/* ============================================
   MIGRATION SERVICE
   localStorage → Supabase (executa uma vez)
   ============================================ */
window.MigrationService = {
    MIGRATION_FLAG: 'ascenda_migrated_to_supabase',

    /**
     * Verifica se há dados locais antigos e faz upload em lote para o Supabase.
     * Executa apenas uma vez por usuário (flag no localStorage).
     */
    async migrateLocalDataToSupabase() {
        // Já migrou?
        if (localStorage.getItem(this.MIGRATION_FLAG) === 'true') {
            console.log('MigrationService: Dados já migrados anteriormente.');
            return { migrated: false, reason: 'already_done' };
        }

        // Tem dados locais?
        const hasLocalData = this._hasLocalData();
        if (!hasLocalData) {
            console.log('MigrationService: Nenhum dado local encontrado para migrar.');
            localStorage.setItem(this.MIGRATION_FLAG, 'true');
            return { migrated: false, reason: 'no_data' };
        }

        // Verifica autenticação
        const user = await SupabaseService.getUser();
        if (!user) {
            console.warn('MigrationService: Usuário não autenticado, adiando migração.');
            return { migrated: false, reason: 'no_auth' };
        }

        console.log('MigrationService: Iniciando migração localStorage → Supabase...');
        const results = {};

        try {
            // 1. PROFILE
            results.profile = await this._migrateProfile(user.id);

            // 2. WEIGHTS
            results.weights = await this._migrateWeights();

            // 3. INJECTIONS
            results.injections = await this._migrateInjections();

            // 4. NUTRITION
            results.nutrition = await this._migrateNutrition();

            // 5. SYMPTOMS
            results.symptoms = await this._migrateSymptoms();

            // 6. JOURNEY (milestones, measurements, photos metadata)
            results.journey = await this._migrateJourney();

            // 7. CUSTOM FOODS
            results.customFoods = await this._migrateCustomFoods();

            // 8. INJECTION SCHEDULE
            results.schedule = await this._migrateSchedule();

            // Marca como migrado
            localStorage.setItem(this.MIGRATION_FLAG, 'true');

            console.log('MigrationService: Migração concluída!', results);

            // Notifica o usuário
            if (window.UI) {
                UI.toast('Dados locais migrados para a nuvem com sucesso!', 'success', 5000);
            }

            return { migrated: true, results };

        } catch (e) {
            console.error('MigrationService: Erro fatal na migração:', e);
            if (window.UI) {
                UI.toast('Erro ao migrar dados para a nuvem. Tente novamente.', 'error');
            }
            return { migrated: false, reason: 'error', error: e.message };
        }
    },

    // ─── CHECAGEM ──────────────────────────────
    _hasLocalData() {
        const keys = [
            'monjaro_profile', 'monjaro_weights', 'monjaro_injections',
            'monjaro_nutrition', 'monjaro_symptoms', 'monjaro_journey',
            'monjaro_custom_foods', 'monjaro_schedule'
        ];
        return keys.some(key => {
            const val = localStorage.getItem(key);
            return val && val !== 'null' && val !== '{}' && val !== '[]';
        });
    },

    // ─── MIGRAÇÕES INDIVIDUAIS ─────────────────

    async _migrateProfile(userId) {
        const raw = StorageService.getSafe(StorageService.KEYS.PROFILE, null);
        if (!raw) return { skipped: true };

        const profile = {
            name: raw.name || null,
            sex: raw.sex || null,
            birthdate: raw.birthdate || null,
            height_cm: raw.heightCm || null,
            weight_goal_kg: raw.weightGoalKg || raw.targetWeight || null,
            activity_level: raw.activityLevel || 'sedentary',
            kidney_health: raw.kidneyHealth || 'normal',
            goal_type: raw.goalType || 'lose_weight',
            drug: raw.drug || raw.medication || null,
            use_medication: raw.useMedication || false,
            daily_water_ml: raw.dailyWater || 2000,
            daily_protein_g: raw.dailyProtein || 100,
            daily_fiber_g: raw.dailyFiber || 30,
            onboarding_complete: raw.onboardingComplete || false,
            // Campos clínicos — afetam cálculo de proteína
            diabetes: raw.diabetes || false,
            sarcopenia: raw.sarcopenia || false,
            // Metas manuais do usuário
            manual_protein_goal: raw.manualProteinGoal || null,
            manual_fiber_goal: raw.manualFiberGoal || null,
            manual_water_goal: raw.manualWaterGoal || null,
            // Preferências de notificação (coluna JSONB)
            notification_settings: StorageService.getSafe(StorageService.KEYS.NOTIFICATION_SETTINGS, null),
            // Foto de perfil (Base64 200x200px JPEG já comprimido pelo Croppie)
            avatar_url: raw.photo || null
        };

        // Profile usa o user.id como PK, então fazemos update
        const { error } = await SupabaseService.update('profiles', profile, { id: userId });
        return { success: !error, error: error?.message };
    },

    async _migrateWeights() {
        const raw = StorageService.getSafe(StorageService.KEYS.WEIGHTS, {});
        const entries = Object.values(raw);
        if (entries.length === 0) return { skipped: true, count: 0 };

        const rows = entries
            .filter(w => w && w.dateISO && w.weightKg)
            .map(w => ({
                date: w.dateISO,
                weight_kg: parseFloat(w.weightKg),
                fat_percent: w.fatPercent ? parseFloat(w.fatPercent) : null
            }));

        if (rows.length === 0) return { skipped: true, count: 0 };

        // Batch upsert (evita duplicatas por date)
        const { error } = await SupabaseService.upsert('weights', rows, 'user_id,date');
        return { success: !error, count: rows.length, error: error?.message };
    },

    async _migrateInjections() {
        const raw = StorageService.getSafe(StorageService.KEYS.INJECTIONS, []);
        if (!Array.isArray(raw) || raw.length === 0) return { skipped: true, count: 0 };

        let updatedLocal = false;
        const rows = raw
            .filter(i => i && (i.dateISO || i.date) && i.drugName)
            .map(i => {
                // Garante que o item local tenha um ID único permanente
                if (!i.id) {
                    i.id = SecurityUtils.generateUUID();
                    updatedLocal = true;
                }
                return {
                    id: i.id,
                    date: i.dateISO || i.date,
                    time: i.time || null,
                    drug_name: i.drugName || i.drug || 'Desconhecido',
                    dose_mg: parseFloat(i.doseMg || i.dose || 0),
                    site: i.site || null,
                    side: i.side || null,
                    notes: i.notes || null
                };
            });

        if (rows.length === 0) return { skipped: true, count: 0 };

        // Salva de volta se geramos IDs novos
        if (updatedLocal) {
            StorageService.set(StorageService.KEYS.INJECTIONS, raw);
        }

        const { error } = await SupabaseService.upsert('injections', rows, 'id');
        return { success: !error, count: rows.length, error: error?.message };
    },

    async _migrateNutrition() {
        let raw = StorageService.getSafe(StorageService.KEYS.NUTRITION, {});
        if (Array.isArray(raw)) raw = {};
        const entries = Object.entries(raw);
        if (entries.length === 0) return { skipped: true, count: 0 };

        // Busca flags de nutrição
        const allFlags = StorageService.getSafe('NUTRITION_FLAGS', {});

        const rows = entries
            .filter(([dateISO, data]) => dateISO && data)
            .map(([dateISO, data]) => ({
                date: dateISO,
                protein_g: data.proteinConsumed || 0,
                water_ml: data.waterMl || 0,
                fiber_g: data.fiberG || 0,
                meals: data.meals || [],
                flags: allFlags[dateISO] || {}
            }));

        if (rows.length === 0) return { skipped: true, count: 0 };

        const { error } = await SupabaseService.upsert('nutrition', rows, 'user_id,date');
        return { success: !error, count: rows.length, error: error?.message };
    },

    async _migrateSymptoms() {
        let raw = StorageService.getSafe(StorageService.KEYS.SYMPTOMS, {});
        const entries = Array.isArray(raw) ? raw : Object.values(raw);
        if (entries.length === 0) return { skipped: true, count: 0 };

        const rows = entries
            .filter(s => s && s.dateISO)
            .map(s => ({
                date: s.dateISO,
                nausea: s.nausea || 0,
                constipation: s.constipation || 0,
                diarrhea: s.diarrhea || 0,
                heartburn: s.heartburn || 0,
                fatigue: s.fatigue || 0,
                headache: s.headache || 0,
                anxiety: s.anxiety || 0,
                custom: s.custom || [],
                notes: s.notes || null
            }));

        if (rows.length === 0) return { skipped: true, count: 0 };

        const { error } = await SupabaseService.upsert('symptoms', rows, 'user_id,date');
        return { success: !error, count: rows.length, error: error?.message };
    },

    async _migrateJourney() {
        const journey = StorageService.getSafe(StorageService.KEYS.JOURNEY, null);
        if (!journey) return { skipped: true };

        const results = {};

        // Milestones
        if (journey.milestones && journey.milestones.length > 0) {
            const milestoneRows = journey.milestones
                .filter(m => m && m.title)
                .map(m => ({
                    date: m.dateISO || DateService.today(),
                    title: m.title,
                    description: m.description || null,
                    icon: m.icon || null
                }));

            if (milestoneRows.length > 0) {
                // Usamos date,title como constraint para milestones legados ou melhor: não usar data se puder colidir
                const { error } = await SupabaseService.upsert('journey_milestones', milestoneRows, 'user_id,date,title');
                results.milestones = { success: !error, count: milestoneRows.length };
            }
        }

        // Measurements
        if (journey.measurements && journey.measurements.length > 0) {
            const measureRows = journey.measurements
                .filter(m => m && m.name && m.value)
                .map(m => ({
                    date: m.dateISO || DateService.today(),
                    name: m.name,
                    value: parseFloat(m.value),
                    unit: m.unit || 'cm'
                }));

            if (measureRows.length > 0) {
                const { error } = await SupabaseService.upsert('journey_measurements', measureRows, 'user_id,date,name');
                results.measurements = { success: !error, count: measureRows.length };
            }
        }

        // Photos metadata — envia registros para journey_photos com photo_url=null inicialmente.
        // Os blobs reais serão sincronizados em background por JourneyService.syncPhotosToCloud()
        // logo após esta migração terminar (ver setTimeout abaixo).
        if (journey.photos && journey.photos.length > 0) {
            const photoRows = journey.photos
                .filter(p => p && p.dateISO)
                .map(p => ({
                    date: p.dateISO,
                    weight_kg: p.weightKg ? parseFloat(p.weightKg) : null,
                    note: p.note || null,
                    photo_url: p.cloudUrl || null, // Preserva cloudUrl existente se houver
                    local_id: p.id || null          // Preserva o id real para restauração correta em novos dispositivos
                }));

            if (photoRows.length > 0) {
                const { error } = await SupabaseService.upsert('journey_photos', photoRows, 'user_id,date');
                results.photos = { success: !error, count: photoRows.length };
            }
        }

        // Agenda sincronização de blobs em background.
        // O delay de 1500ms garante que toda a migração de dados seja finalizada antes
        // de começar o upload de fotos (que é mais pesado).
        // Completamente seguro: JourneyService.syncPhotosToCloud() é à prova de falhas.
        setTimeout(() => {
            if (window.JourneyService && typeof JourneyService.syncPhotosToCloud === 'function') {
                console.log('MigrationService: agendando sincronização de blobs de fotos...');
                JourneyService.syncPhotosToCloud();
            }
        }, 1500);

        return results;
    },

    async _migrateCustomFoods() {
        const raw = StorageService.getSafe(StorageService.KEYS.CUSTOM_FOODS, []);
        if (!Array.isArray(raw) || raw.length === 0) return { skipped: true, count: 0 };

        const rows = raw
            .filter(f => f && f.name)
            .map(f => ({
                name: f.name,
                protein_per_100g: f.proteinPer100g || null,
                fiber_per_100g: f.fiberPer100g || null,
                protein_per_unit: f.proteinPerUnit || null,
                protein_per_scoop: f.proteinPerScoop || null,
                default_unit: f.defaultUnit || 'g'
            }));

        if (rows.length === 0) return { skipped: true, count: 0 };

        const { error } = await SupabaseService.upsert('custom_foods', rows, 'user_id,name');
        return { success: !error, count: rows.length, error: error?.message };
    },

    async _migrateSchedule() {
        const raw = StorageService.getSafe(StorageService.KEYS.SCHEDULE, null);
        if (!raw) return { skipped: true };

        const row = {
            day_of_week: raw.dayOfWeek !== undefined ? raw.dayOfWeek : null,
            time: raw.time || null,
            interval_days: raw.intervalDays || 7
        };

        const { error } = await SupabaseService.upsert('injection_schedule', row, 'user_id');
        return { success: !error, error: error?.message };
    }
};
