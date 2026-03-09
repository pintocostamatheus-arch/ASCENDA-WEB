/**
 * Onboarding Wizard Controller
 * Extracted from app.js — Strangler Fig Pattern
 */
const OnboardingController = {

// --- ONBOARDING WIZARD ---
showOnboardingModal() {
    // Wizard: Opening modal
    const modal = document.getElementById('modal-onboarding');
    const btnNext = document.getElementById('btn-wizard-next');
    const btnBack = document.getElementById('btn-wizard-back');

    if (!modal || !btnNext || !btnBack) return;

    // Initialize state
    this.currentWizardStep = 0; // Start at Disclaimer
    modal.hidden = false;
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    modal.classList.add('active');

    // Reset transform to start
    const container = document.getElementById('wizard-steps-container');
    if (container) container.style.transform = 'translateX(0%)';

    this.goToStep(0);

    // Bind events
    btnNext.onclick = (e) => { e.preventDefault(); this.handleWizardNext(); };
    btnBack.onclick = (e) => { e.preventDefault(); this.handleWizardBack(); };
},

handleWizardNext() {
    const totalSteps = 9;
    if (this.validateStep(this.currentWizardStep)) {
        // Armazena consentimento LGPD ao avançar do passo de privacidade
        if (this.currentWizardStep === 1) {
            localStorage.setItem('monjaro_lgpd_consent', 'true');
            if (window.SupabaseService) {
                SupabaseService.getUser().then(user => {
                    if (user) SupabaseService.update('profiles', { lgpd_consent: true }, { id: user.id });
                }).catch(() => {});
            }
        }
        if (this.currentWizardStep === totalSteps) {
            this.completeOnboarding();
        } else {
            this.currentWizardStep++;
            this.goToStep(this.currentWizardStep);
            // Trigger calc when entering Step 9 (Summary)
            if (this.currentWizardStep === 9) {
                UI.toast('Calculando protocolo...', 'info');
                this.calculateOnboardingSummary();
            }
        }
    }
},

handleWizardBack() {
    if (this.currentWizardStep > 0) {
        this.currentWizardStep--;
        this.goToStep(this.currentWizardStep);
    }
},

goToStep(step) {
    const container = document.getElementById('wizard-steps-container');
    if (!container) return;

    const safeStep = Math.max(0, Math.min(step, 9));
    // 0 to 9 = 10 steps. Simple translateX works best with 100% width steps
    const percentage = safeStep * -100;

    container.style.transform = `translateX(${percentage}%)`;

    // Update active class
    const steps = container.querySelectorAll('.md-step');
    steps.forEach((el, idx) => el.classList.toggle('active', idx === safeStep));

    // Update Progress Bar
    const progressBar = document.querySelector('.md-progress-bar');
    if (progressBar) {
        // Step 0 = 0%, Step 9 = 100%
        const progress = (safeStep / 9) * 100;
        progressBar.style.width = `${progress}%`;
    }

    this.updateWizardButtons(safeStep, 9);
},

updateWizardButtons(step, total) {
    const btnBack = document.getElementById('btn-wizard-back');
    const btnNext = document.getElementById('btn-wizard-next');
    const nextText = document.getElementById('btn-next-text');

    if (btnBack) {
        btnBack.disabled = (step === 0);
        btnBack.style.opacity = (step === 0) ? '0' : '1'; // Hide back on disclaimer
        // Completely hide back button on disclaimer to fix alignment
        btnBack.style.display = (step === 0) ? 'none' : 'block';
    }

    if (btnNext) {
        if (step === 0) {
            btnNext.textContent = 'Concordar e Continuar';
            btnNext.className = 'md-btn-primary';
        } else if (step === 1) {
            btnNext.textContent = 'Aceitar e Continuar';
            btnNext.className = 'md-btn-primary';
        } else if (step === 8) {
            // Notificações: mostra "Pular" se ainda não ativou, "Continuar" se já ativou
            const alreadyGranted = (typeof Notification !== 'undefined' && Notification.permission === 'granted');
            if (alreadyGranted) {
                btnNext.textContent = 'Continuar';
                btnNext.className = 'md-btn-primary';
            } else {
                btnNext.textContent = 'Pular por agora';
                btnNext.className = 'md-btn-ghost';
            }
            btnNext.classList.remove('pulse-animation');
        } else if (step === total) {
            btnNext.textContent = 'Começar Jornada';
            btnNext.className = 'md-btn-primary pulse-animation';
        } else {
            btnNext.textContent = 'Continuar';
            btnNext.className = 'md-btn-primary';
        }
    }
},

checkKidneyHealth(select) {
    const warning = document.getElementById('kidney-warning');
    const diabetesGroup = document.getElementById('onboard-diabetes-group');
    const isRenal = select.value !== 'normal';
    const isCKD = select.value === 'ckd_3' || select.value === 'ckd_4_5';

    if (warning) warning.classList.toggle('hidden', select.value === 'normal' || select.value === 'ckd_1_2');
    // Show diabetes only when CKD 3-5 is selected (it affects the protein factor)
    if (diabetesGroup) diabetesGroup.classList.toggle('hidden', !isCKD);
    if (!isCKD && document.getElementById('onboard-diabetes')) {
        document.getElementById('onboard-diabetes').checked = false;
    }
},

checkAgeForSarcopenia(input) {
    const group = document.getElementById('onboard-sarcopenia-group');
    if (!group) return;

    try {
        const age = DateService.calculateAge(input.value);
        group.classList.toggle('hidden', !age || age < 65);
    } catch (e) {
        group.classList.add('hidden');
    }
},

selectWizardOption(group, value, card) {
    // Visual selection (support both old and new classes)
    const parent = card.parentElement;
    const cards = parent.querySelectorAll('.selection-card, .md-select-card, .premium-card-select');
    cards.forEach(c => c.classList.remove('selected', 'active'));
    card.classList.add('selected', 'active');

    // Logic
    if (group === 'sex') {
        document.getElementById('onboard-sex').value = value;
    } else if (group === 'meds') {
        document.getElementById('onboard-meds').value = value;
        const details = document.getElementById('onboard-med-details');
        if (details) details.classList.toggle('hidden', value !== 'yes');
    } else if (group === 'goal') {
        document.getElementById('onboard-goal-type').value = value;
    }
},

validateStep(step) {

    switch (step) {
        case 0: return true; // Disclaimer (Always valid if clicked next)
        case 1: // LGPD Privacy
            if (!document.getElementById('chk-lgpd-onboard')?.checked) {
                UI.toast('Você precisa aceitar a política de privacidade para continuar.', 'error'); return false;
            }
            return true;
        case 2: // Identity
            if (!document.getElementById('onboard-name').value) {
                UI.toast('Por favor, digite seu nome.', 'error'); return false;
            }
            return true;
        case 3: // Biometrics
            if (!document.getElementById('onboard-sex').value) {
                UI.toast('Selecione seu sexo biológico..', 'error'); return false;
            }
            if (!document.getElementById('onboard-birth').value) {
                UI.toast('Informe sua data de nascimento.', 'error'); return false;
            }
            return true;
        case 4: // Stats
            if (!document.getElementById('onboard-height').value || !document.getElementById('onboard-weight').value) {
                UI.toast('Altura e peso são obrigatórios..', 'error'); return false;
            }
            return true;
        case 5: // Activity
            if (!document.getElementById('onboard-activity').value) {
                UI.toast('Selecione seu nível de atividade..', 'error'); return false;
            }
            return true;
        case 6: // Clinical
            if (!document.getElementById('onboard-meds').value) {
                UI.toast('Informe sobre o uso de GLP-1.', 'error'); return false;
            }
            return true;
        case 7: // Goals
            if (!document.getElementById('onboard-goal-type').value) {
                UI.toast('Selecione seu foco principal.', 'error'); return false;
            }
            if (!document.getElementById('onboard-goal-weight').value) {
                UI.toast('Defina sua meta de peso.', 'error'); return false;
            }
            return true;
        case 8: return true; // Notificações — opcional, usuário pode pular
        default: return true;
    }
},

calculateOnboardingSummary() {
    // Inputs with safe parsing
    const wStr = document.getElementById('onboard-weight').value;
    const hStr = document.getElementById('onboard-height').value;
    const birthStr = document.getElementById('onboard-birth').value;

    const w = parseFloat(wStr);
    const h = parseFloat(hStr);

    let age = 30;
    try {
        age = DateService.calculateAge(birthStr);
        if (!age || isNaN(age)) age = 30;
    } catch (e) {
        console.warn('Age calc failed, defaulting to 30');
        age = 30;
    }

    const sex = document.getElementById('onboard-sex').value || 'male';
    const activity = document.getElementById('onboard-activity').value || 'sedentary';
    const kidney = document.getElementById('onboard-kidney').value || 'normal';

    if (!w || !h) {
        console.warn('Summary Calc aborted: Missing weight/height');
        return;
    }

    // 1. Create Temporary Profile for Calculation
    const tempProfile = {
        heightCm: h,
        startWeight: w,
        birthdate: birthStr,
        sex: sex,
        activityLevel: activity,
        kidneyHealth: kidney,
        sarcopenia: document.getElementById('onboard-sarcopenia')?.checked || false,
        diabetes: document.getElementById('onboard-diabetes')?.checked || false
    };

    const results = NutritionService.calculate(tempProfile);
    const bmi = results.bmi.toFixed(1);
    const dailyProtein = results.protein;
    const waterTarget = results.water;
    const dailyFiber = results.fiber;

    // 2. TDEE (Simple estimate for reference)
    age = DateService.calculateAge(birthStr) || 30;
    let bmr = (10 * w) + (6.25 * h) - (5 * age);
    bmr += (sex === 'male') ? 5 : -161;
    const tdeeMultipliers = { 'sedentary': 1.2, 'light': 1.375, 'moderate': 1.55, 'active': 1.725, 'very_active': 1.9 };
    const tdee = Math.round(bmr * (tdeeMultipliers[activity] || 1.2));

    // 3. Display - FORCE update even if visually hidden
    const elWater = document.getElementById('summary-water');
    const elProtein = document.getElementById('summary-protein');
    const elFiber = document.getElementById('summary-fiber');
    const elBMI = document.getElementById('summary-bmi');

    if (elWater) elWater.textContent = (waterTarget / 1000).toFixed(1) + ' L';
    if (elProtein) elProtein.textContent = dailyProtein + ' g';
    if (elFiber) elFiber.textContent = dailyFiber + ' g';
    if (elBMI) elBMI.textContent = bmi;

    // Store calculated values
    this._tempCalculated = {
        water: waterTarget,
        protein: dailyProtein,
        fiber: dailyFiber,
        bmi: bmi,
        tdee: tdee
    };
    console.log('Summary Calculated (Advanced):', this._tempCalculated);
},

skipOnboarding() {
    if (!confirm('Seus dados não serão salvos. Deseja pular o cadastro? Você poderá configurar seu perfil depois em Configurações.')) return;

    const profile = ProfileService.get();
    profile.name = 'Usuário';
    profile.heightCm = 170;
    profile.startWeight = 70;
    profile.currentWeight = 70;
    profile.activityLevel = 'sedentary';
    profile.dailyWater = 2000;
    profile.dailyProtein = 100;
    profile.dailyFiber = 25;
    profile.tdee = 2000;
    profile.onboardingComplete = true;
    profile.createdAt = new Date().toISOString();
    ProfileService.save(profile);

    const modal = document.getElementById('modal-onboarding');
    if (modal) {
        modal.hidden = true;
        modal.style.display = 'none';
        modal.classList.remove('active');
    }

    UI.toast('Perfil criado com valores padrão. Configure em ⚙️ Configurações.');
    this.refreshTab('dashboard');
},

completeOnboarding() {
    console.log('Completing onboarding...');
    const btn = document.getElementById('btn-wizard-next');
    if (btn) btn.textContent = 'Gerando Protocolo...';

    try {
        const profile = ProfileService.get();

        // 1. Capture All Inputs Again (Safety)
        profile.name = document.getElementById('onboard-name').value;
        profile.sex = document.getElementById('onboard-sex').value;
        profile.birthdate = document.getElementById('onboard-birth').value;

        // Fix: Map to correct ProfileService schema keys
        profile.heightCm = parseFloat(document.getElementById('onboard-height').value) || 0;
        profile.startWeight = parseFloat(document.getElementById('onboard-weight').value) || 0;
        profile.currentWeight = profile.startWeight;

        profile.activityLevel = document.getElementById('onboard-activity').value;
        profile.kidneyHealth = document.getElementById('onboard-kidney').value;
        // Also set renalHealth for compatibility if used elsewhere
        profile.renalHealth = profile.kidneyHealth;

        profile.goalType = document.getElementById('onboard-goal-type').value;
        profile.weightGoalKg = parseFloat(document.getElementById('onboard-goal-weight').value) || 0;

        const medsYes = document.getElementById('onboard-meds').value === 'yes';
        profile.useMedication = medsYes;
        profile.medication = medsYes ? document.getElementById('onboard-drug-name').value : 'none';
        profile.drug = profile.medication;

        // New Clinical Fields
        profile.sarcopenia = document.getElementById('onboard-sarcopenia')?.checked || false;
        profile.diabetes = document.getElementById('onboard-diabetes')?.checked || false;
        profile.age = DateService.calculateAge(profile.birthdate);

        // 2. Force Recalculate Summary (Avoid '--')
        this.calculateOnboardingSummary();

        if (this._tempCalculated) {
            profile.dailyWater = this._tempCalculated.water;
            profile.dailyProtein = this._tempCalculated.protein;
            profile.dailyFiber = this._tempCalculated.fiber;
            profile.tdee = this._tempCalculated.tdee;
        } else {
            // Fallback if calc failed
            profile.dailyWater = 2000;
            profile.dailyProtein = 100;
            profile.dailyFiber = 30;
            profile.tdee = 2000;
        }

        // 3. Mark Complete & Save
        profile.onboardingComplete = true;
        profile.createdAt = new Date().toISOString();
        ProfileService.save(profile);
        console.log('Profile Saved Successfully:', profile);

        // 4. Save Initial Weight
        const todayISO = new Date().toISOString().split('T')[0];
        WeightService.add(todayISO, profile.startWeight);

        // 5. UX Transition
        UI.toast('Protocolo gerado com sucesso!', 'success');

        setTimeout(() => {
            document.getElementById('modal-onboarding').classList.remove('active');
            document.getElementById('modal-onboarding').hidden = true;
            this.loadProfile();
            this.updateDashboard();
            this.checkOnboarding();
        }, 1000);

    } catch (error) {
        console.error('Onboarding Error:', error);
        UI.toast('Erro: ' + error.message, 'error');
        if (btn) btn.textContent = 'Tentar Novamente';
    }
},

async activateOnboardingNotifications() {
    const btn = document.getElementById('btn-onboard-notif');
    const status = document.getElementById('onboard-notif-status');
    const btnNext = document.getElementById('btn-wizard-next');

    if (!window.NotificationService) {
        if (status) status.textContent = 'Notificações não disponíveis neste dispositivo.';
        return;
    }

    if (btn) { btn.disabled = true; btn.textContent = 'Aguardando permissão...'; }

    const result = await NotificationService.requestPermission();

    if (result.granted) {
        // Habilita notificações com as configurações padrão
        const settings = NotificationService.getSettings();
        settings.enabled = true;
        NotificationService.saveSettings(settings);
        NotificationService.scheduleAll().catch(() => {});

        if (btn) {
            btn.textContent = 'Lembretes Ativados!';
            btn.style.background = 'var(--color-success, #10B981)';
            btn.style.cursor = 'default';
        }
        if (status) status.textContent = 'Perfeito! Você receberá lembretes no horário certo.';
        // Atualiza botão wizard para "Continuar" com estilo primário
        if (btnNext) { btnNext.textContent = 'Continuar'; btnNext.className = 'md-btn-primary'; }

    } else if (result.reason === 'denied') {
        if (btn) { btn.disabled = true; btn.textContent = 'Permissão bloqueada'; }
        if (status) status.textContent = 'Libere nas configurações do navegador ou ative depois em Configurações.';

    } else {
        // Usuário fechou o prompt sem responder
        if (btn) { btn.disabled = false; btn.textContent = 'Ativar Lembretes'; }
        if (status) status.textContent = 'Você pode ativar depois em Configurações > Notificações.';
    }
},

};

// Strangler Fig: Mixin into App
Object.assign(App, OnboardingController);
