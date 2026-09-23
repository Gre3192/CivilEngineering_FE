// src/lib/wood/woodSLU.js
//
// Verifiche di resistenza (SLU) di una sezione rettangolare in legno secondo
// NTC2018 par. 4.4.8 / EC5 par. 6.1-6.2. Non include l'instabilita' (svergolamento
// e carico di punta), che va verificata a parte.
//
// Convenzione: N > 0 trazione, N < 0 compressione. Lunghezze mm, forze N.

import { getTimber, kmod as kmodFn, gammaM as gammaMFn, kh as khFn, designStrength } from "./woodMaterials.js";

const KCR = 0.67; // coefficiente di fessurazione per il taglio (EC5)

export const DEFAULT_WOOD_SLU_INPUT = {
    timber: "C24",
    serviceClass: "1",
    duration: "media",
    b: 120, // base [mm]
    h: 240, // altezza [mm]
    N: 0, // sforzo normale [kN] (+ trazione)
    M: 12, // momento [kNm]
    V: 15, // taglio [kN]
};

export function woodSLU(input) {
    const { timber, serviceClass, duration, b, h, N: N_kN, M: M_kNm, V: V_kN } = input;
    const errors = [];
    if (!(b > 0)) errors.push("La base b deve essere positiva.");
    if (!(h > 0)) errors.push("L'altezza h deve essere positiva.");
    if (errors.length > 0) return { ok: false, errors };

    const t = getTimber(timber);
    const km = kmodFn(serviceClass, duration);
    const gM = gammaMFn(t.type);
    const kh = khFn(t.type, h);

    // Resistenze di progetto
    const fmd = designStrength(t.fmk, km, gM) * kh;
    const ft0d = designStrength(t.ft0k, km, gM) * kh;
    const fc0d = designStrength(t.fc0k, km, gM);
    const fvd = designStrength(t.fvk, km, gM);

    // Sollecitazioni -> tensioni
    const A = b * h;
    const W = (b * h * h) / 6;
    const N = N_kN * 1000;
    const M = M_kNm * 1e6;
    const V = V_kN * 1000;

    const sigmaM = M / W;
    const sigmaT0 = Math.max(N, 0) / A;
    const sigmaC0 = Math.max(-N, 0) / A;
    const tau = (1.5 * Math.abs(V)) / (KCR * b * h);

    // Utilizzazioni
    const uBending = sigmaM / fmd;
    const uShear = tau / fvd;
    const uTension = sigmaT0 / ft0d;
    const uCompr = sigmaC0 / fc0d;

    // Combinate (EC5 6.2.3 / 6.2.4)
    let uCombined = 0;
    let combinedLabel = "";
    if (N > 0) {
        uCombined = sigmaT0 / ft0d + sigmaM / fmd;
        combinedLabel = "Tenso-flessione (σt,0/ft,0 + σm/fm)";
    } else if (N < 0) {
        uCombined = Math.pow(sigmaC0 / fc0d, 2) + sigmaM / fmd;
        combinedLabel = "Presso-flessione ((σc,0/fc,0)² + σm/fm)";
    } else {
        uCombined = uBending;
        combinedLabel = "Flessione semplice";
    }

    const checks = [
        { key: "bending", label: "Flessione", u: uBending },
        { key: "shear", label: "Taglio", u: uShear },
    ];
    if (N > 0) checks.push({ key: "tension", label: "Trazione //", u: uTension });
    if (N < 0) checks.push({ key: "compression", label: "Compressione //", u: uCompr });
    checks.push({ key: "combined", label: combinedLabel, u: uCombined });

    const governing = checks.reduce((a, c) => (c.u > a.u ? c : a), checks[0]);
    const verified = governing.u <= 1.0;

    return {
        ok: true,
        errors: [],
        type: t.type,
        km,
        gM,
        kh,
        fmd,
        ft0d,
        fc0d,
        fvd,
        A,
        W,
        sigmaM,
        sigmaT0,
        sigmaC0,
        tau,
        uBending,
        uShear,
        uTension,
        uCompr,
        uCombined,
        combinedLabel,
        checks,
        governing,
        verified,
    };
}
