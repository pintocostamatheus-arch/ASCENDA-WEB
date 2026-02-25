/* ============================================
   DOSE SERVICE
   ============================================ */
window.DoseService = {
    getAll() {
        const all = StorageService.getSafe(StorageService.KEYS.INJECTIONS, []);
        return all.filter(i => i && (i.dateISO || i.date)).sort((a, b) => {
            try {
                const dateA = a.dateISO || a.date || "";
                const dateB = b.dateISO || b.date || "";
                return dateA.localeCompare(dateB);
            } catch (e) { return 0; }
        });
    },

    add(injection) {
        const all = this.getAll();
        injection.id = Date.now();
        all.push(injection);
        StorageService.set(StorageService.KEYS.INJECTIONS, all);
        StorageService.snapshot();
        return injection;
    },

    delete(idOrKey) {
        const all = this.getAll();
        const filtered = all.filter(i => {
            if (i.id && i.id === idOrKey) return false;
            // Fallback for legacy items without ID
            if (!i.id && (i.dateISO === idOrKey || i.date === idOrKey)) return false;
            return true;
        });
        StorageService.set(StorageService.KEYS.INJECTIONS, filtered);
        StorageService.snapshot();
        return true;
    },

    getSchedule() {
        return StorageService.getSafe(StorageService.KEYS.SCHEDULE);
    },

    saveSchedule(schedule) {
        StorageService.set(StorageService.KEYS.SCHEDULE, schedule);
        StorageService.snapshot();
    },

    getNextInjectionDate() {
        const history = this.getAll();
        const schedule = this.getSchedule();

        if (history.length === 0) {
            if (!schedule || schedule.dayOfWeek === undefined) return null; // No history and no valid schedule defined
            return this.calculateNextOccurrence(schedule.dayOfWeek);
        }

        const last = history[history.length - 1];
        const dateStr = last.dateISO || last.date;
        const lastDate = new Date(dateStr);
        lastDate.setDate(lastDate.getDate() + 7);
        return lastDate.toISOString().split('T')[0];
    },

    calculateNextOccurrence(dayOfWeek) {
        const today = new Date();
        const result = new Date(today);
        result.setDate(today.getDate() + (dayOfWeek + 7 - today.getDay()) % 7);
        if (result < today) result.setDate(result.getDate() + 7);
        return result.toISOString().split('T')[0];
    },

    getLastInjection() {
        const all = this.getAll();
        return all.length > 0 ? all[all.length - 1] : null;
    },

    getSuggestedSite() {
        const history = this.getAll();
        const sites = ['abdomen-E', 'abdomen-D', 'coxa-E', 'coxa-D', 'braco-E', 'braco-D'];

        if (history.length === 0) return sites[0];

        const lastUsed = this.getLastUsedDates();
        let oldestDate = new Date();
        let suggested = sites[0];

        sites.forEach(s => {
            if (!lastUsed[s]) {
                suggested = s;
                return;
            }
            if (new Date(lastUsed[s]) < oldestDate) {
                oldestDate = new Date(lastUsed[s]);
                suggested = s;
            }
        });

        return suggested;
    },

    getLastUsedDates() {
        const history = this.getAll();
        const map = {};
        history.forEach(i => {
            // Handle both new (site + side) and legacy (site already combined e.g. "abdomen-e")
            const rawKey = (i.site && i.side) ? `${i.site}-${i.side}` : (i.site || '');
            let key = rawKey.toLowerCase().trim();

            // Normalize to the same keys used in data-site attributes
            if (key.includes('abdomen')) key = (key.includes('-d') || key.includes('dir') || key.includes('right')) ? 'abdomen-d' : 'abdomen-e';
            else if (key.includes('coxa') || key.includes('thigh')) key = (key.includes('-d') || key.includes('dir') || key.includes('right')) ? 'coxa-d' : 'coxa-e';
            else if (key.includes('bra') || key.includes('arm')) key = (key.includes('-d') || key.includes('dir') || key.includes('right')) ? 'braco-d' : 'braco-e';

            if (!key || !i.dateISO) return;

            // Keep the most recent date per site
            if (!map[key] || i.dateISO > map[key]) {
                map[key] = i.dateISO;
            }
        });
        return map;
    },

    formatSite(siteKey) {
        if (!siteKey) return '--';

        // Normalize key: abdomen-e-E -> abdomen-e
        let key = siteKey.toLowerCase().trim();
        if (key.includes('abdomen')) key = key.includes('-d') || key.includes('right') ? 'abdomen-d' : 'abdomen-e';
        else if (key.includes('coxa') || key.includes('thigh')) key = key.includes('-d') || key.includes('right') ? 'coxa-d' : 'coxa-e';
        else if (key.includes('braco') || key.includes('arm')) key = key.includes('-d') || key.includes('right') ? 'braco-d' : 'braco-e';

        const map = {
            'abdomen-e': 'Abdômen Esq.',
            'abdomen-d': 'Abdômen Dir.',
            'coxa-e': 'Coxa Esq.',
            'coxa-d': 'Coxa Dir.',
            'braco-e': 'Braço Esq.',
            'braco-d': 'Braço Dir.'
        };

        return map[key] || siteKey;
    }
};
