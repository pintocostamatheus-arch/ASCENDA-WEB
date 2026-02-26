/* ============================================
   AUTH SERVICE
   Login, Signup, Google OAuth, Session Gate.
   ============================================ */
window.AuthService = {
    _currentUser: null,
    _bootDone: false,   // true após o DOMContentLoaded terminar o boot

    // ─── INIT ──────────────────────────────────
    async init() {
        const client = SupabaseService.getClient();
        if (!client) return false;

        // Escuta mudanças de auth (login, logout, token refresh)
        client.auth.onAuthStateChange((event, session) => {
            console.log('AuthService: event =', event);

            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                this._currentUser = session?.user || null;
                this._onSignIn(session);
            } else if (event === 'SIGNED_OUT') {
                this._currentUser = null;
                this._onSignOut();
            }
        });

        // Verifica sessão existente
        const session = await SupabaseService.getSession();
        if (session) {
            this._currentUser = session.user;
            return true;
        }
        return false;
    },

    // ─── GETTERS ────────────────────────────────
    getUser() {
        return this._currentUser;
    },

    isLoggedIn() {
        return !!this._currentUser;
    },

    // ─── EMAIL + SENHA ─────────────────────────

    /**
     * Cadastro com email e senha.
     * @returns {{ user, error }}
     */
    async signUp(email, password, name) {
        const client = SupabaseService.getClient();
        if (!client) return { user: null, error: 'Client não inicializado' };

        const { data, error } = await client.auth.signUp({
            email,
            password,
            options: {
                data: { name: name || '' }
            }
        });

        if (error) {
            return { user: null, error: this._translateError(error.message) };
        }

        // Atualiza perfil com nome e status inicial
        if (data.user && name) {
            const { data: profileData } = await SupabaseService.update('profiles', {
                name,
                is_approved: false // Por padrão, entra pendente
            }, { id: data.user.id });

            if (profileData && profileData[0]) {
                StorageService.set(StorageService.KEYS.PROFILE, profileData[0]);
            } else {
                StorageService.set(StorageService.KEYS.PROFILE, { name, is_approved: false });
            }
        }

        return { user: data.user, error: null };
    },

    /**
     * Login com email e senha.
     * @returns {{ user, error }}
     */
    async signIn(email, password) {
        const client = SupabaseService.getClient();
        if (!client) return { user: null, error: 'Client não inicializado' };

        const { data, error } = await client.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            return { user: null, error: this._translateError(error.message) };
        }

        // Não fazemos nada com o profile aqui.
        // O loadFromCloud() chamado dentro do _onSignIn fará o mapeamento
        // correto de snake_case → camelCase sem disparar _syncToCloud.

        return { user: data.user, error: null };
    },

    // ─── GOOGLE OAUTH ──────────────────────────
    async signInWithGoogle() {
        const client = SupabaseService.getClient();
        if (!client) return { error: 'Client não inicializado' };

        const { error } = await client.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin + window.location.pathname
            }
        });

        if (error) {
            return { error: this._translateError(error.message) };
        }

        return { error: null };
    },

    // ─── LOGOUT ────────────────────────────────
    async signOut() {
        const client = SupabaseService.getClient();
        if (!client) return;

        await client.auth.signOut();
        this._currentUser = null;
    },

    // ─── ESQUECI MINHA SENHA ───────────────────
    async resetPassword(email) {
        const client = SupabaseService.getClient();
        if (!client) return { error: 'Client não inicializado' };

        const { error } = await client.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + window.location.pathname
        });

        if (error) {
            return { error: this._translateError(error.message) };
        }
        return { error: null };
    },

    // ─── UI GATE ───────────────────────────────

    /**
     * Mostra o app ou a tela de login.
     * Retorna true se o user está logado.
     */
    gate() {
        const authScreen = document.getElementById('auth-screen');
        const appContainer = document.getElementById('app');
        const splashScreen = document.getElementById('splash-screen');
        const pendingScreen = document.getElementById('pending-screen');

        const user = this.getUser();

        // 1. Se NÃO está logado
        if (!user) {
            if (authScreen) authScreen.hidden = false;
            if (appContainer) appContainer.classList.add('hidden');
            if (splashScreen) splashScreen.classList.add('hidden');
            if (pendingScreen) pendingScreen.hidden = true;
            return false;
        }

        // 2. Se ESTÁ logado, mas NÃO aprovado (Whitelist Beta)
        // Precisamos garantir que leia o false explicitamente
        const profile = StorageService.getSafe(StorageService.KEYS.PROFILE, {});
        // Se profile.is_approved não existir (antigos) ou for true, passa. Se for estritamente false, bloqueia.
        if (profile.is_approved === false) {
            if (authScreen) authScreen.hidden = true;
            if (appContainer) appContainer.classList.add('hidden');
            if (splashScreen) splashScreen.classList.add('hidden');
            if (pendingScreen) pendingScreen.hidden = false;
            return true;
        }

        // 3. Logado e APROVADO: Libera o App
        if (authScreen) authScreen.hidden = true;
        if (appContainer) appContainer.classList.remove('hidden');
        if (splashScreen) splashScreen.classList.add('hidden');
        if (pendingScreen) pendingScreen.hidden = true;
        return true;
    },

    // ─── AUTH UI HANDLERS ──────────────────────

    bindAuthUI() {
        // Tabs: Login / Cadastro
        const tabLogin = document.getElementById('auth-tab-login');
        const tabSignup = document.getElementById('auth-tab-signup');
        const formLogin = document.getElementById('auth-form-login');
        const formSignup = document.getElementById('auth-form-signup');
        const forgotLink = document.getElementById('auth-forgot-password');
        const formReset = document.getElementById('auth-form-reset');

        if (tabLogin && tabSignup) {
            tabLogin.onclick = () => {
                tabLogin.classList.add('active');
                tabSignup.classList.remove('active');
                formLogin.hidden = false;
                formSignup.hidden = true;
                if (formReset) formReset.hidden = true;
                this._clearErrors();
            };
            tabSignup.onclick = () => {
                tabSignup.classList.add('active');
                tabLogin.classList.remove('active');
                formSignup.hidden = false;
                formLogin.hidden = true;
                if (formReset) formReset.hidden = true;
                this._clearErrors();
            };
        }

        // Esqueci a senha
        if (forgotLink && formReset) {
            forgotLink.onclick = (e) => {
                e.preventDefault();
                formLogin.hidden = true;
                formSignup.hidden = true;
                formReset.hidden = false;
                this._clearErrors();
            };

            const backToLogin = document.getElementById('auth-back-to-login');
            if (backToLogin) {
                backToLogin.onclick = (e) => {
                    e.preventDefault();
                    formReset.hidden = true;
                    formLogin.hidden = false;
                    tabLogin.classList.add('active');
                    tabSignup.classList.remove('active');
                };
            }
        }

        // Login form submit
        const btnLogin = document.getElementById('btn-auth-login');
        if (btnLogin) {
            btnLogin.onclick = async () => {
                const email = document.getElementById('login-email')?.value?.trim();
                const password = document.getElementById('login-password')?.value;

                if (!email || !password) {
                    this._showError('login', 'Preencha email e senha.');
                    return;
                }

                btnLogin.disabled = true;
                btnLogin.textContent = 'Entrando...';

                const { error } = await this.signIn(email, password);

                btnLogin.disabled = false;
                btnLogin.textContent = 'Entrar';

                if (error) {
                    this._showError('login', error);
                }
                // Se sucesso, onAuthStateChange cuida da navegação
            };
        }

        // Signup form submit
        const btnSignup = document.getElementById('btn-auth-signup');
        if (btnSignup) {
            btnSignup.onclick = async () => {
                const name = document.getElementById('signup-name')?.value?.trim();
                const email = document.getElementById('signup-email')?.value?.trim();
                const password = document.getElementById('signup-password')?.value;
                const confirm = document.getElementById('signup-confirm')?.value;

                if (!email || !password) {
                    this._showError('signup', 'Preencha todos os campos.');
                    return;
                }
                if (password.length < 6) {
                    this._showError('signup', 'A senha deve ter pelo menos 6 caracteres.');
                    return;
                }
                if (password !== confirm) {
                    this._showError('signup', 'As senhas não coincidem.');
                    return;
                }

                btnSignup.disabled = true;
                btnSignup.textContent = 'Criando conta...';

                try {
                    const { user, error } = await this.signUp(email, password, name);

                    if (error) {
                        this._showError('signup', error);
                    } else if (user && !user.confirmed_at) {
                        this._showError('signup', 'Conta criada! Verifique seu email para confirmar.', 'success');
                    }
                } catch (e) {
                    this._showError('signup', 'Erro inesperado. Tente novamente.');
                } finally {
                    btnSignup.disabled = false;
                    btnSignup.textContent = 'Criar Conta';
                }
            };
        }

        // Google login
        const btnGoogle = document.getElementById('btn-auth-google');
        if (btnGoogle) {
            btnGoogle.onclick = async () => {
                btnGoogle.disabled = true;
                const { error } = await this.signInWithGoogle();
                btnGoogle.disabled = false;
                if (error) {
                    this._showError('login', error);
                }
            };
        }

        // Reset password
        const btnReset = document.getElementById('btn-auth-reset');
        if (btnReset) {
            btnReset.onclick = async () => {
                const email = document.getElementById('reset-email')?.value?.trim();
                if (!email) {
                    this._showError('reset', 'Informe seu email.');
                    return;
                }

                btnReset.disabled = true;
                btnReset.textContent = 'Enviando...';

                const { error } = await this.resetPassword(email);

                btnReset.disabled = false;
                btnReset.textContent = 'Enviar Link';

                if (error) {
                    this._showError('reset', error);
                } else {
                    this._showError('reset', 'Link enviado! Verifique seu email.', 'success');
                }
            };
        }

        // Logout (no perfil)
        const btnLogout = document.getElementById('btn-logout');
        if (btnLogout) {
            btnLogout.onclick = async () => {
                await this.signOut();
            };
        }
    },

    // ─── CALLBACKS INTERNOS ────────────────────

    async _onSignIn(session) {
        // ─── GUARD ────────────────────────────────────────────────
        // Durante o carregamento inicial da página (boot), o
        // DOMContentLoaded já controla tudo. Só atuamos aqui em
        // eventos POSTERIORES ao boot (novo login, refresh de token).
        if (!this._bootDone) return;

        // ─── 1. Carrega dados reais da nuvem PRIMEIRO ─────────────
        // Isso garante que is_approved e todos os campos estejam
        // corretos no localStorage ANTES de qualquer decisão de UI.
        if (window.MigrationService) {
            await MigrationService.migrateLocalDataToSupabase();
        }
        await StorageService.loadFromCloud();

        // ─── 2. Agora avalia o gate com dados atualizados ──────────
        this.gate();
        const pendingScreen = document.getElementById('pending-screen');
        const isBlocked = pendingScreen && !pendingScreen.hidden;

        // ─── 3. Só inicializa o App se não estiver barrado ─────────
        if (window.App && !isBlocked) {
            if (!App._initialized) {
                App.init();
            } else {
                App.refreshTab(window.Router?.currentTab || 'hoje');
            }

            // Verifica primeiro acesso APÓS os dados da nuvem estarem carregados
            if (window.ProfileService && ProfileService.isFirstRun()) {
                if (typeof App.showOnboardingModal === 'function') {
                    App.showOnboardingModal();
                }
            }
        }
    },

    _onSignOut() {
        // Limpa TODOS os rastros da sessão (evita que um usuário barrado
        // relogue e seu CACHE engane o app achando que é o primeiro acesso)
        console.log('AuthService: Executando wipedown do cache...');

        // Preserva chaves críticas que NÃO devem ser apagadas no logout
        const preserveKeys = ['monjaro_lgpd_consent', 'monjaro_theme'];
        const preserved = {};
        preserveKeys.forEach(k => {
            const v = localStorage.getItem(k);
            if (v !== null) preserved[k] = v;
        });

        localStorage.clear();

        // Restaura chaves preservadas
        Object.entries(preserved).forEach(([k, v]) => localStorage.setItem(k, v));

        // Gate: mostra tela de login
        this.gate();

        // Recarrega para limpar estado da memória RAM do navegador
        window.location.reload();
    },

    // ─── HELPERS ────────────────────────────────

    _showError(formType, message, type = 'error') {
        const el = document.getElementById(`auth-error-${formType}`);
        if (!el) return;
        el.textContent = message;
        el.className = `auth-message auth-message-${type}`;
        el.hidden = false;
    },

    _clearErrors() {
        document.querySelectorAll('.auth-message').forEach(el => {
            el.hidden = true;
            el.textContent = '';
        });
    },

    _translateError(msg) {
        const map = {
            'Invalid login credentials': 'Email ou senha incorretos.',
            'Email not confirmed': 'Email ainda não confirmado. Verifique sua caixa de entrada.',
            'User already registered': 'Este email já está cadastrado.',
            'Password should be at least 6 characters': 'A senha deve ter pelo menos 6 caracteres.',
            'Signup requires a valid password': 'Informe uma senha válida.',
            'Email rate limit exceeded': 'Muitas tentativas. Aguarde alguns minutos.',
            'For security purposes, you can only request this once every 60 seconds': 'Aguarde 60 segundos antes de tentar novamente.'
        };
        return map[msg] || msg;
    }
};
