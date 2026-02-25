/* ============================================
   REPORT SERVICE (PDF Generation)
   ============================================ */
window.ReportService = {
    /**
     * Generate a professional PDF report with date filtering
     */
    async generate(period = 30) { // Adapter: app.js calls generate(period), user code had generatePDF(options) or similar. 
        // User code signature: async generatePDF(options = {})
        // I will align it to match app.js expectation OR update app.js. 
        // App.js calls: ReportService.generate(period)
        // I will map period to startDate/endDate options here.

        let options = {};
        if (typeof period === 'object') {
            options = period; // If called with options object directly
        } else {
            // Convert period number to date range
            const end = new Date();
            const start = new Date();
            start.setDate(start.getDate() - period);
            options = {
                startDate: start,
                endDate: end,
                includeChart: true,
                includeTable: true,
                includeAnalysis: true,
                includeMeasure: true,
                includePhotos: true
            };
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        // ---------------------------------------------------------
        // 1. DADOS & CONFIG
        // ---------------------------------------------------------
        const startDate = options.startDate ? new Date(options.startDate) : null;
        const endDate = options.endDate ? new Date(options.endDate) : new Date();

        let weights = WeightService.getAll().sort((a, b) => a.dateISO.localeCompare(b.dateISO));
        let injections = DoseService.getAll().sort((a, b) => a.dateISO.localeCompare(b.dateISO)); // User code had InjectionService, but app.js uses DoseService. I will use DoseService.
        let measurements = [];
        if (window.JourneyService) {
            const j = JourneyService.get();
            if (j && j.measurements) {
                measurements = j.measurements.sort((a, b) => a.dateISO.localeCompare(b.dateISO)).reverse();
            }
        }
        // User code had JourneyService.get().measurements.
        // I need to check if JourneyService.get() returns object with measurements array.
        // App.js calls JourneyService.addMilestone, etc.

        // Helper: Find nearest weight for a given date (within 7 days)
        const findNearestWeight = (dateISO) => {
            if (!dateISO) return null;
            const targetDate = new Date(dateISO).getTime();
            let nearest = null;
            let minDiff = Infinity;

            const allWeights = WeightService.getAll();
            for (const w of allWeights) {
                const diff = Math.abs(new Date(w.dateISO).getTime() - targetDate);
                if (diff < minDiff) {
                    minDiff = diff;
                    nearest = w;
                }
            }

            // Return weight if within 7 days
            if (nearest && minDiff <= 7 * 24 * 60 * 60 * 1000) {
                return nearest.weightKg;
            }
            return null;
        };

        if (startDate) {
            // Fix: Use string comparison for inclusive filtering (YYYY-MM-DD vs YYYY-MM-DD)
            // This avoids timezone issues where 00:00:00 might be < itemDate if itemDate has time
            const startStr = options.startDate.toISOString().split('T')[0];
            const endStr = options.endDate.toISOString().split('T')[0];

            weights = weights.filter(w => w.dateISO >= startStr && w.dateISO <= endStr);
            injections = injections.filter(i => i.dateISO >= startStr && i.dateISO <= endStr);
        }

        if (weights.length === 0) {
            UI.toast('Sem dados no período selecionado', 'error');
            return null;
        }

        const profile = ProfileService.get();
        const weightsDesc = [...weights].reverse();

        // Colors & Style (Professional Light Palette)
        const colBrand = [40, 54, 127];      // Navy #28367F
        const colAccent = [240, 125, 34];    // Orange #F07D22
        const colTextMain = [51, 51, 51];    // Anthracite #333333
        const colTextLight = [100, 116, 139]; // Slate 500
        const colGrid = [242, 242, 242];     // Light Gray

        const colRed = [239, 68, 68];
        const colGreen = [34, 197, 94];

        const margin = 15;
        const pageWidth = doc.internal.pageSize.getWidth();
        const contentWidth = pageWidth - (margin * 2);

        let y = 0; // Initialize Y

        // ---------------------------------------------------------
        // 2. PIXEL-PERFECT HEADER (300 DPI Canvas Capture)
        // ---------------------------------------------------------
        const periodStr = startDate
            ? `${startDate.toLocaleDateString('pt-BR')} - ${endDate.toLocaleDateString('pt-BR')}`
            : `Até ${endDate.toLocaleDateString('pt-BR')}`;

        const headerImg = await this.renderHeaderCanvas(periodStr);
        if (headerImg) {
            const headerImgH = pageWidth * (95 / 600); // Proportional to canvas aspect ratio
            doc.addImage(headerImg, 'PNG', 0, 0, pageWidth, headerImgH, undefined, 'FAST');
            y = headerImgH + 15;
        } else {
            y = 30;
        }

        // Simple divider below header
        doc.setDrawColor(226, 232, 240); // Slate 200
        doc.setLineWidth(0.3);
        doc.line(margin, y - 8, pageWidth - margin, y - 8);

        // ---------------------------------------------------------
        // 3. TÍTULO & INFO DO PACIENTE (Professional & Dense)
        // ---------------------------------------------------------

        // Title
        doc.setFontSize(18);
        doc.setTextColor(...colBrand);
        doc.setFont('helvetica', 'bold');
        doc.text('Relatório de Acompanhamento', margin, y);
        y += 7;

        // Subtitle / Patient - HIGH DENSITY
        doc.setFontSize(9);
        doc.setTextColor(...colTextMain);
        doc.setFont('helvetica', 'normal');

        const initialW = weights[0].weightKg.toFixed(1);
        const goalW = profile.weightGoalKg ? profile.weightGoalKg + ' kg' : 'N/D';
        const height = profile.heightCm ? profile.heightCm + ' cm' : 'N/D';
        const patientLine1 = `PACIENTE: ${profile.name ? profile.name.toUpperCase() : 'NÃO INFORMADO'}`;

        let patientAge = '--';
        const birthdate = profile.birthdate || profile.birthDate;
        if (birthdate) {
            const birth = new Date(birthdate);
            const todayDate = new Date();
            let age = todayDate.getFullYear() - birth.getFullYear();
            const m = todayDate.getMonth() - birth.getMonth();
            if (m < 0 || (m === 0 && todayDate.getDate() < birth.getDate())) age--;
            patientAge = age + ' anos';
        }

        const patientLine2 = `IDADE: ${patientAge}  |  ALTURA: ${height}  |  PESO INICIAL: ${initialW} kg  |  META: ${goalW}`;

        doc.setFont('helvetica', 'bold');
        doc.text(patientLine1, margin, y);
        y += 5;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...colTextLight);
        doc.text(patientLine2, margin, y);

        y += 12;

        // ---------------------------------------------------------
        // 4. KPI DASHBOARD (Dense)
        // ---------------------------------------------------------
        const initialWeight = weights[0].weightKg;
        const currentWeight = weights[weights.length - 1].weightKg;
        const totalLoss = (initialWeight - currentWeight).toFixed(1);
        const days = Math.floor((new Date(weights[weights.length - 1].dateISO) - new Date(weights[0].dateISO)) / (1000 * 60 * 60 * 24));
        const weeks = Math.max(days / 7, 1);
        const totalRate = (parseFloat(totalLoss) / weeks).toFixed(2);

        // Revert KPI to Total Average as requested
        let rate = totalRate;
        let rateLabel = 'Taxa Média';

        let goalPrediction = '---';
        if (profile.weightGoalKg && parseFloat(rate) > 0) {
            const remaining = currentWeight - profile.weightGoalKg;
            if (remaining <= 0) goalPrediction = 'Atingida!';
            else {
                const dailyRate = parseFloat(rate) / 7;
                goalPrediction = Math.ceil(remaining / dailyRate) + ' dias';
            }
        }

        const kpiW = (contentWidth - 10) / 3;
        const kpiH = 22;

        const drawKPI = (x, label, value) => {
            // Background
            doc.setFillColor(248, 250, 252); // Slate 50
            doc.setDrawColor(226, 232, 240); // Slate 200
            doc.roundedRect(x, y, kpiW, kpiH, 1, 1, 'FD');

            // Label
            doc.setFontSize(7);
            doc.setTextColor(...colTextLight);
            doc.setFont('helvetica', 'bold');
            doc.text(label.toUpperCase(), x + 4, y + 8);

            // Value
            doc.setFontSize(12);
            doc.setTextColor(...colBrand);
            doc.text(value, x + 4, y + 17);
        };

        drawKPI(margin, 'Perda Total', `-${totalLoss} kg`);
        drawKPI(margin + kpiW + 5, rateLabel, `${rate} kg/sem`);
        drawKPI(margin + (kpiW * 2) + 10, 'Previsão Meta', goalPrediction);

        // Second Row for context
        y += kpiH + 5;
        drawKPI(margin, 'Peso Inicial', `${initialWeight.toFixed(1)} kg`);
        drawKPI(margin + kpiW + 5, 'Peso Atual', `${currentWeight.toFixed(1)} kg`);
        // Calculate BMI using latest weight
        const currentBMI = WeightService.calculateBMI(currentWeight, profile.heightCm);
        drawKPI(margin + (kpiW * 2) + 10, 'IMC Atual', currentBMI.toFixed(1));

        y += kpiH + 15;

        // ---------------------------------------------------------
        // 5. GRÁFICO (Protocolo Alta Fidelidade - 300 DPI)
        // ---------------------------------------------------------
        if (options.includeChart && weights.length >= 2) {
            doc.setFontSize(10);
            doc.setTextColor(...colBrand);
            doc.setFont('helvetica', 'bold');
            doc.text('EVOLUÇÃO PONDERAL E DOSES', margin, y);
            y += 8;

            const chartImg = await this.renderChartCanvas(weights, injections);
            if (chartImg) {
                // FIXED HEIGHT for consistency
                const chartH = 85;
                doc.addImage(chartImg, 'PNG', margin, y, contentWidth, chartH, undefined, 'FAST');
                y += chartH + 5;

                // --- LEGEND (Fixed & Normalized) ---
                // Normalize drug names to avoid "TG 2.5" vs "tg 2.5" duplicates
                const uniqueDoses = new Set();
                injections.forEach(i => {
                    const name = window.MedicationLevelService ? MedicationLevelService.formatDrugName(i.drugName) : (i.drugName || 'Tirzepatida');
                    const normalizedName = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
                    // Store as stringified JSON to maintain structure
                    uniqueDoses.add(JSON.stringify({ drug: normalizedName, dose: i.doseMg }));
                });

                // Parse back and sort
                const doses = Array.from(uniqueDoses).map(s => JSON.parse(s)).sort((a, b) => {
                    if (a.drug !== b.drug) return a.drug.localeCompare(b.drug);
                    return parseFloat(a.dose) - parseFloat(b.dose);
                });

                doc.setFontSize(8);
                doc.setFont('helvetica', 'normal');
                let legX = margin + 2;

                // Reset garante ordem consistente entre legenda e canvas do PDF
                if (window.DoseColorManager) DoseColorManager.reset();

                doses.forEach(item => {
                    // 1. Text (Drug)
                    doc.setTextColor(100, 116, 139); // Slate-500
                    doc.text(item.drug, legX, y + 2.5);
                    legX += doc.getTextWidth(item.drug) + 4;

                    // 2. Dot — cor da paleta por dose
                    const hexColor = window.DoseColorManager
                        ? DoseColorManager.getColor(item.drug, item.dose)
                        : '#EC4899';
                    const r = parseInt(hexColor.slice(1, 3), 16);
                    const g = parseInt(hexColor.slice(3, 5), 16);
                    const b = parseInt(hexColor.slice(5, 7), 16);
                    doc.setFillColor(r, g, b);
                    doc.setDrawColor(r, g, b);
                    doc.circle(legX, y + 1.5, 1.5, 'F');
                    legX += 5; // space after dot

                    // 3. Text (Dose)
                    const doseText = `${item.dose}mg`;
                    doc.setTextColor(100, 116, 139);
                    doc.text(doseText, legX, y + 2.5);

                    legX += doc.getTextWidth(doseText) + 14;
                });
                y += 15;
            } else {
                y += 10;
            }
        }

        // ---------------------------------------------------------
        // 6. HISTÓRICO DE APLICAÇÕES (Compact Table)
        // ---------------------------------------------------------
        if (injections.length > 0) {
            doc.setFontSize(10);
            doc.setTextColor(...colBrand);
            doc.setFont('helvetica', 'bold');
            doc.text('REGISTRO DE APLICAÇÕES', margin, y);
            y += 5;

            // Header
            const drawInjHeader = (curY) => {
                doc.setFillColor(241, 245, 249);
                doc.rect(margin, curY, contentWidth, 6, 'F');
                doc.setFontSize(7);
                doc.setTextColor(...colTextLight);
                doc.setFont('helvetica', 'bold');

                const cols = [margin + 2, margin + 30, margin + 80, margin + 120];
                doc.text('DATA', cols[0], curY + 4);
                doc.text('MEDICAMENTO', cols[1], curY + 4);
                doc.text('DOSE', cols[2], curY + 4);
                doc.text('LOCAL', cols[3], curY + 4);
            };

            drawInjHeader(y);
            y += 6;

            // Rows
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...colTextMain);

            const cols = [margin + 2, margin + 30, margin + 80, margin + 120];

            injections.forEach((inj, i) => {
                // Pagination check
                if (y > 270) {
                    doc.addPage();
                    y = 30;
                    drawInjHeader(y);
                    y += 6;
                    doc.setFont('helvetica', 'normal');
                    doc.setTextColor(...colTextMain);
                }

                if (i % 2 !== 0) {
                    doc.setFillColor(250, 250, 250);
                    doc.rect(margin, y, contentWidth, 5, 'F');
                }

                // Safe drug name access
                const drugName = inj.drugName || 'Tirzepatida';
                // Try to get refined name if available in global MedicationLevelService
                let medicationDisplay = drugName.toUpperCase();
                if (window.MedicationLevelService) {
                    medicationDisplay = MedicationLevelService.formatDrugName(drugName);
                }

                doc.text(DateService.format(inj.dateISO), cols[0], y + 3.5);
                doc.text(medicationDisplay, cols[1], y + 3.5);
                doc.text(`${inj.doseMg} mg`, cols[2], y + 3.5);
                // Safe site access
                const site = inj.site || 'N/D';
                // Try format if available
                const siteFormatted = window.InjectionService && InjectionService.formatSite ? InjectionService.formatSite(site) : site;
                doc.text(siteFormatted, cols[3], y + 3.5);
                y += 5;
            });
            y += 10;
        }

        // ---------------------------------------------------------
        // 6b. EFICÁCIA POR DOSE
        // ---------------------------------------------------------
        if (injections.length >= 2) {
            if (y > 245) { doc.addPage(); y = 30; }
            doc.setFontSize(10);
            doc.setTextColor(...colBrand);
            doc.setFont('helvetica', 'bold');
            doc.text('EFICÁCIA POR DOSE (RESUMO)', margin, y);
            y += 8;

            // Agrupa injeções em fases consecutivas de mesma dose
            const dosePhases = [];
            let activePhase = null;
            [...injections].sort((a, b) => a.dateISO.localeCompare(b.dateISO)).forEach(inj => {
                const key = `${(inj.drugName || 'tirzepatida').toLowerCase()}_${inj.doseMg}`;
                if (!activePhase || activePhase.key !== key) {
                    if (activePhase) dosePhases.push(activePhase);
                    activePhase = { key, drugName: inj.drugName || 'Tirzepatida', doseMg: inj.doseMg, startDate: inj.dateISO, endDate: inj.dateISO, count: 1 };
                } else { activePhase.endDate = inj.dateISO; activePhase.count++; }
            });
            if (activePhase) dosePhases.push(activePhase);

            const rowH = 8;
            dosePhases.forEach((phase, i) => {
                if (y > 270) { doc.addPage(); y = 30; }

                // Background zebra
                if (i % 2 === 0) {
                    doc.setFillColor(248, 250, 252);
                    doc.rect(margin, y, contentWidth, rowH, 'F');
                }

                const wS = findNearestWeight(phase.startDate);
                const wE = findNearestWeight(phase.endDate);
                const lossKg = (wS && wE) ? wS - wE : null;
                const dDays = Math.floor((new Date(phase.endDate) - new Date(phase.startDate)) / 86400000);
                const dWeeks = Math.max(dDays / 7, 1);

                const lossStr = lossKg !== null ? `${lossKg >= 0 ? '-' : '+'}${Math.abs(lossKg).toFixed(1)} kg` : '--';
                const rateStr = (lossKg !== null && lossKg > 0) ? `${(lossKg / dWeeks).toFixed(2)} kg/sem` : '--';
                const drugLabel = window.MedicationLevelService ? MedicationLevelService.formatDrugName(phase.drugName) : phase.drugName;

                const c1 = margin + 2;       // Medicação
                const c2 = margin + 50;      // Semanas
                const c3 = margin + 90;      // Perda Total
                const c4 = margin + 130;     // Taxa

                // Drug Name & Dose (Premium bold)
                doc.setFontSize(8);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(...colTextMain);
                doc.text(`${drugLabel} ${phase.doseMg}mg`, c1, y + 5.5);

                // Duration
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(...colTextLight);
                doc.text(`${dWeeks.toFixed(1)} semanas (${phase.count} apps)`, c2, y + 5.5);

                // Loss Total
                const lossColor = (lossKg !== null && lossKg > 0) ? colGreen : colRed;
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(...lossColor);
                doc.text(lossStr, c3, y + 5.5);

                // Rate
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(...colTextLight);
                const tWidth = doc.getTextWidth(rateStr);
                doc.setFillColor(226, 232, 240);
                doc.roundedRect(c4 - 2, y + 2, tWidth + 4, 5, 1, 1, 'F');
                doc.text(rateStr, c4, y + 5.5);

                y += rowH;
            });
            y += 8;
        }

        // ---------------------------------------------------------
        // 7. JORNADA VISUAL (3 FOTOS DE REFERÊNCIA)
        // ---------------------------------------------------------
        if (options.includePhotos && window.JourneyService) {
            const startDateStr = startDate ? startDate.toISOString().split('T')[0] : null;
            const endDateStr = endDate ? endDate.toISOString().split('T')[0] : null;

            const comparison = JourneyService.getComparison(startDateStr, endDateStr);

            // Fetch all photos in range for a mini-gallery
            const allPhotos = (JourneyService.get()?.photos || [])
                .filter(p => (!startDateStr || p.dateISO >= startDateStr) && (!endDateStr || p.dateISO <= endDateStr))
                .sort((a, b) => a.dateISO.localeCompare(b.dateISO));

            // Seleciona até 3 fotos de referência (início, meio, atual)
            let refPhotos = [];
            if (allPhotos.length === 1) {
                refPhotos = [{ photo: allPhotos[0], label: 'ÚNICO' }];
            } else if (allPhotos.length === 2) {
                refPhotos = [
                    { photo: allPhotos[0], label: 'INÍCIO' },
                    { photo: allPhotos[allPhotos.length - 1], label: 'ATUAL' }
                ];
            } else if (allPhotos.length >= 3) {
                const midIdx = Math.floor((allPhotos.length - 1) / 2);
                refPhotos = [
                    { photo: allPhotos[0], label: 'INÍCIO' },
                    { photo: allPhotos[midIdx], label: 'PROGRESSO' },
                    { photo: allPhotos[allPhotos.length - 1], label: 'ATUAL' }
                ];
            }

            if (refPhotos.length > 0) {
                if (y > 200) { doc.addPage(); y = 30; }
                doc.setFontSize(10);
                doc.setTextColor(...colBrand);
                doc.setFont('helvetica', 'bold');
                doc.text('JORNADA VISUAL', margin, y);
                y += 8;

                const numPhotos = refPhotos.length;
                const gutter = 8;
                const photoW = (contentWidth - gutter * (numPhotos - 1)) / numPhotos;
                const photoH = 78;

                const drawPhotoWithLabel = async (imgData, x, pY, w, h, labelDate, labelWeight) => {
                    if (!imgData) return;
                    try {
                        const img = new Image();
                        let finalSrc = imgData;
                        if (typeof imgData === 'string' && !imgData.startsWith('data:')) {
                            finalSrc = `data:image/jpeg;base64,${imgData}`;
                        }
                        img.src = finalSrc;
                        await new Promise(r => img.onload = r);
                        const scale = Math.min(w / img.width, h / img.height);
                        const renderW = img.width * scale;
                        const renderH = img.height * scale;
                        doc.addImage(finalSrc, 'JPEG', x + (w - renderW) / 2, pY + (h - renderH) / 2, renderW, renderH, undefined, 'FAST');
                        doc.setDrawColor(226, 232, 240);
                        doc.setLineWidth(0.5);
                        doc.roundedRect(x, pY, w, h, 2, 2, 'S');
                        const lbH = 10;
                        const lbY = pY + h - lbH;
                        doc.setFillColor(30, 41, 59);
                        doc.rect(x, lbY, w, lbH, 'F');
                        doc.setFontSize(7);
                        doc.setFont('helvetica', 'bold');
                        doc.setTextColor(255, 255, 255);
                        doc.text(labelDate || 'N/D', x + 2, lbY + 6.5);
                        if (labelWeight) doc.text(`${labelWeight} kg`, x + w - 2, lbY + 6.5, { align: 'right' });
                        doc.setTextColor(...colTextMain);
                    } catch (e) { console.error('Error adding PDF image', e); }
                };

                for (let i = 0; i < refPhotos.length; i++) {
                    const { photo, label } = refPhotos[i];
                    const photoX = margin + i * (photoW + gutter);
                    const weight = photo.weightKg || findNearestWeight(photo.dateISO);
                    doc.setFontSize(8);
                    doc.setFont('helvetica', 'bold');
                    doc.setTextColor(...colTextLight);
                    doc.text(label, photoX + 2, y + 5);
                    doc.setFillColor(248, 250, 252);
                    doc.roundedRect(photoX, y, photoW, photoH + 12, 2, 2, 'F');
                    const photoDataUrl = await PhotoStorageService.getPhotoAsDataUrl(photo.id) || photo.image || photo.dataUrl;
                    await drawPhotoWithLabel(photoDataUrl, photoX + 2, y + 8, photoW - 4, photoH, DateService.format(photo.dateISO), weight);
                }
                y += photoH + 22;
            }
        }
        doc.setTextColor(...colTextMain);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);


        // ---------------------------------------------------------
        // 8. EVOLUÇÃO DE MEDIDAS CORPORAIS
        // ---------------------------------------------------------
        if (options.includeTable && measurements && measurements.length > 0) {
            if (y > 230) { doc.addPage(); y = 30; }

            // Title
            doc.setFontSize(10);
            doc.setTextColor(...colBrand);
            doc.setFont('helvetica', 'bold');
            doc.text('EVOLUÇÃO DE MEDIDAS CORPORAIS', margin, y);
            y += 8;

            // Table Header
            doc.setFillColor(241, 245, 249);
            doc.rect(margin, y, contentWidth, 6, 'F');
            doc.setFontSize(7);
            doc.setTextColor(...colTextLight);

            // Columns (Date, Cintura, Quadril, Coxas, Peitoral)
            const mCols = [margin + 2, margin + 40, margin + 70, margin + 100, margin + 130];
            doc.text('DATA', mCols[0], y + 4);
            doc.text('CINTURA', mCols[1], y + 4);
            doc.text('QUADRIL', mCols[2], y + 4);
            doc.text('COXAS', mCols[3], y + 4);
            doc.text('PEITORAL', mCols[4], y + 4);
            y += 6;

            // Rows
            doc.setFont('helvetica', 'normal');

            // Sort measurements by date descending (newest first)
            const sortedMeasurements = [...measurements].sort((a, b) => b.dateISO.localeCompare(a.dateISO));
            const oldestMeasurement = sortedMeasurements[sortedMeasurements.length - 1];

            sortedMeasurements.forEach((m, i) => {
                if (y > 270) {
                    doc.addPage(); y = 30;
                    doc.setFillColor(241, 245, 249);
                    doc.rect(margin, y, contentWidth, 6, 'F');
                    doc.setFont('helvetica', 'bold');
                    doc.setTextColor(...colTextLight);
                    doc.text('DATA', mCols[0], y + 4);
                    doc.text('CINTURA', mCols[1], y + 4);
                    doc.text('QUADRIL', mCols[2], y + 4);
                    doc.text('COXAS', mCols[3], y + 4);
                    doc.text('PEITORAL', mCols[4], y + 4);
                    doc.setFont('helvetica', 'normal');
                    y += 6;
                }

                if (i % 2 !== 0) {
                    doc.setFillColor(252, 252, 252);
                    doc.rect(margin, y, contentWidth, 5.5, 'F');
                }

                doc.setTextColor(...colTextMain);
                doc.text(DateService.format(m.dateISO), mCols[0], y + 4);

                // Helper to format measurement with variation
                const drawMeasure = (val, initialVal, xPos) => {
                    if (!val) {
                        doc.setTextColor(...colTextLight);
                        doc.text('--', xPos, y + 4);
                        return;
                    }
                    doc.setFont('helvetica', 'bold');
                    doc.setTextColor(...colTextMain);
                    doc.text(`${val} cm`, xPos, y + 4);
                    doc.setFont('helvetica', 'normal');

                    if (initialVal && val !== initialVal) {
                        const diff = val - initialVal;
                        const tWidth = doc.getTextWidth(`${val} cm`);
                        const dColor = diff > 0 ? colRed : colGreen; // For measurements, losing cm is green
                        doc.setFontSize(6);
                        doc.setTextColor(...dColor);
                        doc.text(`${diff > 0 ? '+' : ''}${diff} cm`, xPos + tWidth + 2, y + 3.5);
                        doc.setFontSize(7);
                    }
                };

                drawMeasure(m.waist, oldestMeasurement?.waist, mCols[1]);
                drawMeasure(m.hips, oldestMeasurement?.hips, mCols[2]);
                drawMeasure(m.thighs, oldestMeasurement?.thighs, mCols[3]);
                drawMeasure(m.chest, oldestMeasurement?.chest, mCols[4]);

                y += 5.5;
            });
            y += 10;
        }

        // ---------------------------------------------------------
        // 9. MONITORAMENTO DE PESO (High Density)
        // ---------------------------------------------------------
        if (options.includeTable) {
            if (y > 230) { doc.addPage(); y = 30; }

            doc.setFontSize(10);
            doc.setTextColor(...colBrand);
            doc.setFont('helvetica', 'bold');
            doc.text('DADOS BIOMÉTRICOS DETALHADOS (PESO)', margin, y);
            y += 8;

            // Table Header
            doc.setFillColor(241, 245, 249);
            doc.rect(margin, y, contentWidth, 6, 'F');
            doc.setFontSize(7);
            doc.setTextColor(...colTextLight);

            const wCols = [margin + 2, margin + 40, margin + 70, margin + 100, margin + 140];
            doc.text('DATA', wCols[0], y + 4);
            doc.text('PESO (KG)', wCols[1], y + 4);
            doc.text('IMC', wCols[2], y + 4);
            doc.text('VAR. DIÁRIA (KG)', wCols[3], y + 4);
            doc.text('VAR. TOTAL (KG)', wCols[4], y + 4);
            y += 6;

            // Rows
            doc.setFont('helvetica', 'normal');

            weightsDesc.forEach((w, i) => {
                if (y > 270) {
                    doc.addPage();
                    y = 30;
                    doc.setFillColor(241, 245, 249);
                    doc.rect(margin, y, contentWidth, 6, 'F');
                    doc.setFont('helvetica', 'bold');
                    doc.setTextColor(...colTextLight);
                    doc.text('DATA', wCols[0], y + 4);
                    doc.text('PESO (KG)', wCols[1], y + 4);
                    doc.text('IMC', wCols[2], y + 4);
                    doc.text('VAR. DIÁRIA (KG)', wCols[3], y + 4);
                    doc.text('VAR. TOTAL (KG)', wCols[4], y + 4);
                    doc.setFont('helvetica', 'normal');
                    y += 6;
                }

                let deltaDay = 0;
                const prev = weightsDesc[i + 1];
                if (prev) deltaDay = w.weightKg - prev.weightKg;
                const deltaTotalVal = w.weightKg - initialWeight;

                if (i % 2 !== 0) {
                    doc.setFillColor(252, 252, 252);
                    doc.rect(margin, y, contentWidth, 5.5, 'F');
                }

                doc.setTextColor(...colTextMain);
                doc.text(DateService.format(w.dateISO), wCols[0], y + 4);

                doc.setFont('helvetica', 'bold');
                doc.text(w.weightKg.toFixed(1) + ' kg', wCols[1], y + 4);
                doc.setFont('helvetica', 'normal');

                // BMI check
                const wBMI = w.bmi || WeightService.calculateBMI(w.weightKg, profile.heightCm);
                doc.text(wBMI.toFixed(1), wCols[2], y + 4);

                const cDay = deltaDay > 0 ? colRed : (deltaDay < 0 ? colGreen : colTextLight);
                doc.setTextColor(...cDay);
                const txtDay = deltaDay === 0 ? '0.0 kg' : `${deltaDay > 0 ? '+' : ''}${deltaDay.toFixed(1)} kg`;
                doc.text(txtDay, wCols[3], y + 4);

                const cTotal = deltaTotalVal > 0 ? colRed : (deltaTotalVal < 0 ? colGreen : colTextLight);
                doc.setTextColor(...cTotal);
                const txtTotal = deltaTotalVal === 0 ? '0.0 kg' : `${deltaTotalVal > 0 ? '+' : ''}${deltaTotalVal.toFixed(1)} kg`;
                doc.text(txtTotal, wCols[4], y + 4);

                y += 5.5;
            });
        }

        // Footer
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setDrawColor(226, 232, 240);
            doc.line(margin, 280, pageWidth - margin, 280);
            doc.setFontSize(7);
            doc.setTextColor(...colTextLight);
            doc.text('Ascenda • Documento Confidencial', margin, 285);
            doc.text(`Página ${i}/${pageCount}`, pageWidth - margin, 285, { align: 'right' });
        }

        // Output logic (Print-like)
        const string = doc.output('datauristring');
        const embed = `<embed width='100%' height='100%' src='${string}'/>`;
        const w = window.open();
        if (w) {
            w.document.open();
            w.document.write(embed);
            w.document.close();
            setTimeout(() => {
                w.print();
            }, 500);
        } else {
            doc.save(`Relatorio_Ascenda_${DateService.today()}.pdf`);
        }
    },

    /**
     * Renders a high-fidelity header with gradients using Canvas
     */
    async renderHeaderCanvas(periodStr) {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const scale = 3;
            const W = 600, H = 95;
            canvas.width = W * scale;
            canvas.height = H * scale;
            const ctx = canvas.getContext('2d');
            ctx.scale(scale, scale);

            // 1. Premium gradient background
            const grad = ctx.createLinearGradient(0, 0, W, 0);
            grad.addColorStop(0, '#1E2A5E');
            grad.addColorStop(0.5, '#28367F');
            grad.addColorStop(1, '#1E2A5E');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, W, H);

            // 2. Subtle corner glow (top-left emerald accent)
            const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 120);
            glow.addColorStop(0, 'rgba(16, 185, 129, 0.12)');
            glow.addColorStop(1, 'rgba(16, 185, 129, 0)');
            ctx.fillStyle = glow;
            ctx.fillRect(0, 0, 200, H);

            // 3. Bottom accent line (emerald brand)
            const lineGrad = ctx.createLinearGradient(0, 0, W, 0);
            lineGrad.addColorStop(0, '#10B981');
            lineGrad.addColorStop(0.5, '#34D399');
            lineGrad.addColorStop(1, '#10B981');
            ctx.fillStyle = lineGrad;
            ctx.fillRect(0, H - 2.5, W, 2.5);

            // 4. Draw Official Icon — vertically centered
            const iconX = 22;
            const iconCenterY = (H - 2.5) / 2;
            const iconScale = 0.0065;
            const iconRawH = 5871;
            const iconRenderedH = iconRawH * iconScale;
            const iconY = iconCenterY - iconRenderedH / 2;

            ctx.save();
            ctx.translate(iconX, iconY);
            ctx.scale(iconScale, iconScale);
            ctx.fillStyle = '#FFFFFF';
            ctx.fill(new Path2D('M799.57 5871.62l2587.09 -4969.93 2587.09 4969.93 -703.52 0 -1883.57 -3653.68 -1906.27 3653.68 -680.82 0zm1225.47 0l1384.32 -2700.55 1316.22 2700.55 -590.03 0 -726.19 -1429.71 -748.89 1429.71 -635.43 0z'));
            ctx.restore();

            // 5. Draw "ASCENDA" — vertically centered with icon
            ctx.save();
            const textX = iconX + 48;
            const textScale = 0.013;
            const textPathMid = 1270 * textScale;
            const textY = iconCenterY - textPathMid - 4;
            ctx.translate(textX, textY);
            ctx.scale(textScale, textScale);
            ctx.fillStyle = '#FFFFFF';

            ctx.fill(new Path2D("M431.29 1714.49l400.05 -889 162.56 0 401.32 889 -172.72 0 -344.17 -801.37 66.04 0 -342.9 801.37 -170.18 0zm184.15 -205.74l44.45 -129.54 480.06 0 44.45 129.54 -568.96 0z"));
            ctx.fill(new Path2D("M1819.78 1727.19c-69.43,0 -135.89,-9.95 -199.39,-29.85 -63.5,-19.89 -113.88,-45.5 -151.13,-76.83l57.15 -128.27c35.56,27.94 79.59,51.22 132.08,69.85 52.49,18.63 106.26,27.94 161.29,27.94 46.57,0 84.24,-5.08 113.03,-15.24 28.79,-10.16 49.95,-23.92 63.5,-41.28 13.55,-17.35 20.32,-37.04 20.32,-59.05 0,-27.09 -9.74,-48.9 -29.21,-65.41 -19.47,-16.51 -44.66,-29.63 -75.56,-39.37 -30.91,-9.73 -65.2,-18.83 -102.87,-27.3 -37.68,-8.47 -75.36,-18.42 -113.03,-29.85 -37.68,-11.43 -71.97,-26.24 -102.87,-44.45 -30.91,-18.2 -56.1,-42.54 -75.57,-73.02 -19.47,-30.48 -29.21,-69.43 -29.21,-116.84 0,-48.26 12.91,-92.5 38.74,-132.72 25.82,-40.21 65.19,-72.39 118.11,-96.52 52.91,-24.13 120.01,-36.19 201.29,-36.19 53.34,0 106.26,6.77 158.75,20.32 52.49,13.55 98.21,33.02 137.16,58.42l-52.07 128.27c-39.79,-23.71 -80.86,-41.28 -123.19,-52.71 -42.33,-11.43 -82.97,-17.14 -121.92,-17.14 -45.72,0 -82.76,5.5 -111.12,16.51 -28.37,11.01 -49.11,25.4 -62.23,43.18 -13.13,17.78 -19.69,38.1 -19.69,60.96 0,27.09 9.53,48.89 28.58,65.4 19.05,16.51 44.02,29.43 74.93,38.74 30.9,9.31 65.4,18.41 103.5,27.3 38.1,8.89 75.99,18.84 113.67,29.85 37.67,11.01 71.96,25.4 102.87,43.18 30.9,17.78 55.88,41.91 74.93,72.39 19.05,30.48 28.57,69 28.57,115.57 0,47.41 -12.91,91.23 -38.73,131.44 -25.83,40.22 -65.41,72.39 -118.75,96.52 -53.34,24.14 -120.65,36.2 -201.93,36.2z"));
            ctx.fill(new Path2D("M2790.44 1727.19c-67.73,0 -130.6,-11.22 -188.59,-33.66 -58,-22.43 -108.38,-54.18 -151.13,-95.25 -42.76,-41.06 -75.99,-89.53 -99.7,-145.41 -23.71,-55.88 -35.56,-116.84 -35.56,-182.88 0,-66.04 11.85,-127 35.56,-182.88 23.71,-55.88 57.15,-104.35 100.33,-145.42 43.18,-41.06 93.56,-72.81 151.13,-95.25 57.57,-22.43 120.65,-33.65 189.23,-33.65 72.81,0 139.28,12.49 199.39,37.46 60.11,24.98 110.91,62.02 152.4,111.13l-106.68 100.33c-32.17,-34.71 -68.16,-60.75 -107.95,-78.11 -39.79,-17.35 -82.97,-26.03 -129.54,-26.03 -46.57,0 -89.11,7.62 -127.63,22.86 -38.53,15.24 -71.97,36.83 -100.33,64.77 -28.37,27.94 -50.38,60.96 -66.04,99.06 -15.67,38.1 -23.5,80.01 -23.5,125.73 0,45.72 7.83,87.63 23.5,125.73 15.66,38.1 37.67,71.12 66.04,99.06 28.36,27.94 61.8,49.53 100.33,64.77 38.52,15.24 81.06,22.86 127.63,22.86 46.57,0 89.75,-8.68 129.54,-26.04 39.79,-17.35 75.78,-43.81 107.95,-79.37l106.68 101.6c-41.49,48.26 -92.29,85.09 -152.4,110.49 -60.11,25.4 -127,38.1 -200.66,38.1z"));
            ctx.fill(new Path2D("M3329.3 1714.49l-2.54 -889 647.7 0 1.27 138.43 -485.14 -1.27 1.27 613.41 500.38 1.27 1.27 137.16 -664.21 0zm148.59 -386.08l1.27 -133.35 440.69 2.54 1.27 133.35 -443.23 -2.54z"));
            ctx.fill(new Path2D("M4214.87 1714.49 L4213.6 825.49 L4349.49 825.49 L4907.02 1510.02 L4840.98 1511.29 L4839.71 825.49 L5002.27 825.49 L5003.54 1714.49 L4867.65 1714.49 L4310.12 1029.96 L4377.43 1028.69 L4377.43 1714.49 z"));
            ctx.fill(new Path2D("M5278.24 1714.49l0 -889 388.62 0c96.52,0 181.19,18.63 254,55.88 72.81,37.25 129.54,88.9 170.18,154.94 40.64,66.04 60.96,143.93 60.96,233.68 0,88.9 -20.32,166.58 -60.96,233.04 -40.64,66.47 -97.37,118.33 -170.18,155.58 -72.81,37.25 -157.48,55.88 -254,55.88l-388.62 0zm165.1 -139.7l215.9 0c66.04,0 123.61,-12.7 172.72,-38.1 49.11,-25.4 87,-60.96 113.67,-106.68 26.67,-45.72 40,-99.06 40,-160.02 0,-61.81 -13.33,-115.36 -40,-160.66 -26.67,-45.29 -64.56,-80.64 -113.67,-106.04 -49.11,-25.4 -106.68,-38.1 -172.72,-38.1l-215.9 0 0 609.6z"));
            ctx.fill(new Path2D("M6224.77 1714.49l400.05 -889 162.56 0 401.32 889 -172.72 0 -344.17 -801.37 66.04 0 -342.9 801.37 -170.18 0zm184.15 -205.74l44.45 -129.54 480.06 0 44.45 129.54 -568.96 0z"));
            ctx.restore();

            // 6. Slogan — below ASCENDA, subtle
            ctx.font = '600 7px "Inter", "Helvetica", "Arial", sans-serif';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
            ctx.letterSpacing = '2px';
            ctx.textAlign = 'left';
            ctx.fillText('DESPERTE SUA MELHOR VERSÃO', textX + 2, iconCenterY + 15);

            // 7. Thin vertical separator
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(W * 0.55, 18);
            ctx.lineTo(W * 0.55, H - 18);
            ctx.stroke();

            // 8. Right side — Date
            ctx.font = '500 10px "Inter", "Helvetica", "Arial", sans-serif';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
            ctx.letterSpacing = '0';
            ctx.textAlign = 'right';
            const dateStr = `Gerado em: ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
            ctx.fillText(dateStr, W - 22, iconCenterY - 4);

            // 9. Right side — Period
            if (periodStr) {
                ctx.font = '400 8.5px "Inter", "Helvetica", "Arial", sans-serif';
                ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
                const label = periodStr.includes('Até') ? 'Dados ' : 'Período: ';
                ctx.fillText(`${label}${periodStr}`, W - 22, iconCenterY + 10);
            }

            resolve(canvas.toDataURL('image/png'));
        });
    },

    async renderChartCanvas(weightsRaw, injections) {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            canvas.width = 1800;
            canvas.height = 900;
            canvas.style.display = 'none';
            document.body.appendChild(canvas);

            const dateSet = new Set();
            weightsRaw.forEach(w => dateSet.add(w.dateISO));
            injections.forEach(i => dateSet.add(i.dateISO));
            const sortedDates = Array.from(dateSet).sort();

            const injMap = {};
            injections.forEach(i => injMap[i.dateISO] = i);
            const weightMap = {};
            weightsRaw.forEach(w => weightMap[w.dateISO] = w.weightKg);

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
                    return prev.weightKg + (next.weightKg - prev.weightKg) * ratio;
                } else if (prev) return prev.weightKg;
                else if (next) return next.weightKg;
                return 0;
            };

            const chartData = sortedDates.map(dateISO => {
                const weight = getInterpWeight(dateISO);
                const injection = injMap[dateISO];
                const isRealWeight = weightMap[dateISO] !== undefined;

                let doseColor = null;
                if (injection && window.DoseColorManager) {
                    doseColor = DoseColorManager.getColor(injection.drugName, injection.doseMg);
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

            const themeColors = {
                lineColor: '#6366F1',
                lineGradientStart: 'rgba(99, 102, 241, 0.25)',
                lineGradientEnd: 'rgba(99, 102, 241, 0.05)',
                pointDefault: '#6366F1'
            };

            const ctx = canvas.getContext('2d');
            const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
            gradient.addColorStop(0, themeColors.lineGradientStart);
            gradient.addColorStop(1, themeColors.lineGradientEnd);

            const INJ_RADIUS = 15;
            const WEIGHT_RADIUS = 7;

            // Cor por dose (DoseColorManager) — fallback rosa se não disponível
            const pointColors = chartData.map(d => d.injection ? (d.doseColor || '#EC4899') : themeColors.pointDefault);
            const pointRadius = chartData.map(d => {
                if (d.injection) return INJ_RADIUS;
                if (d.isRealWeight) return WEIGHT_RADIUS;
                return 0;
            });
            const pointBorderColors = chartData.map(d => d.injection ? (d.doseColor || '#EC4899') : themeColors.pointDefault);
            const pointBorderWidth = chartData.map(d => d.injection ? 5 : 3);


            const chart = new Chart(canvas, {
                type: 'line',
                data: {
                    labels: chartData.map(d => d.date),
                    datasets: [{
                        label: 'Peso (kg)',
                        data: chartData.map(d => d.weight),
                        borderColor: themeColors.lineColor,
                        backgroundColor: gradient,
                        fill: 'start',
                        tension: 0.4,
                        borderWidth: 6,
                        pointRadius: chartData.map(d => d.injection ? 15 : (d.isRealWeight ? 7 : 0)),
                        pointBackgroundColor: pointColors,
                        pointBorderColor: pointBorderColors,
                        pointBorderWidth: chartData.map(d => d.injection ? 5 : 3)
                    }]
                },
                options: {
                    animation: false,
                    responsive: false,
                    devicePixelRatio: 1,
                    layout: {
                        padding: { top: 40, bottom: 40, left: 60, right: 100 }
                    },
                    plugins: {
                        legend: { display: false },
                        title: { display: false }
                    },
                    scales: {
                        y: {
                            beginAtZero: false,
                            grid: { color: '#e2e8f0', lineWidth: 2 },
                            ticks: {
                                font: { size: 24, weight: '600' },
                                color: '#333333',
                                padding: 15
                            },
                            title: {
                                display: true,
                                text: 'Peso (kg)',
                                font: { size: 28, weight: 'bold' },
                                color: '#1E293B',
                                padding: { bottom: 20 }
                            }
                        },
                        x: {
                            grid: { display: true, color: '#e2e8f0', lineWidth: 2 },
                            ticks: {
                                font: { size: 22, weight: '600' },
                                color: '#333333',
                                maxRotation: 45,
                                minRotation: 45,
                                autoSkip: true,
                                maxTicksLimit: 15
                            },
                            title: {
                                display: true,
                                text: 'Data',
                                font: { size: 26, weight: 'bold' },
                                color: '#1E293B',
                                padding: { top: 20 }
                            }
                        }
                    }
                }
            });

            setTimeout(() => {
                try {
                    const img = canvas.toDataURL('image/png', 1.0);
                    chart.destroy();
                    document.body.removeChild(canvas);
                    resolve(img);
                } catch (e) {
                    console.error('Canvas export error', e);
                    resolve(null);
                }
            }, 1000);
        });
    }
};
