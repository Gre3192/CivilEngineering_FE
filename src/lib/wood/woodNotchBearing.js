// src/lib/wood/woodNotchBearing.js
//
// Verifica di travi con intaglio all'appoggio (EC5 par. 6.5.2) e della
// compressione ortogonale alla fibratura in zona di appoggio (EC5 par. 6.1.5).
//
// Intaglio (lato appoggio):
//   tau_d = 1.5 V / (b hef) <= kv fv,d
//   kv = min{1 ; kn(1+1.1 i^1.5/sqrt(h)) / [ sqrt(h)(sqrt(a(1-a)) + 0.8 (x/h) sqrt(1/a - a^2)) ]}
//   a = hef/h
// Appoggio:
//   sigma_c,90,d = Fc90,d/(b l) <= kc,90 fc,90,d

import { getTimber, kmod as kmodFn, gammaM as gammaMFn, designStrength } from "./woodMaterials.js";

export const DEFAULT_NOTCH_INPUT = {
    timber: "C24",
    serviceClass: "1",
    duration: "media",
    b: 120,
    h: 240,
    V: 15, // taglio all'appoggio [kN]
    notchSide: "bottom", // "bottom" (lato appoggio) o "top"
    hef: 180, // altezza efficace ridotta [mm]
    x: 60, // distanza reazione-spigolo intaglio [mm]
    i: 0, // inclinazione intaglio [mm] (0 = intaglio netto)
    // appoggio
    Fc90: 15, // forza di appoggio [kN]
    lBear: 100, // lunghezza di appoggio [mm]
    kc90: 1.25, // coeff. compressione ortogonale
};

export function woodNotchBearing(input) {
    const { timber, serviceClass, duration, b, h, V: V_kN, notchSide, hef, x, i, Fc90: Fc90_kN, lBear, kc90 } = input;
    const errors = [];
    if (!(b > 0 && h > 0)) errors.push("Le dimensioni devono essere positive.");
    if (!(hef > 0 && hef <= h)) errors.push("hef deve essere tra 0 e h.");
    if (errors.length > 0) return { ok: false, errors };

    const t = getTimber(timber);
    const km = kmodFn(serviceClass, duration);
    const gM = gammaMFn(t.type);
    const fvd = designStrength(t.fvk, km, gM);
    const fc90d = designStrength(t.fc90k, km, gM);

    // --- Intaglio ---
    const kn = t.type === "glulam" ? 6.5 : 5.0;
    const alpha = hef / h;
    let kv;
    if (notchSide === "top") {
        kv = 1.0; // intaglio sul lato opposto all'appoggio
    } else {
        const denom =
            Math.sqrt(h) *
            (Math.sqrt(alpha * (1 - alpha)) + 0.8 * (x / h) * Math.sqrt(1 / alpha - alpha * alpha));
        const kvCalc = (kn * (1 + (1.1 * Math.pow(i, 1.5)) / Math.sqrt(h))) / denom;
        kv = Math.min(1, kvCalc);
    }
    const V = V_kN * 1000;
    const tau = (1.5 * V) / (b * hef);
    const tauRes = kv * fvd;
    const uNotch = tau / tauRes;

    // --- Appoggio (compressione ortogonale) ---
    const Fc90 = Fc90_kN * 1000;
    const sigmaC90 = Fc90 / (b * lBear);
    const c90Res = kc90 * fc90d;
    const uBearing = sigmaC90 / c90Res;

    const verified = uNotch <= 1 && uBearing <= 1;

    return {
        ok: true,
        errors: [],
        type: t.type,
        km,
        gM,
        fvd,
        fc90d,
        kn,
        alpha,
        kv,
        tau,
        tauRes,
        uNotch,
        sigmaC90,
        c90Res,
        uBearing,
        verified,
    };
}
