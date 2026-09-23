// src/lib/steel/steelBendingShear.js
//
// Resistenza a flessione e taglio (sezione) secondo NTC2018 par. 4.2.4.1.2.
//   Mc,Rd  = Wpl fyk / gM0   (classe 1-2)  oppure  Wel fyk / gM0 (classe 3)
//   Vpl,Rd = Avz (fyk/sqrt3) / gM0
//   Interazione M-V se V > 0.5 Vpl,Rd (riduzione della resistenza a flessione).

import { getGrade, GAMMA_M0 } from "./steelData.js";
import { getProfile } from "./steelProfiles.js";

export const DEFAULT_BENDING_INPUT = {
    grade: "S275",
    profile: "IPE300",
    sectionClass: "12", // "12" (plastica) o "3" (elastica)
    M: 80, // [kNm]
    V: 120, // [kN]
};

export function steelBendingShear(input) {
    const { grade, profile, sectionClass, M: M_kNm, V: V_kN } = input;
    const g = getGrade(grade);
    const p = getProfile(profile);

    const W = sectionClass === "3" ? p.Wely : p.Wply;
    const McRd = (W * g.fyk) / GAMMA_M0; // N*mm
    const VplRd = (p.Avz * (g.fyk / Math.sqrt(3))) / GAMMA_M0; // N

    const M = M_kNm * 1e6;
    const V = V_kN * 1000;

    const uV = V / VplRd;
    // Interazione M-V (EC3 6.2.8): se V>0.5Vpl si riduce fy nell'area a taglio
    let McRdRed = McRd;
    let rho = 0;
    if (uV > 0.5) {
        rho = Math.pow(2 * uV - 1, 2);
        // riduzione approssimata (a favore di sicurezza) applicata a tutta la sezione
        McRdRed = McRd * (1 - rho);
    }
    const uM = M / McRd;
    const uMV = M / McRdRed;

    const governing = Math.max(uM, uV, uMV);
    const verified = governing <= 1;

    return {
        ok: true,
        W,
        fyk: g.fyk,
        Avz: p.Avz,
        McRd: McRd / 1e6,
        VplRd: VplRd / 1000,
        McRdRed: McRdRed / 1e6,
        rho,
        interaction: uV > 0.5,
        uM,
        uV,
        uMV,
        governing,
        verified,
    };
}
