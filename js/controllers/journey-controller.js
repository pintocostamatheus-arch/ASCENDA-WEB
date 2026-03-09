/**
 * Journey, Photos & Measurements Controller
 * Extracted from app.js — Strangler Fig Pattern
 */
const JourneyController = {

    // --- JOURNEY V12 ---

    async refreshJourneyTab() {

        // Libera blob URLs anteriores para evitar memory leak
        if (window.PhotoStorageService) PhotoStorageService.revokeAll();

        const stats = JourneyService.getStats();

        document.getElementById('journey-days').textContent = stats.days;

        document.getElementById('journey-weight-loss').textContent = stats.weightLoss;

        document.getElementById('journey-injections').textContent = stats.injections;



        // Render Comparison (Antes vs Depois) — load from IndexedDB

        const comparison = JourneyService.getComparison();

        const imgStart = document.getElementById('comp-img-start');

        const imgCurrent = document.getElementById('comp-img-current');

        const dateStart = document.getElementById('comp-date-start');

        const dateCurrent = document.getElementById('comp-date-current');



        if (comparison && comparison.start) {

            const startUrl = await JourneyService.getPhotoUrl(comparison.start.id);

            if (imgStart) imgStart.src = startUrl || ''; // limpa se foto foi apagada

            if (dateStart) dateStart.textContent = startUrl ? DateService.format(comparison.start.dateISO, 'DD/MM') : '--';

        } else {

            if (imgStart) imgStart.src = ''; // limpa miniatura obsoleta

            if (dateStart) dateStart.textContent = '--';

        }

        if (comparison && comparison.current) {

            const currentUrl = await JourneyService.getPhotoUrl(comparison.current.id);

            if (imgCurrent) imgCurrent.src = currentUrl || ''; // limpa se foto foi apagada

            if (dateCurrent) dateCurrent.textContent = currentUrl ? DateService.format(comparison.current.dateISO, 'DD/MM') : '--';

        } else {

            if (imgCurrent) imgCurrent.src = ''; // limpa miniatura obsoleta

            if (dateCurrent) dateCurrent.textContent = '--';

        }



        this.renderJourneyMilestones();

    },



    _getMilestones() {

        const stats = JourneyService.getStats();

        const journey = JourneyService.get();

        const waterStreak = NutritionService.getStreak('water');

        const proteinStreak = NutritionService.getStreak('protein');

        const fiberStreak = NutritionService.getStreak('fiber');

        const photos = journey.photos ? journey.photos.length : 0;

        const measurements = journey.measurements ? journey.measurements.length : 0;

        const weights = WeightService.getAll();

        let weightPercent = 0;

        if (weights.length >= 2) {

            const initial = weights[0].weightKg;

            const current = weights[weights.length - 1].weightKg;

            if (initial > 0) weightPercent = ((initial - current) / initial) * 100;

        }

        return [

            { title: 'O Início', shortTitle: 'Início', desc: 'Primeira dose registrada no app', icon: '🌱', active: stats.injections >= 1 },

            { title: 'Primeira Pesagem', shortTitle: '1º Peso', desc: 'Primeiro peso registrado', icon: '⚖️', active: weights.length >= 1 },

            { title: 'Memória Visual', shortTitle: '1ª Foto', desc: 'Primeira foto da jornada adicionada', icon: '📸', active: photos >= 1 },

            { title: 'Uma Semana', shortTitle: '7 Dias', desc: '7 dias de jornada ativa', icon: '🔥', active: stats.days >= 7 },

            { title: 'Hábito Água', shortTitle: 'Hidratado', desc: '3 dias consecutivos batendo meta de água', icon: '💧', active: waterStreak >= 3 },

            { title: 'Hábito Proteína', shortTitle: 'Nutrido', desc: '3 dias consecutivos batendo meta de proteína', icon: '🥩', active: proteinStreak >= 3 },

            { title: 'Hábito Fibra', shortTitle: 'Fibra Ok', desc: '3 dias consecutivos batendo meta de fibra', icon: '🥗', active: fiberStreak >= 3 },

            { title: 'Primeiro Kilo', shortTitle: '-1 kg', desc: 'Primeiro quilograma perdido', icon: '📉', active: parseFloat(stats.weightLoss) >= 1 },

            { title: '5ª Dose', shortTitle: '5 Doses', desc: 'Quinta aplicação registrada', icon: '💉', active: stats.injections >= 5 },

            { title: 'Um Mês', shortTitle: '30 Dias', desc: '30 dias de tratamento ativo', icon: '💎', active: stats.days >= 30 },

            { title: 'Corpo Mapeado', shortTitle: '1ª Medida', desc: 'Primeiras medidas corporais registradas', icon: '📏', active: measurements >= 1 },

            { title: 'Hidratação Total', shortTitle: 'Água 7d', desc: '7 dias seguidos batendo meta de água', icon: '🌊', active: waterStreak >= 7 },

            { title: '5% Conquistados', shortTitle: '-5%', desc: '5% do peso inicial perdido', icon: '🎯', active: weightPercent >= 5 },

            { title: '10ª Dose', shortTitle: '10 Doses', desc: 'Décima aplicação registrada', icon: '💊', active: stats.injections >= 10 },

            { title: 'Rastreador Dedicado', shortTitle: 'Dedicado', desc: '60 dias usando o Ascenda', icon: '🏅', active: stats.days >= 60 },

            { title: '10% Conquistados', shortTitle: '-10%', desc: '10% do peso inicial perdido', icon: '⭐', active: weightPercent >= 10 },

            { title: 'Três Meses', shortTitle: '3 Meses', desc: '90 dias de transformação contínua', icon: '🏆', active: stats.days >= 90 },

            { title: 'Álbum da Jornada', shortTitle: '3 Fotos', desc: 'Três registros fotográficos da jornada', icon: '🖼️', active: photos >= 3 },

            { title: '15% Conquistados', shortTitle: '-15%', desc: '15% do peso inicial perdido', icon: '🚀', active: weightPercent >= 15 },

            { title: 'Guerreiro GLP-1', shortTitle: '6 Meses', desc: '180 dias de dedicação ao tratamento', icon: '👑', active: stats.days >= 180 },

        ];

    },



    renderJourneyMilestones() {

        const scroller = document.getElementById('journey-milestones-scroller');

        if (!scroller) return;



        const milestones = this._getMilestones();



        scroller.innerHTML = milestones.map(m => `

    <div class="milestone-badge-v12 ${m.active ? 'active' : 'locked'}">

                <div class="m-icon">${m.icon}</div>

                <div class="m-title">${m.shortTitle}</div>

            </div>

    `).join('');

    },



    async handleJourneyPhoto(input) {
        const file = input.files ? input.files[0] : null;
        if (!file) return;

        // VALIDACAO PRE-UPLOAD
        const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
        const MAX_SIZE_BYTES = 15 * 1024 * 1024; // 15MB

        if (!file.type.startsWith('image/') || !ALLOWED_TYPES.includes(file.type.toLowerCase())) {
            UI.toast('Arquivo invalido. Use JPG, PNG, WEBP ou HEIC.', 'error');
            input.value = '';
            return;
        }
        if (file.size > MAX_SIZE_BYTES) {
            UI.toast('Imagem muito grande. Maximo 15MB.', 'error');
            input.value = '';
            return;
        }

        UI.toast('Processando...');

        try {

            // Compress to Blob (800px, 75% quality)

            this._pendingPhotoBlob = await PhotoStorageService.compressToBlob(file);



            // Create temporary preview URL

            const previewUrl = URL.createObjectURL(this._pendingPhotoBlob);

            const imgPreview = document.getElementById('journey-photo-preview');

            if (imgPreview) imgPreview.src = previewUrl;



            document.getElementById('modal-photo-date').value = DateService.today();

            const latestWeight = WeightService.getLatest();

            document.getElementById('modal-photo-weight').value = latestWeight ? latestWeight.weightKg : '';

            document.getElementById('modal-photo-notes').value = '';



            UI.openModal('modal-add-journey-photo');

            input.value = '';

        } catch (e) {

            console.error('Error processing photo:', e);

            UI.toast('Erro ao Processar Foto', 'error');

        }

    },



    async saveJourneyPhoto() {

        const date = document.getElementById('modal-photo-date').value;

        const weight = document.getElementById('modal-photo-weight').value;

        const note = document.getElementById('modal-photo-notes').value;



        if (!date) return UI.toast('Informe a data', 'error');



        const btn = document.querySelector('#modal-add-journey-photo .btn-primary');

        await UI.withLoading(btn, async () => {

            await JourneyService.addPhoto({

                dateISO: date,

                blob: this._pendingPhotoBlob,

                weightKg: weight ? parseFloat(weight) : null,

                note: note

            });



            this._pendingPhotoBlob = null;

            UI.closeModal('modal-add-journey-photo');

            UI.toast('Foto salva com sucesso!');

            this.refreshJourneyTab();

        });

    },



    async showFullGallery() {

        const journey = JourneyService.get();

        const grid = document.getElementById('journey-gallery-grid');

        if (!grid) return;



        if (journey.photos.length === 0) {

            grid.innerHTML = '<div class="empty-state">Nenhuma foto registrada ainda.</div>';

        } else {

            const sorted = [...journey.photos].sort((a, b) => b.dateISO.localeCompare(a.dateISO));

            const htmlParts = [];

            for (const p of sorted) {

                const url = await JourneyService.getPhotoUrl(p.id);

                if (!url) continue;

                htmlParts.push(`

    <div class="gallery-item-v12">

        <img src="${url}" loading="lazy" onclick="App.showPhotoDetail(${p.id})">

            <div class="gallery-info">

                <span>${DateService.format(p.dateISO, 'DD/MM/YY')}</span>

                ${p.weightKg ? `<span>${p.weightKg}kg</span>` : ''}

            </div>

        </div>`);

            }

            grid.innerHTML = htmlParts.join('');

        }

        UI.openModal('modal-journey-gallery');

    },



    showPhotoDetail(id) {

        const journey = JourneyService.get();

        const photo = journey.photos.find(p => p.id === id);

        if (!photo) return;



        UI.confirmDelete({

            title: 'Visualizar Foto',

            message: `Registrado em ${DateService.format(photo.dateISO, 'short')}. Deseja excluir esta foto?`,

            onConfirm: async () => {

                await JourneyService.deletePhoto(id);

                this.showFullGallery();

                this.refreshJourneyTab();

                UI.toast('Foto removida');

            }

        });

    },



    showComparisonModal() {

        const comp = JourneyService.getComparison();

        if (!comp || !comp.start || !comp.current) {

            return UI.toast('Adicione pelo menos duas fotos para comparar');

        }

        this.showFullGallery(); // Fallback for now or create specialized modal

    },



    showAllMilestones() {

        const container = document.getElementById('milestones-full-list');

        if (!container) return;



        const milestones = this._getMilestones();



        container.innerHTML = milestones.map(m => `

    <div class="milestone-item-full ${m.active ? 'active' : 'locked'}">

                <div class="m-icon-large">${m.icon}</div>

                <div class="m-content">

                    <h4>${m.title}</h4>

                    <p>${m.desc}</p>

                </div>

                <div class="m-status">${m.active ? '✅' : '🔒'}</div>

            </div>

    `).join('');



        UI.openModal('modal-milestones-all');

    },



    showMeasurementsHistory() {

        const journey = JourneyService.get();

        const list = document.getElementById('measurements-history-list');

        if (!list) return;



        if (journey.measurements.length === 0) {

            list.innerHTML = '<div class="empty-state">Nenhum registro de medidas.</div>';

        } else {

            const sorted = [...journey.measurements].sort((a, b) => b.id - a.id);

            list.innerHTML = sorted.map(m => `

                <div class="history-item">

                    <div style="flex:1;">

                        <div style="font-weight:700;">${DateService.format(m.dateISO, 'short')}</div>

                        <div style="font-size:0.85rem; color:var(--text-muted); display:flex; gap:10px; flex-wrap:wrap;">

                            <span>C: ${m.waist}cm</span>

                            <span>A: ${m.abdomen}cm</span>

                            <span>Q: ${m.hip}cm</span>

                            <span>B: ${m.arm}cm</span>
                            ${m.chest ? `<span>P: ${m.chest}cm</span>` : ''}
                            ${m.thigh ? `<span>Cx: ${m.thigh}cm</span>` : ''}
                        </div>

                    </div>

                    <button class="btn-delete-weight" onclick="App.deleteMeasurement(${m.id})">🗑️</button>

                </div>

            `).join('');

        }

        UI.openModal('modal-measurements-history');

    },



    showAddMeasurementModal() {

        document.getElementById('measure-date').value = DateService.today();

        ['waist', 'abdomen', 'hip', 'arm', 'chest', 'thigh'].forEach(k => {

            const el = document.getElementById(`measure-${k}`);

            if (el) el.value = '';

        });

        UI.openModal('modal-add-measurement');

    },



    saveMeasurement() {

        const date = document.getElementById('measure-date').value;

        const waist = parseFloat(document.getElementById('measure-waist').value);
        const abdomen = parseFloat(document.getElementById('measure-abdomen').value);
        const hip = parseFloat(document.getElementById('measure-hip').value);
        const arm = parseFloat(document.getElementById('measure-arm').value);
        const chest = parseFloat(document.getElementById('measure-chest').value);
        const thigh = parseFloat(document.getElementById('measure-thigh').value);



        if (!date || isNaN(waist)) return UI.toast('Data e Cintura são obrigatórios', 'error');



        JourneyService.addMeasurement({
            dateISO: date,
            waist, abdomen, hip, arm, chest, thigh
        });



        UI.closeModal('modal-add-measurement');

        UI.toast('Medidas salvas!');

        this.refreshJourneyTab();

    },



    deleteMeasurement(id) {

        UI.confirmDelete({

            message: 'Excluir este registro de medidas?',

            onConfirm: () => {

                JourneyService.deleteMeasurement(id);

                this.showMeasurementsHistory();

                this.refreshJourneyTab();

                UI.toast('Medidas excluídas');

            }

        });

    },



    compressImage(file) {

        // Legacy wrapper — delegates to PhotoStorageService

        return PhotoStorageService.compressToBlob(file);

    },

};

// Strangler Fig: Mixin into App
Object.assign(App, JourneyController);
