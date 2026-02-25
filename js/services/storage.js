/* ============================================
   STORAGE SERVICE
   Camada de abstração: localStorage (offline) + Supabase (cloud).
   Mantém compatibilidade total com o código existente.
   ============================================ */
window.StorageService = {
    VERSION: '1.0.0',

    KEYS: {
        META: 'monjaro_meta',
        PROFILE: 'monjaro_profile',
        WEIGHTS: 'monjaro_weights',
        NUTRITION: 'monjaro_nutrition',
        INJECTIONS: 'monjaro_injections',
        SYMPTOMS: 'monjaro_symptoms',
        JOURNEY: 'monjaro_journey',
        CUSTOM_FOODS: 'monjaro_custom_foods',
        SCHEDULE: 'monjaro_schedule',
        NOTIFICATION_SETTINGS: 'monjaro_notification_settings',
        LAST_GOOD: 'monjaro_last_good_state'
    },

    // Mapeamento: localStorage key → tabela Supabase + formato
    _cloudMap: {
        monjaro_profile: { table: 'profiles', format: 'single', pkField: 'id' },
        monjaro_weights: { table: 'weights', format: 'object_by_date', dateField: 'date' },
        monjaro_nutrition: { table: 'nutrition', format: 'object_by_date', dateField: 'date' },
        monjaro_injections: { table: 'injections', format: 'array', dateField: 'date' },
        monjaro_symptoms: { table: 'symptoms', format: 'object_by_date', dateField: 'date' },
        monjaro_journey: { table: null, format: 'composite' }, // Handled specially
        monjaro_custom_foods: { table: 'custom_foods', format: 'array' },
        monjaro_schedule: { table: 'injection_schedule', format: 'single' }
    },

    // Cache em memória para dados carregados do Supabase
    _cache: {},
    _cacheLoaded: {},

    // ─── CORE: localStorage (síncrono, sempre disponível) ──

    getSafe(key, defaultValue = null) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : defaultValue;
        } catch (e) {
            console.error(`Erro ao ler ${key}:`, e);
            return defaultValue;
        }
    },

    get(key) {
        return this.getSafe(key);
    },

    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));

            // Sync assíncrono para o Supabase (fire-and-forget)
            this._syncToCloud(key, value);

            return true;
        } catch (e) {
            console.error(`Erro ao salvar ${key}:`, e);
            return false;
        }
    },

    remove(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (e) {
            return false;
        }
    },

    // ─── SYNC ASSÍNCRONO PARA SUPABASE ─────────

    async _syncToCloud(key, value) {
        // Só sincroniza se estiver autenticado e o Supabase estiver disponível
        if (!window.AuthService || !AuthService.isLoggedIn()) return;
        if (!window.SupabaseService) return;

        // PROTEÇÃO CONTRA SOBRESCRITA (READ-ONLY PARA NÃO APROVADOS E GHOSTS)
        const profile = this.getSafe(this.KEYS.PROFILE, {});

        // Bloqueio 1: Usuários explicitamente não aprovados
        if (profile.is_approved === false) {
            console.warn('StorageSync Bloqueado: Usuário pendente (Read-Only). Alterações locais não subirão.');
            return;
        }

        // Bloqueio 2: Impede que perfis "fantasmas" (sem nome ou onboarding) apaguem a nuvem acidentalmente no boot
        if (key === this.KEYS.PROFILE) {
            if (!profile.onboardingComplete || !profile.name || profile.name.trim() === '') {
                console.warn('StorageSync Abortado: Tentativa de sincronizar perfil nulo ou incompleto evitada. A nuvem está segura.');
                return;
            }
        }

        const mapping = this._cloudMap[key];
        if (!mapping || !mapping.table) return; // Não sincroniza JOURNEY, META, LAST_GOOD

        try {
            const user = await SupabaseService.getUser();
            if (!user) return;

            switch (mapping.format) {
                case 'single':
                    await this._syncSingle(mapping, value, user.id);
                    break;
                case 'object_by_date':
                    await this._syncObjectByDate(mapping, value, user.id);
                    break;
                case 'array':
                    // Arrays são sincronizados sob demanda (não a cada set completo)
                    // para evitar duplicatas. Sincronização granular é feita pelos services.
                    break;
            }
        } catch (e) {
            console.warn(`StorageService: Falha no sync cloud para ${key}:`, e.message);
        }
    },

    async _syncSingle(mapping, value, userId) {
        if (!value) return;

        if (mapping.table === 'profiles') {
            // Profile usa user.id como PK
            const row = this._profileToRow(value);
            await SupabaseService.update('profiles', row, { id: userId });
        } else if (mapping.table === 'injection_schedule') {
            const row = {
                day_of_week: value.dayOfWeek !== undefined ? value.dayOfWeek : null,
                time: value.time || null
            };
            await SupabaseService.upsert('injection_schedule', row, 'user_id');
        }
    },

    async _syncObjectByDate(mapping, value, userId) {
        if (!value || typeof value !== 'object') return;

        // Encontra a entrada mais recente (otimização: só sincroniza a última alteração)
        const entries = Object.entries(value);
        if (entries.length === 0) return;

        // Pega a última entry modificada (heurística: última no objeto)
        const lastEntry = entries[entries.length - 1];
        if (!lastEntry) return;

        const [dateKey, data] = lastEntry;
        let row;

        switch (mapping.table) {
            case 'weights':
                row = {
                    date: dateKey,
                    weight_kg: data.weightKg,
                    fat_percent: data.fatPercent || null
                };
                break;
            case 'nutrition':
                row = {
                    date: dateKey,
                    protein_g: data.proteinConsumed || 0,
                    water_ml: data.waterMl || 0,
                    fiber_g: data.fiberG || 0,
                    meals: data.meals || [],
                    flags: data.flags || {}
                };
                break;
            case 'symptoms':
                row = {
                    date: data.dateISO || dateKey,
                    nausea: data.nausea || 0,
                    constipation: data.constipation || 0,
                    diarrhea: data.diarrhea || 0,
                    heartburn: data.heartburn || 0,
                    fatigue: data.fatigue || 0,
                    headache: data.headache || 0,
                    anxiety: data.anxiety || 0,
                    custom: data.custom || [],
                    notes: data.notes || null
                };
                break;
            default:
                return;
        }

        await SupabaseService.upsert(mapping.table, row, 'user_id,date');
    },

    _profileToRow(profile) {
        return {
            name: profile.name || null,
            sex: profile.sex || null,
            birthdate: profile.birthdate || null,
            height_cm: profile.heightCm || null,
            weight_goal_kg: profile.weightGoalKg || profile.targetWeight || null,
            activity_level: profile.activityLevel || 'sedentary',
            kidney_health: profile.kidneyHealth || 'normal',
            goal_type: profile.goalType || 'lose_weight',
            drug: profile.drug || profile.medication || null,
            use_medication: profile.useMedication || false,
            daily_water_ml: profile.dailyWater || 2000,
            daily_protein_g: profile.dailyProtein || 100,
            daily_fiber_g: profile.dailyFiber || 30,
            onboarding_complete: profile.onboardingComplete || false
        };
    },

    // ─── LOAD FROM CLOUD (Pull inicial) ────────

    /**
     * Puxa dados do Supabase para o localStorage (executa ao login).
     * Prioridade: Cloud > Local (dados na nuvem são a fonte da verdade).
     */
    async loadFromCloud() {
        if (!window.SupabaseService || !window.AuthService || !AuthService.isLoggedIn()) return;

        const user = await SupabaseService.getUser();
        if (!user) return;

        console.log('StorageService: Carregando dados da nuvem...');

        try {
            // Profile — usa client direto para evitar order-by em tabela sem coluna 'date'
            const client = SupabaseService.getClient();
            const { data: profileData } = await client
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .maybeSingle();
            const profiles = profileData ? [profileData] : [];
            if (profiles.length > 0) {
                const p = profiles[0];
                const localProfile = this.getSafe(this.KEYS.PROFILE, {});

                // Usa user_metadata como fallback seguro para o nome (nunca corrompido por bugs de sync)
                const metaName = user.user_metadata?.name || user.user_metadata?.full_name || null;
                // Prioridade: DB profile.name → auth user_metadata → cache local (ignorando 'Usuário' default)
                const localNameSafe = (localProfile.name && localProfile.name !== 'Usuário') ? localProfile.name : null;
                const resolvedName = p.name || metaName || localNameSafe || '';

                const cloudProfile = {
                    ...localProfile,
                    name: resolvedName,
                    sex: p.sex || localProfile.sex,
                    birthdate: p.birthdate || localProfile.birthdate,
                    heightCm: p.height_cm || localProfile.heightCm,
                    weightGoalKg: p.weight_goal_kg || localProfile.weightGoalKg,
                    activityLevel: p.activity_level || localProfile.activityLevel,
                    kidneyHealth: p.kidney_health || localProfile.kidneyHealth,
                    goalType: p.goal_type || localProfile.goalType,
                    drug: p.drug || localProfile.drug,
                    useMedication: p.use_medication ?? localProfile.useMedication,
                    dailyWater: p.daily_water_ml || localProfile.dailyWater,
                    dailyProtein: p.daily_protein_g || localProfile.dailyProtein,
                    dailyFiber: p.daily_fiber_g || localProfile.dailyFiber,
                    onboardingComplete: p.onboarding_complete ?? localProfile.onboardingComplete,
                    is_approved: p.is_approved ?? localProfile.is_approved,
                    createdAt: p.created_at || localProfile.createdAt
                };
                localStorage.setItem(this.KEYS.PROFILE, JSON.stringify(cloudProfile));

                // Restaura notification_settings salvas na nuvem (novo dispositivo)
                if (p.notification_settings) {
                    const localNotifSettings = this.getSafe(this.KEYS.NOTIFICATION_SETTINGS, null);
                    if (!localNotifSettings) {
                        localStorage.setItem(
                            this.KEYS.NOTIFICATION_SETTINGS,
                            JSON.stringify(p.notification_settings)
                        );
                    }
                }
            }

            // Weights
            const weights = await SupabaseService.select('weights', {}, 'date', true);
            if (weights.length > 0) {
                const obj = {};
                weights.forEach(w => {
                    const profile = this.getSafe(this.KEYS.PROFILE, {});
                    const heightCm = profile.heightCm || 160;
                    const bmi = w.weight_kg / ((heightCm / 100) ** 2);
                    obj[w.date] = {
                        dateISO: w.date,
                        weightKg: parseFloat(w.weight_kg),
                        fatPercent: w.fat_percent ? parseFloat(w.fat_percent) : null,
                        bmi: parseFloat(bmi.toFixed(2))
                    };
                });
                localStorage.setItem(this.KEYS.WEIGHTS, JSON.stringify(obj));
            }

            // Injections
            const injections = await SupabaseService.select('injections', {}, 'date', true);
            if (injections.length > 0) {
                const arr = injections.map(i => ({
                    id: i.id,
                    dateISO: i.date,
                    time: i.time || null,
                    drugName: i.drug_name,
                    doseMg: parseFloat(i.dose_mg),
                    site: i.site || null,
                    side: i.side || null,
                    notes: i.notes || null
                }));
                localStorage.setItem(this.KEYS.INJECTIONS, JSON.stringify(arr));
            }

            // Nutrition
            const nutrition = await SupabaseService.select('nutrition', {}, 'date', true);
            if (nutrition.length > 0) {
                const obj = {};
                nutrition.forEach(n => {
                    obj[n.date] = {
                        dateISO: n.date,
                        proteinConsumed: parseFloat(n.protein_g || 0),
                        waterMl: parseInt(n.water_ml || 0),
                        fiberG: parseFloat(n.fiber_g || 0),
                        meals: n.meals || [],
                        flags: n.flags || {}
                    };
                });
                localStorage.setItem(this.KEYS.NUTRITION, JSON.stringify(obj));
            }

            // Symptoms
            const symptoms = await SupabaseService.select('symptoms', {}, 'date', true);
            if (symptoms.length > 0) {
                const obj = {};
                symptoms.forEach(s => {
                    obj[s.date] = {
                        dateISO: s.date,
                        nausea: s.nausea || 0,
                        constipation: s.constipation || 0,
                        diarrhea: s.diarrhea || 0,
                        heartburn: s.heartburn || 0,
                        fatigue: s.fatigue || 0,
                        headache: s.headache || 0,
                        anxiety: s.anxiety || 0,
                        custom: s.custom || [],
                        notes: s.notes || null
                    };
                });
                localStorage.setItem(this.KEYS.SYMPTOMS, JSON.stringify(obj));
            }

            // Custom Foods
            const customFoods = await SupabaseService.select('custom_foods', {}, 'created_at', true);
            if (customFoods.length > 0) {
                const arr = customFoods.map(f => ({
                    id: f.id,
                    name: f.name,
                    proteinPer100g: f.protein_per_100g,
                    fiberPer100g: f.fiber_per_100g,
                    proteinPerUnit: f.protein_per_unit,
                    proteinPerScoop: f.protein_per_scoop,
                    defaultUnit: f.default_unit || 'g'
                }));
                localStorage.setItem(this.KEYS.CUSTOM_FOODS, JSON.stringify(arr));
            }

            // Schedule
            const schedule = await SupabaseService.select('injection_schedule', {}, 'created_at', true);
            if (schedule.length > 0) {
                const s = schedule[0];
                localStorage.setItem(this.KEYS.SCHEDULE, JSON.stringify({
                    dayOfWeek: s.day_of_week,
                    time: s.time
                }));
            }

            console.log('StorageService: Dados carregados da nuvem com sucesso.');

        } catch (e) {
            console.error('StorageService: Erro ao carregar da nuvem:', e);
        }
    },

    // ─── SNAPSHOT, RESTORE, EXPORT, IMPORT (original) ──

    snapshot() {
        const state = {};
        Object.values(this.KEYS).forEach(key => {
            if (key !== this.KEYS.JOURNEY) {
                state[key] = this.getSafe(key);
            }
        });
        // Snapshot é local-only (não sincroniza para cloud)
        try {
            localStorage.setItem(this.KEYS.LAST_GOOD, JSON.stringify(state));
        } catch (e) { /* ignore */ }
        this.updateMeta();
    },

    restore() {
        const lastGood = this.getSafe(this.KEYS.LAST_GOOD);
        if (lastGood) {
            Object.entries(lastGood).forEach(([key, value]) => {
                if (value !== null && key !== this.KEYS.LAST_GOOD) {
                    this.set(key, value);
                }
            });
            return true;
        }
        return false;
    },

    updateMeta() {
        try {
            localStorage.setItem(this.KEYS.META, JSON.stringify({
                version: this.VERSION,
                lastBackup: new Date().toISOString()
            }));
        } catch (e) { /* ignore */ }
    },

    exportAll() {
        const data = { version: this.VERSION, exportDate: new Date().toISOString() };
        Object.entries(this.KEYS).forEach(([name, key]) => {
            if (key !== this.KEYS.LAST_GOOD && key !== this.KEYS.META) {
                data[name.toLowerCase()] = this.getSafe(key);
            }
        });
        return data;
    },

    importData(data, mode = 'merge') {
        if (mode === 'replace') {
            Object.values(this.KEYS).forEach(key => this.remove(key));
        }

        // Handle legacy key mappings
        if (data.injecoes && !data.injections) data.injections = data.injecoes;
        if (data.pesos && !data.weights) data.weights = data.pesos;
        if (data.refeicoes && !data.nutrition) data.nutrition = data.refeicoes;
        if (data.cronograma && !data.schedule) data.schedule = data.cronograma;

        const keyMap = {
            profile: this.KEYS.PROFILE,
            weights: this.KEYS.WEIGHTS,
            nutrition: this.KEYS.NUTRITION,
            injections: this.KEYS.INJECTIONS,
            symptoms: this.KEYS.SYMPTOMS,
            journey: this.KEYS.JOURNEY,
            custom_foods: this.KEYS.CUSTOM_FOODS,
            schedule: this.KEYS.SCHEDULE
        };

        const priorityOrder = ['profile', 'weights', 'injections', 'nutrition', 'symptoms', 'schedule', 'custom_foods', 'journey'];

        priorityOrder.forEach(key => {
            if (data[key]) {
                let value = data[key];

                // Legacy Normalization for Profile
                if (key === 'profile') {
                    if (value.birthDate && !value.birthdate) value.birthdate = value.birthDate;
                    if (value.renalHealth && !value.kidneyHealth) value.kidneyHealth = value.renalHealth;
                    if (value.medicationUsage !== undefined && value.useMedication === undefined) {
                        value.useMedication = (value.medicationUsage === 'yes' || value.medicationUsage === true);
                    }
                    delete value.birthDate;
                    delete value.renalHealth;
                    delete value.medicationUsage;
                }

                // Normalization for Arrays
                if (Array.isArray(value)) {
                    value = value.map(item => {
                        if (!item) return item;
                        if (item.date && !item.dateISO) item.dateISO = item.date;
                        if (key === 'injections') {
                            if (item.drug && !item.drugName) item.drugName = item.drug;
                            if (item.dose !== undefined && item.doseMg === undefined) item.doseMg = parseFloat(item.dose);
                        }
                        return item;
                    }).filter(Boolean);
                }

                // Weights: backups antigos exportam como array; formato interno é objeto keyed by dateISO.
                // Converter para garantir compatibilidade com WeightService e _syncToCloud.
                if (key === 'weights' && Array.isArray(value)) {
                    const obj = {};
                    value.forEach(w => { if (w.dateISO) obj[w.dateISO] = w; });
                    value = obj;
                }

                try {
                    if (mode === 'merge' && Array.isArray(value) && key !== 'profile') {
                        const existing = this.getSafe(keyMap[key], []);
                        const merged = [...existing];
                        value.forEach(item => {
                            const isDuplicate = merged.find(e => {
                                if (item.id && e.id) return item.id === e.id;
                                if (item.dateISO && e.dateISO) {
                                    if (key === 'injections') return e.dateISO === item.dateISO && e.drugName === item.drugName;
                                    return e.dateISO === item.dateISO;
                                }
                                return false;
                            });
                            if (!isDuplicate) merged.push(item);
                        });
                        this.set(keyMap[key], merged);
                    } else {
                        this.set(keyMap[key], value);
                    }
                } catch (e) {
                    console.error(`Quota exceeded or error saving ${key}:`, e);
                    if (key === 'journey') {
                        alert('Aviso: O backup foi restaurado, mas fotos da galeria podem não ter sido salvas por falta de espaço no navegador.');
                    } else {
                        console.warn(`Non-critical failure saving ${key}. Continuing...`);
                    }
                }
            }
        });

        this.updateMeta();
        this.snapshot();
        return true;
    },

    clearAll() {
        Object.values(this.KEYS).forEach(key => this.remove(key));
    },

    // Sincroniza todos os dados do localStorage com o Supabase.
    // Usado após importação de JSON para garantir que a nuvem reflita o backup.
    async syncAllToCloud() {
        const skipKeys = [this.KEYS.LAST_GOOD, this.KEYS.META];
        for (const key of Object.values(this.KEYS)) {
            if (skipKeys.includes(key)) continue;
            const value = this.getSafe(key);
            if (value !== null && value !== undefined) {
                try {
                    await this._syncToCloud(key, value);
                } catch (e) {
                    console.warn(`StorageService.syncAllToCloud: erro ao sincronizar ${key}:`, e);
                }
            }
        }
    }
};
