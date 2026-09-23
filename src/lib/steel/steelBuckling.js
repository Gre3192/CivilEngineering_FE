// src/lib/steel/steelBuckling.js
//
// Instabilita' a compressione (carico di punta) secondo NTC2018 par.
// 4.2.4.1.3.1 / EC3 6.3.1.
//   lambda_bar = (Lcr/i) / lambda1 ,  lambda1 = pi sqrt(E/fyk)
//   Phi = 0.5 [1 + alpha(lambda_bar - 0.2) + lambda_bar^2]
//   chi = 1 / (Phi + sqrt(Phi^2 - lambda_bar^2)) <= 1
//   Nb,Rd = chi A fyk / gM1

import { getGrade, getCurve, E_STEEL, GAMMA_M1 } from "./steelData.js";
import { getProfile } from "./steelProfiles.js";

export const DEFAULT_BUCKLING_INPUT = {
    grade: "S275",
    profile: "HEB200",
    axis: "z", // asse di inflessione (debole = z)
    Lcr: 3.5, // lunghezza libera di inflessione [m]
    curve: "c",
    NEd: 600, // [kN] (compressione)
};

export function steelBuckling(input) {
    const { grade, profile, axis, Lcr: Lcr_m, curve, NEd: NEd_kN } = input;
    const g = getGrade(grade);
    const p = getProfile(profile);
    const c = getCurve(curve);

    const i = axis === "y" ? p.iy : p.iz;
    const I = axis === "y" ? p.Iy : p.Iz;
    const Lcr = Lcr_m * 1000;

    const lambda1 = Math.PI * Math.sqrt(E_STEEL / g.fyk);
    const lambdaBar = Lcr / i / lambda1;
    const Ncr = (Math.PI * Math.PI * E_STEEL * I) / (Lcr * Lcr); // N

    const Phi = 0.5 * (1 + c.alpha * (lambdaBar - 0.2) + lambdaBar * lambdaBar);
    const chi = Math.min(1 / (Phi + Math.sqrt(Math.max(Phi * Phi - lambdaBar * lambdaBar, 0))), 1);

    const NbRd = (chi * p.A * g.fyk) / GAMMA_M1; // N
    const NEd = NEd_kN * 1000;
    const utilization = NbRd > 0 ? NEd / NbRd : Infinity;
    const verified = utilization <= 1;

    return {
        ok: true,
        i,
        A: p.A,
        fyk: g.fyk,
        lambda1,
        lambdaBar,
        Ncr: Ncr / 1000,
        Phi,
        chi,
        alpha: c.alpha,
        NbRd: NbRd / 1000,
        utilization,
        verified,
    };
}
