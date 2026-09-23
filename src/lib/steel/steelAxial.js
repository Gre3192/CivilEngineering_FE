// src/lib/steel/steelAxial.js
//
// Resistenza a trazione e compressione (sezione) secondo NTC2018 par.
// 4.2.4.1.2. L'instabilita' a compressione va verificata a parte.
//   Npl,Rd = A fyk / gM0          (plasticizzazione sezione lorda)
//   Nu,Rd  = 0.9 Anet ftk / gM2   (rottura sezione netta forata)
//   Nc,Rd  = A fyk / gM0          (compressione, sezione)

import { getGrade, GAMMA_M0, GAMMA_M2 } from "./steelData.js";
import { getProfile } from "./steelProfiles.js";

export const DEFAULT_AXIAL_INPUT = {
    grade: "S275",
    profile: "IPE300",
    N: 800, // + trazione, - compressione [kN]
    nHoles: 0, // numero fori nella sezione trasversale
    dHole: 22, // diametro foro [mm]
    tHole: 7.1, // spessore attraversato dai fori [mm]
};

export function steelAxial(input) {
    const { grade, profile, N: N_kN, nHoles, dHole, tHole } = input;
    const g = getGrade(grade);
    const p = getProfile(profile);
    const A = p.A;
    const Anet = Math.max(A - nHoles * dHole * tHole, 0);

    const NplRd = (A * g.fyk) / GAMMA_M0;
    const NuRd = (0.9 * Anet * g.ftk) / GAMMA_M2;
    const NtRd = Math.min(NplRd, NuRd);
    const NcRd = (A * g.fyk) / GAMMA_M0;

    const N = N_kN * 1000;
    const tension = N >= 0;
    const NRd = tension ? NtRd : NcRd;
    const utilization = NRd > 0 ? Math.abs(N) / NRd : Infinity;
    const verified = utilization <= 1;

    return {
        ok: true,
        A,
        Anet,
        fyk: g.fyk,
        ftk: g.ftk,
        NplRd: NplRd / 1000,
        NuRd: NuRd / 1000,
        NtRd: NtRd / 1000,
        NcRd: NcRd / 1000,
        NRd: NRd / 1000,
        tension,
        utilization,
        verified,
    };
}
