/* ============================================
   WEIGHT SERVICE
   ============================================ */
window.WeightService = {
    add(dateISO, weightKg, fatPercent = null) {
        const all = StorageService.getSafe(StorageService.KEYS.WEIGHTS, {});

        // Calculate BMI before saving
        const profile = ProfileService.get();
        const bmi = this.calculateBMI(weightKg, profile.heightCm);

        all[dateISO] = {
            dateISO,
            weightKg: parseFloat(weightKg),
            fatPercent: fatPercent ? parseFloat(fatPercent) : null,
            bmi: parseFloat(bmi.toFixed(2))
        };

        StorageService.set(StorageService.KEYS.WEIGHTS, all);
        StorageService.snapshot();

        return all[dateISO];
    },

    delete(dateISO) {
        const all = StorageService.getSafe(StorageService.KEYS.WEIGHTS, {});
        if (all[dateISO]) {
            delete all[dateISO];
            StorageService.set(StorageService.KEYS.WEIGHTS, all);
            StorageService.snapshot();

            // Remove também do Supabase para não voltar no próximo pull
            if (window.SupabaseService && window.AuthService && AuthService.isLoggedIn()) {
                SupabaseService.getUser().then(user => {
                    if (user) SupabaseService.delete('weights', { user_id: user.id, date: dateISO });
                }).catch(e => console.warn('WeightService.delete: falha ao remover do Supabase (não crítico):', e.message));
            }

            return true;
        }
        return false;
    },

    getAll() {
        const all = StorageService.getSafe(StorageService.KEYS.WEIGHTS, {});
        return Object.values(all).sort((a, b) => a.dateISO.localeCompare(b.dateISO));
    },

    getMovingAverage(windowSize = 7) {
        const weights = this.getAll();
        if (weights.length === 0) return [];

        return weights.map((w, idx) => {
            const start = Math.max(0, idx - windowSize + 1);
            const subset = weights.slice(start, idx + 1);
            const avg = subset.reduce((sum, item) => sum + item.weightKg, 0) / subset.length;
            return {
                ...w,
                ma: parseFloat(avg.toFixed(2))
            };
        });
    },

    getLatest() {
        const all = this.getAll();
        return all.length > 0 ? all[all.length - 1] : null;
    },

    calculateBMI(weightKg, heightCm) {
        if (!weightKg || !heightCm) return 0;
        const heightM = heightCm / 100;
        return weightKg / (heightM * heightM);
    },

    getBMICategory(bmi) {
        if (bmi < 18.5) return { text: 'Abaixo do Peso', color: 'var(--info)' };
        if (bmi < 25) return { text: 'Peso Normal', color: 'var(--success)' };
        if (bmi < 30) return { text: 'Sobrepeso', color: 'var(--warning)' };
        if (bmi < 35) return { text: 'Obesidade I', color: 'var(--orange)' };
        if (bmi < 40) return { text: 'Obesidade II', color: 'var(--danger)' };
        return { text: 'Obesidade III', color: 'var(--danger)' };
    },

    getInsights() {
        const weights = this.getAll();
        if (weights.length === 0) return { totalLoss: 0, trend30: 0, goalPercent: null, currentBmi: 0, weeklyVar: 0 };

        const latest = weights[weights.length - 1];
        const first = weights[0];

        // Perda Total: negativo = perdeu peso (consistente com as outras métricas)
        const totalLoss = weights.length === 1 ? 0 : latest.weightKg - first.weightKg;

        // Tendência 30d
        let trend30 = 0;
        if (weights.length > 1) {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const weight30DaysAgo = weights.find(w => new Date(w.dateISO) >= thirtyDaysAgo) || weights[0];
            if (weight30DaysAgo.dateISO !== latest.dateISO) {
                trend30 = latest.weightKg - weight30DaysAgo.weightKg;
            }
        }

        // % da Meta (fallback: IMC atual)
        const profile = ProfileService.get();
        let goalPercent = null;
        const goalKg = parseFloat(profile.weightGoalKg);
        if (goalKg && first.weightKg > goalKg) {
            const totalToLose = first.weightKg - goalKg;
            const lost = first.weightKg - latest.weightKg;
            goalPercent = Math.min(100, Math.max(0, Math.round((lost / totalToLose) * 100)));
        }

        // Variação entre os dois últimos registros
        let weeklyVar = 0;
        if (weights.length >= 2) {
            const prev = weights[weights.length - 2];
            weeklyVar = latest.weightKg - prev.weightKg;
        }

        return {
            totalLoss: parseFloat(totalLoss.toFixed(1)),
            trend30: weights.length === 1 ? 0 : parseFloat(trend30.toFixed(1)),
            goalPercent,
            currentBmi: latest.bmi,
            weeklyVar: weights.length === 1 ? 0 : parseFloat(weeklyVar.toFixed(1))
        };
    }
};
