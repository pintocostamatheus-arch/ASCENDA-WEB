/* ============================================
   UI COMPONENTS & HELPERS
   ============================================ */
window.UI = {
    capitalizeDate(str) {
        if (!str) return '';
        return str.split(' ').map(word => {
            return word.length > 2 ? word.charAt(0).toUpperCase() + word.slice(1) : word;
        }).join(' ');
    },

    setClick(id, callback) {
        const el = document.getElementById(id);
        if (el) el.onclick = callback;
    },

    setEvent(id, event, callback) {
        const el = document.getElementById(id);
        if (el) el.addEventListener(event, callback);
    },

    updateHeader() {
        const now = new Date();
        const dateEl = document.getElementById('header-date');

        if (dateEl) {
            const options = { weekday: 'long', day: 'numeric', month: 'long' };
            const dateStr = now.toLocaleDateString('pt-BR', options);
            dateEl.innerText = this.capitalizeDate(dateStr);
        }
    },

    toast(message, type = 'success', duration = 3000) {
        const container = document.getElementById('toast-container');
        const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <span class="toast-icon">${icons[type]}</span>
            <span class="toast-message">${SecurityUtils.escapeHTML(message)}</span>
        `;

        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('toast-exit');
            setTimeout(() => toast.remove(), 200);
        }, duration);
    },

    /** Wraps a button action with loading state — prevents double-submit */
    async withLoading(btn, asyncFn) {
        if (!btn || btn.disabled) return;
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.classList.add('btn-loading');
        try {
            await asyncFn();
        } catch (e) {
            console.error('Action failed:', e);
            this.toast('Erro na operação', 'error');
        } finally {
            btn.disabled = false;
            btn.classList.remove('btn-loading');
            btn.innerHTML = originalText;
        }
    },


    showModal(title, content, buttons = [], onRender = null) {
        const overlay = document.getElementById('modal-overlay');
        const titleEl = document.getElementById('modal-title');
        const bodyEl = document.getElementById('modal-body');
        const footerEl = document.getElementById('modal-footer');

        if (titleEl) titleEl.textContent = title;
        if (bodyEl) bodyEl.innerHTML = content;
        if (footerEl) footerEl.innerHTML = '';

        buttons.forEach(btn => {
            const button = document.createElement('button');
            button.className = `btn ${btn.class || 'btn-secondary'}`;
            button.textContent = btn.text;
            button.onclick = () => {
                if (btn.onClick) btn.onClick();
                if (btn.closeOnClick !== false) this.hideModal();
            };
            footerEl.appendChild(button);
        });

        overlay.hidden = false;
        if (onRender) onRender();
    },

    hideModal() {
        document.getElementById('modal-overlay').hidden = true;
    },

    openModal(id) {
        const modal = document.getElementById(id);
        if (modal) {
            modal.removeAttribute('hidden');
            modal.style.display = 'flex';
            setTimeout(() => modal.classList.add('active'), 10);
        }
    },

    closeModal(id) {
        const modal = document.getElementById(id);
        if (modal) {
            modal.classList.remove('active');
            setTimeout(() => {
                modal.style.display = 'none';
                modal.setAttribute('hidden', '');
            }, 300);
        }
    },

    confirmDelete({ title, message, onConfirm }) {
        this.showModal(
            title || 'Confirmar Exclusão',
            `<div style="text-align:center; padding: 20px 0;">
                <div style="font-size: 3rem; margin-bottom: 20px;">🗑️</div>
                <p style="color: var(--text-secondary); line-height: 1.5;">${message}</p>
            </div>`,
            [
                { text: 'Cancelar', class: 'btn-secondary', closeOnClick: true },
                {
                    text: 'Deletar',
                    class: 'btn-danger',
                    onClick: onConfirm,
                    closeOnClick: true
                }
            ]
        );
    },

    updateProgress(elementId, current, target) {
        const el = document.getElementById(elementId);
        if (!el) return;

        const pct = Math.min(100, (current / target) * 100);

        if (el.tagName.toLowerCase() === 'circle') {
            const r = el.r.baseVal.value || 45;
            const circumference = 2 * Math.PI * r;
            const offset = circumference - (pct / 100) * circumference;
            el.style.strokeDasharray = `${circumference} ${circumference}`;
            el.style.strokeDashoffset = offset;
        } else if (el.tagName.toLowerCase() === 'path' && el.classList.contains('ring-fill')) {
            // Logic for Dashboard Rings (viewBox 0 0 36 36, C=100)
            // Stroke-dasharray: "current, 100"
            el.style.strokeDasharray = `${pct}, 100`;
        } else {
            el.style.width = `${pct}%`;
        }

        const isNutri = elementId.includes('protein') || elementId.includes('water') || elementId.includes('fiber');
        if (isNutri) {
            const cardType = elementId.replace('-ring', '').replace('-progress', '');
            const card = document.getElementById(`${cardType}-card`);
            const numberEl = document.getElementById(`${cardType}-consumed`);
            if (card) {
                if (numberEl) {
                    numberEl.classList.remove('animating');
                    void numberEl.offsetWidth;
                    numberEl.classList.add('animating');
                    setTimeout(() => numberEl.classList.remove('animating'), 500);
                }
                card.classList.remove('goal-reached', 'close-to-goal', 'goal-celebration');
                if (pct >= 100) {
                    const wasAlreadyComplete = card.dataset.goalReached === 'true';
                    card.classList.add('goal-reached');
                    if (!wasAlreadyComplete) {
                        card.dataset.goalReached = 'true';
                        card.classList.add('goal-celebration');
                        setTimeout(() => card.classList.remove('goal-celebration'), 600);
                    }
                } else if (pct >= 90) {
                    card.classList.add('close-to-goal');
                    card.dataset.goalReached = 'false';
                } else {
                    card.dataset.goalReached = 'false';
                }
            }
        }
    },
};
