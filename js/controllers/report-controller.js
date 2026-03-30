/**
 * Reports, Export & Import Controller
 * Extracted from app.js — Strangler Fig Pattern
 */
const ReportController = {

exportJSON() {

    const data = StorageService.exportAll();

    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });

    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');

    a.href = url;

    a.download = 'ascenda_backup.json';

    a.click();

},



exportPDF() {

    const activeBtn = document.querySelector('.filter-btn.active[data-chart="report"]');

    let period = activeBtn ? activeBtn.dataset.period : 30;

    if (period === 'all') period = 365; // High limit for PDF

    else period = parseInt(period);



    UI.toast('Gerando PDF...');

    ReportService.generate(period);

},



refreshReportTab() {

    // Set Default inputs

    const today = new Date();

    const thirtyDaysAgo = new Date();

    thirtyDaysAgo.setDate(today.getDate() - 30);



    const startInput = document.getElementById('report-start-date');

    const endInput = document.getElementById('report-end-date');



    if (startInput && !startInput.value) startInput.value = thirtyDaysAgo.toISOString().split('T')[0];

    if (endInput && !endInput.value) endInput.value = today.toISOString().split('T')[0];



    // Ensure "30 days" is selected for chart preview if not set

    const btnPresets = document.querySelectorAll('#tab-relatorios .date-presets .preset-btn');

    let hasActive = false;



    btnPresets.forEach(btn => {

        if (btn.classList.contains('active')) hasActive = true;

    });



    if (!hasActive) {

        const btn30 = document.querySelector('#tab-relatorios .preset-btn[data-days="30"]');

        if (btn30) {

            btnPresets.forEach(b => b.classList.remove('active'));

            btn30.classList.add('active');

        }

    }



    // Bind Presets

    document.querySelectorAll('.preset-btn').forEach(btn => {

        btn.onclick = () => {

            document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));

            btn.classList.add('active');



            const days = btn.dataset.days;

            const currentToday = DateService.today();

            if (endInput) endInput.value = currentToday;



            if (startInput) {

                if (days === 'all') {

                    startInput.value = '2000-01-01';

                } else {

                    startInput.value = DateService.addDays(currentToday, -parseInt(days));

                }

            }

        };

    });



    // Bind Generate Button

    const btnGenerate = document.getElementById('btn-generate-report');

    if (btnGenerate) {

        btnGenerate.onclick = async () => {

            UI.toast('Gerando PDF...', 'info');



            let period = 30;

            if (startInput && endInput && startInput.value && endInput.value) {

                const start = new Date(startInput.value);

                const end = new Date(endInput.value);

                const diffTime = Math.abs(end - start);

                period = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            }



            const options = {

                startDate: new Date(startInput.value),

                endDate: new Date(endInput.value),

                includeChart: document.getElementById('report-chk-chart')?.checked,

                includeTable: document.getElementById('report-chk-table')?.checked,

                includeAnalysis: document.getElementById('report-chk-analysis')?.checked,

                includeMeasure: document.getElementById('report-chk-measure')?.checked,

                includePhotos: document.getElementById('report-chk-photos')?.checked

            };



            try {

                if (window.ReportService) {

                    await ReportService.generate(options);

                    UI.toast('Relatório gerado com sucesso!');

                } else {

                    UI.toast('Erro: Serviço de relatório não encontrado.', 'error');

                }

            } catch (e) {

                console.error(e);

                UI.toast('Erro ao gerar relatório', 'error');

            }

        };

    }

},



exportCSV() {

    UI.toast('Exportando CSV...');

    // Placeholder for actual CSV export logic if available in services

    if (window.StorageService && StorageService.exportCSV) {

        StorageService.exportCSV();

    } else {

        UI.toast('Serviço CSV não disponível', 'warning');

    }

},



// --- DATA IMPORT / EXPORT V12 ---

triggerConfigImport() {

    const input = document.getElementById('import-file-config');

    if (input) input.click();

},



handleImportFile(event, source = 'tab') {

    const file = event.target.files[0];

    if (!file) return;



    const reader = new FileReader();

    reader.onload = (e) => {

        try {

            const data = JSON.parse(e.target.result);

            this.importData(data, 'replace');

        } catch (err) {

            console.error('Import Error:', err);

            UI.toast('Arquivo JSON inválido', 'error');

        }

    };

    reader.readAsText(file);

},



importData(data, mode = 'replace') {

    if (!data || typeof data !== 'object') {

        return UI.toast('Dados inválidos', 'error');

    }



    UI.showModal(

        'Confirmar Importação',

        `<div style="text-align:center; padding: 20px 0;">

                <div style="font-size: 3rem; margin-bottom: 20px;">📂</div>

                <p style="color: var(--text-secondary); line-height: 1.5;">Você está prestes a importar um backup. Isso <strong>substituirá</strong> todos os seus dados atuais. Deseja continuar?</p>

            </div>`,

        [

            { text: 'Cancelar', class: 'btn-secondary', closeOnClick: true },

            {

                text: 'Importar e Recarregar',

                class: 'btn-primary',

                onClick: async () => {

                    try {

                        StorageService.importData(data, mode);

                        UI.toast('Sincronizando com a nuvem...', 'info');

                        await StorageService.syncAllToCloud();

                        UI.toast('Dados importados com sucesso!', 'success');

                        setTimeout(() => location.reload(), 1000);

                    } catch (err) {

                        console.error('Storage Import Error:', err);

                        UI.toast('Erro ao processar importação', 'error');

                    }

                }

            }

        ]

    );

},

};

// Strangler Fig: Mixin into App
Object.assign(App, ReportController);
