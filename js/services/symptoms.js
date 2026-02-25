/* ============================================
   SYMPTOMS SERVICE
   ============================================ */
window.SymptomsService = {
    SYMPTOMS: ['nausea', 'constipation', 'diarrhea', 'heartburn', 'fatigue', 'headache', 'anxiety'],
    LABELS: {
        nausea: 'Náusea',
        constipation: 'Constipação',
        heartburn: 'Azia',
        fatigue: 'Fadiga',
        headache: 'Dor de cabeça',
        anxiety: 'Ansiedade',
        diarrhea: 'Diarreia'
    },
    delete(dateISO) {
        console.log('Service: Tentando deletar registro para:', dateISO);
        try {
            const all = StorageService.getSafe(StorageService.KEYS.SYMPTOMS, {});
            console.log('Service: Chaves atuais no storage:', Object.keys(all));

            const dateKey = dateISO.trim();
            let deleted = false;

            // 1. Exact Object Match
            if (all[dateKey]) {
                delete all[dateKey];
                deleted = true;
                console.log('Service: Deletado via match exato de objeto');
            }
            // 2. Partial Object Match
            else {
                for (let key in all) {
                    if (key.startsWith(dateKey)) {
                        delete all[key];
                        deleted = true;
                        console.log('Service: Deletado via match parcial:', key);
                        break;
                    }
                }
            }

            // 3. Array Match
            if (!deleted && Array.isArray(all)) {
                const index = all.findIndex(item => item.dateISO && item.dateISO.startsWith(dateKey));
                if (index !== -1) {
                    all.splice(index, 1);
                    deleted = true;
                    console.log('Service: Deletado via match em array');
                }
            }

            if (deleted) {
                StorageService.set(StorageService.KEYS.SYMPTOMS, all);
                StorageService.snapshot();
                console.log('Service: Sucesso na persistência');
                return true;
            }

            console.warn('Service: Registro não encontrado após varredura completa');
            return false;
        } catch (e) {
            console.error('Service: Erro fatal no delete:', e);
            throw e;
        }
    },
    getByDate(dateISO) {
        if (!dateISO) return null;
        const all = StorageService.getSafe(StorageService.KEYS.SYMPTOMS, {});
        const dateKey = dateISO.trim();

        if (Array.isArray(all)) {
            return all.find(item => item.dateISO && item.dateISO.startsWith(dateKey)) || null;
        }

        if (all[dateKey]) return all[dateKey];

        // Find partial
        for (let key in all) {
            if (key.startsWith(dateKey)) return all[key];
        }
        return null;
    },
    getToday() {
        return this.getByDate(DateService.today());
    },
    save(dateISO, symptoms) {
        if (!dateISO) return;
        try {
            const all = StorageService.getSafe(StorageService.KEYS.SYMPTOMS, {});
            symptoms.dateISO = dateISO;

            if (Array.isArray(all)) {
                const index = all.findIndex(item => item.dateISO === dateISO);
                if (index !== -1) {
                    all[index] = symptoms;
                } else {
                    all.push(symptoms);
                }
            } else {
                all[dateISO] = symptoms;
            }

            StorageService.set(StorageService.KEYS.SYMPTOMS, all);
            StorageService.snapshot();
        } catch (e) {
            console.error('Service: Falha ao salvar sintomas:', e);
        }
    },
    analyze(symptomsHistory) {
        const alerts = [];
        if (!symptomsHistory || symptomsHistory.length === 0) return alerts;

        const sorted = [...symptomsHistory].sort((a, b) => b.dateISO.localeCompare(a.dateISO));
        const latest = sorted[0];

        // 1. High Intensity Check (Immediate)
        const labels = this.LABELS;
        this.SYMPTOMS.forEach(sym => {
            if (latest[sym] >= 8) {
                alerts.push({
                    type: 'high_intensity',
                    level: 'danger',
                    symptom: labels[sym],
                    value: latest[sym],
                    message: `Alto nível de ${labels[sym]} (${latest[sym]}/10). Procure orientação médica se persistir.`
                });
            }
        });

        // 2. Multiple Moderate Check
        const moderateSymptoms = this.SYMPTOMS.filter(sym => latest[sym] >= 5);
        if (moderateSymptoms.length >= 3) {
            alerts.push({
                type: 'multiple_moderate',
                level: 'warning',
                message: `Você registrou ${moderateSymptoms.length} sintomas com intensidade moderada/alta. Monitore a evolução geral.`
            });
        }

        // 3. Persistence Check (3+ days with value >= 4)
        if (sorted.length >= 3) {
            this.SYMPTOMS.forEach(sym => {
                const recent = sorted.slice(0, 3);
                const isPersistent = recent.every(entry => entry[sym] >= 4);
                if (isPersistent) {
                    alerts.push({
                        type: 'persistence',
                        level: 'warning',
                        symptom: labels[sym],
                        message: `${labels[sym]} persistente (>=4) por 3 registros seguidos. Informe seu médico.`
                    });
                }
            });
        }

        return alerts;
    },
    getHistory(limit = 30) {
        const all = StorageService.getSafe(StorageService.KEYS.SYMPTOMS, {});
        const list = Array.isArray(all) ? all : Object.values(all);
        return list
            .sort((a, b) => (b.dateISO || '').localeCompare(a.dateISO || ''))
            .slice(0, limit);
    },
    getChartData(period = 7) {
        const all = StorageService.getSafe(StorageService.KEYS.SYMPTOMS, {});
        const list = Array.isArray(all) ? all : Object.values(all);
        let data = list.sort((a, b) => (a.dateISO || '').localeCompare(b.dateISO || ''));
        if (period !== 'all') {
            data = DateService.filterByPeriod(data, period);
        }
        return data;
    },
    getActiveSymptoms(symptoms) {
        if (!symptoms) return [];
        return this.SYMPTOMS
            .filter(s => symptoms[s] && symptoms[s] > 0)
            .map(s => ({ key: s, label: this.LABELS[s], value: symptoms[s] }));
    },
    getAll() {
        const all = StorageService.getSafe(StorageService.KEYS.SYMPTOMS, {});
        const list = Array.isArray(all) ? all : Object.values(all);
        return list.sort((a, b) => (a.dateISO || '').localeCompare(b.dateISO || ''));
    },
    // --- Custom Symptoms Management ---
    CUSTOM_NAMES_KEY: 'ascenda_custom_symptom_names',
    MAX_CUSTOM_NAMES: 15,
    getCustomNames() {
        try {
            return JSON.parse(localStorage.getItem(this.CUSTOM_NAMES_KEY)) || [];
        } catch {
            return [];
        }
    },
    saveCustomName(name) {
        if (!name || name.trim().length === 0) return;
        const trimmed = name.trim();
        let names = this.getCustomNames();
        names = names.filter(n => n.toLowerCase() !== trimmed.toLowerCase());
        names.unshift(trimmed);
        if (names.length > this.MAX_CUSTOM_NAMES) {
            names = names.slice(0, this.MAX_CUSTOM_NAMES);
        }
        localStorage.setItem(this.CUSTOM_NAMES_KEY, JSON.stringify(names));
    },
    getActiveCustomSymptoms(symptoms) {
        if (!symptoms || !symptoms.custom) return [];
        return symptoms.custom
            .filter(c => c && c.name && c.value > 0)
            .map(c => ({ key: c.name, label: c.name, value: c.value }));
    }
};
