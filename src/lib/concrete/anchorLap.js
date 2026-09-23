// src/lib/concrete/anchorLap.js
//
// Lunghezze di ancoraggio e di sovrapposizione delle barre in c.a. secondo
// EC2 (EN 1992-1-1) par. 8.4 e 8.7 / NTC2018 par. 4.1.6.1.4.
//
//   f_bd     = 2.25 * eta1 * eta2 * f_ctd           (tensione di aderenza)
//   l_b,rqd  = (phi/4) * (sigma_sd / f_bd)           (ancoraggio di base)
//   l_bd     = a1 a2 a3 a4 a5 * l_b,rqd >= l_b,min   (ancoraggio di progetto)
//   l_0      = a1 a2 a3 a5 a6 * l_b,rqd >= l_0,min   (sovrapposizione)
//
// con f_ctd = f_ctk,0.05 / gamma_c = 0.7 f_ctm / gamma_c.
// Vincolo: a2*a3*a5 >= 0.7.
//
// Lunghezze in mm, tensioni MPa.

export const LAP_PERCENTAGES = [
    { id: "<=25", label: "≤ 25%", a6: 1.0 },
    { id: "33", label: "33%", a6: 1.15 },
    { id: "50", label: "50%", a6: 1.4 },
    { id: ">50", label: "> 50%", a6: 1.5 },
];

export const DEFAULT_ANCHOR_INPUT = {
    phi: 16, // diametro barra [mm]
    fck: 25,
    fyk: 450,
    gammaS: 1.15,
    gammaC: 1.5,
    sigmaSd: 0, // 0 => usa f_yd (ancoraggio totale)
    bond: "good", // "good" (eta1=1) o "poor" (eta1=0.7)
    solic: "tension", // "tension" o "compression"
    shape: "straight", // "straight" o "bent" (piegata/uncinata, solo trazione)
    cd: 25, // ricoprimento efficace c_d [mm]
    alpha3: 1.0, // confinamento armatura trasversale
    alpha5: 1.0, // pressione trasversale
    welded: false, // armatura trasversale saldata (a4)
    lapPct: ">50", // percentuale di barre sovrapposte -> a6
};

function clamp(v, lo, hi) {
    return Math.min(Math.max(v, lo), hi);
}

export function anchorLap(input) {
    const {
        phi,
        fck,
        fyk,
        gammaS,
        gammaC,
        sigmaSd,
        bond,
        solic,
        shape,
        cd,
        alpha3,
        alpha5,
        welded,
        lapPct,
    } = input;

    const errors = [];
    if (!(phi > 0)) errors.push("Il diametro φ deve essere positivo.");
    if (!(fck > 0)) errors.push("Selezionare una classe di calcestruzzo.");
    if (!(fyk > 0)) errors.push("Definire l'acciaio fyk.");
    if (errors.length > 0) return { ok: false, errors };

    const fyd = fyk / gammaS;
    const sigma = sigmaSd > 0 ? sigmaSd : fyd;

    // Resistenze del calcestruzzo
    const fctm = 0.3 * Math.pow(fck, 2 / 3);
    const fctk = 0.7 * fctm; // f_ctk,0.05
    const fctd = fctk / gammaC;

    // Tensione di aderenza
    const eta1 = bond === "poor" ? 0.7 : 1.0; // condizioni di aderenza
    const eta2 = phi <= 32 ? 1.0 : (132 - phi) / 100; // diametro
    const fbd = 2.25 * eta1 * eta2 * fctd;

    // Ancoraggio di base
    const lbrqd = (phi / 4) * (sigma / fbd);

    const compression = solic === "compression";

    // Coefficienti alpha
    let a1, a2, a3, a4, a5;
    if (compression) {
        a1 = a2 = a3 = a4 = a5 = 1.0;
    } else {
        a1 = shape === "bent" ? 0.7 : 1.0;
        a2 =
            shape === "bent"
                ? clamp(1 - 0.15 * (cd - 3 * phi) / phi, 0.7, 1.0)
                : clamp(1 - 0.15 * (cd - phi) / phi, 0.7, 1.0);
        a3 = clamp(alpha3, 0.7, 1.0);
        a4 = welded ? 0.7 : 1.0;
        a5 = clamp(alpha5, 0.7, 1.0);
    }

    // Vincolo a2*a3*a5 >= 0.7
    const prod235 = Math.max(a2 * a3 * a5, 0.7);

    // Ancoraggio di progetto
    const lbdRaw = a1 * prod235 * a4 * lbrqd;
    const lbMin = compression
        ? Math.max(0.6 * lbrqd, 10 * phi, 100)
        : Math.max(0.3 * lbrqd, 10 * phi, 100);
    const lbd = Math.max(lbdRaw, lbMin);

    // Sovrapposizione
    const a6 =
        (LAP_PERCENTAGES.find((p) => p.id === lapPct) || { a6: 1.5 }).a6;
    const l0Raw = a1 * prod235 * a6 * lbrqd;
    const l0Min = Math.max(0.3 * a6 * lbrqd, 15 * phi, 200);
    const l0 = Math.max(l0Raw, l0Min);

    return {
        ok: true,
        errors: [],
        fyd,
        sigma,
        fctm,
        fctk,
        fctd,
        eta1,
        eta2,
        fbd,
        lbrqd,
        a1,
        a2,
        a3,
        a4,
        a5,
        a6,
        prod235,
        lbdRaw,
        lbMin,
        lbd,
        lbdPhi: lbd / phi,
        l0Raw,
        l0Min,
        l0,
        l0Phi: l0 / phi,
        compression,
        phi,
    };
}
