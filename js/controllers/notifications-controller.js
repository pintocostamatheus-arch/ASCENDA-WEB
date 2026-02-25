/* ============================================
   NOTIFICATIONS CONTROLLER
   Gerencia o modal de preferências de notificação.
   ============================================ */
App.initNotifications = function () {

    // ─── Escuta mensagens do SW (navegar para tab) ──────────────
    if (navigator.serviceWorker) {
        navigator.serviceWorker.addEventListener('message', (e) => {
            if (e.data?.type === 'NAVIGATE_TAB' && e.data.tab) {
                if (window.Router) Router.navigate(e.data.tab);
            }
        });
    }

    // ─── Elementos do modal ─────────────────────────────────────
    const modal            = document.getElementById('modal-notificacoes');
    if (!modal) return;

    const masterToggle     = document.getElementById('notif-master-toggle');
    const permStatusEl     = document.getElementById('notif-permission-status');
    const settingsBody     = document.getElementById('notif-settings-body');

    // Dose
    const doseToggle       = document.getElementById('notif-dose-toggle');
    const doseMinSel       = document.getElementById('notif-dose-minutes');

    // Água
    const waterToggle      = document.getElementById('notif-water-toggle');
    const waterStartSel    = document.getElementById('notif-water-start');
    const waterEndSel      = document.getElementById('notif-water-end');
    const waterIntervalSel = document.getElementById('notif-water-interval');

    // Peso
    const weightToggle     = document.getElementById('notif-weight-toggle');
    const weightDaySel     = document.getElementById('notif-weight-day');
    const weightTimeInput  = document.getElementById('notif-weight-time');

    // Sintomas
    const sympToggle       = document.getElementById('notif-symptoms-toggle');
    const sympHoursSel     = document.getElementById('notif-symptoms-hours');

    // Refeições
    const mealsToggle      = document.getElementById('notif-meals-toggle');
    const mealsBreakfast   = document.getElementById('notif-meals-breakfast');
    const mealsLunch       = document.getElementById('notif-meals-lunch');
    const mealsDinner      = document.getElementById('notif-meals-dinner');

    const btnSave          = document.getElementById('btn-notif-save');

    // ─── Helper: verifica se uma <option value> existe no select ──
    function selectHasOption(sel, val) {
        if (!sel) return false;
        return Array.from(sel.options).some(o => o.value === String(val));
    }

    // ─── Popula a UI com os settings salvos ────────────────────
    function loadUI() {
        // Limpa localStorage antigo/inválido se startHour ou endHour forem inválidos
        const raw = localStorage.getItem('monjaro_notification_settings');
        if (raw) {
            try {
                const parsed = JSON.parse(raw);
                const sh = parsed?.water?.startHour;
                const eh = parsed?.water?.endHour;
                // Valores inválidos (ex: 0, 2 de implementação anterior)
                if (sh < 5 || sh > 14 || eh < 13 || eh > 23) {
                    localStorage.removeItem('monjaro_notification_settings');
                }
            } catch { localStorage.removeItem('monjaro_notification_settings'); }
        }

        const s = NotificationService.getSettings();
        const perm = NotificationService.getPermissionLabel();

        // Status de permissão
        if (permStatusEl) {
            permStatusEl.textContent = perm.text;
            permStatusEl.style.color = perm.color;
        }

        // Master toggle
        if (masterToggle) masterToggle.checked = s.enabled;
        updateBodyVisibility(s.enabled);

        // Dose
        if (doseToggle)  doseToggle.checked           = s.dose?.enabled ?? true;
        if (doseMinSel)  doseMinSel.value             = String(s.dose?.minutesBefore ?? 0);

        // Água — garante que o valor existe nas options, senão usa default
        const startHour = s.water?.startHour ?? 8;
        const endHour   = s.water?.endHour   ?? 20;
        if (waterToggle)      waterToggle.checked     = s.water?.enabled ?? true;
        if (waterStartSel)    waterStartSel.value     = selectHasOption(waterStartSel, startHour) ? String(startHour) : '8';
        if (waterEndSel)      waterEndSel.value       = selectHasOption(waterEndSel, endHour)     ? String(endHour)   : '20';
        if (waterIntervalSel) waterIntervalSel.value  = String(s.water?.intervalHours ?? 2);

        // Peso
        if (weightToggle)    weightToggle.checked     = s.weight?.enabled ?? true;
        if (weightDaySel)    weightDaySel.value       = String(s.weight?.dayOfWeek ?? 1);
        if (weightTimeInput) weightTimeInput.value    = s.weight?.time ?? '08:00';

        // Sintomas
        if (sympToggle)   sympToggle.checked          = s.symptoms?.enabled ?? true;
        if (sympHoursSel) sympHoursSel.value          = String(s.symptoms?.hoursAfter ?? 4);

        // Refeições
        if (mealsToggle)    mealsToggle.checked       = s.meals?.enabled ?? false;
        if (mealsBreakfast) mealsBreakfast.value      = s.meals?.breakfast ?? '08:00';
        if (mealsLunch)     mealsLunch.value          = s.meals?.lunch    ?? '12:00';
        if (mealsDinner)    mealsDinner.value         = s.meals?.dinner   ?? '19:00';
    }

    function updateBodyVisibility(enabled) {
        if (settingsBody) {
            settingsBody.style.opacity = enabled ? '1' : '0.4';
            settingsBody.style.pointerEvents = enabled ? '' : 'none';
        }
    }

    // ─── Master toggle: pede permissão ao ligar ─────────────────
    if (masterToggle) {
        masterToggle.addEventListener('change', async () => {
            if (masterToggle.checked) {
                const { granted, reason } = await NotificationService.requestPermission();
                if (!granted) {
                    masterToggle.checked = false;
                    const msg = reason === 'denied'
                        ? 'Notificações bloqueadas. Libere nas configurações do browser.'
                        : 'Permissão necessária para ativar notificações.';
                    if (window.UI) UI.toast(msg, 'error', 4000);
                    return;
                }
                if (permStatusEl) {
                    const perm = NotificationService.getPermissionLabel();
                    permStatusEl.textContent = perm.text;
                    permStatusEl.style.color = perm.color;
                }
            }
            updateBodyVisibility(masterToggle.checked);
        });
    }

    // ─── Salvar ─────────────────────────────────────────────────
    if (btnSave) {
        btnSave.addEventListener('click', async () => {
            const settings = {
                enabled: masterToggle?.checked ?? false,
                dose: {
                    enabled: doseToggle?.checked ?? true,
                    minutesBefore: parseInt(doseMinSel?.value ?? '0', 10)
                },
                water: {
                    enabled: waterToggle?.checked ?? true,
                    startHour: parseInt(waterStartSel?.value ?? '8', 10),
                    endHour: parseInt(waterEndSel?.value ?? '20', 10),
                    intervalHours: parseInt(waterIntervalSel?.value ?? '2', 10)
                },
                weight: {
                    enabled: weightToggle?.checked ?? true,
                    dayOfWeek: parseInt(weightDaySel?.value ?? '1', 10),
                    time: weightTimeInput?.value ?? '08:00'
                },
                symptoms: {
                    enabled: sympToggle?.checked ?? true,
                    hoursAfter: parseInt(sympHoursSel?.value ?? '4', 10)
                },
                meals: {
                    enabled: mealsToggle?.checked ?? false,
                    breakfast: mealsBreakfast?.value ?? '08:00',
                    lunch: mealsLunch?.value    ?? '12:00',
                    dinner: mealsDinner?.value  ?? '19:00'
                }
            };

            NotificationService.saveSettings(settings);
            await NotificationService.scheduleAll();

            if (window.UI) {
                UI.toast('Preferências de notificação salvas!', 'success');
                UI.closeModal('modal-notificacoes');
            }
        });
    }

    // ─── Abre o modal: carrega a UI ─────────────────────────────
    const btnOpenNotif = document.getElementById('btn-open-notificacoes');
    if (btnOpenNotif) {
        btnOpenNotif.addEventListener('click', () => {
            loadUI();
            if (window.UI) UI.openModal('modal-notificacoes');
        });
    }
};
