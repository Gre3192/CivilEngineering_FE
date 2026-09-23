// src/lib/wood/woodTaperedBeam.js
//
// Verifica a flessione di una trave rastremata (bordo inclinato) secondo
// EC5 par. 6.4.2. Al bordo inclinato la resistenza a flessione e' ridotta dal
// fattore k_m,alpha, diverso per lembo teso o compresso rispetto alla fibratura.
//
//   sigma_m,alpha,d = 6 M / (b h^2)
//   lembo teso:      k_m,alpha = 1/sqrt(1 + (fm,d/(0.75 fv,d) tanα)^2 + (fm,d/ft,90,d tan²α)^2)
//   lembo compresso: k_m,alpha = 1/sqrt(1 + (fm,d/(1.5 fv,d) tanα)^2 + (fm,d/fc,90,d tan²α)^2)

import { getTimber, kmod as kmodFn, gammaM as gammaMFn, kh as khFn, designStrength } from "./woodMaterials.js";

export const DEFAULT_TAPERED_INPUT = {
    timber: "GL24h",
    serviceClass: "1",
    duration: "media",
    b: 140,
    h: 500, // altezza alla sezione considerata [mm]
    alpha: 8, // angolo di rastremazione [gradi]
    M: 40, // momento [kNm]
    edge: "tension", // "tension" o "compression" al bordo inclinato
};

export function woodTaperedBeam(input) {
    const { timber, serviceClass, duration, b, h, alpha, M: M_kNm, edge } = input;
    const errors = [];
    if (!(b > 0 && h > 0)) errors.push("Le dimensioni devono essere positive.");
    if (!(alpha >= 0)) errors.push("L'angolo deve essere ≥ 0.");
    if (errors.length > 0) return { ok: false, errors };

    const t = getTimber(timber);
    const km = kmodFn(serviceClass, duration);
    const gM = gammaMFn(t.type);
    const kh = khFn(t.type, h);

    const fmd = designStrength(t.fmk, km, gM) * kh;
    const fvd = designStrength(t.fvk, km, gM);
    const ft90d = designStrength(t.ft90k, km, gM);
    const fc90d = designStrength(t.fc90k, km, gM);

    const aRad = (alpha * Math.PI) / 180;
    const tan = Math.tan(aRad);
    const tan2 = tan * tan;

    let kmAlpha;
    if (edge === "compression") {
        kmAlpha = 1 / Math.sqrt(1 + Math.pow((fmd / (1.5 * fvd)) * tan, 2) + Math.pow((fmd / fc90d) * tan2, 2));
    } else {
        kmAlpha = 1 / Math.sqrt(1 + Math.pow((fmd / (0.75 * fvd)) * tan, 2) + Math.pow((fmd / ft90d) * tan2, 2));
    }

    const M = M_kNm * 1e6;
    const sigmaM = (6 * M) / (b * h * h);

    const resist = kmAlpha * fmd;
    const utilization = sigmaM / resist;
    const verified = utilization <= 1.0;

    return {
        ok: true,
        errors: [],
        type: t.type,
        km,
        gM,
        kh,
        fmd,
        fvd,
        ft90d,
        fc90d,
        tan,
        kmAlpha,
        sigmaM,
        resist,
        utilization,
        verified,
        edge,
    };
}
