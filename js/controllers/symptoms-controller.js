/**
 * Symptoms Controller
 * Extracted from app.js — Strangler Fig Pattern
 */
const SymptomsController = {

// --- SYMPTOMS V12 ---
refreshSymptomsTab() {
    const today = SymptomsService.getToday();
    SymptomsService.SYMPTOMS.forEach(s => this.symptomValues[s] = today ? (today[s] || 0) : 0);
    this.renderSymptomChecklist();
    this.renderSymptomsRecentHistory();
},

renderSymptomChecklist() {
    const container = document.getElementById('symptoms-checklist');
    if (!container) return;

    let html = SymptomsService.SYMPTOMS.map(s => {
        const val = this.symptomValues[s] || 0;
        const intensityClass = this.getIntensityClass(val);
        return `
    <div class="symptom-card-v12 ${val > 0 ? 'has-value' : ''} ${intensityClass}" id="card-${s}">
                    <div class="symptom-header-v12">
                        <span class="symptom-icon-v12">${this.SYMPTOM_ICONS[s] || '✨'}</span>
                        <span class="symptom-name-v12">${SymptomsService.LABELS[s]}</span>
                    </div>
                    <div class="stepper-v12">
                        <button onclick="App.updateSymptomIntensity('${s}', -1)">-</button>
                        <span id="val-${s}">${val}</span>
                        <button onclick="App.updateSymptomIntensity('${s}', 1)">+</button>
                    </div>
                </div>
    `;
    }).join('');

    // Render Custom Symptoms
    const customNames = SymptomsService.getCustomNames();
    if (customNames.length > 0) {
        html += '<div style="grid-column: 1 / -1; margin-top: 10px; font-size: 0.8rem; font-weight: 700; opacity: 0.6; text-transform: uppercase;">Outros</div>';
        html += customNames.map(name => {
            const val = this.symptomValues[name] || 0;
            const intensityClass = this.getIntensityClass(val);
            return `
    <div class="symptom-card-v12 ${val > 0 ? 'has-value' : ''} ${intensityClass}" id="card-${name}">
                        <div class="symptom-header-v12">
                            <span class="symptom-icon-v12">ðŸ·️</span>
                            <span class="symptom-name-v12">${name}</span>
                        </div>
                        <div class="stepper-v12">
                            <button onclick="App.updateSymptomIntensity('${name}', -1)">-</button>
                            <span id="val-${name}">${val}</span>
                            <button onclick="App.updateSymptomIntensity('${name}', 1)">+</button>
                        </div>
                    </div>
    `;
        }).join('');
    }

    container.innerHTML = html;
},

getIntensityClass(val) {
    if (val === 0) return '';
    if (val <= 3) return 'intensity-low';
    if (val <= 7) return 'intensity-mid';
    return 'intensity-high';
},

addCustomSymptomRow() {
    const name = prompt('Nome do sintoma:');
    if (name && name.trim()) {
        SymptomsService.saveCustomName(name.trim());
        this.refreshSymptomsTab();
    }
},

updateSymptomIntensity(s, delta) {
    const val = Math.max(0, Math.min(10, (this.symptomValues[s] || 0) + delta));
    this.symptomValues[s] = val;

    const valEl = document.getElementById(`val-${s}`);
    const cardEl = document.getElementById(`card-${s}`);

    if (valEl) valEl.textContent = val;
    if (cardEl) {
        cardEl.classList.toggle('has-value', val > 0);

        // Update intensity classes
        cardEl.classList.remove('intensity-low', 'intensity-mid', 'intensity-high');
        const intensityClass = this.getIntensityClass(val);
        if (intensityClass) cardEl.classList.add(intensityClass);
    }
},

saveSymptoms() {
    try {
        const today = DateService.today();
        const note = document.getElementById('symptom-note')?.value || '';

        // Current symptoms to be saved
        const currentEntry = {
            dateISO: today,
            note,
            ...this.symptomValues
        };

        // Get history including potential new entry for analysis
        const history = SymptomsService.getHistory(30);

        // Re-run analysis with current entry
        const alerts = SymptomsService.analyze([currentEntry, ...history]);

        if (alerts.length > 0) {
            this.showSafetyAlerts(alerts, currentEntry);
        } else {
            this.finalSaveSymptoms(currentEntry);
        }
    } catch (e) {
        console.error('App: Erro ao salvar sintomas:', e);
        UI.toast('Erro ao salvar!', 'error');
    }
},

showSafetyAlerts(alerts, data, type = 'symptoms') {
    const list = document.getElementById('safety-alerts-list');
    if (!list) return;

    list.innerHTML = alerts.map(a => `
    <div class="safety-alert-item ${a.level || 'warning'}">
        <strong>${(a.level === 'danger') ? '🚨 CRÍTICO' : '⚠️ AVISO'}:</strong> ${a.message}
            </div>
    `).join('');

    const overlay = document.getElementById('safety-alert-overlay');
    const confirmBtn = document.getElementById('safety-confirm');
    const cancelBtn = document.getElementById('safety-cancel');

    if (confirmBtn) confirmBtn.onclick = () => {
        overlay.hidden = true;
        if (type === 'symptoms') {
            this.finalSaveSymptoms(data);
        } else if (type === 'injection') {
            this.finalSaveInjection(data);
        }
    };
    if (cancelBtn) cancelBtn.onclick = () => {
        overlay.hidden = true;
    };

    overlay.hidden = false;
},

finalSaveSymptoms(data) {
    SymptomsService.save(data.dateISO, data);
    UI.toast('Sintomas Salvos!');

    // Clear note after save
    if (document.getElementById('symptom-note')) {
        document.getElementById('symptom-note').value = '';
    }

    this.refreshSymptomsTab();
},

openHistoryModal() {
    const history = SymptomsService.getHistory(100);
    const list = document.getElementById('symptoms-full-list');
    if (!list) return;

    list.innerHTML = history.map(h => {
        const active = SymptomsService.getActiveSymptoms(h);
        const custom = SymptomsService.getActiveCustomSymptoms(h);
        const allSymptoms = [...active, ...custom];

        return `
                <div class="history-item-compact" style="margin-bottom: 12px; border-bottom: 1px solid var(--border-color); padding-bottom: 12px;">
        <div class="history-header-row">
            <span class="history-date">${DateService.format(h.dateISO, 'long')}</span>
            <button class="btn-delete-item" onclick="App.deleteSymptomRecord('${h.dateISO}')">🗑️</button>
        </div>
                    ${h.note ? `<div class="history-note">"${h.note}"</div>` : ''}
<div class="history-tags-cloud">
    ${allSymptoms.map(s => {
            const intensityClass = this.getIntensityClass(s.value);
            return `<span class="history-tag-inline ${intensityClass}">${s.label}: ${s.value}</span>`;
        }).join('')}
</div>
                </div>
            `;
    }).join('');

    UI.openModal('modal-sintomas-completo');
},

renderSymptomsRecentHistory() {
    const history = SymptomsService.getHistory(30); // Get all to check total
    const container = document.getElementById('symptoms-recent-list');
    if (!container) return;

    const limit = 5;
    const displayHistory = history.slice(0, limit);
    const hasMore = history.length > limit;

    let html = displayHistory.map(h => {
        const active = SymptomsService.getActiveSymptoms(h);
        const custom = SymptomsService.getActiveCustomSymptoms(h);
        const allSymptoms = [...active, ...custom];

        return `
                <div class="history-item-compact">
        <div class="history-header-row">
            <span class="history-date">${DateService.format(h.dateISO, 'short')}</span>
            <button class="btn-delete-item" onclick="App.deleteSymptomRecord('${h.dateISO}')">🗑️</button>
        </div>
                    ${h.note ? `<div class="history-note">"${h.note}"</div>` : ''}
<div class="history-tags-cloud">
    ${allSymptoms.map(s => `<span class="history-tag-inline">${s.label}: ${s.value}</span>`).join('')}
</div>
                </div>
            `;
    }).join('');

    const historyBtn = document.querySelector('#tab-sintomas .card-action-btn');
    if (historyBtn) historyBtn.style.display = (history.length > 0) ? 'block' : 'none';

    if (history.length === 0) {
        html = '<div class="empty-state">Nenhum registro encontrado</div>';
    }

    container.innerHTML = html;
},

    async deleteSymptomRecord(dateISO) {
    UI.confirmDelete({
        title: 'Excluir Registro',
        message: `Deseja realmente apagar o registro de sintomas do dia ${DateService.format(dateISO, 'short')}?`,
        onConfirm: () => {
            try {
                const deleted = SymptomsService.delete(dateISO);
                if (deleted) {
                    UI.toast('Registro excluído');
                    this.refreshSymptomsTab();
                } else {
                    UI.toast('Erro ao excluir', 'error');
                }
            } catch (e) {
                console.error('App: Erro ao deletar:', e);
                UI.toast('Falha na exclusão', 'error');
            }
        }
    });
},

};

// Strangler Fig: Mixin into App
Object.assign(App, SymptomsController);
