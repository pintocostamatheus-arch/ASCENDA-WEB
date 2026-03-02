/**
 * Weight Management Controller
 * Extracted from app.js — Strangler Fig Pattern
 */
const WeightController = {

saveWeight() {
        const date = document.getElementById('weight-date').value;
        const weight = parseFloat(document.getElementById('weight-value').value);
        if (!date || !weight) return UI.toast('Preencha os dados', 'error');
        WeightService.add(date, weight);
        document.getElementById('weight-value').value = '';
        this.refreshWeightTab();
        this.refreshDashboard();
        // Force refresh of the 'hoje' tab if it's currently active to ensure UI elements like rings update
        if (Router.currentTab === 'hoje') {
            this.refreshTab('hoje');
        }
        UI.toast('Peso salvo!');
    },

    initWeightChartFilters() {
        // Redundant as bindEvents already handles this, but keeping it safe
        document.querySelectorAll('.filter-btn[data-period][data-chart="weight"]').forEach(btn => {
            btn.onclick = () => this.handleChartFilter(btn);
        });
    },

    handleChartFilter(btn) {
        const period = btn.dataset.period;
        const chartType = btn.dataset.chart || 'weight';

        // Update active state for buttons in the same group
        const parent = btn.parentElement;
        if (parent) {
            parent.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        }

        if (chartType === 'weight') {
            this.weightChartPeriod = period;
            this.refreshWeightTab();
        } else if (chartType === 'symptoms') {
            this.symptomsChartPeriod = period;
            this.refreshSymptomsTab();
        } else if (chartType === 'injection-weight') {
            this.injectionChartPeriod = period;
            this.refreshInjectionsTab();
        } else if (chartType === 'report') {
            this.refreshRelatoriosTab(); // Period is handled inside refreshRelatoriosTab via active btn
        }
    },

    refreshWeightTab() {
        const weights = WeightService.getAll();
        Charts.createWeightChart('weight-chart', this.weightChartPeriod);

        const list = document.getElementById('weight-history-list');
        if (list) {
            const header = `
                <div class="history-header">
                    <span>Data</span>
                    <span>Peso</span>
                    <span>IMC</span>
                    <span>Última</span>
                    <span>Total</span>
                    <span></span>
                </div>
            `;

            const rows = weights.slice().reverse().map((w, idx, arr) => {
                const olderEntry = arr[idx + 1];
                const firstEntry = weights[0];

                let ultima = '-';
                let ultimaClass = '';
                if (olderEntry) {
                    const diff = w.weightKg - olderEntry.weightKg;
                    const sign = diff > 0 ? '+' : (diff < 0 ? '' : '+');
                    ultima = sign + (diff || 0).toFixed(1);
                    ultimaClass = diff > 0 ? 'text-danger' : (diff < 0 ? 'text-success' : 'text-muted');
                }

                let total = '-';
                let totalClass = '';
                if (firstEntry && w.dateISO !== firstEntry.dateISO) {
                    const diffTotal = w.weightKg - firstEntry.weightKg;
                    const signTotal = diffTotal > 0 ? '+' : (diffTotal < 0 ? '' : '+');
                    total = signTotal + diffTotal.toFixed(1);
                    totalClass = diffTotal > 0 ? 'text-danger' : (diffTotal < 0 ? 'text-success' : 'text-muted');
                }

                return `
                <div class="history-item">
                        <span class="history-date">${DateService.format(w.dateISO, 'short')}</span>
                        <span class="history-weight"><strong>${w.weightKg.toFixed(1)}</strong> <span class="unit-history">kg</span></span>
                        <span class="history-bmi">${w.bmi.toFixed(1)}</span>
                        <span class="change-val ${ultimaClass}">${ultima}</span>
                        <span class="change-val ${totalClass}">${total}</span>
                        <div class="history-actions">
                            <button class="btn-delete-weight" onclick="App.deleteWeight('${w.dateISO}')" title="Excluir">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M3 6h18"></path>
                                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                                </svg>
                            </button>
                        </div>
                    </div>
                `;
            }).join('');

            list.innerHTML = header + rows;
        }
        this.renderInsights(WeightService.getInsights());
        this.renderDoseAnalysis();
    },

    renderDoseAnalysis() {
        if (!window.DoseAnalysisService) return;
        const container = document.getElementById('dose-analysis-content');
        if (!container) return;

        const analyses = DoseAnalysisService.getLossRateByDose();
        if (!analyses || analyses.length === 0) {
            container.innerHTML = '<p class="text-muted" style="padding: 15px;">Dados insuficientes para análise por períodos de dose.</p>';
            return;
        }

        let html = `
        <div class="dose-analysis-subtitle" style="margin: 16px 0 12px; font-size: 0.75rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; display: flex; justify-content: space-between; align-items: center;">
            <span>TAXA DE PERDA POR DOSE</span>
            <span style="font-size: 0.6rem; opacity: 0.6; font-weight: 500;">(Variação / Semanas)</span>
        </div>
        `;

        html += analyses.map(item => {
            let statusClass = 'healthy'; // Loss (Negative rate)
            if (item.rate > -0.2 && item.rate < 0.2) statusClass = 'plateau';
            else if (item.rate >= 0.2) statusClass = 'gain'; // Weight gain (Positive rate)

            return `
                <div class="dose-pill-card ${statusClass}">
                    <div style="display: flex; flex-direction: column;">
                        <span class="dose-pill-label">${item.dose}mg</span>
                        <span style="font-size: 0.65rem; color: var(--text-muted); margin-top: 4px; font-weight: 600;">
                            ${item.weeks.toFixed(1)} sem • ${item.totalLoss > 0 ? '+' : ''}${item.totalLoss.toFixed(1)}kg
                        </span>
                    </div>
                    <div style="text-align: right;">
                        <span class="dose-pill-value">${item.rate > 0 ? '+' : ''}${item.rate.toFixed(2)}</span>
                        <span style="font-size: 0.7rem; opacity: 0.8; font-weight: 700; margin-left: 2px;">kg/sem</span>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = html;
    },

    renderInsights(insights) {
        if (!insights) return;

        // Card 1 — Perda Total
        const el1 = document.getElementById('insight-avg7');
        if (el1) {
            const sign = insights.totalLoss > 0 ? '+' : '';
            el1.textContent = sign + insights.totalLoss.toFixed(1) + ' kg';
            el1.className = 'insight-value ' + (insights.totalLoss < 0 ? 'text-success' : insights.totalLoss > 0 ? 'text-danger' : '');
        }

        // Card 2 — Peso Atual
        const el2 = document.getElementById('insight-current-weight');
        if (el2) {
            const latest = WeightService.getLatest();
            el2.textContent = latest ? latest.weightKg.toFixed(1) + ' kg' : '--';
            el2.className = 'insight-value';
        }

        // Card 3 — % da Meta ou IMC Atual
        const el3 = document.getElementById('insight-best');
        const el3label = document.getElementById('insight-label-best');
        if (el3) {
            if (insights.goalPercent !== null) {
                el3.textContent = insights.goalPercent + '%';
                el3.className = 'insight-value ' + (insights.goalPercent >= 100 ? 'text-success' : '');
                if (el3label) el3label.textContent = '% da Meta';
            } else {
                el3.textContent = insights.currentBmi.toFixed(1);
                el3.className = 'insight-value';
                if (el3label) el3label.textContent = 'IMC Atual';
            }
        }

        // Card 4 — Ult. Variação
        const el4 = document.getElementById('insight-weekly-var');
        if (el4) {
            const sign = insights.weeklyVar > 0 ? '+' : '';
            el4.textContent = sign + insights.weeklyVar.toFixed(1) + ' kg';
            el4.className = 'insight-value ' + (insights.weeklyVar < 0 ? 'text-success' : insights.weeklyVar > 0 ? 'text-danger' : '');
        }
    },

    deleteWeight(date) {
        UI.confirmDelete({
            title: 'Excluir Peso',
            message: `Deseja apagar o registro de peso do dia ${DateService.format(date, 'short')}?`,
            onConfirm: () => {
                WeightService.delete(date);
                this.refreshWeightTab();
                UI.toast('Peso excluído');
            }
        });
    },

};

// Strangler Fig: Mixin into App
Object.assign(App, WeightController);
