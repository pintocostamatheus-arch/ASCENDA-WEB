/* ============================================
   DATE SERVICE
   ============================================ */
window.DateService = {
    toLocalISO(d) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },

    today() {
        return this.toLocalISO(new Date());
    },

    calculateAge(birthDateString) {
        if (!birthDateString) return 0;
        const today = new Date();
        const birthDate = new Date(birthDateString);
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age;
    },

    format(dateStr, style = 'short') {
        const date = new Date(dateStr + 'T12:00:00');
        const options = style === 'long'
            ? { weekday: 'long', day: 'numeric', month: 'long' }
            : { day: '2-digit', month: '2-digit' };
        return date.toLocaleDateString('pt-BR', options);
    },

    formatFull(dateStr) {
        const date = new Date(dateStr + 'T12:00:00');
        return date.toLocaleDateString('pt-BR', {
            day: '2-digit', month: '2-digit', year: 'numeric'
        });
    },

    daysAgo(dateStr) {
        const diff = this.diffDays(dateStr, this.today());
        if (diff === 0) return 'Hoje';
        if (diff === 1) return 'Ontem';
        return `${diff} dias atrás`;
    },

    diffDays(start, end) {
        const d1 = new Date(start);
        const d2 = new Date(end);
        return Math.floor((d2 - d1) / (1000 * 60 * 60 * 24));
    },

    addDays(dateStr, days) {
        const date = new Date(dateStr + 'T12:00:00');
        date.setDate(date.getDate() + days);
        return this.toLocalISO(date);
    },

    getWeekDay(dateStr) {
        const date = new Date(dateStr + 'T12:00:00');
        return date.getDay();
    },

    nextWeekday(targetDay) {
        const today = new Date();
        const currentDay = today.getDay();
        let daysUntil = targetDay - currentDay;
        if (daysUntil <= 0) daysUntil += 7;
        const next = new Date(today);
        next.setDate(today.getDate() + daysUntil);
        return this.toLocalISO(next);
    },

    getCurrentWeekScheduledDate(targetDay) {
        const today = new Date(this.today() + 'T12:00:00');
        const currentDay = today.getDay();
        let diff = targetDay - currentDay;
        const scheduled = new Date(today);
        scheduled.setDate(today.getDate() + diff);
        return this.toLocalISO(scheduled);
    },

    filterByPeriod(data, period, dateKey = 'dateISO') {
        if (period === 'all') return data;
        const today = new Date(this.today());
        const cutoff = new Date(today);
        cutoff.setDate(cutoff.getDate() - parseInt(period));
        return data.filter(item => new Date(item[dateKey]) >= cutoff);
    }
};
