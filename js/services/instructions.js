/* ============================================
   INSTRUCTIONS SERVICE (Calculator Logic)
   ============================================ */
window.InstructionsService = {
    // Drug data with dose-to-UI/clicks mappings
    DRUGS: {
        // Tirzepatida Ampolas (calculated based on concentration)
        tg: { type: 'ampola', name: 'T.G.' },
        tirzec: { type: 'ampola', name: 'Tirzec' },
        lipoless: { type: 'ampola', name: 'Lipoless' },

        // Mounjaro KwikPen 15mg (60 cliques = 15mg)
        mounjaro: {
            type: 'caneta',
            name: 'Mounjaro',
            clicks: { 2.5: 10, 5: 20, 7.5: 30, 10: 40, 12.5: 50, 15: 60 }
        },

        // Ozempic 1.0mg (74 cliques = 1.0mg)
        ozempic: {
            type: 'caneta',
            name: 'Ozempic',
            clicks: { 0.25: 18, 0.5: 37, 1.0: 74 }
        },

        // Wegovy 2.4mg (Vinho)
        'wegovy-24': {
            type: 'caneta',
            name: 'Wegovy 2.4mg',
            clicks: { 0.25: 8, 0.5: 15, 1.0: 31, 1.7: 52, 2.4: 74 }
        },

        // Wegovy 1.7mg (Azul Escuro)
        'wegovy-17': {
            type: 'caneta',
            name: 'Wegovy 1.7mg',
            clicks: { 0.25: 11, 0.5: 22, 1.0: 44, 1.7: 62 }
        },

        // Wegovy 1.0mg (Turquesa)
        'wegovy-10': {
            type: 'caneta',
            name: 'Wegovy 1.0mg',
            clicks: { 0.25: 18, 0.5: 37, 1.0: 74 }
        }
    },

    // Ampola UI lookup table - concentration (mg/0.5ml) vs dose (mg)
    AMPOLA_TABLE: {
        2.5: { 2.5: 50 },
        5: { 2.5: 25, 5: 50 },
        7.5: { 2.5: 17, 5: 33, 7.5: 50 },
        10: { 2.5: 13, 5: 25, 7.5: 38, 10: 50 },
        12.5: { 2.5: 10, 5: 21, 7.5: 31, 10: 42, 12.5: 50 },
        15: { 2.5: 8, 5: 17, 7.5: 25, 10: 33, 12.5: 42, 15: 50 }
    },

    calculate(drugId, doseMg, concentrationMgPer05ml = null) {
        const drug = this.DRUGS[drugId];
        if (!drug) return null;

        let result = { drugName: drug.name, doseMg, volumeUI: null, clicks: null, warning: null };

        if (drug.type === 'ampola') {
            // For ampolas: calculate UI based on concentration table
            if (!concentrationMgPer05ml) return null;

            const table = this.AMPOLA_TABLE[concentrationMgPer05ml];
            if (!table) {
                result.warning = 'Concentração não encontrada na tabela';
                return result;
            }

            // Direct lookup for standard doses
            if (table[doseMg] !== undefined) {
                result.volumeUI = table[doseMg];
            } else {
                // Calculate for non-standard doses
                // Formula: UI = (doseMg / concentrationMgPer05ml) * 50
                const calculated = (doseMg / concentrationMgPer05ml) * 50;
                result.volumeUI = Math.round(calculated * 10) / 10;

                if (result.volumeUI > 50) {
                    result.warning = 'Dose excede o limite de 50 UI por aplicação. Divida em múltiplas injeções.';
                }
            }
        } else if (drug.type === 'caneta') {
            // For pens: lookup clicks from table
            if (drug.clicks[doseMg] !== undefined) {
                result.clicks = drug.clicks[doseMg];
            } else {
                // Interpolate for non-standard doses
                const doses = Object.keys(drug.clicks).map(Number).sort((a, b) => a - b);
                const maxDose = doses[doses.length - 1];
                const maxClicks = drug.clicks[maxDose];

                // Linear interpolation
                result.clicks = Math.round((doseMg / maxDose) * maxClicks);
                result.warning = 'Dose não padrão. Cliques estimados por interpolação.';
            }
        }

        return result;
    }
};
