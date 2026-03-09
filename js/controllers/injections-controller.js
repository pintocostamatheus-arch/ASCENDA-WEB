/**
 * Injections & Medication Controller
 * Extracted from app.js — Strangler Fig Pattern
 */
const InjectionsController = {

    saveInjectionSchedule() {
        const dayOfWeek = parseInt(document.getElementById('injection-day').value);
        const time = document.getElementById('injection-time').value;

        // Lê o valor do select de intervalo
        const intervalDays = parseInt(document.getElementById('injection-interval')?.value || 7);

        const history = DoseService.getAll();
        const lastInj = history.length > 0 ? history[history.length - 1] : null;
        const currentSchedule = DoseService.getSchedule() || {};

        const schedule = {
            dayOfWeek,
            time,
            intervalDays,
            drugName: lastInj ? lastInj.drugName : (currentSchedule.drugName || 'Monjaro'),
            doseMg: lastInj ? lastInj.doseMg : (currentSchedule.doseMg || 0)
        };

        DoseService.saveSchedule(schedule);
        UI.toast('Cronograma salvo com sucesso!');
        this.refreshInjectionsTab();
        this.refreshDashboard();
    },

    refreshInjectionsTab() {

        const schedule = DoseService.getSchedule();

        const history = DoseService.getAll();

        const next = DoseService.getNextInjectionDate();


        // Atualiza os campos do cronograma se existirem
        if (schedule) {
            const elDay = document.getElementById('injection-day');
            const elTime = document.getElementById('injection-time');
            if (elDay && schedule.dayOfWeek !== undefined) elDay.value = schedule.dayOfWeek;
            if (elTime && schedule.time) elTime.value = schedule.time;

            // Restaura o select de intervalo
            const elInterval = document.getElementById('injection-interval');
            if (elInterval && schedule.intervalDays) elInterval.value = schedule.intervalDays;
        }


        // 1. Hero Card Updates

        const elCountdown = document.getElementById('dose-hero-countdown');

        const elDate = document.getElementById('dose-hero-date');

        const elSite = document.getElementById('suggested-site-hero');



        if (next) {

            const today = new Date(DateService.today());

            const nextDate = new Date(next);

            const diffDays = Math.ceil((nextDate - today) / (1000 * 60 * 60 * 24));



            if (elCountdown) {

                if (diffDays === 0) elCountdown.textContent = 'Hoje';

                else elCountdown.textContent = `${Math.abs(diffDays)} ${Math.abs(diffDays) === 1 ? 'dia' : 'dias'}${diffDays < 0 ? ' (atrasado)' : ''} `;

            }

            if (elDate) {

                const formatted = DateService.format(next, 'long');

                elDate.textContent = formatted.charAt(0).toUpperCase() + formatted.slice(1) + ' às ' + (schedule?.time || '08:00');

            }

        } else {

            if (elCountdown) elCountdown.textContent = '--';

            if (elDate) elDate.textContent = 'Sem agendamento';

        }



        if (elSite) {

            elSite.textContent = DoseService.formatSite(DoseService.getSuggestedSite());

        }



        // 2b. Update rotation tile status with days since last use

        const lastUsedDates = DoseService.getLastUsedDates();

        const suggestedSite = DoseService.getSuggestedSite();

        const todayMs = new Date(DateService.today()).getTime();



        document.querySelectorAll('.rotation-tile').forEach(tile => {

            const siteKey = tile.dataset.site; // e.g. "abdomen-e"

            const statusEl = tile.querySelector('.tile-statusText');

            if (!statusEl) return;



            // Normalize the suggested site to the same format as data-site

            const normalizedSuggested = (suggestedSite || '').toLowerCase().replace('_', '-');

            if (siteKey === normalizedSuggested) {

                statusEl.textContent = 'Sugerido';

                return;

            }



            // Find last used date for this tile

            const lastDate = lastUsedDates[siteKey];

            if (!lastDate) {

                statusEl.textContent = 'Nunca usado';

                tile.classList.add('tile-never-used');

            } else {

                const diffMs = todayMs - new Date(lastDate).getTime();

                const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

                if (diffDays === 0) statusEl.textContent = 'Usado hoje';

                else if (diffDays === 1) statusEl.textContent = 'Há 1 dia';

                else statusEl.textContent = `Há ${diffDays} dias`;

                tile.classList.remove('tile-never-used');

            }

        });

        this.renderInjectionsList(history);

        this.renderMedicationLevel();



        // 3. Charts

        if (window.Charts && document.getElementById('injection-weight-chart')) {

            Charts.createInjectionWeightChart('injection-weight-chart', this.injectionChartPeriod || 'all');

        }

    },



    registerInjection() {

        const data = {

            dateISO: document.getElementById('injection-date').value,

            time: document.getElementById('injection-time-reg').value,

            drugName: document.getElementById('injection-drug').value,

            doseMg: parseFloat(document.getElementById('injection-dose').value),

            site: document.getElementById('injection-site').value,

            side: document.getElementById('injection-side').value

        };



        // Validation

        if (!data.dateISO || !data.drugName || isNaN(data.doseMg)) {

            return UI.toast('Preencha Medicamento e Dose', 'error');

        }



        // Safety Check

        if (window.SafetyGuardService) {

            const rawAlerts = SafetyGuardService.check(data);

            if (rawAlerts.length > 0) {

                const alerts = rawAlerts.map(a => ({

                    level: 'danger', // Injection alerts are usually critical

                    message: a.message

                }));

                this.showSafetyAlerts(alerts, data, 'injection');

                return;

            }

        }



        // Retatrutide safety check: dose limit from Phase 2 trials

        const drugClass = MedicationLevelService.getDrugClass(data.drugName);

        if (drugClass === 'retatrutida') {

            const params = MedicationLevelService.getParams(data.drugName);

            if (params.maxSafeDoseMg && parseFloat(data.doseMg) > params.maxSafeDoseMg) {

                if (!window.confirm(`⚠️ ALERTA DE SEGURANÇA — Retatrutide\n\nA dose registrada (${data.doseMg}mg) está acima do limite máximo dos ensaios clínicos de Fase 2 (${params.maxSafeDoseMg}mg).\n\nSomente prossiga se orientado pelo seu médico.\n\nDeseja registrar mesmo assim?`)) {

                    return;

                }

            }

        }



        this.finalSaveInjection(data);

    },



    finalSaveInjection(data) {

        DoseService.add(data);

        UI.closeModal('modal-register-injection');

        this.refreshInjectionsTab();

        this.refreshDashboard();

        UI.toast('Aplicação registrada!');

    },



    updateDashboardInjectionCard() {

        const nextDate = DoseService.getNextInjectionDate();

        const lastInj = DoseService.getLastInjection();

        const schedule = DoseService.getSchedule();



        const elDays = document.getElementById('next-injection-days-v10');

        const elDate = document.getElementById('next-injection-date-v10');

        const elDrug = document.getElementById('next-injection-drug-v10');

        const elDose = document.getElementById('next-injection-dose-v10');

        const elBadge = document.getElementById('injection-status-badge');



        if (!elDays || !elDate) return;



        if (!nextDate) {

            elDays.textContent = '--';

            elDate.textContent = 'Sem agendamento';

            if (elDrug) elDrug.textContent = '---';

            if (elDose) elDose.textContent = '---';

            if (elBadge) {

                elBadge.textContent = 'PROGRAMAR';

                elBadge.className = 'status-badge-v10 badge-secondary';

                elBadge.style.backgroundColor = 'rgba(255, 255, 255, 0.15)';

                elBadge.style.color = '#FFFFFF';

            }

            return;

        }



        // Calculate Days Remaining

        const today = new Date(DateService.today());

        const next = new Date(nextDate);

        const diffTime = next - today;

        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));



        if (diffDays === 0) {

            elDays.textContent = 'Hoje';

            if (elBadge) {

                elBadge.textContent = 'DIA DE APLICAR';

                elBadge.className = 'status-badge-v10 badge-warning';

            }

        } else {

            const absDays = Math.abs(diffDays);

            const label = absDays === 1 ? 'Dia' : 'Dias';



            // Smaller font for "Dias" label

            elDays.innerHTML = `${absDays} <span style="font-size: 0.4em; font-weight: 600; text-transform: uppercase; margin-left: 2px;">${label}</span>`;



            if (diffDays < 0) {

                if (elBadge) {

                    elBadge.textContent = 'ATRASADA';

                    elBadge.className = 'status-badge-v10 badge-danger';

                }

            } else {

                if (elBadge) {

                    elBadge.textContent = 'NO PRAZO';

                    elBadge.className = 'status-badge-v10 badge-success'; // Explicit green class if available, or stays standard

                    // Ensure green if standard class doesn't cover it

                    elBadge.style.backgroundColor = 'rgba(16, 185, 129, 0.4)';

                    elBadge.style.color = '#FFFFFF';

                }

            }

        }



        const formattedNextDate = DateService.format(nextDate, 'long');

        elDate.textContent = formattedNextDate.charAt(0).toUpperCase() + formattedNextDate.slice(1);



        if (lastInj) {

            if (elDrug) elDrug.textContent = MedicationLevelService.formatDrugName(lastInj.drugName);

            if (elDose) elDose.textContent = lastInj.doseMg + ' mg';

        } else if (schedule) {

            if (elDrug) elDrug.textContent = MedicationLevelService.formatDrugName(schedule.drugName);

            if (elDose) elDose.textContent = schedule.doseMg + ' mg';

        } else {

            if (elDrug) elDrug.textContent = 'DEFINIR';

            if (elDose) elDose.textContent = '-- mg';

        }

    },



    renderInjectionsList(history) {

        const list = document.getElementById('injections-list');

        if (!list) return;



        if (history.length === 0) {

            list.innerHTML = '<div class="empty-state">Nenhuma aplicação registrada</div>';

            return;

        }



        list.innerHTML = history.slice().reverse().map(i => {

            const drugDisplay = MedicationLevelService.formatDrugName(i.drugName);

            // Handle both new (site+side) and legacy (site used as key) properties

            const siteKey = (i.site && i.side) ? `${i.site} -${i.side} ` : (i.site || '');



            const dateStr = i.dateISO || i.date;

            const fullDate = DateService.format(dateStr, 'short');

            const timeDisplay = i.time || '08:00';

            const itemId = i.id || dateStr;



            return `

    <div class="injection-item">

                    <div class="injection-info-col">

                        <div class="injection-item-date">${SecurityUtils.escapeHTML(fullDate)} - ${SecurityUtils.escapeHTML(timeDisplay)}</div>

                        <div class="injection-item-sub">

                            <strong>${SecurityUtils.escapeHTML(drugDisplay)} ${SecurityUtils.escapeHTML(String(i.doseMg))}mg</strong>

                            <span class="dot-sep">•</span>

                            <span>${SecurityUtils.escapeHTML(DoseService.formatSite(siteKey))}</span>

                        </div>

                    </div>

                    <button class="btn-delete-history" onclick="App.deleteInjection('${SecurityUtils.escapeHTML(String(itemId))}')">

                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">

                            <polyline points="3 6 5 6 21 6"></polyline>

                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>

                        </svg>

                    </button>

                </div>

    `;

        }).join('');

    },



    deleteInjection(id) {

        const targetId = isNaN(id) ? id : Number(id);

        const history = DoseService.getAll();

        const item = history.find(i => (i.id === targetId || i.dateISO === id || i.date === id));



        if (!item) return;



        UI.confirmDelete({

            title: 'Excluir Aplicação',

            message: `Deseja apagar o registro de ${MedicationLevelService.formatDrugName(item.drugName)} do dia ${DateService.format(item.dateISO || item.date, 'short')}?`,

            onConfirm: () => {

                DoseService.delete(targetId);

                this.refreshInjectionsTab();

                this.refreshDashboard();

                UI.toast('Aplicação excluída');

            }

        });

    },



    renderMedicationLevel() {

        if (!window.MedicationLevelService) return;



        const data = MedicationLevelService.getCurrentLevel();

        const elGauge = document.getElementById('med-gauge-fill');

        const elPercent = document.getElementById('med-level-percent');

        const elPhase = document.getElementById('med-phase-badge');

        const elStatus = document.getElementById('med-level-status');

        const elTime = document.getElementById('med-time-elapsed');

        const elTrough = document.getElementById('med-trough-date');



        if (!data) {

            if (elPercent) elPercent.textContent = '0';

            if (elStatus) elStatus.textContent = 'Sem dados';

            return;

        }



        // Percentage & Gauge

        const percent = Math.round(data.level);

        if (elPercent) elPercent.textContent = percent;

        if (elGauge) {

            const circumference = 282.7;

            const offset = circumference - (percent / 100) * circumference;

            elGauge.style.strokeDashoffset = offset;

        }



        // Phase & Status

        if (elPhase) {

            elPhase.textContent = data.phase.toUpperCase();

            elPhase.className = `phase - badge ${data.phase === 'absorção' ? 'phase-rising' : 'phase-falling'} `;

        }



        if (elStatus) {

            if (data.level > 80) elStatus.textContent = 'Pico de Eficácia';

            else if (data.level > 40) elStatus.textContent = 'Nível Estável';

            else elStatus.textContent = 'Nível Baixo';

        }



        // Footer details

        if (elTime) {

            const h = Math.floor(data.hoursElapsed);

            if (h < 24) elTime.textContent = `${h} h`;

            else elTime.textContent = `${Math.floor(h / 24)}d ${h % 24} h`;

        }



        if (elTrough) {

            // Estimate next trough (simplified: last + 7 days)

            const lastDate = new Date(data.lastInjection.dateISO);

            lastDate.setDate(lastDate.getDate() + 7);

            elTrough.textContent = DateService.format(lastDate.toISOString().split('T')[0], 'short');

        }

    },

};

// Strangler Fig: Mixin into App
Object.assign(App, InjectionsController);
