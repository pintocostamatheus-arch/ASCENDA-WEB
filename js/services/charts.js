/* ============================================
   DYNAMIC DOSE COLOR SYSTEM
   ============================================ */
const DoseColorManager = {
    // Curated array of 12 visually distinct colors
    palette: [
        '#EC4899', // Pink
        '#F97316', // Orange  
        '#EAB308', // Yellow
        '#10B981', // Emerald
        '#06B6D4', // Cyan
        '#3B82F6', // Blue
        '#6366F1', // Indigo
        '#8B5CF6', // Violet
        '#EF4444', // Red
        '#14B8A6', // Teal
        '#84CC16', // Lime
        '#A855F7', // Fuchsia
    ],

    // Map to store assigned colors: "drugName-doseMg" -> color
    assignedColors: {},
    nextColorIndex: 0,

    /**
     * Get a unique color for a drug+dose combination
     * Same combination always returns same color within session
     */
    getColor(drugName, doseMg) {
        const key = `${drugName.toLowerCase()}-${doseMg}`;

        if (!this.assignedColors[key]) {
            // Assign next color from palette (circular)
            this.assignedColors[key] = this.palette[this.nextColorIndex % this.palette.length];
            this.nextColorIndex++;
        }

        return this.assignedColors[key];
    },

    /**
     * Reset color assignments (useful for fresh render)
     */
    reset() {
        this.assignedColors = {};
        this.nextColorIndex = 0;
    }
};

// Legacy function for backward compatibility
function getDoseColor(mg) {
    // Default to pink for legacy calls without drug name
    return DoseColorManager.palette[0];
}

/* ============================================
   CHARTS SERVICE
   ============================================ */
window.Charts = {
    instances: {},
    weightChartPeriod: '30',
    symptomsChartPeriod: '30',

    destroy(canvasId) {
        if (this.instances[canvasId]) {
            this.instances[canvasId].destroy();
            delete this.instances[canvasId];
        }
    },

    createWeightChart(canvasId = 'weight-chart', period = '30') {
        this.destroy(canvasId);
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        // Dynamic Theme Colors
        const style = getComputedStyle(document.documentElement);
        const getVar = (name) => style.getPropertyValue(name).trim();
        const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';

        const primaryRgb = getVar('--color-primary-rgb') || '16, 185, 129';
        const primaryColor = getVar('--color-primary') || '#10B981';
        const secondaryColor = getVar('--color-secondary') || '#3B82F6';

        const themeColors = {
            lineColor: primaryColor,
            lineGradientStart: `rgba(${primaryRgb}, ${isDarkMode ? 0.3 : 0.15})`,
            lineGradientEnd: `rgba(${primaryRgb}, 0.05)`,
            pointColor: primaryColor,
            maLineColor: secondaryColor, // Moving average in secondary color (Blue) for contrast
            gridColor: getVar('--border-color') || '#E2E8F0',
            tickColor: getVar('--text-secondary') || '#64748B',
            legendColor: getVar('--text-tertiary') || '#94A3B8'
        };

        let weights = WeightService.getMovingAverage();
        if (period !== 'all') {
            weights = DateService.filterByPeriod(weights, parseInt(period));
        }

        if (weights.length === 0) return;

        const labels = weights.map(w => DateService.format(w.dateISO));
        const data = weights.map(w => w.weightKg);

        const showBMI = document.getElementById('toggle-bmi')?.checked;
        const showMA = document.getElementById('toggle-average')?.checked;

        // Create gradient for fill
        const ctx = canvas.getContext('2d');
        const gradient = ctx.createLinearGradient(0, 0, 0, 400); // Fixed large height
        gradient.addColorStop(0, themeColors.lineGradientStart);
        gradient.addColorStop(1, themeColors.lineGradientEnd);

        const datasets = [{
            label: 'Peso (kg)',
            data: weights.map(w => w.weightKg),
            borderColor: themeColors.lineColor,
            backgroundColor: gradient,
            fill: 'start', // Fill to bottom
            tension: 0.4,
            borderWidth: 3,
            pointRadius: 4,
            pointBackgroundColor: themeColors.pointColor,
            pointBorderColor: isDarkMode ? 'rgba(124, 154, 255, 0.6)' : themeColors.pointColor,
            pointBorderWidth: 2
        }];

        if (showMA) {
            datasets.push({
                label: 'Média Móvel 7d',
                data: weights.map(w => w.ma),
                borderColor: themeColors.maLineColor,
                borderDash: [5, 5],
                fill: false,
                tension: 0.4,
                borderWidth: 2,
                pointRadius: 0
            });
        }

        const injections = DoseService.getAll();
        const injDates = new Set(injections.map(i => i.dateISO));

        this.instances[canvasId] = new Chart(canvas, {
            type: 'line',
            data: {
                labels: weights.map(w => DateService.format(w.dateISO)),
                datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: {
                        display: datasets.length > 1,
                        position: 'bottom',
                        labels: {
                            color: themeColors.legendColor,
                            font: { size: 11, weight: '500' },
                            usePointStyle: true,
                            padding: 15
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        grid: {
                            color: themeColors.gridColor,
                            lineWidth: 1
                        },
                        ticks: {
                            color: themeColors.tickColor,
                            font: { size: 11, weight: '500' },
                            padding: 8
                        },
                        border: { display: false }
                    },
                    x: {
                        grid: {
                            display: true,
                            color: themeColors.gridColor,
                            lineWidth: 1
                        },
                        ticks: {
                            color: themeColors.tickColor,
                            font: { size: 10, weight: '500' },
                            padding: 6
                        },
                        border: { display: false }
                    }
                }
            }
        });
    },

    createSymptomsChart(canvasId = 'symptoms-chart', period = '30') {
        this.destroy(canvasId);
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        let symptoms = SymptomsService.getAll();
        if (period !== 'all') {
            symptoms = DateService.filterByPeriod(symptoms, parseInt(period));
        }

        if (symptoms.length === 0) return;

        // Aggregate by date and score
        const dailyScores = {};
        symptoms.forEach(s => {
            // Score: 0 (None) to 3 (Severe)
            const scoreMap = { 'Nenhum': 0, 'Leve': 1, 'Moderado': 2, 'Intenso': 3 };
            const score = scoreMap[s.intensity] || 0;
            if (score > 0) {
                if (!dailyScores[s.dateISO]) dailyScores[s.dateISO] = 0;
                dailyScores[s.dateISO] += score;
            }
        });

        const sortedDates = Object.keys(dailyScores).sort();
        const data = sortedDates.map(d => dailyScores[d]);
        const labels = sortedDates.map(d => DateService.format(d));

        const style = getComputedStyle(document.documentElement);
        const getVar = (n) => style.getPropertyValue(n).trim();
        const dangerColor = getVar('--danger') || '#EF4444';
        const warningColor = getVar('--warning') || '#F59E0B';
        const successColor = getVar('--success') || '#10B981';

        this.instances[canvasId] = new Chart(canvas, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Intensidade de Efeitos',
                    data: data,
                    backgroundColor: data.map(v => {
                        if (v > 3) return dangerColor;
                        if (v > 1) return warningColor;
                        return successColor;
                    }),
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { y: { min: 0 } }
            }
        });
    },

    createInjectionWeightChart(canvasId = 'injection-weight-chart', period = 'all') {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        this.destroy(canvasId);

        const weightsRaw = WeightService.getAll();
        if (weightsRaw.length === 0) return;

        // Dynamic Theme Colors
        const style = getComputedStyle(document.documentElement);
        const getVar = (name) => style.getPropertyValue(name).trim();
        const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';

        const primaryRgb = getVar('--color-primary-rgb') || '16, 185, 129';
        const primaryColor = getVar('--color-primary') || '#10B981';
        const secondaryColor = getVar('--color-secondary') || '#3B82F6';

        // Use primary color for main chart elements to match theme
        const themeColors = {
            lineColor: primaryColor,
            lineGradientStart: `rgba(${primaryRgb}, ${isDarkMode ? 0.3 : 0.15})`,
            lineGradientEnd: `rgba(${primaryRgb}, 0.05)`,
            pointDefault: primaryColor,
            gridColor: getVar('--border-color') || '#E2E8F0',
            tickColor: getVar('--text-secondary') || '#64748B',
            doseMarkerColor: secondaryColor, // Use secondary (often blue/purple) for dose markers
            tooltipBg: isDarkMode ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
            tooltipTitle: getVar('--text-main') || '#0F172A',
            tooltipBody: getVar('--text-secondary') || '#64748B'
        };

        // 1. Combine ALL Dates (Union) first
        const injections = DoseService.getAll();
        const dateSet = new Set();
        weightsRaw.forEach(w => dateSet.add(w.dateISO));
        injections.forEach(i => dateSet.add(i.dateISO));
        let sortedDates = Array.from(dateSet).sort();

        // 2. Filter by Period
        if (period !== 'all') {
            const days = parseInt(period);
            const today = new Date(DateService.today());
            const cutoffDate = new Date(today);
            cutoffDate.setDate(today.getDate() - days);
            const cutoffISO = cutoffDate.toISOString().split('T')[0];

            sortedDates = sortedDates.filter(d => d >= cutoffISO);
        }

        // 3. Prepare Maps
        const injMap = {};
        injections.forEach(i => injMap[i.dateISO] = i);
        const weightMap = {};
        weightsRaw.forEach(w => weightMap[w.dateISO] = w.weightKg);

        // 4. Interpolation Helper
        const getInterpWeight = (targetDateISO) => {
            if (weightMap[targetDateISO] !== undefined) return weightMap[targetDateISO];
            const targetTime = new Date(targetDateISO).getTime();
            let prev = null, next = null;
            for (let w of weightsRaw) {
                const t = new Date(w.dateISO).getTime();
                if (t < targetTime) prev = w;
                else if (t > targetTime && !next) { next = w; break; }
            }
            if (prev && next) {
                const prevTime = new Date(prev.dateISO).getTime();
                const nextTime = new Date(next.dateISO).getTime();
                const ratio = (targetTime - prevTime) / (nextTime - prevTime);
                return (prev.weightKg || 0) + ((next.weightKg || 0) - (prev.weightKg || 0)) * ratio;
            } else if (prev) return prev.weightKg || 0;
            else if (next) return next.weightKg || 0;
            return 0;
        };

        // Reset color manager for fresh assignment order
        DoseColorManager.reset();

        const usedDosesMap = {};

        // 5. Build Chart Data
        const chartData = sortedDates.map(dateISO => {
            const weight = getInterpWeight(dateISO);
            const injection = injMap[dateISO];
            const isRealWeight = weightMap[dateISO] !== undefined;

            let doseColor = null;
            if (injection) {
                const normalizedDrugName = MedicationLevelService.formatDrugName(injection.drugName);
                doseColor = DoseColorManager.getColor(normalizedDrugName, injection.doseMg);

                const key = `${normalizedDrugName.toLowerCase()}-${injection.doseMg}`;

                if (!usedDosesMap[key]) {
                    usedDosesMap[key] = {
                        drug: normalizedDrugName,
                        dose: injection.doseMg,
                        color: doseColor
                    };
                }
            }

            return {
                dateISO,
                date: DateService.format(dateISO),
                weight,
                injection,
                isRealWeight,
                doseColor
            };
        });

        if (chartData.length === 0) return;

        // Create gradient for fill - Height based (fill entire chart area)
        const ctx = canvas.getContext('2d');
        const gradient = ctx.createLinearGradient(0, 0, 0, 400); // Fixed large height to ensure coverage
        gradient.addColorStop(0, themeColors.lineGradientStart);
        gradient.addColorStop(1, themeColors.lineGradientEnd);

        // Styling parameters (Reduced sizes)
        const INJ_RADIUS = 6;
        const WEIGHT_RADIUS = 3;
        const INJ_HOVER_RADIUS = 9;
        const WEIGHT_HOVER_RADIUS = 5;

        // Build point styling arrays
        const pointColors = chartData.map(d => {
            if (d.injection) return d.doseColor;
            return themeColors.pointDefault;
        });

        const pointRadius = chartData.map(d => {
            if (d.injection) return INJ_RADIUS;
            if (d.isRealWeight) return WEIGHT_RADIUS;
            return 0;
        });

        const pointBorderColors = chartData.map(d => {
            if (d.injection) return d.doseColor;
            return 'transparent';
        });

        const pointBorderWidth = chartData.map(d => {
            if (d.injection) return 2;
            return 0;
        });


        this.instances[canvasId] = new Chart(canvas, {
            type: 'line',
            data: {
                labels: chartData.map(d => d.date),
                datasets: [{
                    label: 'Peso / Aplicações', // Generic label, custom legend used
                    data: chartData.map(d => d.weight),
                    borderColor: themeColors.lineColor,
                    backgroundColor: gradient,
                    fill: 'start',
                    tension: 0.3,
                    borderWidth: 3,
                    pointRadius: pointRadius,
                    pointHoverRadius: chartData.map(d => d.injection ? INJ_HOVER_RADIUS : WEIGHT_HOVER_RADIUS),
                    pointBackgroundColor: pointColors,
                    pointBorderColor: pointBorderColors,
                    pointBorderWidth: pointBorderWidth
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                },
                plugins: {
                    legend: { display: false }, // Use custom HTML legend
                    tooltip: {
                        enabled: true,
                        backgroundColor: themeColors.tooltipBg,
                        titleColor: themeColors.tooltipTitle,
                        bodyColor: themeColors.tooltipBody,
                        padding: 12,
                        cornerRadius: 8,
                        titleFont: { size: 13, weight: 'bold' },
                        bodyFont: { size: 12 },
                        displayColors: true,
                        callbacks: {
                            label: function (context) {
                                const idx = context.dataIndex;
                                const item = chartData[idx];
                                const lines = [`Peso: ${(item.weight || 0).toFixed(1)} kg`];
                                if (item.injection) {
                                    const drugName = MedicationLevelService.formatDrugName(item.injection.drugName);
                                    lines.push(`💉 ${drugName} ${item.injection.doseMg}mg`);
                                }
                                return lines;
                            },
                            labelColor: function (context) {
                                const idx = context.dataIndex;
                                const item = chartData[idx];
                                return {
                                    borderColor: item.injection ? item.doseColor : themeColors.lineColor,
                                    backgroundColor: item.injection ? item.doseColor : themeColors.lineColor
                                };
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        grid: {
                            color: themeColors.gridColor,
                            lineWidth: 1,
                            drawBorder: false
                        },
                        ticks: {
                            color: themeColors.tickColor,
                            font: { size: 11, weight: '500' },
                            padding: 8
                        }
                    },
                    x: {
                        grid: {
                            display: true,
                            color: themeColors.gridColor,
                            lineWidth: 1,
                            drawBorder: false
                        },
                        ticks: {
                            color: themeColors.tickColor,
                            font: { size: 10, weight: '500' },
                            padding: 6,
                            maxRotation: 0,
                            autoSkip: true,
                            maxTicksLimit: 6
                        }
                    }
                }
            }
        });

        // Generate Custom Legend HTML
        const legendContainer = document.getElementById('dose-legend-container');
        if (legendContainer) {
            legendContainer.innerHTML = '';
            // usedDosesMap keys need to be sorted to ensure consistent order (e.g. by dose)
            const sortedKeys = Object.keys(usedDosesMap).sort((a, b) => usedDosesMap[a].dose - usedDosesMap[b].dose);

            if (sortedKeys.length === 0) {
                legendContainer.style.display = 'none';
            } else {
                // Remove inline display style to let CSS !important take over
                legendContainer.style.display = '';
                legendContainer.classList.add('visible');

                // Group by drug
                const drugsMap = {};
                sortedKeys.forEach(key => {
                    const item = usedDosesMap[key];
                    if (!drugsMap[item.drug]) drugsMap[item.drug] = [];
                    drugsMap[item.drug].push(item);
                });

                // Display each drug group
                Object.keys(drugsMap).sort().forEach(drug => {
                    const groupDiv = document.createElement('div');
                    groupDiv.className = 'legend-drug-group';
                    groupDiv.style.display = 'flex';
                    groupDiv.style.flexDirection = 'column';
                    groupDiv.style.gap = '4px';
                    groupDiv.style.marginBottom = '8px';

                    const items = drugsMap[drug].sort((a, b) => a.dose - b.dose);

                    items.forEach((item, index) => {
                        const legItem = document.createElement('div');
                        legItem.className = 'legend-item';
                        legItem.style.display = 'flex';
                        legItem.style.alignItems = 'center';
                        legItem.style.gap = '6px';
                        legItem.style.justifyContent = 'flex-start';

                        if (index === 0) {
                            legItem.innerHTML = `
                                <span style="font-weight: 600; min-width: 85px; text-align: right;">${SecurityUtils.escapeHTML(item.drug)}</span>
                                <span class="legend-dot" style="background-color: ${item.color}; box-shadow: 0 0 6px ${item.color}40; margin: 0;"></span>
                                <span>${item.dose}mg</span>
                            `;
                        } else {
                            legItem.innerHTML = `
                                <span style="font-weight: 600; min-width: 85px; text-align: right; visibility: hidden;">${SecurityUtils.escapeHTML(item.drug)}</span>
                                <span class="legend-dot" style="background-color: ${item.color}; box-shadow: 0 0 6px ${item.color}40; margin: 0;"></span>
                                <span>${item.dose}mg</span>
                            `;
                        }
                        groupDiv.appendChild(legItem);
                    });

                    legendContainer.appendChild(groupDiv);
                });
            }
        }
    },

    createMedicationLevelChart(canvasId = 'medication-level-chart') {
        const checkCanvas = document.getElementById(canvasId);
        if (!checkCanvas) return;
        this.destroy(canvasId);

        const activeInjections = DoseService.getAll().filter(i => i.dateISO <= DateService.today());
        if (activeInjections.length === 0) {
            return;
        }

        const data = MedicationLevelService.getChartData();
        if (!data) return;

        const ctx = checkCanvas.getContext('2d');
        const style = getComputedStyle(document.documentElement);
        const getVar = (name) => style.getPropertyValue(name).trim();
        const primaryColor = getVar('--color-primary') || '#10B981';
        const primaryRgb = getVar('--color-primary-rgb') || '16, 185, 129';
        const gridColor = getVar('--border-color') || '#e2e8f0';
        const textColor = getVar('--text-secondary') || '#64748B';

        // Gradient Fill
        const gradient = ctx.createLinearGradient(0, 0, 0, 300);
        gradient.addColorStop(0, `rgba(${primaryRgb}, 0.2)`);
        gradient.addColorStop(1, `rgba(${primaryRgb}, 0.0)`);

        // Find peak index for custom label
        const peakIndex = data.points.findIndex(p => p.isPeak);
        const currentIndex = data.points.findIndex(p => p.isCurrent);

        this.instances[canvasId] = new Chart(checkCanvas, {
            type: 'line',
            data: {
                labels: data.points.map((p, idx) => {
                    const dayNum = (idx * (7 / (data.points.length - 1))).toFixed(1);
                    if (idx === peakIndex) return `Pico (${Math.round(dayNum)}d)`;
                    return `Dia ${dayNum}`;
                }),
                datasets: [{
                    label: 'Nível Plasmático',
                    data: data.points.map(p => p.level),
                    borderColor: primaryColor,
                    backgroundColor: gradient,
                    borderWidth: 3,
                    pointRadius: (ctx) => {
                        const idx = ctx.dataIndex;
                        const p = data.points[idx];
                        if (p.isPeak) return 8; // Adjusted to 8px per user request
                        if (p.isCurrent) return 8;
                        return 0;
                    },
                    pointBackgroundColor: (ctx) => {
                        const idx = ctx.dataIndex;
                        const p = data.points[idx];
                        if (p.isPeak) return '#EF4444';
                        if (p.isCurrent) return '#F59E0B';
                        return primaryColor;
                    },
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointStyle: (ctx) => {
                        const idx = ctx.dataIndex;
                        const p = data.points[idx];
                        if (p.isPeak || p.isCurrent) return 'circle'; // Restore balls for key points
                        return false; // No point for regular line
                    },
                    fill: true,
                    tension: 0.4,
                    order: 1
                },
                // DUMMY DATASETS FOR LEGEND
                {
                    label: 'Pico Máximo',
                    data: [],
                    backgroundColor: '#EF4444',
                    borderColor: '#EF4444',
                    pointStyle: 'circle',
                    order: 2
                },
                {
                    label: 'Nível Atual',
                    data: [],
                    backgroundColor: '#F59E0B',
                    borderColor: '#F59E0B',
                    pointStyle: 'circle',
                    order: 3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'bottom',
                        labels: {
                            color: textColor,
                            font: { size: 10, weight: '500' },
                            usePointStyle: true,
                            padding: 15,
                            filter: function (item, chart) {
                                // Hide "Nível Plasmático" (main dataset) from legend
                                return item.text !== 'Nível Plasmático';
                            }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            title: function (context) {
                                const idx = context[0].dataIndex;
                                const p = data.points[idx];
                                return p.date.toLocaleString('pt-BR', { weekday: 'long', hour: '2-digit', minute: '2-digit' });
                            },
                            label: function (context) {
                                const val = context.raw || 0;
                                return `Nível: ${val.toFixed(1)}%`;
                            }
                        }
                    },
                    annotation: {
                        annotations: {
                            currentLine: {
                                type: 'line',
                                xMin: currentIndex,
                                xMax: currentIndex,
                                borderColor: '#F59E0B',
                                borderWidth: 2,
                                borderDash: [5, 5],
                                label: {
                                    display: true,
                                    content: 'Agora',
                                    position: 'start',
                                    backgroundColor: '#F59E0B',
                                    color: 'white',
                                    font: { size: 10, weight: 'bold' },
                                    yAdjust: -10
                                }
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 105,
                        grid: { color: gridColor, borderDash: [5, 5] },
                        ticks: {
                            display: true,
                            color: textColor,
                            font: { size: 10 },
                            stepSize: 20,
                            callback: function (value) { return value + '%'; }
                        },
                        title: {
                            display: true,
                            text: 'Nível (%)',
                            color: textColor,
                            font: { size: 11, weight: '500' }
                        }
                    },
                    x: {
                        grid: {
                            display: true,
                            color: gridColor,
                            lineWidth: 1
                        },
                        ticks: {
                            color: textColor,
                            font: { size: 11 },
                            maxTicksLimit: 8,
                            maxRotation: 0
                        }
                    }
                }
            }
        });
    }
};
