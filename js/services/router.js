/* ============================================
   ROUTER
   ============================================ */
window.Router = {
    currentTab: 'hoje',

    // Tab order for slide direction
    _tabOrder: ['hoje','instrucoes','injecoes','sintomas','peso','nutricao','jornada','relatorios','ajuda','boaspraticas','perfil','backup'],

    init() {
        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;
                this.navigate(tab);
            });
        });
    },

    navigate(tab) {
        if (tab === this.currentTab) return;

        // Scroll to top immediately when switching tabs
        window.scrollTo(0, 0);

        // Determine slide direction
        const oldIdx = this._tabOrder.indexOf(this.currentTab);
        const newIdx = this._tabOrder.indexOf(tab);
        const direction = newIdx >= oldIdx ? 'slide-right' : 'slide-left';

        document.querySelectorAll('.tab-section').forEach(s => {
            s.classList.remove('active', 'slide-left', 'slide-right');
        });
        document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));

        const section = document.getElementById(`tab-${tab}`);
        const navBtns = document.querySelectorAll(`[data-tab="${tab}"]`);

        if (section) {
            section.classList.add('active', direction);
        }
        navBtns.forEach(btn => btn.classList.add('active'));

        this.currentTab = tab;
        if (window.App && App.refreshTab) {
            App.refreshTab(tab);
        }
    }
};
