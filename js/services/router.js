/* ============================================
   ROUTER
   ============================================ */
window.Router = {
    currentTab: 'hoje',

    init() {
        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;
                this.navigate(tab);
            });
        });
    },

    navigate(tab) {
        // Scroll to top immediately when switching tabs
        window.scrollTo(0, 0);

        document.querySelectorAll('.tab-section').forEach(s => s.classList.remove('active'));
        document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));

        const section = document.getElementById(`tab-${tab}`);
        const navBtns = document.querySelectorAll(`[data-tab="${tab}"]`);

        if (section) section.classList.add('active');
        navBtns.forEach(btn => btn.classList.add('active'));

        this.currentTab = tab;
        if (window.App && App.refreshTab) {
            App.refreshTab(tab);
        }
    }
};
