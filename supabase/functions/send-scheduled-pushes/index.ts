/**
 * ASCENDA — Edge Function: send-scheduled-pushes
 *
 * Chamada pelo pg_cron a cada 15 minutos.
 * Verifica quais usuários têm notificações devidas agora
 * e envia os Web Push correspondentes.
 *
 * Deploy: supabase functions deploy send-scheduled-pushes
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push";

// ─── Configuração VAPID ────────────────────────────────────────────────────────
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
let VAPID_EMAIL = Deno.env.get("VAPID_EMAIL") || "mailto:contato@ascenda.app";

// Garante que o email tenha o prefixo mailto: (evita erro 400 Bad Request no Web Push)
if (!VAPID_EMAIL.startsWith("mailto:") && !VAPID_EMAIL.startsWith("https:")) {
  VAPID_EMAIL = `mailto:${VAPID_EMAIL}`;
}

webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

// ─── Supabase Admin ───────────────────────────────────────────────────────────
const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// ─── Janela de tolerância (minutos) ──────────────────────────────────────────
// pg_cron roda a cada 1 min. WINDOW_MINUTES = 0 garante disparo exato,
// sem duplicatas. Aumentar apenas se o cron for alterado para > 1 min.
const WINDOW_MINUTES = 0;

// ─── Handler principal ────────────────────────────────────────────────────────
// CORS headers for security
const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") || "https://ascenda.app",
  "Access-Control-Allow-Methods": "POST",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // ─── Segurança: valida CRON_SECRET (fail-closed: sem secret = negar tudo)
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret) {
    console.error("CRON_SECRET not configured — denying all requests.");
    return new Response(JSON.stringify({ ok: false, error: "Server misconfigured" }), {
      status: 500,
      headers: CORS_HEADERS,
    });
  }
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();
  if (token !== cronSecret) {
    return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
      status: 401,
      headers: CORS_HEADERS,
    });
  }

  const now = new Date();
  const results: Array<{ tag: string; ok: boolean; error?: string }> = [];

  try {
    // 1. Busca todas as subscriptions com dados do perfil + cronograma
    const { data: subs, error: subError } = await supabaseAdmin
      .from("push_subscriptions")
      .select("user_id, endpoint, p256dh, auth");

    if (subError) throw subError;
    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0 }), {
        headers: CORS_HEADERS,
      });
    }

    // 2. Busca todos os perfis e cronogramas de uma vez (evita N+1)
    const userIds = [...new Set(subs.map((s) => s.user_id))];

    const [{ data: profiles }, { data: schedules }] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id, notification_settings, drug")
        .in("id", userIds),
      supabaseAdmin
        .from("injection_schedule")
        .select("user_id, day_of_week, time")
        .in("user_id", userIds),
    ]);

    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
    const scheduleMap = new Map((schedules ?? []).map((s) => [s.user_id, s]));

    for (const userId of userIds) {
      const profile = profileMap.get(userId);
      const settings = profile?.notification_settings;
      if (!settings?.enabled) continue;

      const schedule = scheduleMap.get(userId) ?? null;

      // Calcula horário local do usuário
      const tzOffset = settings.timezone_offset ?? -3;
      const localNow = new Date(now.getTime() + tzOffset * 60 * 60 * 1000);
      const localHour = localNow.getUTCHours();
      const localMinute = localNow.getUTCMinutes();
      const localDow = localNow.getUTCDay();
      const localNowMinutes = localHour * 60 + localMinute;

      const userSubs = subs.filter((s) => s.user_id === userId);
      const toSend: Array<{ title: string; body: string; tag: string; data: Record<string, string> }> = [];

      // ── DEBUG ─────────────────────────────────
      console.log(`[DEBUG] userId=${userId} | UTC=${now.toISOString()} | localHour=${localHour} | localMinute=${localMinute} | localDow=${localDow} | tzOffset=${tzOffset}`);
      console.log(`[DEBUG] master.enabled=${settings?.enabled} | water.enabled=${settings.water?.enabled} | startH=${settings.water?.startHour} | endH=${settings.water?.endHour} | interval=${settings.water?.intervalHours}`);
      console.log(`[DEBUG] userSubs.length=${userSubs.length} | localNowMinutes=${localNowMinutes}`);

      // ── 1. Lembrete de Dose ──────────────────
      if (schedule && settings.dose?.enabled && schedule.day_of_week === localDow && schedule.time) {
        const [sh, sm] = schedule.time.split(":").map(Number);
        const targetMinutes = sh * 60 + sm - (settings.dose.minutesBefore ?? 0);
        if (Math.abs(localNowMinutes - targetMinutes) <= WINDOW_MINUTES) {
          const drugName = formatDrugName(profile?.drug);
          toSend.push({
            title: "Lembrete de Dose",
            body: `Hoje é dia da sua injeção de ${drugName}!`,
            tag: "dose",
            data: { tab: "injecoes" },
          });
        }
      }

      // ── 2. Hidratação ────────────────────────
      if (settings.water?.enabled) {
        const startH = settings.water.startHour ?? 8;
        const endH = settings.water.endHour ?? 20;
        const interval = settings.water.intervalHours ?? 2;

        if (localHour >= startH && localHour <= endH) {
          const minutesSinceStart = localNowMinutes - startH * 60;
          const intervalMinutes = interval * 60;
          const remainder = minutesSinceStart % intervalMinutes;
          if (remainder <= WINDOW_MINUTES) {
            toSend.push({
              title: "Hora de se Hidratar!",
              body: "Beba um copo de água agora. Hidratação é fundamental no tratamento.",
              tag: `water_${localHour}`,
              data: { tab: "hoje" },
            });
          }
        }
      }

      console.log(`[DEBUG] toSend após water=${toSend.length}`);

      // ── 3. Pesagem Semanal ───────────────────
      if (settings.weight?.enabled) {
        const [wh, wm] = (settings.weight.time ?? "08:00").split(":").map(Number);
        if (settings.weight.dayOfWeek === localDow) {
          const targetMinutes = wh * 60 + wm;
          if (Math.abs(localNowMinutes - targetMinutes) <= WINDOW_MINUTES) {
            toSend.push({
              title: "Que tal se pesar hoje?",
              body: "Registre seu peso e acompanhe seu progresso na jornada.",
              tag: "weight",
              data: { tab: "peso" },
            });
          }
        }
      }

      // ── 4. Sintomas Pós-dose ─────────────────
      if (schedule && settings.symptoms?.enabled && schedule.time) {
        const [dh, dm] = schedule.time.split(":").map(Number);
        const hoursAfter = settings.symptoms.hoursAfter ?? 4;
        const rawTarget = dh * 60 + dm + hoursAfter * 60;
        // Suporte a horários que ultrapassam meia-noite (ex: injeção às 22h + 4h = 02h do dia seguinte)
        const targetMinutes = rawTarget % (24 * 60);
        const targetDow = rawTarget >= 24 * 60
          ? (schedule.day_of_week + 1) % 7
          : schedule.day_of_week;
        if (targetDow === localDow && Math.abs(localNowMinutes - targetMinutes) <= WINDOW_MINUTES) {
          toSend.push({
            title: "Como está se sentindo?",
            body: "Registre seus sintomas após a aplicação de hoje.",
            tag: "symptoms",
            data: { tab: "sintomas" },
          });
        }
      }

      // ── 5. Refeições ─────────────────────────
      if (settings.meals?.enabled) {
        const slots = [
          { key: "breakfast", title: "Café da Manhã", body: "Não esqueça de registrar o que você comeu no café da manhã." },
          { key: "lunch", title: "Hora do Almoço", body: "Registre seu almoço e mantenha seu acompanhamento nutricional em dia." },
          { key: "dinner", title: "Hora do Jantar", body: "Registre seu jantar e feche o dia com seu acompanhamento completo." },
        ];
        for (const slot of slots) {
          const timeStr = settings.meals[slot.key];
          if (!timeStr) continue;
          const [mh, mm] = timeStr.split(":").map(Number);
          const targetMinutes = mh * 60 + mm;
          if (Math.abs(localNowMinutes - targetMinutes) <= WINDOW_MINUTES) {
            toSend.push({
              title: slot.title,
              body: slot.body,
              tag: `meal_${slot.key}`,
              data: { tab: "hoje" },
            });
          }
        }
      }

      // ── Envia as notificações devidas (em paralelo) ─────────
      const sendTasks: Promise<void>[] = [];
      for (const notif of toSend) {

        // --- 🔒 VALIDAÇÃO DE ESQUEMA DO PAYLOAD 🔒 ---
        // Previne XSS, quebra de UI no mobile nativo e payloads massivos
        if (typeof notif.title !== "string" || notif.title.length > 150) {
          console.error(`Status 400: Título inválido ou extenso na tag ${notif.tag}`);
          continue;
        }
        if (typeof notif.body !== "string" || notif.body.length > 500) {
          console.error(`Status 400: Corpo inválido ou extenso na tag ${notif.tag}`);
          continue;
        }
        // ----------------------------------------------

        for (const sub of userSubs) {
          sendTasks.push(
            webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              JSON.stringify(notif)

            ).then(() => {
              results.push({ tag: notif.tag, ok: true });
            }).catch(async (e: any) => {
              console.error(`[SEND ERROR] tag=${notif.tag} | status=${e.statusCode} | msg=${e.message}`);
              results.push({ tag: notif.tag, ok: false, error: e.message });
              if (e.statusCode === 410) {
                await supabaseAdmin
                  .from("push_subscriptions")
                  .delete()
                  .eq("endpoint", sub.endpoint);
                console.log("NotificationService: subscription expirada removida:", sub.endpoint);
              }
            })
          );
        }
      }
      await Promise.all(sendTasks);
    }

    console.log(`send-scheduled-pushes: ${results.filter((r) => r.ok).length} enviadas.`);
    return new Response(
      JSON.stringify({ ok: true, sent: results.filter((r) => r.ok).length }),
      { headers: CORS_HEADERS }
    );
  } catch (err: any) {
    console.error("send-scheduled-pushes ERROR:", err);
    return new Response(JSON.stringify({ ok: false, error: "Internal error" }), {
      status: 500,
      headers: CORS_HEADERS,
    });
  }
});

// ─── Helper: nome do medicamento ──────────────────────────────────────────────
function formatDrugName(drug?: string | null): string {
  if (!drug) return "GLP-1";
  const map: Record<string, string> = {
    sg: "Semaglutida", semaglutida: "Semaglutida",
    ozempic: "Semaglutida", wegovy: "Semaglutida",
    tg: "Tirzepatida", tirzepatida: "Tirzepatida",
    mounjaro: "Tirzepatida", zepbound: "Tirzepatida",
    rt: "Retatrutida", retatrutida: "Retatrutida",
  };
  return map[drug.toLowerCase()] ?? drug;
}
