/* ============================================
   DOSE ANALYSIS SERVICE (GLP-1 Specific)
   ============================================ */
window.DoseAnalysisService = {
    // Meia-vida típica do GLP-1 em dias
    HALF_LIFE_DAYS: 5,

    // Semanas típicas entre escalonamentos
    ESCALATION_WEEKS: 4,

    /**
     * Agrupa registros de peso por período de cada dose
     * Retorna: [{ dose: 5, startDate, endDate, weights: [...] }, ...]
     */
    getWeightsByDosePeriod() {
        const weights = WeightService.getAll();
        const injections = DoseService.getAll();

        if (injections.length === 0 || weights.length === 0) {
            return [];
        }

        // Agrupa injeções por dose
        const dosePeriods = [];
        let currentDose = null;
        let periodStart = null;

        injections.forEach((inj, idx) => {
            if (currentDose !== inj.doseMg) {
                // Fecha período anterior
                if (currentDose !== null) {
                    dosePeriods.push({
                        dose: currentDose,
                        startDate: periodStart,
                        endDate: inj.dateISO
                    });
                }
                // Inicia novo período
                currentDose = inj.doseMg;
                periodStart = inj.dateISO;
            }

            // Último período
            if (idx === injections.length - 1) {
                dosePeriods.push({
                    dose: currentDose,
                    startDate: periodStart,
                    endDate: DateService.today()
                });
            }
        });

        // Associa pesos a cada período
        return dosePeriods.map((period, pIdx) => {
            // Buscamos o peso inicial (o peso mais recente antes ou no dia da primeira injeção desta dose)
            let weightBefore = weights.filter(w => w.dateISO < period.startDate).pop();

            // Refinement: only use a pre-period weight as baseline if it's reasonably close
            // to the period start (within 60 days). This avoids using historical weights
            // from before the patient gained weight, which would invert the sign (loss appears as gain).
            if (!weightBefore && pIdx === 0 && weights.length > 0) {
                const firstWeight = weights[0];
                const daysDiff = Math.abs(
                    (new Date(period.startDate) - new Date(firstWeight.dateISO)) / (1000 * 60 * 60 * 24)
                );
                if (daysDiff <= 60) {
                    weightBefore = firstWeight;
                }
            }

            const periodWeights = weights.filter(w =>
                w.dateISO >= period.startDate && w.dateISO <= period.endDate
            );

            // Se temos um peso imediatamente antes (ou a base da jornada), incluímos como ponto de partida
            const allRelevantWeights = weightBefore ? [weightBefore, ...periodWeights] : periodWeights;

            // Debug logic: ensure we don't have duplicate dates if the first weight WAS on period.startDate
            const uniqueWeights = [];
            const seenDates = new Set();
            allRelevantWeights.forEach(w => {
                if (!seenDates.has(w.dateISO)) {
                    uniqueWeights.push(w);
                    seenDates.add(w.dateISO);
                }
            });

            return { ...period, weights: uniqueWeights };
        });
    },

    /**
     * Calcula taxa de perda (kg/semana) por dose
     */
    getLossRateByDose() {
        const periods = this.getWeightsByDosePeriod();

        return periods.map(period => {
            if (period.weights.length < 2) {
                return { dose: period.dose, rate: null, weeks: 0, totalLoss: 0 };
            }

            const first = period.weights[0];
            const last = period.weights[period.weights.length - 1];
            const days = Math.max(1,
                Math.floor((new Date(last.dateISO) - new Date(first.dateISO)) / (1000 * 60 * 60 * 24))
            );
            const weeks = days / 7;
            const totalLoss = last.weightKg - first.weightKg;
            const rate = weeks > 0 ? totalLoss / weeks : 0; // Negative for weight loss

            // DEBUG - Remove after fix verified
            console.log(`[DoseAnalysis] ${period.dose}mg:`, {
                firstDate: first.dateISO, firstWeight: first.weightKg,
                lastDate: last.dateISO, lastWeight: last.weightKg,
                totalLoss, rate, periodWeightsCount: period.weights.length
            });

            return {
                dose: period.dose,
                rate: parseFloat(rate.toFixed(2)),
                weeks: parseFloat(weeks.toFixed(1)),
                totalLoss: parseFloat(totalLoss.toFixed(1)),
                startWeight: first.weightKg,
                endWeight: last.weightKg
            };
        }).filter(r => r.rate !== null);
    },

    /**
     * Calcula taxa média de perda geral
     */
    getAverageLossRate() {
        const weights = WeightService.getAll();
        if (weights.length < 2) return null;

        const first = weights[0];
        const last = weights[weights.length - 1];
        const days = Math.floor((new Date(last.dateISO) - new Date(first.dateISO)) / (1000 * 60 * 60 * 24));
        const weeks = days / 7;
        const totalLoss = last.weightKg - first.weightKg;

        return weeks > 0 ? parseFloat((totalLoss / weeks).toFixed(2)) : 0;
    },

    getCurrentWeightFromWeights() {
        const weights = WeightService.getAll();
        return weights.length > 0 ? weights[weights.length - 1].weightKg : null;
    },

    /**
     * Prevê data para atingir peso-meta
     */
    predictGoalDate() {
        const profile = ProfileService.get();
        const goalWeight = profile.weightGoalKg;

        if (!goalWeight) return null;

        const currentWeight = this.getCurrentWeightFromWeights() || ProfileService.getCurrentWeight();
        const avgRate = this.getAverageLossRate();

        // Se a taxa for positiva ou zero, significa que não há perda para prever meta
        if (avgRate === null || avgRate >= 0) return null;

        const kgToLose = currentWeight - goalWeight;
        if (kgToLose <= 0) {
            return { reached: true, date: DateService.today() };
        }

        // Usamos o valor absoluto da taxa (perda) para o cálculo do tempo
        const weeksNeeded = kgToLose / Math.abs(avgRate);
        const daysNeeded = Math.ceil(weeksNeeded * 7);
        const predictedDate = DateService.addDays(DateService.today(), daysNeeded);

        return {
            reached: false,
            date: predictedDate,
            daysRemaining: daysNeeded,
            weeksRemaining: parseFloat(weeksNeeded.toFixed(1)),
            kgRemaining: parseFloat(kgToLose.toFixed(1)),
            currentRate: avgRate
        };
    },

    /**
     * Verifica se é hora de considerar escalonamento de dose
     */
    shouldConsiderEscalation() {
        const injections = DoseService.getAll();
        if (injections.length === 0) return null;

        // Encontra última mudança de dose
        let lastDoseChange = null;
        let currentDose = null;

        for (let i = injections.length - 1; i >= 0; i--) {
            if (currentDose === null) {
                currentDose = injections[i].doseMg;
            }
            if (injections[i].doseMg !== currentDose) {
                lastDoseChange = injections[i + 1]?.dateISO || injections[i].dateISO;
                break;
            }
        }

        // Primeira dose
        if (!lastDoseChange && injections.length > 0) {
            lastDoseChange = injections[0].dateISO;
        }

        if (!lastDoseChange) return null;

        const daysSinceChange = Math.floor(
            (new Date(DateService.today()) - new Date(lastDoseChange)) / (1000 * 60 * 60 * 24)
        );
        const weeksSinceChange = daysSinceChange / 7;

        // Calcula taxa de perda desde última mudança
        const weights = WeightService.getAll().filter(w => w.dateISO >= lastDoseChange);
        let recentRate = 0;
        if (weights.length >= 2) {
            const first = weights[0];
            const last = weights[weights.length - 1];
            const periodDays = Math.floor((new Date(last.dateISO) - new Date(first.dateISO)) / (1000 * 60 * 60 * 24));
            const periodWeeks = periodDays / 7;
            if (periodWeeks > 0) {
                recentRate = (last.weightKg - first.weightKg) / periodWeeks;
            }
        }

        // Lógica de decisão: Se após 4 semanas a perda for menor que 0.5kg/sem (ex: -0.2kg/sem)
        if (weeksSinceChange >= this.ESCALATION_WEEKS) {
            if (recentRate > -0.5) {
                return {
                    shouldEscalate: true,
                    reason: `Baixa resposta (${recentRate.toFixed(2)}kg/sem) após ${weeksSinceChange.toFixed(0)} semanas.`
                };
            }
        }

        return {
            shouldEscalate: false,
            reason: `Periodo de adaptação ou boa resposta (${recentRate.toFixed(2)}kg/sem).`
        };
    },

    getFullAnalysis() {
        return {
            byDose: this.getLossRateByDose(),
            avgRate: this.getAverageLossRate(),
            goalPrediction: this.predictGoalDate(),
            escalation: this.shouldConsiderEscalation()
        };
    }
};
