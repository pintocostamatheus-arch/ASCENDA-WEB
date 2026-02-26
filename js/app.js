﻿/* ============================================
   MAIN APPLICATION CONTROLLER
   ============================================ */
window.App = {
    selectedFood: null,
    lastWaterAmount: 0,
    weightChartPeriod: '30',
    symptomsChartPeriod: '30',
    injectionChartPeriod: 'all',
    medicationLevelCard: null,
    customSymptomTags: [],
    currentSymptomEditing: null,
    symptomValues: {},
    showAllWeights: false,

    SYMPTOM_ICONS: {
        nausea: '🤢',
        constipation: '💩',
        diarrhea: '🏃‍♂️',
        heartburn: '🔥',
        fatigue: '😴',
        headache: '💆‍♂️',
        anxiety: '😰'
    },

    _initialized: false,

    init() {
        if (this._initialized) return;
        this._initialized = true;

        // Global Exports
        window.App = this;
        window.Chart = Chart; // Make Chart.js globally available

        // Auto-refresh when opening PWA on a new day
        window.lastActiveDate = DateService.today();
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                const today = DateService.today();
                if (window.lastActiveDate !== today) {
                    console.log('New day detected, reloading PWA to reset daily data...');
                    window.location.reload();
                }
                // Re-agenda notificações ao reabrir o app
                if (window.NotificationService) NotificationService.scheduleAll();
            }
        });

        // Inicializa controller de notificações
        if (this.initNotifications) this.initNotifications();

        // Bind Cronograma Button
        const btnCronograma = document.getElementById('btn-hero-setup');
        if (btnCronograma) {
            btnCronograma.onclick = () => this.scrollToSchedule();
        }

        // 1. Initialize router
        if (window.Router) Router.init();

        // 2. Initialize UI (Theme + Header) - PRIORITY
        this.initTheme();
        UI.updateHeader();

        // 3. Set up event listeners
        this.bindEvents();

        // 4. Initialize Instructions Tab Logic
        if (this.initInstructionsTab) this.initInstructionsTab();

        // 5. Initialize Weight Chart Filters
        this.initWeightChartFilters();

        // 6. Load initial data (Safely)
        try {
            // Default date inputs
            const today = DateService.today();
            const dateInputs = ['weight-date', 'injection-date', 'measure-date', 'modal-photo-date'];
            dateInputs.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = today;
            });
            const timeEl = document.getElementById('injection-time-reg');
            if (timeEl) timeEl.value = new Date().toTimeString().slice(0, 5);

            // 7. Migrate legacy Base64 photos to IndexedDB (runs once, non-blocking)
            if (window.PhotoStorageService && window.JourneyService) {
                PhotoStorageService.open().then(() => JourneyService.migratePhotos());
            }

            // O refreshTab oficial foi delegado para AuthService._onSignIn para evitar
            // renderizações prematuras ou pisões por cima da tela de segurança.
        } catch (e) {
            console.error('Error loading initial data:', e);
            UI.toast('Erro ao carregar dados iniciais', 'error');
        }

        // Hide splash after load
        setTimeout(() => {
            const splash = document.getElementById('splash-screen');
            if (splash) splash.classList.add('hidden');

            // SOMENTE LIBERA O APP QUANDO O LOGIN CONFIRMAR VIA _onSignIn (AuthService)
            // Remover as chamadas precoces a app.classList.remove() e refreshTab() daqui.
        }, 200);

        // More Modal Logic
        const btnOpenMore = document.getElementById('btn-open-more-modal');
        const moreModal = document.getElementById('more-modal');

        if (btnOpenMore && moreModal) {
            btnOpenMore.addEventListener('click', (e) => {
                e.stopPropagation();
                moreModal.hidden = false;
            });

            moreModal.addEventListener('click', (e) => {
                if (e.target === moreModal) moreModal.hidden = true;
            });

            document.querySelectorAll('.more-card').forEach(card => {
                card.addEventListener('click', () => {
                    const tab = card.dataset.navigate;
                    moreModal.hidden = true;
                    Router.navigate(tab);
                });
            });
        }

        // Load profile into form
        this.loadProfileForm();

        // Modal close handlers
        const modalClose = document.getElementById('modal-close');
        if (modalClose) modalClose.onclick = () => UI.hideModal();
        const modalOverlay = document.getElementById('modal-overlay');
        if (modalOverlay) modalOverlay.onclick = (e) => {
            if (e.target === e.currentTarget) UI.hideModal();
        };

        // Check for first run delegated to AuthService._onSignIn AFTER cloud load
    },

    // Wizard State
    currentWizardStep: 1,

    initTheme() {
        const saved = localStorage.getItem('monjaro_theme') || 'light';
        document.documentElement.setAttribute('data-theme', saved);

        const updateTheme = (newTheme) => {
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('monjaro_theme', newTheme);
            if (Router.currentTab) this.refreshTab(Router.currentTab);
        };

        UI.setClick('theme-toggle', () => {
            const current = document.documentElement.getAttribute('data-theme');
            updateTheme(current === 'dark' ? 'light' : 'dark');
        });

        document.querySelectorAll('.theme-option').forEach(btn => {
            btn.onclick = () => updateTheme(btn.dataset.theme);
        });

        this.setTheme = updateTheme;

        // Theme Dropdown Logic
        const selector = document.getElementById('theme-selector');
        const btn = document.getElementById('theme-toggle-btn');
        if (selector && btn) {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                selector.classList.toggle('active');
            });
            document.addEventListener('click', (e) => {
                if (!selector.contains(e.target)) selector.classList.remove('active');
            });
        }
    },

    bindEvents() {
        // Weight (with loading state)
        UI.setClick('btn-save-weight', () => UI.withLoading(document.getElementById('btn-save-weight'), async () => { this.saveWeight(); await new Promise(r => setTimeout(r, 100)); }));
        UI.setClick('btn-register-weight', () => Router.navigate('peso'));

        // Chart filters
        document.querySelectorAll('.filter-btn[data-period]').forEach(btn => {
            btn.onclick = (e) => {
                e.preventDefault();
                this.handleChartFilter(btn);
            };
        });

        // Nutrition
        const foodInput = document.getElementById('meal-food');
        if (foodInput) {
            foodInput.oninput = () => this.handleFoodSearch(foodInput.value);
            foodInput.onblur = () => setTimeout(() => document.getElementById('food-autocomplete')?.classList.remove('show'), 200);
        }
        UI.setEvent('meal-quantity', 'input', () => this.updateProteinPreview());
        UI.setEvent('meal-unit', 'change', () => this.updateProteinPreview());
        UI.setClick('btn-add-meal', () => UI.withLoading(document.getElementById('btn-add-meal'), async () => { this.addMeal(); await new Promise(r => setTimeout(r, 100)); }));

        // Water
        document.querySelectorAll('.btn-water[data-amount]').forEach(btn => {
            btn.onclick = () => this.addWater(parseInt(btn.dataset.amount));
        });
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('.btn-water-sm');
            if (btn) {
                const amount = parseInt(btn.dataset.amount);
                NutritionService.addWater(amount);
                this.refreshNutritionTab();
                UI.toast(`Adicionado: ${amount}ml`);
            }
        });
        UI.setClick('btn-water-undo', () => this.undoWater());
        UI.setClick('btn-add-custom-food', () => this.showAddFoodModal());

        // Symptoms
        UI.setClick('btn-save-symptoms', () => UI.withLoading(document.getElementById('btn-save-symptoms'), async () => { this.saveSymptoms(); await new Promise(r => setTimeout(r, 100)); }));
        UI.setClick('btn-add-custom-symptom', () => this.addCustomSymptomRow());

        // Injections
        UI.setClick('btn-save-schedule', () => this.saveInjectionSchedule());
        UI.setClick('btn-register-injection', () => this.registerInjection());

        const btnHeroRegister = document.getElementById('btn-hero-register');
        if (btnHeroRegister) btnHeroRegister.onclick = () => {
            const modal = document.getElementById('modal-register-injection');
            if (modal) {
                modal.hidden = false;
                document.getElementById('injection-date').value = DateService.today();
                document.getElementById('injection-time-reg').value = new Date().toTimeString().slice(0, 5);
            }
        };
        UI.setClick('btn-close-register-modal', () => {
            const modal = document.getElementById('modal-register-injection');
            if (modal) modal.hidden = true;
        });
        UI.setClick('btn-confirm-injection', () => UI.withLoading(document.getElementById('btn-confirm-injection'), async () => { this.registerInjection(); await new Promise(r => setTimeout(r, 100)); }));

        // Journey
        const photoInput = document.getElementById('photo-input');
        if (photoInput) photoInput.onchange = (e) => this.handlePhotoUpload(e);
        UI.setClick('btn-save-measurements', () => this.saveMeasurements());
        UI.setClick('btn-add-milestone', () => this.showMilestoneModal());

        // Profile
        UI.setClick('btn-save-profile', () => this.saveProfile());
        const notifyToggle = document.getElementById('notification-enabled');
        if (notifyToggle) notifyToggle.onchange = (e) => this.toggleNotifications(e.target.checked);

        // Backup
        UI.setClick('btn-export-json', () => this.exportJSON());
        UI.setClick('btn-export-csv', () => this.exportCSV());
        UI.setClick('btn-export-pdf', () => this.exportPDF());
        UI.setClick('btn-select-import', () => document.getElementById('import-file')?.click());
        const inputImport = document.getElementById('import-file');
        if (inputImport) inputImport.onchange = (e) => this.handleImportFile(e);
        UI.setClick('btn-import-data', () => this.importData());
        UI.setClick('btn-reset-all', () => this.resetAll());


        this.bindProfileRedesign();
    },

    bindProfileRedesign() {
        const medToggle = document.getElementById('profile-medication-toggle');
        const medSelect = document.getElementById('profile-medication');
        if (medToggle && medSelect) {
            medToggle.checked = (medSelect.value === 'yes');
            medToggle.addEventListener('change', function () {
                medSelect.value = this.checked ? 'yes' : 'no';
                UI.toast('Medicamento: ' + (this.checked ? 'Sim' : 'Não'));
            });
        }
        const nameInput = document.getElementById('profile-name');
        if (nameInput) {
            nameInput.addEventListener('input', function () {
                const val = this.value || 'você';
                document.getElementById('header-name').textContent = val;
                const avatar = document.getElementById('profile-avatar');
                if (avatar) avatar.textContent = val.charAt(0).toUpperCase();
            });
        }
    },

    refreshTab(tab) {
        const today = DateService.today();
        const todayEl = document.getElementById('today-date');
        if (todayEl) todayEl.textContent = DateService.format(today, 'long');

        switch (tab) {
            case 'hoje': this.refreshDashboard(); break;
            case 'peso': this.refreshWeightTab(); break;
            case 'nutricao': this.refreshNutritionTab(); break;
            case 'injecoes': this.refreshInjectionsTab(); break;
            case 'sintomas': this.refreshSymptomsTab(); break;
            case 'jornada': this.refreshJourneyTab(); break;
            case 'relatorios': this.refreshReportTab(); break;
            case 'ajuda': this.refreshHelpTab(); break;
            case 'boaspraticas': this.refreshBoasPraticasTab(); break;
            case 'perfil': this.loadProfileForm(); break;
            case 'backup': this.refreshBackupTab(); break;
        }
    },

    refreshDashboard() {
        try {
            const profile = ProfileService.get() || {};
            const latest = WeightService.getLatest();
            const nutrition = NutritionService.getToday() || { protein: 0, water: 0, fiber: 0 };

            // Header
            const elGreeting = document.getElementById('header-user-name');
            if (elGreeting && profile.name) elGreeting.textContent = profile.name;
            const elProfileName = document.getElementById('profile-name-display');
            if (elProfileName && profile.name) elProfileName.textContent = profile.name;

            // Weight
            if (latest) {
                const elWeight = document.getElementById('today-weight');
                if (elWeight) elWeight.innerHTML = `${latest.weightKg.toFixed(1)} <span class="unit">kg</span>`;
                const elBmi = document.getElementById('today-bmi');
                if (elBmi) elBmi.textContent = latest.bmi.toFixed(1);

                // BMI Redesign Logic
                const bmiCat = WeightService.getBMICategory(latest.bmi);
                const elCat = document.getElementById('bmi-category');
                if (elCat) elCat.textContent = bmiCat.text.toUpperCase();

                const elStageBadge = document.getElementById('bmi-stage-badge');
                if (elStageBadge) {
                    let stageText = '';
                    let stageClass = '';
                    if (latest.bmi < 18.5) { stageText = 'Abaixo do Peso'; stageClass = 'underweight'; }
                    else if (latest.bmi < 25) { stageText = 'Peso Normal'; stageClass = 'normal'; }
                    else if (latest.bmi < 30) { stageText = 'Sobrepeso'; stageClass = 'overweight'; }
                    else if (latest.bmi < 35) { stageText = 'Obesidade Grau I'; stageClass = 'obese-1'; }
                    else if (latest.bmi < 40) { stageText = 'Obesidade Grau II'; stageClass = 'obese-2'; }
                    else { stageText = 'Obesidade Grau III'; stageClass = 'obese-3'; }
                    elStageBadge.textContent = stageText.toUpperCase();
                    elStageBadge.className = 'bmi-stage-badge ' + stageClass;
                }

                const elIndicator = document.getElementById('bmi-indicator');
                if (elIndicator) {
                    let normalizedPos = 0;
                    if (latest.bmi < 18.5) normalizedPos = (latest.bmi / 18.5) * 37; // blue (0-18.5)
                    else if (latest.bmi < 25) normalizedPos = 37 + ((latest.bmi - 18.5) / 6.5) * 13; // green (18.5-25)
                    else if (latest.bmi < 30) normalizedPos = 50 + ((latest.bmi - 25) / 5) * 10; // yellow (25-30)
                    else if (latest.bmi < 35) normalizedPos = 60 + ((latest.bmi - 30) / 5) * 10; // orange (30-35)
                    else if (latest.bmi < 40) normalizedPos = 70 + ((latest.bmi - 35) / 5) * 10; // red (35-40)
                    else normalizedPos = 80 + Math.min(20, ((latest.bmi - 40) / 10) * 20); // dark red
                    elIndicator.style.left = `${normalizedPos}%`;
                }

                // Weight Change & Goal
                const weights = WeightService.getAll();
                const elChange = document.getElementById('today-weight-change');
                const elGoal = document.getElementById('today-weight-goal');

                if (elChange && weights.length >= 2) {
                    const prev = weights[weights.length - 2];
                    const diff = latest.weightKg - prev.weightKg;
                    const sign = diff > 0 ? '+' : '';
                    elChange.textContent = `${sign}${(diff || 0).toFixed(1)} kg`;
                    // Ensure visibility
                    elChange.style.opacity = '1';
                } else if (elChange) {
                    elChange.textContent = '-';
                }

                if (elGoal && profile.weightGoalKg) {
                    elGoal.textContent = `${profile.weightGoalKg} kg`;
                }
            }

            // Nutrition
            const protTarget = nutrition.proteinTarget || 100;
            const waterTarget = nutrition.waterMlTarget || 2500;
            const fiberTarget = nutrition.fiberTarget || 28;

            UI.updateProgress('protein-ring', nutrition.proteinConsumed || 0, protTarget);
            UI.updateProgress('water-ring', nutrition.waterMl || 0, waterTarget);
            UI.updateProgress('fiber-ring', nutrition.fiberG || 0, fiberTarget);

            // Synchronize numeric labels
            const setLabel = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

            setLabel('protein-consumed', Math.round(nutrition.proteinConsumed || 0));
            setLabel('protein-goal', protTarget);

            setLabel('water-consumed', (nutrition.waterMl / 1000).toFixed(1));
            setLabel('water-goal', (waterTarget / 1000).toFixed(1));

            setLabel('fiber-consumed', Math.round(nutrition.fiberG || 0));
            setLabel('fiber-goal', fiberTarget);

            this.updateDashboardInjectionCard();
            this.renderMedicationLevel();
            this.renderWeightZoneInsight();
            this.renderEscalationSuggestion();
            this.renderDailyInsight();
        } catch (e) {
            console.error('Error refreshing dashboard:', e);
        }
    },

    renderDailyInsight() {
        if (!window.InsightService) return;
        const insight = InsightService.getInsight();
        if (!insight) return;
        const el = document.getElementById('card-daily-insight');
        const iconEl = document.getElementById('insight-icon');
        const titleEl = document.getElementById('insight-title');
        const textEl = document.getElementById('insight-text');
        if (!el || !iconEl || !titleEl || !textEl) return;

        iconEl.textContent = insight.icon;
        titleEl.textContent = insight.title;
        textEl.textContent = insight.text;

        el.className = 'card card-insight';
        if (insight.type) el.classList.add('insight-' + insight.type);
    },

    renderWeightZoneInsight() {
        if (!window.ClinicalService || !window.DoseService) return;

        const weights = WeightService.getAll();
        const lastInjection = DoseService.getLastInjection();
        const card = document.querySelector('.card-clinical-analysis');
        const badge = document.getElementById('efficacy-badge');
        const text = document.getElementById('clinical-analysis-text');
        const label = document.getElementById('clinical-label');
        const icon = document.getElementById('clinical-icon');

        if (!card || !badge || !text) return;

        // STRICT CHECK: Need at least 2 weights on DIFFERENT days + an injection
        const hasRealData = () => {
            if (weights.length < 2 || !lastInjection) return false;
            const uniqueDays = new Set(weights.map(w => w.dateISO.split('T')[0]));
            return uniqueDays.size >= 2;
        };

        if (!hasRealData()) {
            badge.textContent = 'AGUARDANDO';
            badge.className = 'badge';
            badge.style.backgroundColor = 'var(--text-muted)';
            badge.style.color = 'white';
            text.innerHTML = 'Insira pelo menos 2 registros de peso em dias diferentes e sua primeira aplicação para iniciar a análise.';
            if (label) label.textContent = 'Análise Clínica';
            if (icon) icon.style.color = 'var(--text-muted)';
            return;
        }

        // Calculate weeks on current dose
        const history = DoseService.getAll();
        let weeksOnDose = 1;
        if (history.length > 0) {
            const currentDose = lastInjection.doseMg;
            const sameDoseInjections = [...history].reverse().filter(i => i.doseMg === currentDose);
            if (sameDoseInjections.length > 0) {
                const firstOfDose = sameDoseInjections[sameDoseInjections.length - 1];
                const days = Math.floor((new Date(DateService.today()) - new Date(firstOfDose.dateISO)) / (1000 * 3600 * 24));
                weeksOnDose = Math.max(1, Math.ceil(days / 7));
            }
        }

        const analysis = ClinicalService.analyze(weights, lastInjection.doseMg, weeksOnDose);

        if (analysis) {
            badge.textContent = `${analysis.wwl} kg/sem`;
            badge.className = `badge badge-${analysis.zone.color}`;
            badge.style.backgroundColor = ''; // Reset inline style from empty state
            badge.style.color = '';
            text.textContent = analysis.reason;
            if (label) label.textContent = `Análise Clínica (${analysis.zone.label})`;
            if (icon) icon.style.color = 'var(--success)';

            card.hidden = false;
        }
    },

    renderEscalationSuggestion() {
        if (!window.DoseAnalysisService) return;

        const analysis = DoseAnalysisService.shouldConsiderEscalation();
        const badge = document.getElementById('injection-status-badge');

        if (analysis && analysis.shouldEscalate) {
            if (badge) {
                badge.textContent = 'AVALIE SUBIR DOSE';
                badge.className = 'status-badge-v10 badge-warning';
                badge.title = analysis.reason;
            }

            // Optionally add a more visible warning if it's a plateau
            UI.toast('Sugestão clínica: avalie ajuste de dose.', 'info');
        }
    },


    resetAll() {
        UI.showModal(
            'Apagar Todos os Dados',
            `<div style="text-align:center; padding: 20px 0;">
                <div style="font-size: 3rem; margin-bottom: 16px;">🗑️</div>
                <p style="color: var(--text-secondary); line-height: 1.6; margin-bottom: 16px;">
                    Esta ação irá apagar <strong>PERMANENTEMENTE</strong> todos os seus dados:<br>
                    peso, refeições, injeções, sintomas, jornada, perfil e configurações.
                </p>
                <p style="color: #ef4444; font-size: 0.85rem; margin-bottom: 16px;">
                    ⚠️ Os dados também serão removidos da nuvem. Esta ação é <strong>irreversível</strong>.
                </p>
                <label style="display:flex; align-items:center; gap:10px; justify-content:center; cursor:pointer; font-size:0.9rem; color:var(--text-secondary);">
                    <input type="checkbox" id="chk-confirm-reset" style="width:18px;height:18px;cursor:pointer;">
                    Entendo que esta ação é irreversível
                </label>
            </div>`,
            [
                { text: 'Cancelar', class: 'btn-secondary', closeOnClick: true },
                {
                    text: 'Apagar Tudo',
                    class: 'btn-danger',
                    onClick: async () => {
                        const chk = document.getElementById('chk-confirm-reset');
                        if (!chk?.checked) {
                            UI.toast('Marque a caixa de confirmação para continuar.', 'warning');
                            return;
                        }
                        UI.toast('Apagando dados...', 'info');
                        try {
                            const user = await SupabaseService.getUser();
                            if (user) {
                                const tables = [
                                    'weights', 'nutrition', 'injections', 'symptoms',
                                    'injection_schedule', 'custom_foods', 'journey_milestones',
                                    'journey_measurements', 'journey_photos', 'push_subscriptions'
                                ];
                                for (const t of tables) {
                                    await SupabaseService.delete(t, { user_id: user.id });
                                }
                                await SupabaseService.update('profiles', {
                                    heightCm: null, startWeight: null, birthdate: null,
                                    drug: null, notification_settings: null, onboardingComplete: false
                                }, { id: user.id });
                            }
                        } catch (e) {
                            console.warn('resetAll: erro ao apagar dados da nuvem:', e);
                        }
                        StorageService.clearAll();
                        localStorage.removeItem('monjaro_lgpd_consent');
                        if (window.AuthService) await AuthService.signOut();
                        location.reload();
                    }
                }
            ],
            () => {
                const footer = document.getElementById('modal-footer');
                if (footer) {
                    footer.style.justifyContent = 'center';
                    footer.querySelectorAll('.btn').forEach(b => b.style.minWidth = '120px');
                }
            }
        );
    },

    // --- Extracted Controllers ---
    // Nutrition      -> js/controllers/nutrition-controller.js
    // Weight         -> js/controllers/weight-controller.js
    // Profile        -> js/controllers/profile-controller.js
    // Help           -> js/controllers/help-controller.js
    // Injections     -> js/controllers/injections-controller.js
    // Symptoms       -> js/controllers/symptoms-controller.js
    // Journey        -> js/controllers/journey-controller.js
    // Onboarding     -> js/controllers/onboarding-controller.js
    // Reports        -> js/controllers/report-controller.js

    scrollToSchedule() {
        const el = document.getElementById("schedule-settings-details");
        if (el) el.scrollIntoView({ behavior: "smooth" });
    },

};

// ─── BOOTSTRAP: Auth → App Init → Cloud Sync ───────────────────
// Ordem correta:
//  1. Supabase init
//  2. Auth check (sessão existente?)
//  3a. Tem sessão → mostra app, inicia com dados locais (rápido),
//      depois puxa cloud em bg e atualiza a view
//  3b. Sem sessão → mostra tela de login
//  4. Marca _bootDone para que _onSignIn saiba que o boot terminou
// ─── LGPD: verifica consentimento antes de qualquer ação ─────────────────────
function _checkLgpdConsent() {
    const overlay = document.getElementById('modal-lgpd');
    if (!overlay) return;

    // Se já aceitou → garante que o modal está oculto e sai
    if (localStorage.getItem('monjaro_lgpd_consent')) {
        overlay.style.display = 'none';
        return;
    }

    // Novos usuários (sem onboarding completo) verão o consentimento durante o onboarding
    try {
        const profile = window.StorageService
            ? StorageService.getSafe(StorageService.KEYS.PROFILE, null)
            : JSON.parse(localStorage.getItem('ascenda_profile') || 'null');
        if (!profile || !profile.onboardingComplete) {
            overlay.style.display = 'none';
            return;
        }
    } catch (e) { /* fallback: mostra modal se algo der errado */ }

    // Usuário existente que completou onboarding mas ainda não consentiu
    overlay.style.display = 'flex';

    const chk = document.getElementById('chk-lgpd-accept');
    const btnAceitar = document.getElementById('btn-lgpd-aceitar');
    const btnRecusar = document.getElementById('btn-lgpd-recusar');

    if (chk && btnAceitar) {
        chk.addEventListener('change', () => {
            btnAceitar.disabled = !chk.checked;
        });
        btnAceitar.addEventListener('click', () => {
            localStorage.setItem('monjaro_lgpd_consent', 'true');
            overlay.style.display = 'none';
            // Persiste consentimento na nuvem para não pedir novamente
            if (window.SupabaseService) {
                SupabaseService.getUser().then(user => {
                    if (user) SupabaseService.update('profiles', { lgpd_consent: true }, { id: user.id });
                }).catch(() => { });
            }
        });
    }

    if (btnRecusar) {
        btnRecusar.addEventListener('click', () => {
            overlay.innerHTML = `
                <div style="color:#fff; text-align:center; padding:40px 20px; max-width:400px;">
                    <div style="font-size:3rem; margin-bottom:16px;">🔒</div>
                    <h3 style="margin-bottom:12px;">Acesso não autorizado</h3>
                    <p style="opacity:0.8; line-height:1.6;">
                        Sem o consentimento para o uso dos dados de saúde, não é possível utilizar o Ascenda.<br><br>
                        Se mudar de ideia, acesse o app novamente.
                    </p>
                </div>`;
        });
    }
}

window.addEventListener("DOMContentLoaded", async () => {

    // 0. Verifica consentimento LGPD antes de qualquer ação
    _checkLgpdConsent();

    // Botão "Política de Privacidade" nas configurações
    const btnOpenLgpd = document.getElementById('btn-open-lgpd-info');
    if (btnOpenLgpd) {
        btnOpenLgpd.addEventListener('click', () => {
            const overlay = document.getElementById('modal-lgpd');
            const chk = document.getElementById('chk-lgpd-accept');
            const btn = document.getElementById('btn-lgpd-aceitar');
            if (chk) chk.checked = true;
            if (btn) btn.disabled = false;
            if (overlay) overlay.style.display = 'flex';
        });
    }

    // 1. Inicializa o Supabase Client
    if (window.SupabaseService) SupabaseService.init();

    if (window.AuthService) {

        // 2. Bind da UI de autenticação PRIMEIRO — handlers disponíveis imediatamente,
        // mesmo que a verificação de sessão do Supabase demore (rede lenta).
        AuthService.bindAuthUI();

        // 3. Verifica sessão e registra onAuthStateChange
        const hasSession = await AuthService.init();

        if (hasSession) {
            // 4. Mostra o app imediatamente com dados locais (rápido)
            AuthService.gate();
            App.init();

            // 5. Migração local → nuvem (só roda uma vez, se ainda não migrou)
            if (window.MigrationService) {
                await MigrationService.migrateLocalDataToSupabase();
            }

            // 6. Sincroniza com a nuvem em background e atualiza a view
            StorageService.loadFromCloud().then(() => {
                if (window.App && window.Router) {
                    App.refreshTab(Router.currentTab || 'hoje');
                }
                // Restaura consentimento LGPD do perfil cloud se ausente localmente
                if (!localStorage.getItem('monjaro_lgpd_consent')) {
                    const profile = StorageService.getSafe(StorageService.KEYS.PROFILE, {});
                    if (profile.lgpd_consent) {
                        localStorage.setItem('monjaro_lgpd_consent', 'true');
                        const lgpdOverlay = document.getElementById('modal-lgpd');
                        if (lgpdOverlay) lgpdOverlay.style.display = 'none';
                    }
                }
            }).catch(e => console.warn('loadFromCloud falhou:', e));

            // 7. Agenda notificações do dia
            if (window.NotificationService) NotificationService.scheduleAll();

        } else {
            // Sem sessão: mostra tela de login
            AuthService.gate();
        }

        // 8. Libera o _onSignIn para atuar em logins futuros
        AuthService._bootDone = true;

    } else {
        // Fallback: sem Supabase, inicia normalmente (modo offline)
        App.init();
        if (window.NotificationService) NotificationService.scheduleAll();
    }
});
