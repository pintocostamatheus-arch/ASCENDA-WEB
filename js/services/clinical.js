/* ============================================
   CLINICAL SERVICE (Dose Adjustment Logic)
   ============================================ */
window.ClinicalService = {
    ZONES: {
        BLUE: { label: 'Super-Resposta', color: 'info', min: -Infinity, max: -1.0, msg: 'Manter Dose (Preservação Muscular)' },
        GREEN: { label: 'Alta Eficácia', color: 'success', min: -1.0, max: -0.5, msg: 'Manter Dose Atual' },
        YELLOW: { label: 'Atenção/Platô', color: 'warning', min: -0.5, max: 0.2, msg: 'Monitorar Oscilação' },
        RED: { label: 'Estagnação', color: 'danger', min: 0.2, max: Infinity, msg: 'Avaliar Aumento' }
    },

    analyze(weights, currentDoseMg, weeksOnDose) {
        if (!weights || weights.length < 2) return null;

        // 1. Calculate Recent WWL (Last 30 days average - more robust for sparse data)
        const sorted = [...weights].sort((a, b) => a.dateISO.localeCompare(b.dateISO));
        const lastDate = new Date(sorted[sorted.length - 1].dateISO);
        const windowStart = new Date(lastDate);
        windowStart.setDate(lastDate.getDate() - 15);

        const recentWeights = sorted.filter(w => new Date(w.dateISO) >= windowStart);
        let wwlCurrent = 0;

        if (recentWeights.length >= 2) {
            const loss = recentWeights[recentWeights.length - 1].weightKg - recentWeights[0].weightKg;
            const diffMs = new Date(recentWeights[recentWeights.length - 1].dateISO) - new Date(recentWeights[0].dateISO);
            const days = diffMs / (1000 * 3600 * 24);
            wwlCurrent = days >= 3 ? (loss / days) * 7 : 0; // Negative for loss
        }

        // 2. Determine Zone basd on WWL (Standard: New - Old)
        let zone = this.ZONES.RED;
        if (wwlCurrent <= this.ZONES.BLUE.max) zone = this.ZONES.BLUE;
        else if (wwlCurrent >= this.ZONES.GREEN.min && wwlCurrent <= this.ZONES.GREEN.max) zone = this.ZONES.GREEN;
        else if (wwlCurrent > this.ZONES.YELLOW.min && wwlCurrent < this.ZONES.YELLOW.max) zone = this.ZONES.YELLOW;

        // 3. Apply Clinical Rules for Status
        let status = 'MONITOR'; // Default
        let reason = '';
        let action = 'maintain'; // maintain, escalate, monitor

        // RULE: Safety Block (Blue Zone) - Always maintain to protect muscle
        if (zone === this.ZONES.BLUE) {
            status = 'SUPER_RESPONDER';
            action = 'maintain';
            reason = 'Perda acelerada (<-1kg/sem). Manter dose para segurança.';
        }

        // RULE: Green Zone - Keep going
        else if (zone === this.ZONES.GREEN) {
            status = 'OPTIMAL';
            action = 'maintain';
            reason = 'Eficácia ideal (-1.0 a -0.5kg/sem). Continue assim.';
        }

        // RULE: Yellow/Red Zone (Low Efficacy)
        else {
            // Check 4-Week Plateau Rule
            // Look back 4 weeks
            const fourWeeksAgo = new Date(lastDate);
            fourWeeksAgo.setDate(lastDate.getDate() - 28);
            const monthlyWeights = sorted.filter(w => new Date(w.dateISO) >= fourWeeksAgo);

            let monthlyLoss = 0;
            if (monthlyWeights.length >= 2) {
                monthlyLoss = monthlyWeights[monthlyWeights.length - 1].weightKg - monthlyWeights[0].weightKg;
            }
            const monthlyAvg = monthlyLoss / 4; // Avg per week over 4 weeks (Negative for loss)

            // "Regra de Ouro": Exigir 4 semanas de dados consistentes
            const sustainedLowResponse = monthlyAvg > -0.5; // Meaning it lost less than 0.5kg per week (or gained)

            if (sustainedLowResponse && weeksOnDose >= 4) {
                // Exception for 2.5mg start dose (User Rule 4)
                if (currentDoseMg === 2.5 && wwlCurrent < -1.0) {
                    status = 'SUPER_RESPONDER_START';
                    action = 'maintain';
                    reason = 'Super-resposta inicial. Manter 2.5mg por segurança.';
                } else {
                    status = 'ESCALATE_SUGGESTED';
                    action = 'escalate';
                    reason = 'Baixa eficácia por 4 semanas. Considerar aumento.';
                }
            } else {
                status = 'MONITOR_OSCILLATION';
                action = 'monitor';
                reason = weeksOnDose < 4
                    ? `Adaptação (${weeksOnDose}ª semana). Aguarde 4 semanas.`
                    : 'Oscilação recente. Aguardando confirmação (4 semanas).';
            }
        }

        return {
            wwl: (wwlCurrent || 0).toFixed(2),
            zone: zone,
            status: status,
            action: action,
            reason: reason,
            weeksOnDose: weeksOnDose
        };
    }
};
