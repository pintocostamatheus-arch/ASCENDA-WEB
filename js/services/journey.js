/* ============================================
   JOURNEY SERVICE
   Metadata in localStorage, photos in IndexedDB.
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

    /** Add photo: metadata to localStorage, blob to IndexedDB */
    async addPhoto(photoData) {
        const journey = this.get();
        const id = Date.now();

        const newPhoto = {
            id,
            dateISO: photoData.dateISO || DateService.today(),
            weightKg: photoData.weightKg || null,
            note: photoData.note || '',
            storedInIDB: true
        };

        if (photoData.blob) {
            await PhotoStorageService.savePhoto(id, photoData.blob);
        } else if (photoData.image && photoData.image.startsWith('data:')) {
            const blob = PhotoStorageService.dataUrlToBlob(photoData.image);
            await PhotoStorageService.savePhoto(id, blob);
        }

        journey.photos.push(newPhoto);
        this.save(journey);
        return newPhoto;
    },

    async deletePhoto(id) {
        const journey = this.get();
        journey.photos = journey.photos.filter(p => p.id !== id);
        this.save(journey);
        try { await PhotoStorageService.deletePhoto(id); } catch (e) { /* ignore */ }
    },

    /** Get Object URL for a photo */
    async getPhotoUrl(id) {
        const url = await PhotoStorageService.getPhoto(id);
        if (url) return url;

        // Fallback: legacy Base64
        const journey = this.get();
        const photo = journey.photos.find(p => p.id === id);
        return photo && photo.image ? photo.image : null;
    },

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

    addMeasurement(measurement) {
        const journey = this.get();
        measurement.id = Date.now();
        journey.measurements.push(measurement);
        this.save(journey);
        return measurement;
    },

    deleteMeasurement(id) {
        const journey = this.get();
        journey.measurements = journey.measurements.filter(m => m.id !== id);
        this.save(journey);
    },

    addMilestone(milestone) {
        const journey = this.get();
        milestone.id = Date.now();
        milestone.dateISO = DateService.today();
        journey.milestones.push(milestone);
        this.save(journey);
        return milestone;
    },

    deleteMilestone(id) {
        const journey = this.get();
        journey.milestones = journey.milestones.filter(m => m.id !== id);
        this.save(journey);
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
        photos = photos.filter(p => p.storedInIDB || p.image || p.dataUrl);

        if (photos.length === 0) return null;
        return { start: photos[0], current: photos[photos.length - 1] };
    }
};
