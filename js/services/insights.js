/** InsightService — Contextual daily insights based on user data */
const InsightService = {

    /** Returns the best insight for right now */
    getInsight() {
        const rules = this._getRules();
        for (const rule of rules) {
            const result = rule();
            if (result) return result;
        }
        return this._neutralTip();
    },

    /** Priority-ordered rules — first match wins */
    _getRules() {
        return [
            () => this._injectionToday(),
            () => this._injectionTomorrow(),
            () => this._injectionOverdue(),
            () => this._weeklyWeightLoss(),
            () => this._weeklyWeightGain(),
            () => this._noWeightRecently(),
            () => this._hydrationStreak(),
            () => this._lowHydration(),
            () => this._proteinStreak(),
            () => this._earlyJourney(),
            () => this._milestone30days(),
        ];
    },

    // ─── INJECTION RULES ────────────────────────────

    _injectionToday() {
        if (!window.DoseService) return null;
        const nextDate = DoseService.getNextInjectionDate();
        if (!nextDate) return null;
        const today = DateService.today();
        if (nextDate !== today) return null;
        const lastInj = DoseService.getLastInjection();
        return {
            icon: '💉',
            title: 'Aplicação Hoje',
            text: `Sua dose de ${lastInj?.drugName || 'medicamento'} está programada para hoje. Lembre-se de alternar o local de aplicação.`,
            type: 'warning'
        };
    },

    _injectionTomorrow() {
        if (!window.DoseService) return null;
        const nextDate = DoseService.getNextInjectionDate();
        if (!nextDate) return null;
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowISO = tomorrow.toISOString().split('T')[0];
        if (nextDate !== tomorrowISO) return null;
        return {
            icon: '📅',
            title: 'Aplicação Amanhã',
            text: `Sua próxima aplicação é amanhã. Retire o medicamento da geladeira 30 min antes para reduzir a dor.`,
            type: 'info'
        };
    },

    _injectionOverdue() {
        if (!window.DoseService) return null;
        const nextDate = DoseService.getNextInjectionDate();
        if (!nextDate) return null;
        const today = DateService.today();
        if (nextDate >= today) return null;
        const days = Math.floor((new Date(today) - new Date(nextDate)) / 86400000);
        if (days < 1) return null;
        return {
            icon: '⚠️',
            title: 'Aplicação Atrasada',
            text: `Sua dose está ${days} dia${days > 1 ? 's' : ''} atrasada. Aplique assim que possível e ajuste o calendário.`,
            type: 'urgent'
        };
    },

    // ─── WEIGHT RULES ───────────────────────────────

    _weeklyWeightLoss() {
        if (!window.WeightService) return null;
        const all = WeightService.getAll();
        if (all.length < 2) return null;
        const latest = all[all.length - 1];
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const weekAgoISO = weekAgo.toISOString().split('T')[0];
        const prev = [...all].reverse().find(w => w.dateISO <= weekAgoISO);
        if (!prev) return null;
        const diff = prev.weightKg - latest.weightKg;
        if (diff <= 0.2) return null;
        return {
            icon: '📉',
            title: 'Progresso Semanal',
            text: `Você perdeu ${diff.toFixed(1)}kg nos últimos 7 dias! Mantenha o foco na proteína para preservar massa magra.`,
            type: 'success'
        };
    },

    _weeklyWeightGain() {
        if (!window.WeightService) return null;
        const all = WeightService.getAll();
        if (all.length < 3) return null;
        const latest = all[all.length - 1];
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const weekAgoISO = weekAgo.toISOString().split('T')[0];
        const prev = [...all].reverse().find(w => w.dateISO <= weekAgoISO);
        if (!prev) return null;
        const diff = latest.weightKg - prev.weightKg;
        if (diff < 0.5) return null;
        return {
            icon: '📊',
            title: 'Atenção ao Peso',
            text: `Houve um aumento de ${diff.toFixed(1)}kg essa semana. Pode ser retenção hídrica — reveja o consumo de sódio e água.`,
            type: 'warning'
        };
    },

    _noWeightRecently() {
        if (!window.WeightService) return null;
        const all = WeightService.getAll();
        if (all.length === 0) return null;
        const latest = all[all.length - 1];
        const days = Math.floor((new Date() - new Date(latest.dateISO)) / 86400000);
        if (days < 3) return null;
        return {
            icon: '⚖️',
            title: 'Peso Desatualizado',
            text: `Faz ${days} dias sem registro. Pese-se em jejum pela manhã, com roupas leves, para manter a precisão da curva.`,
            type: 'info'
        };
    },

    // ─── NUTRITION RULES ────────────────────────────

    _hydrationStreak() {
        if (!window.NutritionService) return null;
        const streak = NutritionService.getStreak('water');
        if (streak < 3) return null;
        return {
            icon: '💧',
            title: 'Hidratação Exemplar',
            text: `${streak} dias consecutivos batendo a meta de água! A hidratação constante reduz náuseas e melhora a digestão.`,
            type: 'success'
        };
    },

    _lowHydration() {
        if (!window.NutritionService) return null;
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yISO = yesterday.toISOString().split('T')[0];
        const data = NutritionService.getByDate(yISO);
        if (!data) return null;
        const targets = NutritionService.calculate ? NutritionService.calculate() : {};
        const waterGoal = targets.water || 2500;
        if ((data.waterMl || 0) >= waterGoal) return null;
        const pct = Math.round(((data.waterMl || 0) / waterGoal) * 100);
        if (pct > 60) return null;
        return {
            icon: '🥤',
            title: 'Hidratação Baixa',
            text: `Ontem você atingiu apenas ${pct}% da meta de água. Comece o dia com um copo grande logo ao acordar!`,
            type: 'warning'
        };
    },

    _proteinStreak() {
        if (!window.NutritionService) return null;
        const streak = NutritionService.getStreak('protein');
        if (streak < 3) return null;
        return {
            icon: '🥩',
            title: 'Proteína em Dia',
            text: `${streak} dias seguidos no alvo de proteína! Isso é essencial para preservar massa muscular durante o emagrecimento.`,
            type: 'success'
        };
    },

    // ─── JOURNEY RULES ──────────────────────────────

    _earlyJourney() {
        if (!window.JourneyService) return null;
        const stats = JourneyService.getStats();
        if (stats.days > 14 || stats.days < 1) return null;
        return {
            icon: '🌱',
            title: 'Início da Jornada',
            text: 'Nas primeiras semanas, foque em comer devagar, porções menores e manter a hidratação. O corpo está se adaptando!',
            type: 'info'
        };
    },

    _milestone30days() {
        if (!window.JourneyService) return null;
        const stats = JourneyService.getStats();
        if (stats.days < 30 || stats.days > 35) return null;
        return {
            icon: '💎',
            title: '1 Mês de Jornada!',
            text: 'Parabéns! Você completou 30 dias. Esse é o momento ideal para tirar uma foto de progresso e comparar com o início.',
            type: 'success'
        };
    },

    // ─── NEUTRAL FALLBACK ───────────────────────────

    _neutralTip() {
        const tips = [
            { icon: '💡', title: 'Dica do Dia', text: 'Mastigue cada garfada pelo menos 20 vezes. O GLP-1 retarda o esvaziamento gástrico — refeições lentas evitam desconforto.' },
            { icon: '🧊', title: 'Dica do Dia', text: 'Retire a caneta da geladeira 30 minutos antes da aplicação. O medicamento em temperatura ambiente causa menos dor.' },
            { icon: '🏋️', title: 'Dica do Dia', text: 'Musculação durante o tratamento é essencial. A perda de peso com GLP-1 pode incluir massa magra — o treino minimiza isso.' },
            { icon: '🥗', title: 'Dica do Dia', text: 'Priorize proteína no café da manhã. Isso ajuda a manter a saciedade e protege contra a perda muscular.' },
            { icon: '😴', title: 'Dica do Dia', text: 'Durma 7-8 horas por noite. O sono regula a grelina e a leptina — hormônios que controlam fome e saciedade.' },
            { icon: '🚶', title: 'Dica do Dia', text: 'Caminhar 30 minutos após as refeições melhora a sensibilidade à insulina e acelera o metabolismo basal.' },
            { icon: '📸', title: 'Dica do Dia', text: 'Registre fotos periodicamente na aba Jornada. A balança nem sempre reflete composição corporal — fotos mostram a mudança real.' },
        ];
        const dayIndex = new Date().getDate() % tips.length;
        return { ...tips[dayIndex], type: 'neutral' };
    }
};

window.InsightService = InsightService;
