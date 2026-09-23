// src/lib/concrete/crackCheck.js
//
// Verifica dell'ampiezza delle fessure (SLE) di una sezione rettangolare in
// c.a. inflessa, secondo NTC2018 par. 4.1.2.2.4 / EC2 par. 7.3.4.
//
//   w_k = s_r,max * (eps_sm - eps_cm)
//   eps_sm - eps_cm = [ sigma_s - k_t (f_ct,eff/rho_eff)(1 + alpha_e rho_eff) ] / Es
//                     >= 0.6 sigma_s / Es
//   s_r,max = k3 c + k1 k2 k4 phi / rho_eff   (se interasse barre <= 5(c+phi/2))
//   s_r,max = 1.3 (h - x)                     (altrimenti)
//
// La tensione dell'acciaio sigma_s deriva da un'analisi in stadio II
// (sezione fessurata, comportamento elastico-lineare).
//
// Lunghezze mm, tensioni MPa, momenti N*mm (input M in kNm), ampiezze mm.

const ES = 200000; // modulo elastico acciaio [MPa]

// Coefficienti (valori raccomandati EC2 per barre ad aderenza migliorata)
const K1 = 0.8; // aderenza (barre ad aderenza migliorata)
const K2 = 0.5; // flessione
const K3 = 3.4;
const K4 = 0.425;

// Limiti di ampiezza [mm] (NTC2018 Tab. 4.1.IV)
export const CRACK_LIMITS = [
    { id: "0.2", w: 0.2, label: "w1 = 0,2 mm (ambiente aggressivo)" },
    { id: "0.3", w: 0.3, label: "w2 = 0,3 mm (ordinario)" },
    { id: "0.4", w: 0.4, label: "w3 = 0,4 mm (poco aggressivo)" },
];

export const DEFAULT_CRACK_INPUT = {
    b: 300,
    h: 500,
    c: 40, // copriferro all'asse armatura tesa [mm]
    cPrime: 40,
    As: 1206, // armatura tesa [mm^2] (~6 phi 16)
    AsPrime: 0,
    phi: 16, // diametro barre tese [mm]
    MSer: 90, // momento in combinazione SLE [kNm]
    fck: 25,
    longTerm: true, // carichi di lunga durata -> k_t = 0.4
    wLim: 0.3, // limite di ampiezza [mm]
};

/** Resistenza media a trazione (fck <= 50). */
function fctm(fck) {
    return 0.3 * Math.pow(fck, 2 / 3);
}

/** Modulo elastico secante del calcestruzzo E_cm [MPa]. */
function Ecm(fck) {
    const fcm = fck + 8;
    return 22000 * Math.pow(fcm / 10, 0.3);
}

export function crackCheck(input) {
    const {
        b,
        h,
        c,
        cPrime,
        As,
        AsPrime,
        phi,
        MSer: MSer_kNm,
        fck,
        longTerm,
        wLim,
    } = input;

    const errors = [];
    if (!(b > 0)) errors.push("La base b deve essere positiva.");
    if (!(h > 0)) errors.push("L'altezza h deve essere positiva.");
    if (!(As > 0)) errors.push("L'armatura tesa As deve essere positiva.");
    if (!(fck > 0)) errors.push("Selezionare una classe di calcestruzzo.");

    const d = h - c;
    const dPrime = cPrime;
    if (!(d > 0)) errors.push("Il copriferro c e' troppo grande rispetto ad h.");

    if (errors.length > 0) return { ok: false, errors };

    const MSer = MSer_kNm * 1e6; // N*mm
    const ecm = Ecm(fck);
    const alphaE = ES / ecm;
    const fct = fctm(fck);
    const kt = longTerm ? 0.4 : 0.6;

    // --- Stadio II: posizione asse neutro (flessione) ---
    // (b/2) x^2 + alpha_e (As+As') x - alpha_e (As d + As' d') = 0
    const aa = b / 2;
    const bb = alphaE * (As + AsPrime);
    const cc = -alphaE * (As * d + AsPrime * dPrime);
    const x = (-bb + Math.sqrt(bb * bb - 4 * aa * cc)) / (2 * aa);

    // Momento d'inerzia fessurato
    const III =
        (b * Math.pow(x, 3)) / 3 +
        alphaE * As * Math.pow(d - x, 2) +
        alphaE * AsPrime * Math.pow(x - dPrime, 2);

    // Tensione nell'acciaio teso
    const sigmaS = (alphaE * MSer * (d - x)) / III;

    // --- Area efficace di calcestruzzo teso ---
    const hcEff = Math.min(2.5 * (h - d), (h - x) / 3, h / 2);
    const AcEff = b * hcEff;
    const rhoEff = As / AcEff;

    // --- Differenza di deformazione media ---
    const term = sigmaS - kt * (fct / rhoEff) * (1 + alphaE * rhoEff);
    const epsDiff = Math.max(term / ES, (0.6 * sigmaS) / ES);

    // --- Distanza massima tra le fessure ---
    // interasse barre (stima) e condizione 5(c+phi/2) = 5*(c all'asse)
    const nBars = Math.max(1, Math.round(As / ((Math.PI * phi * phi) / 4)));
    const barSpacing = nBars > 1 ? (b - 2 * c) / (nBars - 1) : Infinity;
    const cSurface = Math.max(c - phi / 2, 0); // copriferro alla superficie della barra
    const spacingLimit = 5 * (cSurface + phi / 2); // = 5 c

    let srMax;
    let srMode;
    if (barSpacing <= spacingLimit) {
        srMax = K3 * cSurface + (K1 * K2 * K4 * phi) / rhoEff;
        srMode = "barre ravvicinate";
    } else {
        srMax = 1.3 * (h - x);
        srMode = "barre distanti";
    }

    // --- Ampiezza di fessura ---
    const wk = srMax * epsDiff;
    const verified = wk <= wLim;
    const utilization = wLim > 0 ? wk / wLim : Infinity;

    return {
        ok: true,
        errors: [],
        d,
        dPrime,
        ecm,
        alphaE,
        fctm: fct,
        kt,
        x,
        III,
        sigmaS,
        hcEff,
        AcEff,
        rhoEff,
        epsDiff,
        srMax,
        srMode,
        nBars,
        barSpacing,
        spacingLimit,
        cSurface,
        wk,
        wLim,
        verified,
        utilization,
        MSer: MSer_kNm,
        b,
        h,
        phi,
    };
}
