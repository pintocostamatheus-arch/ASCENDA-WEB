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
        LAST_GOOD: 'monjaro_last_good_state',
        NUTRITION_FLAGS: 'NUTRITION_FLAGS'
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
        monjaro_schedule: { table: 'injection_schedule', format: 'single' },
        monjaro_notification_settings: { table: 'profiles', format: 'notification_sync' }
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
            if (e.name === 'QuotaExceededError' || e.code === 22) {
                if (window.UI) UI.toast('Armazenamento local cheio. Seus dados podem não ser salvos. Limpe dados antigos ou reinstale o app.', 'error');
            }
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
                case 'notification_sync':
                    // notification_settings é salvo como coluna JSONB na tabela profiles
                    await this._syncNotificationSettings(value, user.id);
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
                time: value.time || null,
                interval_days: value.intervalDays || 7
            };
            await SupabaseService.upsert('injection_schedule', row, 'user_id');
        }
    },

    /**
     * Sincroniza notification_settings para a coluna JSONB na tabela profiles.
     * Chamado automaticamente quando o usuário altera preferências de notificação.
     */
    async _syncNotificationSettings(value, userId) {
        if (!value || !userId) return;
        try {
            await SupabaseService.update('profiles', { notification_settings: value }, { id: userId });
        } catch (e) {
            console.warn('StorageService._syncNotificationSettings: falha (não crítica):', e.message);
        }
    },

    async _syncObjectByDate(mapping, value, userId, syncAll = false) {
        if (!value || typeof value !== 'object') return;

        const entries = Object.entries(value);
        if (entries.length === 0) return;

        // syncAll=true: sincroniza todas as entradas (usado na importação de backup)
        // syncAll=false: sincroniza o dia de hoje (operação mais comum) ou fallback para última entrada
        let entriesToSync;
        if (syncAll) {
            entriesToSync = entries;
        } else {
            const today = window.DateService ? DateService.today() : new Date().toISOString().split('T')[0];
            const todayEntry = entries.find(([dateKey]) => dateKey === today);
            entriesToSync = todayEntry ? [todayEntry] : [entries[entries.length - 1]];
        }

        for (const [dateKey, data] of entriesToSync) {
            if (!data) continue;
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
        }
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
            onboarding_complete: profile.onboardingComplete || false,
            // Campos clínicos — afetam diretamente o cálculo de proteína
            diabetes: profile.diabetes || false,
            sarcopenia: profile.sarcopenia || false,
            // Metas manuais definidas pelo usuário no perfil
            manual_protein_goal: profile.manualProteinGoal || null,
            manual_fiber_goal: profile.manualFiberGoal || null,
            manual_water_goal: profile.manualWaterGoal || null,
            // Foto de perfil (Base64 200x200px JPEG, ~15-30KB — seguro para coluna TEXT)
            avatar_url: profile.photo || null
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
                    subscription_expires_at: p.subscription_expires_at ?? localProfile.subscription_expires_at ?? null,
                    createdAt: p.created_at || localProfile.createdAt,
                    // Campos clínicos — críticos para cálculo correto de proteína
                    diabetes: p.diabetes ?? localProfile.diabetes ?? false,
                    sarcopenia: p.sarcopenia ?? localProfile.sarcopenia ?? false,
                    // Metas manuais definidas pelo usuário
                    manualProteinGoal: p.manual_protein_goal ?? localProfile.manualProteinGoal ?? null,
                    manualFiberGoal: p.manual_fiber_goal ?? localProfile.manualFiberGoal ?? null,
                    manualWaterGoal: p.manual_water_goal ?? localProfile.manualWaterGoal ?? null,
                    // Foto de perfil — prioridade: nuvem → local (restaura no novo dispositivo)
                    photo: p.avatar_url || localProfile.photo || null
                };
                localStorage.setItem(this.KEYS.PROFILE, JSON.stringify(cloudProfile));

                // Restaura notification_settings salvas na nuvem (novo dispositivo).
                // Se já existir localmente, mantém o local (pode ser mais recente).
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
                // Lê o perfil UMA vez (já foi salvo acima pelo bloco de profile)
                const profileForBmi = this.getSafe(this.KEYS.PROFILE, {});
                const heightCmForBmi = profileForBmi.heightCm || 160;
                weights.forEach(w => {
                    const bmi = w.weight_kg / ((heightCmForBmi / 100) ** 2);
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
                const rawArr = injections.map(i => ({
                    id: i.id,
                    dateISO: i.date,
                    time: i.time || null,
                    drugName: i.drug_name,
                    doseMg: parseFloat(i.dose_mg),
                    site: i.site || null,
                    side: i.side || null,
                    notes: i.notes || null
                }));
                // Deduplicação defensiva: remove duplicatas vindas da nuvem
                // (pode ocorrer por registros feitos em localhost ou reenvios acidentais)
                const seen = new Set();
                const arr = rawArr.filter(i => {
                    const key = `${i.dateISO}|${i.time || ''}|${i.drugName}|${i.doseMg}`;
                    if (seen.has(key)) return false;
                    seen.add(key);
                    return true;
                });
                if (arr.length < rawArr.length) {
                    console.warn(`loadFromCloud: ${rawArr.length - arr.length} injecao(oes) duplicada(s) removida(s) do cache local.`);
                }
                // Merge with existing local injections to prevent data loss 
                // (e.g., if local has unsynced entries, don't overwrite them)
                const localInjections = this.getSafe(this.KEYS.INJECTIONS, []);
                const merged = [...arr];

                localInjections.forEach(localInj => {
                    const isDup = merged.find(c => 
                        (c.id && localInj.id && c.id === localInj.id) || 
                        (c.dateISO === localInj.dateISO && (c.time || '') === (localInj.time || '') && c.drugName === localInj.drugName && c.doseMg === localInj.doseMg)
                    );
                    if (!isDup) merged.push(localInj);
                });

                // Sort by date
                merged.sort((a, b) => {
                    const dateA = a.dateISO || a.date || "";
                    const dateB = b.dateISO || b.date || "";
                    return dateA.localeCompare(dateB);
                });

                localStorage.setItem(this.KEYS.INJECTIONS, JSON.stringify(merged));
            }

            // Nutrition
            const nutrition = await SupabaseService.select('nutrition', {}, 'date', true);
            if (nutrition.length > 0) {
                const obj = this.getSafe(this.KEYS.NUTRITION, {});
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
                const obj = this.getSafe(this.KEYS.SYMPTOMS, {});
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
                    time: s.time,
                    intervalDays: s.interval_days || 7
                }));
            }

            // Journey Photos — restaura cloudUrls no dispositivo (novo dispositivo ou reinstalação)
            // Não substitui dados locais; apenas preenche cloudUrl onde estava vazio
            // e adiciona registros de fotos que só existem na nuvem.
            try {
                const journeyPhotos = await SupabaseService.select('journey_photos', {}, 'date', true);
                if (journeyPhotos.length > 0) {
                    const localJourney = this.getSafe(this.KEYS.JOURNEY, { photos: [], measurements: [], milestones: [] });
                    let journeyUpdated = false;

                    journeyPhotos.forEach(row => {
                        if (!row.photo_url) return; // Sem URL na nuvem, nada a restaurar

                        const localPhoto = localJourney.photos.find(p => p.dateISO === row.date);

                        if (localPhoto && !localPhoto.cloudUrl) {
                            // Foto existe localmente mas sem cloudUrl — restaura o link
                            localPhoto.cloudUrl = row.photo_url;
                            journeyUpdated = true;
                        } else if (!localPhoto) {
                            // Foto existe na nuvem mas não neste dispositivo (novo dispositivo)
                            // Cria entrada local com cloudUrl para que getPhotoUrl() funcione via fallback
                            localJourney.photos.push({
                                id: row.local_id || (new Date(row.date).getTime()) || Date.now(),
                                dateISO: row.date,
                                weightKg: row.weight_kg || null,
                                note: row.note || '',
                                storedInIDB: false, // Não está no IndexedDB deste dispositivo
                                cloudUrl: row.photo_url
                            });
                            journeyUpdated = true;
                        }
                    });

                    if (journeyUpdated) {
                        // Salva direto no localStorage (não via StorageService.set para não
                        // disparar _syncToCloud desnecessariamente para journey)
                        localStorage.setItem(this.KEYS.JOURNEY, JSON.stringify(localJourney));
                        console.log('StorageService: cloudUrls das fotos da jornada restaurados.');
                    }
                }
            } catch (e) {
                // Falha aqui é completamente não-crítica — dados locais permanecem intactos
                console.warn('StorageService.loadFromCloud: erro ao restaurar fotos da jornada (não crítico):', e.message);
            }

            // Journey Milestones — restaura marcos no dispositivo (novos desde a última migração)
            try {
                const cloudMilestones = await SupabaseService.select('journey_milestones', {}, 'date', true);
                if (cloudMilestones.length > 0) {
                    const localJourney = this.getSafe(this.KEYS.JOURNEY, { photos: [], measurements: [], milestones: [] });
                    let milestonesUpdated = false;

                    cloudMilestones.forEach(row => {
                        if (!row.title) return;
                        // Só adiciona se não existir localmente (evita duplicatas)
                        const exists = localJourney.milestones.find(m =>
                            m.title === row.title && m.dateISO === row.date
                        );
                        if (!exists) {
                            localJourney.milestones.push({
                                id: Date.now() + Math.floor(Math.random() * 1000),
                                dateISO: row.date,
                                title: row.title,
                                description: row.description || null,
                                icon: row.icon || null
                            });
                            milestonesUpdated = true;
                        }
                    });

                    if (milestonesUpdated) {
                        localStorage.setItem(this.KEYS.JOURNEY, JSON.stringify(localJourney));
                        console.log('StorageService: milestones da jornada restaurados da nuvem.');
                    }
                }
            } catch (e) {
                console.warn('StorageService.loadFromCloud: erro ao restaurar milestones (não crítico):', e.message);
            }

            // Journey Measurements — restaura medidas corporais no dispositivo
            try {
                const cloudMeasurements = await SupabaseService.select('journey_measurements', {}, 'date', true);
                if (cloudMeasurements.length > 0) {
                    // Re-lê o journey do localStorage para pegar qualquer mudança feita pelo bloco anterior
                    const localJourney = this.getSafe(this.KEYS.JOURNEY, { photos: [], measurements: [], milestones: [] });
                    let measurementsUpdated = false;

                    cloudMeasurements.forEach(row => {
                        if (!row.name || row.value === undefined || row.value === null) return;

                        // Encontra se já criamos (ou se já havia localmente) um registro para ESTA data
                        let measureObj = localJourney.measurements.find(m => m.dateISO === row.date);

                        if (!measureObj) {
                            // Se não existe, cria o objeto agrupador para essa data
                            measureObj = {
                                id: Date.now() + Math.floor(Math.random() * 1000),
                                dateISO: row.date
                            };
                            localJourney.measurements.push(measureObj);
                        }

                        // Se esse campo específico ainda não existir no objeto (ou se a nuvem for nova pra ele), atribui
                        if (measureObj[row.name] === undefined) {
                            measureObj[row.name] = parseFloat(row.value);
                            measurementsUpdated = true;
                        }
                    });

                    if (measurementsUpdated) {
                        localStorage.setItem(this.KEYS.JOURNEY, JSON.stringify(localJourney));
                        console.log('StorageService: medidas corporais da jornada restauradas da nuvem.');
                    }
                }
            } catch (e) {
                console.warn('StorageService.loadFromCloud: erro ao restaurar medidas corporais (não crítico):', e.message);
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
        // Sanitize imported data to prevent XSS via malicious JSON
        if (window.SecurityUtils && typeof SecurityUtils.sanitizeImportData === 'function') {
            data = SecurityUtils.sanitizeImportData(data);
        }

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
        if (!window.AuthService || !AuthService.isLoggedIn()) return;
        if (!window.SupabaseService) return;
        const user = await SupabaseService.getUser();
        if (!user) return;

        const skipKeys = [this.KEYS.LAST_GOOD, this.KEYS.META];
        for (const key of Object.values(this.KEYS)) {
            if (skipKeys.includes(key)) continue;
            const value = this.getSafe(key);
            if (value !== null && value !== undefined) {
                try {
                    const mapping = this._cloudMap[key];
                    // object_by_date (pesos, nutrição, sintomas): sincroniza TODAS as entradas
                    if (mapping && mapping.format === 'object_by_date') {
                        await this._syncObjectByDate(mapping, value, user.id, true);
                    } else {
                        await this._syncToCloud(key, value);
                    }
                } catch (e) {
                    console.warn(`StorageService.syncAllToCloud: erro ao sincronizar ${key}:`, e);
                }
            }
        }
    }
};
