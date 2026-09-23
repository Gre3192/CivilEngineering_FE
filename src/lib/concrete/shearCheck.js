// src/lib/concrete/shearCheck.js
//
// Verifica a taglio (SLU) di una trave rettangolare in c.a. secondo
// NTC2018 par. 4.1.2.3.5 / EC2, con il modello del traliccio ad
// inclinazione variabile delle bielle (1 <= cot(theta) <= 2.5).
//
//   V_Rsd = 0.9 d (Asw/s) f_yd (cot(a)+cot(t)) sin(a)   (armatura trasversale)
//   V_Rcd = 0.9 d bw a_c f'_cd (cot(a)+cot(t))/(1+cot^2(t))   (bielle compresse)
//   V_Rd  = min(V_Rsd, V_Rcd) >= V_Ed
//   f'_cd = 0.5 f_cd  (resistenza ridotta del cls d'anima fessurato)
//
// Lunghezze mm, forze N, tensioni MPa. Input taglio/aziale in kN.

export const STIRRUP_DIAMETERS = [6, 8, 10, 12, 14, 16];

export const DEFAULT_SHEAR_INPUT = {
    bw: 300, // larghezza anima [mm]
    h: 500, // altezza [mm]
    c: 40, // copriferro all'asse armatura tesa [mm]
    fck: 25,
    fyk: 450,
    alphaCc: 0.85,
    gammaC: 1.5,
    gammaS: 1.15,
    phiSw: 8, // diametro staffa [mm]
    nLegs: 2, // numero di bracci
    s: 200, // passo staffe [mm]
    alpha: 90, // inclinazione staffe [gradi]
    cotgTheta: 2.5, // inclinazione bielle (cot theta)
    Asl: 1206, // armatura longitudinale tesa (per V_Rd,c) [mm^2]
    VEd: 150, // taglio di progetto [kN]
    NEd: 0, // sforzo normale (compressione +) [kN]
};

const DEG = Math.PI / 180;

export function shearCheck(input) {
    const {
        bw,
        h,
        c,
        fck,
        fyk,
        alphaCc,
        gammaC,
        gammaS,
        phiSw,
        nLegs,
        s,
        alpha,
        cotgTheta,
        Asl,
        VEd: VEd_kN,
        NEd: NEd_kN,
    } = input;

    const errors = [];
    if (!(bw > 0)) errors.push("La larghezza b_w deve essere positiva.");
    if (!(h > 0)) errors.push("L'altezza h deve essere positiva.");
    if (!(s > 0)) errors.push("Il passo delle staffe s deve essere positivo.");
    if (!(fck > 0)) errors.push("Selezionare una classe di calcestruzzo.");

    const d = h - c;
    if (!(d > 0)) errors.push("Il copriferro c e' troppo grande rispetto ad h.");

    if (errors.length > 0) return { ok: false, errors };

    // Materiali
    const fcd = (alphaCc * fck) / gammaC;
    const fyd = fyk / gammaS;
    const fcd1 = 0.5 * fcd; // f'_cd resistenza ridotta del cls d'anima

    // Geometria del traliccio
    const z = 0.9 * d; // braccio delle forze interne
    const cotT = Math.min(Math.max(cotgTheta, 1), 2.5); // 1 <= cot(theta) <= 2.5
    const aRad = alpha * DEG;
    const cotA = alpha >= 90 ? 0 : Math.cos(aRad) / Math.sin(aRad);
    const sinA = Math.sin(aRad);

    // Coefficiente alpha_c per sforzo normale (sigma_cp)
    const Ac = bw * h;
    const sigmaCp = Math.min(Math.max((NEd_kN * 1000) / Ac, 0), 0.2 * fcd);
    let alphaC;
    if (sigmaCp <= 0) alphaC = 1;
    else if (sigmaCp < 0.25 * fcd) alphaC = 1 + sigmaCp / fcd;
    else if (sigmaCp <= 0.5 * fcd) alphaC = 1.25;
    else alphaC = 2.5 * (1 - sigmaCp / fcd);

    // Armatura trasversale
    const Asw = nLegs * ((Math.PI * phiSw * phiSw) / 4); // area a taglio [mm^2]
    const AswS = Asw / s; // per unita' di lunghezza

    // Resistenze del traliccio [N]
    const VRsd = z * AswS * fyd * (cotA + cotT) * sinA;
    const VRcd = ((z * bw * alphaC * fcd1 * (cotA + cotT)) / (1 + cotT * cotT));
    const VRd = Math.min(VRsd, VRcd);
    const governing = VRsd <= VRcd ? "staffe" : "bielle";

    // Taglio resistente senza armatura, V_Rd,c (NTC 4.1.2.3.5.1) [N]
    const k = Math.min(1 + Math.sqrt(200 / d), 2);
    const rhoL = Math.min(Asl / (bw * d), 0.02);
    const vmin = 0.035 * Math.pow(k, 1.5) * Math.sqrt(fck);
    const VRdc =
        Math.max(
            (0.18 / gammaC) * k * Math.pow(100 * rhoL * fck, 1 / 3) + 0.15 * sigmaCp,
            vmin + 0.15 * sigmaCp
        ) *
        bw *
        d;

    // Verifica
    const VEd = VEd_kN * 1000;
    const verified = VEd <= VRd;
    const utilization = VRd > 0 ? VEd / VRd : Infinity;
    const stirrupsRequired = VEd > VRdc;

    // Armatura minima e passo massimo (NTC/EC2)
    const rhoW = Asw / (s * bw * sinA);
    const rhoWmin = (0.08 * Math.sqrt(fck)) / fyk;
    const rhoWok = rhoW >= rhoWmin;
    const sMax = 0.75 * d * (1 + cotA); // passo massimo longitudinale
    const sMaxOk = s <= sMax;

    // Inclinazione ottimale (V_Rsd = V_Rcd), utile come suggerimento
    // cotT_opt: da bw*alphaC*fcd1/(1+cotT^2) = AswS*fyd  (staffe verticali)
    let cotTheta_opt = null;
    if (alpha >= 90 && AswS > 0) {
        const ratio = (bw * alphaC * fcd1) / (AswS * fyd);
        const val = ratio - 1;
        if (val > 0) cotTheta_opt = Math.min(Math.max(Math.sqrt(val), 1), 2.5);
    }

    return {
        ok: true,
        errors: [],
        d,
        z,
        fcd,
        fyd,
        fcd1,
        alphaC,
        sigmaCp,
        cotT,
        Asw,
        AswS,
        // resistenze [kN]
        VRsd: VRsd / 1000,
        VRcd: VRcd / 1000,
        VRd: VRd / 1000,
        VRdc: VRdc / 1000,
        VEd: VEd_kN,
        governing,
        verified,
        utilization,
        stirrupsRequired,
        // dettagli armatura
        rhoW,
        rhoWmin,
        rhoWok,
        sMax,
        sMaxOk,
        cotTheta_opt,
        alpha,
    };
}
