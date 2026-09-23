// src/lib/steel/steelWeld.js
//
// Resistenza di un cordone d'angolo (saldatura) - metodo semplificato secondo
// NTC2018 par. 4.2.8.2.4 / EC3 4.5.3.3.
//   fvw,d = (fu / sqrt(3)) / (betaW gM2)     (resistenza a taglio del cordone)
//   Fw,Rd = fvw,d * a                        (per unita' di lunghezza)
//   capacita' = Fw,Rd * L_eff
// La forza applicata deve risultare <= capacita' (indipendentemente dalla
// direzione, nel metodo semplificato).

import { getGrade, GAMMA_M2 } from "./steelData.js";

export const DEFAULT_WELD_INPUT = {
    grade: "S275",
    a: 5, // sezione di gola [mm]
    L: 300, // lunghezza efficace totale [mm]
    F: 120, // forza applicata [kN]
};

export function steelWeld(input) {
    const { grade, a, L, F: F_kN } = input;
    const g = getGrade(grade);

    const fvwd = g.ftk / Math.sqrt(3) / (g.betaW * GAMMA_M2);
    const FwRd = fvwd * a; // per mm [N/mm]
    const capacity = FwRd * L; // N

    const F = F_kN * 1000;
    const utilization = capacity > 0 ? F / capacity : Infinity;
    const verified = utilization <= 1;

    return {
        ok: true,
        fu: g.ftk,
        betaW: g.betaW,
        fvwd,
        FwRd,
        capacity: capacity / 1000,
        utilization,
        verified,
    };
}
