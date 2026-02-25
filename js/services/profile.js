/* ============================================
   PROFILE SERVICE
   ============================================ */
window.ProfileService = {
    get() {
        return StorageService.getSafe(StorageService.KEYS.PROFILE, {
            name: '',
            sex: null, // 'male' or 'female'
            birthdate: null, // 'YYYY-MM-DD'
            heightCm: null,
            weightGoalKg: null,

            // Clinical & Stats
            activityLevel: 'sedentary', // sedentary, light, moderate, active, very_active
            kidneyHealth: 'normal', // normal, altered, severe
            goalType: 'lose_weight', // lose_weight, maintain, gain_muscle
            targetWeight: null,

            // Goals (Calculated)
            dailyWater: 2000,
            dailyProtein: 100,
            dailyFiber: 30,
            tdee: 2000,

            // Medication
            medication: 'none',
            useMedication: false,
            drug: null,

            // System
            onboardingComplete: false,
            createdAt: new Date().toISOString()
        });
    },

    save(profile) {
        StorageService.set(StorageService.KEYS.PROFILE, profile);
        StorageService.snapshot();
    },

    // Legacy method, now delegates to NutritionService
    calculateProteinTarget() {
        return NutritionService.calculate().protein;
    },

    getProteinBasis() {
        return NutritionService.explain();
    },

    isFirstRun() {
        const profile = StorageService.getSafe(StorageService.KEYS.PROFILE, null);

        // Se realmente não existir nenhum perfil na memória
        if (!profile) return true;

        // Se o usuário já tiver dados chaves preenchidos (Legado), não é First Run.
        if (profile.heightCm && profile.startWeight) {
            if (!profile.onboardingComplete) {
                this.markOnboardingComplete(); // Corrige silenciosamente
            }
            return false;
        }

        return !profile.onboardingComplete;
    },

    markOnboardingComplete() {
        const profile = this.get();
        profile.onboardingComplete = true;
        this.save(profile);
    },

    // Check missing fields for calculations
    getMissingFields() {
        const p = this.get();
        const missing = [];
        if (!p.sex) missing.push('Sexo Biológico');
        if (!p.birthdate && !p.age) missing.push('Idade');
        if (!p.activityLevel) missing.push('Nível de Atividade');
        if (!p.kidneyHealth) missing.push('Saúde Renal');
        return missing;
    },

    getCurrentWeight() {
        const latest = WeightService.getLatest();
        return latest ? latest.weightKg : null;
    }
};
