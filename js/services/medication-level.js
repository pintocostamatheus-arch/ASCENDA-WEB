/* ============================================
   MEDICATION LEVEL SERVICE
   ============================================ */
window.MedicationLevelService = {
    // Pharmacokinetic parameters by drug class
    // References: Clinical pharmacokinetic studies
    DRUG_PARAMS: {
        // Tirzepatida (Mounjaro, Tirzec, TG)
        tirzepatida: {
            name: 'Tirzepatida',
            Ka: 0.0373,           // Absorption constant (h⁻¹)
            Tmax: 48,             // Time to peak (hours)
            halfLife: 120,        // ~5 days in hours
            kel: 0.00578,         // Elimination constant (h⁻¹) = ln(2)/120
            CL_ref: 0.0329,       // Clearance at 70kg (L/h)
            bioavailability: 0.80, // 80%
            accumulation: 1.62,   // Steady-state accumulation ratio
            steadyStateWeeks: 4,  // Weeks to reach steady-state
            allometricCL: 0.8,    // Exponent for CL
            allometricV: 1.0      // Exponent for V
        },
        // Semaglutida (Ozempic, Wegovy)
        // Source: User-provided clinical pharmacokinetic data
        semaglutida: {
            name: 'Semaglutida',
            Ka: 0.0289,           // Absorption constant (h⁻¹) based on Tmax ~48h
            Tmax: 48,             // Time to peak (hours) - range 24-72h
            halfLife: 168,        // 7 days in hours
            kel: 0.0041,          // Elimination constant (h⁻¹) = ln(2)/168
            CL_ref: 0.05,         // Clearance at 70kg (L/h)
            Vd: 12.5,             // Volume of distribution (L) - >99% protein binding
            bioavailability: 0.89, // 89%
            accumulation: 2.0,    // Steady-state accumulation ratio (doubles at SS)
            steadyStateWeeks: 5,  // 4-5 weeks to reach steady-state
            allometricCL: 0.8,    // Exponent for CL
            allometricV: 1.0,     // Exponent for V
            // PD parameters (Strathe et al. 2024)
            kout: 0.0039,         // Effect loss rate (day⁻¹)
            IC50: 12.3,           // nmol/L for 50% effect
            fatLossRatio: 0.60,   // 60% fat, 40% lean mass loss
            leanLossRatio: 0.40
        },
        // Retatrutida (LY3437943) - Triagonista GLP-1/GIP/Glucagon
        // Ref: Eli Lilly Phase 2 / Phase 3 PK data
        retatrutida: {
            name: 'Retatrutida',
            Ka: 0.0350,           // Absorption constant (h⁻¹) — similar subcutaneous profile
            Tmax: 48,             // Time to peak (hours)
            halfLife: 144,        // 6 days in hours
            kel: 0.004813,        // ln(2)/144 ≈ 0.004813 h⁻¹
            CL_ref: 0.040,        // Estimated clearance at 70kg (L/h)
            bioavailability: 0.85, // Estimated ~85% SC bioavailability
            accumulation: 1.8,    // Steady-state Rac for weekly dosing
            steadyStateWeeks: 5,  // ~30 days / 4+ doses to reach steady-state
            allometricCL: 0.8,
            allometricV: 1.0,
            maxSafeDoseMg: 12     // Phase 2 safety limit (12mg)
        }
    },

    // Map drug names to their class
    DRUG_CLASS_MAP: {
        'mounjaro': 'tirzepatida',
        'tirzec': 'tirzepatida',
        'tg': 'tirzepatida',
        'lipoless': 'tirzepatida',
        'zepbound': 'tirzepatida',
        'ozempic': 'semaglutida',
        'wegovy': 'semaglutida',
        'retatrutide': 'retatrutida',
        'retatrutida': 'retatrutida'
    },

    /**
     * Get drug class (tirzepatida or semaglutida)
     */
    getDrugClass(drugName) {
        if (!drugName) return 'tirzepatida';
        const key = drugName.toLowerCase().trim();
        return this.DRUG_CLASS_MAP[key] || 'tirzepatida';
    },

    /**
     * Get pharmacokinetic parameters for a drug
     */
    getParams(drugName) {
        const drugClass = this.getDrugClass(drugName);
        return this.DRUG_PARAMS[drugClass];
    },

    /**
     * Adjust clearance for patient weight (allometric scaling)
     * CL_patient = CL_ref × (Weight/70)^0.8
     */
    adjustClearanceForWeight(CL_ref, weightKg, exponent = 0.8) {
        const refWeight = 70;
        return CL_ref * Math.pow(weightKg / refWeight, exponent);
    },

    /**
     * Two-compartment model: concentration profile
     * C(t) = F × Dose × Ka / (V × (Ka - kel)) × (e^(-kel×t) - e^(-Ka×t))
     * Simplified for practical use with Tmax-based curve
     */
    getLevelAtTime(hoursAfterInjection, params) {
        const { Ka, kel, Tmax, halfLife } = params;

        // Use Bateman equation for absorption and elimination
        // Normalized so peak = 100% at Tmax
        if (hoursAfterInjection < 0) return 0;

        // Absorption phase (0 to Tmax): rising curve
        if (hoursAfterInjection <= Tmax) {
            // Exponential rise to peak
            const absorptionFraction = 1 - Math.exp(-Ka * hoursAfterInjection);
            const peakNormalized = 1 - Math.exp(-Ka * Tmax);
            return 100 * (absorptionFraction / peakNormalized);
        }

        // Elimination phase (after Tmax): exponential decay from peak
        const hoursAfterPeak = hoursAfterInjection - Tmax;
        const halfLifeHours = halfLife;
        return 100 * Math.pow(0.5, hoursAfterPeak / halfLifeHours);
    },

    /**
     * Get current medication level with detailed info
     */
    getCurrentLevel() {
        const injections = DoseService.getAll();
        if (injections.length === 0) return null;

        // FIND LATEST ACTIVE INJECTION (Past or Present)
        const now = new Date();
        const activeInjections = injections.filter(i => {
            return i.dateISO <= DateService.today();
        });

        if (activeInjections.length === 0) return null;

        // Sort by date (descending) to ensure we get the true latest
        activeInjections.sort((a, b) => {
            return new Date(a.dateISO) - new Date(b.dateISO);
        });

        const last = activeInjections[activeInjections.length - 1];
        const params = this.getParams(last.drugName);
        const currentWeight = ProfileService.getCurrentWeight() || 70;

        const dateStr = last.dateISO || last.date;
        const injDateTime = new Date(`${dateStr}T${last.time || '08:00'}`);
        // Clamp 'now' to be at least the injection time if it's today (handling future-dated logs)
        const effectiveNow = new Date(Math.max(now.getTime(), injDateTime.getTime()));
        const hoursElapsed = (effectiveNow - injDateTime) / (1000 * 60 * 60);

        let level = this.getLevelAtTime(hoursElapsed, params);
        const peakLevel = 100; // At Tmax
        const troughLevel = this.getLevelAtTime(7 * 24, params); // At 7 days

        // Determine phase
        let phase = 'absorção';
        let phaseLabel = 'Fase de Absorção / Pico de Concentração';
        if (hoursElapsed > params.Tmax) {
            phase = 'eliminação';
            phaseLabel = 'Fase de Eliminação Ativa';
        }

        // Steady-state accumulation for Retatrutida (≥4 consecutive weekly doses)
        let accumulationApplied = false;
        let systemicLoad = level;
        const drugClass = this.getDrugClass(last.drugName);
        if (drugClass === 'retatrutida' && params.accumulation) {
            const weeklyDoses = activeInjections.filter(i =>
                this.getDrugClass(i.drugName) === 'retatrutida'
            );
            if (weeklyDoses.length >= 4) {
                systemicLoad = Math.min(100, level * params.accumulation);
                accumulationApplied = true;
            }
        }

        return {
            level: level,
            systemicLoad: systemicLoad,
            accumulationApplied: accumulationApplied,
            hoursElapsed: hoursElapsed,
            daysElapsed: hoursElapsed / 24,
            phase: phase,
            phaseLabel: phaseLabel,
            params: params,
            lastInjection: last,
            peakLevel: peakLevel,
            peakTime: params.Tmax,
            troughLevel: troughLevel,
            adjustedCL: this.adjustClearanceForWeight(params.CL_ref, currentWeight),
            patientWeight: currentWeight
        };
    },

    /**
     * Generate data points for the medication level chart
     * Uses proper absorption-elimination curve
     */
    getChartData() {
        const injections = DoseService.getAll();
        if (injections.length === 0) return null;

        // FIND LATEST ACTIVE INJECTION (Past or Present)
        const now = new Date();
        const activeInjections = injections.filter(i => {
            return i.dateISO <= DateService.today();
        });

        if (activeInjections.length === 0) return null;

        // Sort by date (descending) to ensure we get the true latest
        activeInjections.sort((a, b) => {
            return new Date(a.dateISO) - new Date(b.dateISO);
        });

        const last = activeInjections[activeInjections.length - 1];
        const params = this.getParams(last.drugName);
        const dateStr = last.dateISO || last.date;
        const injDateTime = new Date(`${dateStr}T${last.time || '08:00'}`);
        // Clamp 'now' for chart to ensuring current point is shown even if dose is slightly in future (today)
        const effectiveNow = new Date(Math.max(now.getTime(), injDateTime.getTime()));

        // Generate points from 0 to 7 days (168 hours)
        const points = [];
        const steps = 56; // Every 3 hours
        let closestToPeak = { index: -1, diff: Infinity };

        for (let i = 0; i <= steps; i++) {
            const hours = (i / steps) * 168;
            const level = this.getLevelAtTime(hours, params);
            const date = new Date(injDateTime.getTime() + hours * 60 * 60 * 1000);

            // Find the single closest point to Tmax
            const diffToPeak = Math.abs(hours - params.Tmax);
            if (diffToPeak < closestToPeak.diff) {
                closestToPeak = { index: i, diff: diffToPeak };
            }

            points.push({
                hours: hours,
                day: hours / 24,
                level: level,
                date: date,
                isPeak: false, // Will set the single peak below
                isCurrent: date <= effectiveNow && new Date(injDateTime.getTime() + ((i + 1) / steps) * 168 * 60 * 60 * 1000) > effectiveNow
            });
        }

        // Mark only the single closest point as peak
        if (closestToPeak.index >= 0) {
            points[closestToPeak.index].isPeak = true;
        }

        const hoursElapsed = (effectiveNow - injDateTime) / (1000 * 60 * 60);

        return {
            points: points,
            currentLevel: this.getLevelAtTime(hoursElapsed, params),
            currentHours: hoursElapsed,
            currentDay: hoursElapsed / 24,
            params: params,
            drugName: last.drugName,
            drugClass: this.getDrugClass(last.drugName),
            peakHours: params.Tmax,
            halfLife: params.halfLife
        };
    },

    /**
     * Get formatted drug name for display
     */
    formatDrugName(drugNameValue) {
        if (!drugNameValue) return '';
        // Map all commercial/legacy names directly to the active principles
        const names = {
            'mounjaro': 'Tirzepatida',
            'tirzec': 'Tirzepatida',
            'tg': 'Tirzepatida',
            'lipoless': 'Tirzepatida',
            'zepbound': 'Tirzepatida',
            'tirzepatida': 'Tirzepatida',
            'ozempic': 'Semaglutida',
            'wegovy': 'Semaglutida',
            'rybelsus': 'Semaglutida',
            'semaglutida': 'Semaglutida',
            'retatrutide': 'Retatrutida',
            'retatrutida': 'Retatrutida',
            'saxenda': 'Liraglutida',
            'victoza': 'Liraglutida'
        };
        const key = drugNameValue.toLowerCase().trim();
        return names[key] || drugNameValue;
    }
};
