/* ============================================
   SAFETY GUARD SERVICE (Injection Safety Rules)
   ============================================ */
window.SafetyGuardService = {
    // Get last injection info
    getLastInjection() {
        const injections = DoseService.getAll();
        return injections.length > 0 ? injections[injections.length - 1] : null;
    },

    // Get dose history for progression check
    getDoseHistory() {
        const injections = DoseService.getAll();
        const doseMap = new Map();

        injections.forEach(inj => {
            const dose = inj.doseMg;
            if (!doseMap.has(dose)) {
                doseMap.set(dose, { firstDate: inj.dateISO, count: 0 });
            }
            doseMap.get(dose).count++;
        });

        return doseMap;
    },

    // Check all safety rules
    check(newInjection) {
        const alerts = [];
        const last = this.getLastInjection();

        if (!last) return alerts; // First injection, no checks needed

        // Rule 1: Dose Jump > 2.5mg
        const doseJump = newInjection.doseMg - last.doseMg;
        if (doseJump > 2.5) {
            alerts.push({
                type: 'dose_jump',
                title: 'Salto de Dose Detectado',
                message: `Risco de choque gástrico! Você está tentando pular etapas de adaptação (${last.doseMg}mg → ${newInjection.doseMg}mg).`
            });
        }

        // Rule 2: Interval < 7 days
        const lastDate = new Date(last.dateISO);
        const newDate = new Date(newInjection.dateISO);
        const daysDiff = Math.floor((newDate - lastDate) / (1000 * 60 * 60 * 24));

        if (daysDiff < 7 && daysDiff >= 0) {
            alerts.push({
                type: 'short_interval',
                title: 'Intervalo Curto',
                message: `Atenção: Intervalo de apenas ${daysDiff} dias. Intervalo inferior a 7 dias pode causar empilhamento perigoso da medicação no sangue.`
            });
        }

        // Rule 3: Rapid Progression (dose increase without 4 weeks on previous)
        if (newInjection.doseMg > last.doseMg) {
            const doseHistory = this.getDoseHistory();
            const lastDoseInfo = doseHistory.get(last.doseMg);

            if (lastDoseInfo) {
                const firstDate = new Date(lastDoseInfo.firstDate);
                const weeksOnDose = Math.floor((newDate - firstDate) / (1000 * 60 * 60 * 24 * 7));

                if (weeksOnDose < 4) {
                    alerts.push({
                        type: 'rapid_progression',
                        title: 'Progressão Rápida',
                        message: `Recomendação clínica: Você está na dose ${last.doseMg}mg há apenas ${weeksOnDose} semana(s). Mantenha a mesma dose por 4 semanas para minimizar efeitos colaterais.`
                    });
                }
            }
        }

        return alerts;
    },

    // Show safety modal
    showModal(alerts, onConfirm) {
        const overlay = document.getElementById('safety-alert-overlay');
        const alertsList = document.getElementById('safety-alerts-list');

        // Render alerts
        alertsList.innerHTML = alerts.map(alert => `
            <div class="safety-alert-item">
                <svg width="20" height="20"><use href="#icon-alert-triangle"></use></svg>
                <div>
                    <strong>${SecurityUtils.escapeHTML(alert.title)}</strong>
                    <p>${SecurityUtils.escapeHTML(alert.message)}</p>
                </div>
            </div>
        `).join('');

        // Setup buttons
        const cancelBtn = document.getElementById('safety-cancel');
        const confirmBtn = document.getElementById('safety-confirm');

        const closeModal = () => {
            overlay.hidden = true;
            cancelBtn.onclick = null;
            confirmBtn.onclick = null;
        };

        cancelBtn.onclick = () => closeModal();
        confirmBtn.onclick = () => {
            closeModal();
            if (onConfirm) onConfirm();
        };

        overlay.hidden = false;
    }
};
