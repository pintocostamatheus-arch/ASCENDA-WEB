/* ============================================
   NUTRITION SERVICE
   ============================================ */
window.NutritionService = {
    calculate(manualProfile = null) {
        if (!manualProfile && (typeof ProfileService === 'undefined' || typeof WeightService === 'undefined')) {
            return { protein: 60, water: 2000, fiber: 28, proteinBasis: 'Default', bmi: 25 };
        }

        const profile = manualProfile || ProfileService.get();
        const weights = WeightService.getAll().sort((a, b) => a.dateISO.localeCompare(b.dateISO));
        const currentWeight = weights.length > 0 ? weights[weights.length - 1].weightKg : (profile.startWeight || 70);
        const height = profile.heightCm || 160;
        const age = profile.age || (profile.birthdate ? DateService.calculateAge(profile.birthdate) : 30);
        const sex = profile.sex || 'male';
        const kidney = profile.kidneyHealth || 'normal';
        const hasSarcopenia = profile.sarcopenia || false;
        const activity = profile.activityLevel || 'sedentary';

        if (!currentWeight || isNaN(currentWeight)) {
            return { protein: 60, water: 2000, fiber: 28, proteinBasis: 'Default', bmi: 25 };
        }

        const bmi = currentWeight / ((height / 100) ** 2);

        // ETAPA 2: Cálculo da Massa de Referência (FFM)
        // FFM = 0.28*W + 0.57*H + 7.35*S + 0.03*A - 70.61
        const sVal = (sex === 'male') ? 1 : 0;
        const ffm = (0.28 * currentWeight) + (0.57 * height) + (7.35 * sVal) + (0.03 * age) - 70.61;
        const ffmRef = Math.max(ffm, currentWeight * 0.4); // Safety floor for FFM

        // Calcule o Peso Ideal (BMI 24.9) para regras renais
        const idealWeight = 24.9 * ((height / 100) ** 2);

        // Peso de referência para o adulto saudável (abordagem pragmática ESPEN):
        // peso total até IMC 30; acima disso, peso ajustado = ideal + 25% do excesso.
        // Evita superestimar em obesidade sem penalizar quem está em faixa normal/sobrepeso.
        const adjustedWeight = idealWeight + 0.25 * (currentWeight - idealWeight);
        const refWeight = bmi < 30 ? currentWeight : adjustedWeight;

        // ETAPA 3: Árvore de Decisão Clínica
        let proteinTarget = 0;
        let ruleApplied = '';

        // REGRA 4: Exceção Geriátrica (Idoso >= 65 com DRC Avançada E Sarcopenia)
        if (age >= 65 && (kidney === 'ckd_3' || kidney === 'ckd_4_5') && hasSarcopenia) {
            proteinTarget = idealWeight * 1.1; // Alvo de 1.0-1.2g/kg
            ruleApplied = 'Regra 4: Exceção Geriátrica (Sarcopenia > Renal)';
        }
        // REGRA 1: DRC Estágio 3, 4 e 5 (Não-Dialítico)
        else if (kidney === 'ckd_3' || kidney === 'ckd_4_5') {
            const factor = profile.diabetes ? 0.7 : 0.58; // 0.6-0.8 se diabético, else 0.55-0.6
            proteinTarget = idealWeight * factor;
            ruleApplied = `Regra 1: DRC Estágio ${kidney === 'ckd_3' ? '3' : '4/5'} (${profile.diabetes ? 'Diabético' : 'Padrão'})`;
        }
        // REGRA 2: Paciente em Diálise
        else if (kidney === 'dialysis') {
            proteinTarget = idealWeight * 1.1; // 1.0 a 1.2 g/kg
            ruleApplied = 'Regra 2: Paciente em Diálise';
        }
        // REGRA 3: DRC Estágios 1 e 2
        else if (kidney === 'ckd_1_2') {
            proteinTarget = Math.min(ffmRef * 1.6, idealWeight * 0.8); // Limite absoluto de 0.8g/kg ideal
            ruleApplied = 'Regra 3: DRC Estágio 1/2 (Dano Leve)';
        }
        // REGRA 5: Idoso Saudável (>= 65 anos) — MUST come before activity check
        else if (age >= 65) {
            proteinTarget = currentWeight * 1.35; // Alvo ideal de 1.2 a 1.5 g/kg
            ruleApplied = 'Regra 5: Idoso Saudável (Resistência Anabólica)';
        }
        // REGRA 6: Adulto Saudável — fator escalonado sobre o peso de referência.
        // Base 1.6 g/kg (breakpoint de Morton 2018), com incrementos por contexto e
        // teto de 2.2 g/kg (ISSN Position Stand). Substitui a antiga Regra 7.
        else {
            const goal = profile.objective || profile.goalType || 'loss';
            const inDeficit = (goal === 'loss' || goal === 'lose_weight');
            const usesGlp1 = profile.useMedication || (profile.drug && profile.drug !== 'none');

            let factor = 1.6;
            const mods = [];
            if (inDeficit) { factor += 0.2; mods.push('déficit'); }
            if (activity === 'active' || activity === 'very_active') { factor += 0.1; mods.push('treino intenso'); }
            else if (activity === 'moderate') { factor += 0.05; mods.push('treino moderado'); }
            if (usesGlp1) { factor += 0.1; mods.push('GLP-1'); }
            factor = Math.min(factor, 2.2);

            proteinTarget = refWeight * factor;
            const baseLabel = bmi < 30 ? 'peso total' : 'peso ajustado';
            ruleApplied = `Regra 6: Adulto (${factor.toFixed(2)} g/kg de ${baseLabel}`
                + (mods.length ? ` — ${mods.join(', ')}` : '') + ')';
        }

        // ETAPA 4: Regras de Retorno (Filtros Finais)
        // Limite Mínimo Absoluto (80-120g se não renal)
        const isRenal = kidney !== 'normal' && kidney !== 'ckd_1_2';
        if (!isRenal && proteinTarget < 90) {
            proteinTarget = 90;
            ruleApplied += ' [Ajuste: Piso Mínimo 90g]';
        }

        // Water Calculation
        let waterTarget = Math.max(currentWeight * 35, (sex === 'female' ? 2200 : 3000));
        const todayFlags = this.getTodayFlags();
        if (todayFlags.training) waterTarget += (todayFlags.trainingHours || 1) * 500;
        if (todayFlags.heat) waterTarget += 500;
        if (todayFlags.symptoms) waterTarget += 1000;

        // Fibra: Adequate Intake (IOM / Academy of Nutrition and Dietetics).
        // 38g/dia homens e 25g/dia mulheres; cai para 30g/21g a partir dos 50 anos.
        const fiberTarget = (sex === 'male')
            ? (age >= 50 ? 30 : 38)
            : (age >= 50 ? 21 : 25);

        // Metas manuais definidas pelo usuário sobrepõem o cálculo automático.
        // Exceção de segurança: em perfil renal a meta manual só pode REDUZIR o alvo,
        // nunca ultrapassar a restrição do KDOQI — o app não tem supervisão clínica
        // e não há nenhuma tela que exiba proteinBasis para avisar o usuário.
        let manualProtein = profile.manualProteinGoal || null;
        let basis = ruleApplied;
        if (manualProtein) {
            if (isRenal && manualProtein > proteinTarget) {
                manualProtein = null;
                basis = ruleApplied + ' [Meta manual ignorada: excede o limite renal]';
            } else {
                basis = 'Meta manual definida por você';
            }
        }

        return {
            protein: Math.round(manualProtein || proteinTarget),
            water: Math.round(profile.manualWaterGoal || waterTarget),
            fiber: Math.round(profile.manualFiberGoal || fiberTarget),
            proteinBasis: basis,
            bmi: bmi,
            ffm: ffmRef
        };
    },

    explain() {
        const res = this.calculate();
        return res.proteinBasis;
    },

    // Daily Flags Storage
    getTodayFlags() {
        const today = DateService.today();
        const flags = StorageService.getSafe(StorageService.KEYS.NUTRITION_FLAGS, {});
        return flags[today] || { training: false, heat: false, symptoms: false };
    },

    setFlag(flag, value, hours = 1) {
        const today = DateService.today();
        const allFlags = StorageService.getSafe(StorageService.KEYS.NUTRITION_FLAGS, {});

        if (!allFlags[today]) allFlags[today] = {};

        allFlags[today][flag] = value;
        if (flag === 'training' && value) allFlags[today].trainingHours = hours;

        StorageService.set(StorageService.KEYS.NUTRITION_FLAGS, allFlags);
    },

    // -------------------------------------------------
    // DATA PERSISTENCE (MEALS & LOGS)
    // -------------------------------------------------
    getToday() {
        return this.getByDate(DateService.today());
    },

    getByDate(dateISO) {
        let all = StorageService.getSafe(StorageService.KEYS.NUTRITION, {});
        // Critical Fix: If 'all' is an array, force it to be an object so string keys (dates) are persisted by JSON.stringify
        if (Array.isArray(all)) all = {};

        const empty = this.createEmpty(dateISO);
        const data = all[dateISO] || empty;

        // Dynamic Target Update (Always fresh)
        const targets = this.calculate();
        data.proteinTarget = targets.protein;
        data.waterMlTarget = targets.water;
        data.fiberTarget = targets.fiber;

        return data;
    },

    createEmpty(dateISO) {
        const targets = this.calculate();
        return {
            dateISO,
            proteinTarget: targets.protein,
            proteinConsumed: 0,
            waterMl: 0,
            waterMlTarget: targets.water,
            fiberG: 0,
            fiberTarget: targets.fiber,
            meals: []
        };
    },

    save(dateISO, data) {
        let all = StorageService.getSafe(StorageService.KEYS.NUTRITION, {});
        if (Array.isArray(all)) all = {}; // Force object
        all[dateISO] = data;
        // Mantém apenas os últimos 7 dias para não encher o localStorage
        const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 7);
        const cutoffISO = cutoff.toISOString().split('T')[0];
        Object.keys(all).forEach(k => { if (k < cutoffISO) delete all[k]; });
        StorageService.set(StorageService.KEYS.NUTRITION, all);
    },

    addMeal(meal) {
        const today = DateService.today();
        const data = this.getByDate(today);
        meal.id = Date.now();
        data.meals.push(meal);
        data.proteinConsumed = data.meals.reduce((s, m) => s + (m.proteinG || 0), 0);
        data.fiberG = data.meals.reduce((s, m) => s + (m.fiberG || 0), 0);
        this.save(today, data);
        StorageService.snapshot();
        return data;
    },

    deleteMeal(mealId) {
        const today = DateService.today();
        const data = this.getByDate(today);
        data.meals = data.meals.filter(m => m.id !== mealId);
        data.proteinConsumed = data.meals.reduce((s, m) => s + (m.proteinG || 0), 0);
        data.fiberG = data.meals.reduce((s, m) => s + (m.fiberG || 0), 0);
        this.save(today, data);
        return data;
    },

    addWater(ml) {
        const today = DateService.today();
        const data = this.getByDate(today);
        data.waterMl = Math.max(0, (data.waterMl || 0) + ml);
        this.save(today, data);
        return data;
    },

    addFiber(g) {
        const today = DateService.today();
        const data = this.getByDate(today);
        data.fiberG = Math.max(0, (data.fiberG || 0) + g);
        this.save(today, data);
        return data;
    },

    // -------------------------------------------------
    // FOOD DATABASE
    // -------------------------------------------------
    getAllFoods() {
        const custom = StorageService.getSafe(StorageService.KEYS.CUSTOM_FOODS, []);
        // Define FOODS_BUILTIN if missing or rely on global
        const builtin = typeof FOODS_BUILTIN !== 'undefined' ? FOODS_BUILTIN : [];
        return [...builtin, ...custom];
    },

    // Helper to normalize strings (remove accents/diacritics)
    normalize(str) {
        return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    },

    searchFoods(query) {
        if (!query || query.length < 2) return [];
        const foods = this.getAllFoods();
        const q = this.normalize(query);
        // Prioriza nomes que COMEÇAM com a query, depois os que contêm
        const matches = foods.filter(f => this.normalize(f.name).includes(q));
        matches.sort((a, b) => {
            const aStarts = this.normalize(a.name).startsWith(q) ? 0 : 1;
            const bStarts = this.normalize(b.name).startsWith(q) ? 0 : 1;
            return aStarts - bStarts;
        });
        return matches.slice(0, 15);
    },

    calculateProtein(food, quantity, unit) {
        if (unit === 'unidade') {
            return (food.proteinPerUnit || 0) * quantity;
        }
        if (unit === 'scoop') {
            return (food.proteinPerScoop || 0) * quantity;
        }
        return ((food.proteinPer100g || 0) / 100) * quantity;
    },

    calculateFiber(food, quantity, unit) {
        if (!food) return 0;
        if (unit === 'unidade') {
            return (food.fiberPerUnit || 0) * quantity;
        }
        if (unit === 'scoop') {
            return (food.fiberPerScoop || 0) * quantity;
        }
        return ((food.fiberPer100g || 0) / 100) * quantity;
    },

    addCustomFood(food) {
        const custom = StorageService.getSafe(StorageService.KEYS.CUSTOM_FOODS, []);
        food.id = Date.now();
        custom.push(food);
        StorageService.set(StorageService.KEYS.CUSTOM_FOODS, custom);

        // Sync granular com Supabase (arrays não são sincronizados via _cloudMap)
        if (window.SupabaseService && window.AuthService && AuthService.isLoggedIn()) {
            SupabaseService.getUser().then(user => {
                if (!user) return;
                const row = {
                    name: food.name,
                    protein_per_100g: food.proteinPer100g || null,
                    fiber_per_100g: food.fiberPer100g || null,
                    protein_per_unit: food.proteinPerUnit || null,
                    fiber_per_unit: food.fiberPerUnit || null,
                    protein_per_scoop: food.proteinPerScoop || null,
                    fiber_per_scoop: food.fiberPerScoop || null,
                    default_unit: food.defaultUnit || 'g'
                };
                SupabaseService.upsert('custom_foods', row, 'user_id,name').catch(e => {
                    console.warn('NutritionService.addCustomFood: falha no sync (não crítico):', e.message);
                });
            });
        }

        return custom;
    },

    deleteCustomFood(id) {
        let custom = StorageService.getSafe(StorageService.KEYS.CUSTOM_FOODS, []);
        // Compara como string para suportar id numérico (Date.now) e UUID (Supabase)
        const foodToDelete = custom.find(f => String(f.id) === String(id));
        custom = custom.filter(f => String(f.id) !== String(id));
        StorageService.set(StorageService.KEYS.CUSTOM_FOODS, custom);

        // Remove do Supabase usando 'name' como chave (id local é timestamp, não UUID)
        if (foodToDelete && window.SupabaseService && window.AuthService && AuthService.isLoggedIn()) {
            SupabaseService.getUser().then(user => {
                if (user) SupabaseService.delete('custom_foods', { user_id: user.id, name: foodToDelete.name });
            }).catch(e => console.warn('NutritionService.deleteCustomFood: falha ao remover do Supabase (não crítico):', e.message));
        }

        return custom;
    },

    /**
     * Calculates current streak for a metric (e.g., 'protein', 'water', 'fiber')
     */
    getStreak(metric) {
        const all = StorageService.getSafe(StorageService.KEYS.NUTRITION, {});
        const dates = Object.keys(all).sort().reverse();
        let streak = 0;
        let expectedDate = DateService.today();

        for (const date of dates) {
            // Se o dia esperado não tem registro, verifica se é o dia atual (pode ainda não ter registrado)
            if (date !== expectedDate) {
                // Se o dia atual não tem registro ainda, pula para ontem
                if (streak === 0 && expectedDate === DateService.today()) {
                    const yesterday = new Date(expectedDate);
                    yesterday.setDate(yesterday.getDate() - 1);
                    expectedDate = yesterday.toISOString().split('T')[0];
                    if (date !== expectedDate) break; // Gap detectado
                } else {
                    break; // Gap detectado — streak interrompido
                }
            }

            const data = all[date];
            let reached = false;

            if (metric === 'water') reached = data.waterMl >= (data.waterMlTarget || 2000);
            else if (metric === 'protein') reached = data.proteinConsumed >= (data.proteinTarget || 60);
            else if (metric === 'fiber') reached = data.fiberG >= (data.fiberTarget || 30);

            if (reached) {
                streak++;
                // Próximo dia esperado = dia anterior
                const prev = new Date(date);
                prev.setDate(prev.getDate() - 1);
                expectedDate = prev.toISOString().split('T')[0];
            } else {
                break;
            }
        }
        return streak;
    },

    /**
     * Calculates total water consumed across all time
     */
    getTotalWater() {
        const all = StorageService.getSafe(StorageService.KEYS.NUTRITION, {});
        return Object.values(all).reduce((sum, day) => sum + (day.waterMl || 0), 0);
    }
};
