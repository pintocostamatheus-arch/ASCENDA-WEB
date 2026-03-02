/* ============================================
   JOURNEY SERVICE
   Metadata in localStorage, photos in IndexedDB.
   Cloud sync: blobs → Supabase Storage (background, non-blocking).
   ============================================ */
window.JourneyService = {
    _migrated: false,

    get() {
        const data = StorageService.getSafe(StorageService.KEYS.JOURNEY, null);

        if (Array.isArray(data)) {
            const converted = { photos: data, measurements: [], milestones: [] };
            this.save(converted);
            return converted;
        }

        return data || { photos: [], measurements: [], milestones: [] };
    },

    save(journey) {
        const success = StorageService.set(StorageService.KEYS.JOURNEY, journey);
        StorageService.snapshot();
        return success;
    },

    // ─── CLOUD UPLOAD (Background, sem bloquear a UI) ────────

    /**
     * Tenta enviar um blob para o Supabase Storage.
     * REGRA DE OURO: NUNCA lança exceção. Falha é silenciosa.
     * O dado local (IndexedDB) é sempre a fonte primária.
     * @param {number} id - ID da foto (timestamp)
     * @param {Blob} blob - Blob da imagem comprimida
     * @returns {string|null} URL assinada (1 ano) ou null em caso de falha
     */
    async _uploadToCloud(id, blob) {
        try {
            if (!window.SupabaseService || !window.AuthService) return null;
            if (!AuthService.isLoggedIn()) return null;

            // Bloqueia usuários não aprovados
            const profile = StorageService.getSafe(StorageService.KEYS.PROFILE, {});
            if (profile.is_approved === false) return null;

            const filename = `photo_${id}.jpg`;
            const { url, error } = await SupabaseService.uploadPhoto(blob, filename);

            if (error || !url) {
                console.warn(`JourneyService._uploadToCloud: falha no upload da foto ${id}:`, error);
                return null;
            }

            console.log(`JourneyService._uploadToCloud: foto ${id} enviada para a nuvem com sucesso.`);
            return url;

        } catch (e) {
            console.warn(`JourneyService._uploadToCloud: exceção ao subir foto ${id}:`, e.message);
            return null; // Falha silenciosa — jamais propaga
        }
    },

    /**
     * Persiste o cloudUrl de uma foto nos metadados locais e na tabela journey_photos.
     * Operação defensiva: qualquer falha é ignorada.
     * @param {number} id - ID da foto
     * @param {string} cloudUrl - URL assinada retornada pelo Supabase Storage
     */
    async _saveCloudUrl(id, cloudUrl) {
        try {
            // 1. Atualiza metadado no localStorage
            const journey = this.get();
            const photo = journey.photos.find(p => p.id === id);
            if (photo) {
                photo.cloudUrl = cloudUrl;
                // Salva via StorageService.set (que chama _syncToCloud,
                // mas journey tem table: null, então não faz nada indevido na nuvem)
                this.save(journey);
            }

            // 2. Atualiza coluna photo_url na tabela journey_photos do Supabase
            if (window.SupabaseService && window.AuthService && AuthService.isLoggedIn()) {
                const user = await SupabaseService.getUser();
                if (user && photo && photo.dateISO) {
                    await SupabaseService.update(
                        'journey_photos',
                        { photo_url: cloudUrl },
                        { user_id: user.id, date: photo.dateISO }
                    );
                }
            }

        } catch (e) {
            console.warn(`JourneyService._saveCloudUrl: falha ao persistir cloudUrl para foto ${id}:`, e.message);
            // Não propaga — a foto ainda existe localmente, isso é apenas um bônus
        }
    },

    /**
     * Sincronização retroativa em background.
     * Varre todas as fotos sem cloudUrl e tenta enviar para a nuvem.
     * Roda completamente em background com 200ms de intervalo entre uploads
     * para não travar a UI ou sobrecarregar a rede.
     *
     * Acionado após login/migração. Seguro para ser chamado múltiplas vezes.
     */
    async syncPhotosToCloud() {
        try {
            if (!window.SupabaseService || !window.AuthService) return;
            if (!AuthService.isLoggedIn()) return;

            const profile = StorageService.getSafe(StorageService.KEYS.PROFILE, {});
            if (profile.is_approved === false) return;

            const journey = this.get();

            // Apenas fotos que existem no IndexedDB e ainda não têm URL na nuvem
            const pending = journey.photos.filter(p => p.storedInIDB && !p.cloudUrl);

            if (pending.length === 0) {
                console.log('JourneyService.syncPhotosToCloud: nenhuma foto pendente.');
                return;
            }

            console.log(`JourneyService.syncPhotosToCloud: ${pending.length} foto(s) para sincronizar.`);

            for (const photo of pending) {
                try {
                    // Recupera blob do IndexedDB
                    const db = await PhotoStorageService.open();
                    const blob = await new Promise((resolve) => {
                        try {
                            const tx = db.transaction('photos', 'readonly');
                            const req = tx.objectStore('photos').get(photo.id);
                            req.onsuccess = () => resolve(req.result?.blob || null);
                            req.onerror = () => resolve(null); // Não rejeita, apenas retorna null
                        } catch (e) {
                            resolve(null);
                        }
                    });

                    if (!blob) {
                        console.warn(`JourneyService.syncPhotosToCloud: blob não encontrado para foto ${photo.id}. Pulando.`);
                        continue;
                    }

                    const cloudUrl = await this._uploadToCloud(photo.id, blob);
                    if (cloudUrl) {
                        await this._saveCloudUrl(photo.id, cloudUrl);
                    }

                    // Yield de 200ms entre uploads para não travar a thread principal
                    await new Promise(resolve => setTimeout(resolve, 200));

                } catch (e) {
                    console.warn(`JourneyService.syncPhotosToCloud: erro na foto ${photo.id}:`, e.message);
                    // Continua com a próxima — falha em uma não para o processo
                }
            }

            console.log('JourneyService.syncPhotosToCloud: ciclo de sincronização concluído.');

        } catch (e) {
            console.warn('JourneyService.syncPhotosToCloud: erro geral (não crítico):', e.message);
            // Falha total é completamente silenciosa — o app continua funcionando
        }
    },

    // ─── CRUD DE FOTOS ───────────────────────────────────────

    /**
     * Adiciona uma foto:
     * 1. Salva blob no IndexedDB (SEMPRE, síncrono, fonte primária)
     * 2. Salva metadados no localStorage
     * 3. Dispara upload para nuvem em background (fire-and-update, sem bloquear)
     */
    async addPhoto(photoData) {
        const journey = this.get();
        const id = Date.now();

        const newPhoto = {
            id,
            dateISO: photoData.dateISO || DateService.today(),
            weightKg: photoData.weightKg || null,
            note: photoData.note || '',
            storedInIDB: true,
            cloudUrl: null // Preenchido após upload em background
        };

        // PASSO 1: Salva blob localmente (obrigatório, nunca pula)
        let savedBlob = null;
        if (photoData.blob) {
            await PhotoStorageService.savePhoto(id, photoData.blob);
            savedBlob = photoData.blob;
        } else if (photoData.image && photoData.image.startsWith('data:')) {
            const blob = PhotoStorageService.dataUrlToBlob(photoData.image);
            await PhotoStorageService.savePhoto(id, blob);
            savedBlob = blob;
        }

        // PASSO 2: Persiste metadados localmente
        journey.photos.push(newPhoto);
        this.save(journey);

        // PASSO 3: Upload para nuvem em background (não bloqueia, falha não afeta o fluxo)
        if (savedBlob) {
            this._uploadToCloud(id, savedBlob)
                .then(cloudUrl => {
                    if (cloudUrl) {
                        return this._saveCloudUrl(id, cloudUrl);
                    }
                })
                .catch(e => {
                    // Captura qualquer rejeição inesperada — log apenas, sem crash
                    console.warn('JourneyService.addPhoto: upload em background gerou exceção inesperada:', e.message);
                });
        }

        return newPhoto;
    },

    /**
     * Remove uma foto localmente e da nuvem (background).
     */
    async deletePhoto(id) {
        const journey = this.get();

        // Captura referência antes de remover (necessário para limpeza na nuvem)
        const photo = journey.photos.find(p => p.id === id);

        // Remove dos metadados locais
        journey.photos = journey.photos.filter(p => p.id !== id);
        this.save(journey);

        // Remove do IndexedDB local
        try { await PhotoStorageService.deletePhoto(id); } catch (e) { /* ignore */ }

        // Remove da nuvem em background (não bloqueia, falha é ignorada)
        if (photo) {
            const filename = `photo_${id}.jpg`;

            // Remove arquivo do Supabase Storage
            if (window.SupabaseService && window.AuthService && AuthService.isLoggedIn()) {
                SupabaseService.deletePhoto(filename).catch(e => {
                    console.warn(`JourneyService.deletePhoto: falha ao remover storage da nuvem para foto ${id}:`, e.message);
                });
            }

            // Remove registro da tabela journey_photos
            if (window.SupabaseService && window.AuthService && AuthService.isLoggedIn() && photo.dateISO) {
                SupabaseService.getUser()
                    .then(user => {
                        if (user) {
                            return SupabaseService.delete('journey_photos', { user_id: user.id, date: photo.dateISO });
                        }
                    })
                    .catch(e => {
                        console.warn(`JourneyService.deletePhoto: falha ao remover metadado da nuvem para foto ${id}:`, e.message);
                    });
            }
        }
    },

    /**
     * Retorna uma URL utilizável para exibir a foto.
     * Ordem de prioridade (da mais rápida/segura para a última alternativa):
     * 1. IndexedDB local (offline, instantâneo)
     * 2. cloudUrl salvo nos metadados (Supabase Storage — novo dispositivo)
     * 3. Base64 legado (fotos de versões antigas antes do IndexedDB)
     */
    async getPhotoUrl(id) {
        // 1. IndexedDB — fonte primária, funciona offline
        try {
            const url = await PhotoStorageService.getPhoto(id);
            if (url) return url;
        } catch (e) {
            console.warn(`JourneyService.getPhotoUrl: IndexedDB falhou para foto ${id}:`, e.message);
            // Não para aqui — tenta o próximo fallback
        }

        // 2. cloudUrl — foto existe na nuvem mas não neste dispositivo
        const journey = this.get();
        const photo = journey.photos.find(p => p.id === id);
        if (photo && photo.cloudUrl) {
            console.log(`JourneyService.getPhotoUrl: usando cloudUrl para foto ${id}.`);
            return photo.cloudUrl;
        }

        // 3. Base64 legado — compatibilidade com versões antigas
        return photo && photo.image ? photo.image : null;
    },

    // ─── MIGRAÇÃO LEGACY (Base64 → IndexedDB) ────────────────

    /** Auto-migrate legacy Base64 photos to IndexedDB (runs once) */
    async migratePhotos() {
        if (this._migrated) return;
        this._migrated = true;

        const journey = this.get();
        let changed = false;

        for (const photo of journey.photos) {
            if (photo.image && photo.image.startsWith('data:')) {
                try {
                    const blob = PhotoStorageService.dataUrlToBlob(photo.image);
                    await PhotoStorageService.savePhoto(photo.id, blob);
                    delete photo.image;
                    photo.storedInIDB = true;
                    changed = true;
                } catch (e) {
                    console.warn('Migration failed for photo', photo.id, e);
                }
            }
        }

        if (changed) {
            this.save(journey);
            console.log('JourneyService: Migrated legacy photos to IndexedDB');
        }
    },

    // ─── SYNC DE MILESTONES E MEDIDAS (Background, não-bloqueante) ──────────

    /**
     * Envia um marco para a tabela journey_milestones.
     * NUNCA lança exceção — falha é completamente silenciosa.
     */
    async _syncMilestoneToCloud(milestone) {
        try {
            if (!window.SupabaseService || !window.AuthService) return;
            if (!AuthService.isLoggedIn()) return;
            const profile = StorageService.getSafe(StorageService.KEYS.PROFILE, {});
            if (profile.is_approved === false) return;

            const row = {
                date: milestone.dateISO || DateService.today(),
                title: milestone.title,
                description: milestone.description || null,
                icon: milestone.icon || null
            };
            await SupabaseService.upsert('journey_milestones', row, 'user_id,date,title');
        } catch (e) {
            console.warn('JourneyService._syncMilestoneToCloud: falha (não crítica):', e.message);
        }
    },

    /**
     * Remove um marco da tabela journey_milestones.
     * NUNCA lança exceção — falha é completamente silenciosa.
     */
    async _deleteMilestoneFromCloud(milestone) {
        try {
            if (!window.SupabaseService || !window.AuthService) return;
            if (!AuthService.isLoggedIn()) return;
            const user = await SupabaseService.getUser();
            if (!user || !milestone.dateISO || !milestone.title) return;
            await SupabaseService.delete('journey_milestones', {
                user_id: user.id,
                date: milestone.dateISO,
                title: milestone.title
            });
        } catch (e) {
            console.warn('JourneyService._deleteMilestoneFromCloud: falha (não crítica):', e.message);
        }
    },

    /**
     * Envia uma medida corporal para a tabela journey_measurements.
     * NUNCA lança exceção — falha é completamente silenciosa.
     */
    async _syncMeasurementToCloud(measurement) {
        try {
            if (!window.SupabaseService || !window.AuthService) return;
            if (!AuthService.isLoggedIn()) return;
            const profile = StorageService.getSafe(StorageService.KEYS.PROFILE, {});
            if (profile.is_approved === false) return;
            if (!measurement.name || measurement.value === undefined || measurement.value === null) return;

            const row = {
                date: measurement.dateISO || DateService.today(),
                name: measurement.name,
                value: parseFloat(measurement.value),
                unit: measurement.unit || 'cm'
            };
            await SupabaseService.upsert('journey_measurements', row, 'user_id,date,name');
        } catch (e) {
            console.warn('JourneyService._syncMeasurementToCloud: falha (não crítica):', e.message);
        }
    },

    /**
     * Remove uma medida corporal da tabela journey_measurements.
     * NUNCA lança exceção — falha é completamente silenciosa.
     */
    async _deleteMeasurementFromCloud(measurement) {
        try {
            if (!window.SupabaseService || !window.AuthService) return;
            if (!AuthService.isLoggedIn()) return;
            const user = await SupabaseService.getUser();
            if (!user || !measurement.dateISO || !measurement.name) return;
            await SupabaseService.delete('journey_measurements', {
                user_id: user.id,
                date: measurement.dateISO,
                name: measurement.name
            });
        } catch (e) {
            console.warn('JourneyService._deleteMeasurementFromCloud: falha (não crítica):', e.message);
        }
    },

    // ─── MEDIDAS, MARCOS, TIMELINE, STATS ────────────────────

    addMeasurement(measurement) {
        const journey = this.get();
        measurement.id = Date.now();
        journey.measurements.push(measurement);
        this.save(journey);

        // Sync para nuvem em background — falha não afeta o dado local
        this._syncMeasurementToCloud(measurement).catch(e => {
            console.warn('JourneyService.addMeasurement: sync cloud falhou:', e.message);
        });

        return measurement;
    },

    deleteMeasurement(id) {
        const journey = this.get();
        const measurement = journey.measurements.find(m => m.id === id);
        journey.measurements = journey.measurements.filter(m => m.id !== id);
        this.save(journey);

        // Remove da nuvem em background — falha não afeta o dado local
        if (measurement) {
            this._deleteMeasurementFromCloud(measurement).catch(e => {
                console.warn('JourneyService.deleteMeasurement: delete cloud falhou:', e.message);
            });
        }
    },

    addMilestone(milestone) {
        const journey = this.get();
        milestone.id = Date.now();
        milestone.dateISO = DateService.today();
        journey.milestones.push(milestone);
        this.save(journey);

        // Sync para nuvem em background — falha não afeta o dado local
        this._syncMilestoneToCloud(milestone).catch(e => {
            console.warn('JourneyService.addMilestone: sync cloud falhou:', e.message);
        });

        return milestone;
    },

    deleteMilestone(id) {
        const journey = this.get();
        const milestone = journey.milestones.find(m => m.id === id);
        journey.milestones = journey.milestones.filter(m => m.id !== id);
        this.save(journey);

        // Remove da nuvem em background — falha não afeta o dado local
        if (milestone) {
            this._deleteMilestoneFromCloud(milestone).catch(e => {
                console.warn('JourneyService.deleteMilestone: delete cloud falhou:', e.message);
            });
        }
    },

    getTimeline() {
        const journey = this.get();
        const items = [];
        journey.photos.forEach(p => items.push({ ...p, type: 'photo' }));
        journey.measurements.forEach(m => items.push({ ...m, type: 'measurement' }));
        journey.milestones.forEach(m => items.push({ ...m, type: 'milestone' }));
        return items.sort((a, b) => b.dateISO.localeCompare(a.dateISO));
    },

    getStats() {
        const weights = WeightService.getAll();
        const injections = DoseService.getAll();
        let days = 0;
        let weightLoss = 0;

        const startDate = (injections.length > 0 ? injections[0].dateISO : null)
            || (weights.length > 0 ? weights[0].dateISO : null);

        if (startDate) {
            days = Math.floor((new Date() - new Date(startDate)) / (1000 * 60 * 60 * 24)) + 1;
        }

        if (weights.length >= 2) {
            weightLoss = weights[0].weightKg - weights[weights.length - 1].weightKg;
        }

        return {
            days: days < 0 ? 0 : days,
            weightLoss: weightLoss.toFixed(1),
            injections: injections.length
        };
    },

    getComparison(startDate = null, endDate = null) {
        const journey = this.get();
        let photos = journey.photos.filter(p => p && p.dateISO)
            .sort((a, b) => a.dateISO.localeCompare(b.dateISO));

        if (startDate) photos = photos.filter(p => p.dateISO >= startDate);
        if (endDate) photos = photos.filter(p => p.dateISO <= endDate);
        photos = photos.filter(p => p.storedInIDB || p.cloudUrl || p.image || p.dataUrl);

        if (photos.length === 0) return null;
        return { start: photos[0], current: photos[photos.length - 1] };
    }
};
