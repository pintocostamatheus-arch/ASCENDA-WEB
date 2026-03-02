/* ============================================
   NOTIFICATION SERVICE
   Web Push API — agendamento pelo servidor Supabase.
   Funciona em iOS 16.4+, Android, Desktop.
   ============================================ */
window.NotificationService = {

    // ─── VAPID PUBLIC KEY ──────────────────────
    // Preencha após gerar as chaves VAPID (ver instruções no README).
    // Comando: npx web-push generate-vapid-keys
    VAPID_PUBLIC_KEY: 'BMRH4U0Xs06rbjtnZC4Q2i7WLIfLD9nSueu28YtG4FRZdEcyGlicqVpktBTXLMatKqyq4kOa8y8j7_pmkWsHwK0',

    // ─── DEFAULTS ──────────────────────────────
    DEFAULT_SETTINGS: {
        enabled: false,
        timezone_offset: -3,        // UTC-3 (Brasília). Ajuste se necessário.
        dose: {
            enabled: true,
            minutesBefore: 0
        },
        water: {
            enabled: true,
            startHour: 8,
            endHour: 20,
            intervalHours: 2
        },
        weight: {
            enabled: true,
            dayOfWeek: 1,
            time: '08:00'
        },
        symptoms: {
            enabled: true,
            hoursAfter: 4
        },
        meals: {
            enabled: false,
            breakfast: '08:00',
            lunch: '12:00',
            dinner: '19:00'
        }
    },

    // ─── GETTERS / SETTERS ─────────────────────
    getSettings() {
        return StorageService.getSafe(
            StorageService.KEYS.NOTIFICATION_SETTINGS,
            JSON.parse(JSON.stringify(this.DEFAULT_SETTINGS))
        );
    },

    saveSettings(settings) {
        StorageService.set(StorageService.KEYS.NOTIFICATION_SETTINGS, settings);
        // Sincroniza com o Supabase para que o servidor possa ler
        this._syncSettingsToCloud(settings).catch(e =>
            console.warn('NotificationService: falha ao sincronizar settings:', e)
        );
    },

    async _syncSettingsToCloud(settings) {
        const user = await SupabaseService.getUser();
        if (!user) return;
        await SupabaseService.update('profiles', { notification_settings: settings }, { id: user.id });
    },

    // ─── PERMISSÃO ─────────────────────────────
    getPermissionStatus() {
        if (!('Notification' in window)) return 'unsupported';
        return Notification.permission; // 'default' | 'granted' | 'denied'
    },

    async requestPermission() {
        if (!('Notification' in window)) return { granted: false, reason: 'unsupported' };
        if (Notification.permission === 'granted') return { granted: true };
        if (Notification.permission === 'denied') return { granted: false, reason: 'denied' };
        const result = await Notification.requestPermission();
        return { granted: result === 'granted', reason: result };
    },

    // ─── AGENDAMENTO PRINCIPAL ─────────────────

    /**
     * Garante que o dispositivo está inscrito no Push Manager e
     * sincroniza as preferências com o Supabase.
     * O servidor (Edge Function + pg_cron) decide quando enviar.
     */
    async scheduleAll() {
        const settings = this.getSettings();

        if (!settings.enabled) {
            await this._unsubscribeFromPush();
            return;
        }

        if (this.getPermissionStatus() !== 'granted') return;

        if (!('PushManager' in window)) {
            console.warn('NotificationService: PushManager não disponível neste browser.');
            return;
        }

        if (!this.VAPID_PUBLIC_KEY) {
            console.warn('NotificationService: VAPID_PUBLIC_KEY não configurada. Configure em notifications.js.');
            return;
        }

        await this._ensureSubscribed();
        await this._syncSettingsToCloud(settings);
    },

    // ─── PUSH SUBSCRIPTION ─────────────────────

    async _ensureSubscribed() {
        if (!navigator.serviceWorker) return;
        try {
            const reg = await navigator.serviceWorker.ready;
            let sub = await reg.pushManager.getSubscription();

            if (!sub) {
                sub = await reg.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: this._urlBase64ToUint8Array(this.VAPID_PUBLIC_KEY)
                });
                console.log('NotificationService: inscrito no Push Manager.');
            }

            await this._saveSubscriptionToCloud(sub);
        } catch (e) {
            console.error('NotificationService: erro ao inscrever no Push:', e.message);
        }
    },

    async _saveSubscriptionToCloud(subscription) {
        const user = await SupabaseService.getUser();
        if (!user) return;

        const json = subscription.toJSON();
        const client = SupabaseService.getClient();

        const { error } = await client
            .from('push_subscriptions')
            .upsert({
                user_id: user.id,
                endpoint: json.endpoint,
                p256dh: json.keys.p256dh,
                auth: json.keys.auth,
                device_info: navigator.userAgent.slice(0, 250)
            }, { onConflict: 'user_id,endpoint' });

        if (error) console.error('NotificationService: falha ao salvar subscription:', error.message);
        else console.log('NotificationService: subscription salva no Supabase.');
    },

    async _unsubscribeFromPush() {
        if (!navigator.serviceWorker) return;
        try {
            const reg = await navigator.serviceWorker.ready;
            const sub = await reg.pushManager.getSubscription();
            if (sub) {
                const endpoint = sub.endpoint;
                await sub.unsubscribe();

                const user = await SupabaseService.getUser();
                if (user) {
                    const client = SupabaseService.getClient();
                    await client.from('push_subscriptions')
                        .delete()
                        .eq('user_id', user.id)
                        .eq('endpoint', endpoint);
                }
                console.log('NotificationService: push subscription removida.');
            }
        } catch (e) {
            console.warn('NotificationService: erro ao desinscrever:', e.message);
        }
    },

    async isSubscribed() {
        if (!navigator.serviceWorker || !('PushManager' in window)) return false;
        try {
            const reg = await navigator.serviceWorker.ready;
            const sub = await reg.pushManager.getSubscription();
            return !!sub;
        } catch {
            return false;
        }
    },

    // ─── HELPERS ───────────────────────────────

    // Converte a VAPID public key de base64 para Uint8Array
    _urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    },

    getPermissionLabel() {
        const status = this.getPermissionStatus();
        if (status === 'granted') {
            return { text: 'Ativo — push nativo', color: 'var(--color-success, #10B981)' };
        }
        const map = {
            denied: { text: 'Bloqueado — libere nas configurações do browser', color: '#ef4444' },
            default: { text: 'Permissão não concedida ainda', color: 'var(--text-muted, #9ca3af)' },
            unsupported: { text: 'Não suportado neste browser', color: '#f59e0b' }
        };
        return map[status] || map.default;
    }
};
