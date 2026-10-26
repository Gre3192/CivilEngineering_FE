// src/lib/concrete/sectionDesign.js
//
// Progetto (dimensionamento) a flessione semplice (SLU) di una sezione
// rettangolare in c.a., secondo gli appunti di Tecnica delle Costruzioni
// (NTC2018 / EC2). Metodo: si fissa la posizione dell'asse neutro a
// X = 0.2593 d (acciaio teso a eps_s = 10 permille, cls a eps_cu = 3.5 permille),
// e si ricavano contemporaneamente l'altezza utile d e l'armatura A_s.
//
// Ipotesi:
//  - diagramma delle tensioni del calcestruzzo rettangolare (stress-block,
//    profondita' 0.8 X, tensione fcd);
//  - acciaio elasto-plastico, Es = 200 GPa;
//  - armatura compressa definita dal rapporto beta = A's/A_s.
//
// Tutte le lunghezze in mm, le forze in N, i momenti in N*mm.

export const ES = 200000; // modulo elastico acciaio [MPa]

// Classi di resistenza del calcestruzzo (tutte <= C50/60 -> eps_cu = 3.5 permille)
export const CONCRETE_CLASSES = [
    { id: "C20/25", fck: 20 },
    { id: "C25/30", fck: 25 },
    { id: "C28/35", fck: 28 },
    { id: "C30/37", fck: 30 },
    { id: "C32/40", fck: 32 },
    { id: "C35/45", fck: 35 },
    { id: "C40/50", fck: 40 },
    { id: "C45/55", fck: 45 },
    { id: "C50/60", fck: 50 },
];

export const STEEL_GRADES = [
    { id: "B450C", fyk: 450 },
    { id: "B450A", fyk: 450 },
];

export const DEFAULT_INPUT = {
    mode: "fixB", // "fixB" (fissa base), "fixH" (fissa altezza), "fixBH" (entrambe)
    B: 300, // larghezza della sezione [mm]
    h: 500, // altezza della sezione [mm] (usata per fixH / fixBH)
    MEd: 150, // momento di progetto [kNm] (positivo: fibre inferiori tese)
    NEd: 0, // sforzo normale di progetto [kN] (positivo: compressione)
    beta: 0, // A's/A_s (0 = semplice armatura) - solo fixB/fixH
    c: 40, // copriferro all'asse armatura tesa [mm]
    cPrime: 40, // copriferro all'asse armatura compressa [mm]
    fck: 25, // [MPa]
    fyk: 450, // [MPa]
    alphaCc: 0.85,
    gammaC: 1.5,
    gammaS: 1.15,
    phi: 16, // diametro barre longitudinali [mm]
    phiStirrup: 8, // diametro staffa [mm]
    cLat: 30, // copriferro laterale netto [mm]
    dRound: 10, // arrotondamento della dimensione progettata [mm]
    concreteModel: "rectangular", // diagramma costitutivo del cls
    steelModel: "ep", // "ep" elasto-plastico | "hardening" incrudente
    ks: 1.15, // ft/fy (incrudimento)
};

export const DESIGN_MODES = [
    { id: "fixB", label: "Fissa base B (progetta h)" },
    { id: "fixH", label: "Fissa altezza h (progetta B)" },
    { id: "fixBH", label: "Fissa base e altezza (progetta A_s)" },
];

export const STEEL_MODELS = [
    { id: "ep", label: "Elasto-plastico" },
    { id: "hardening", label: "Elasto-plastico incrudente" },
];

export const CONCRETE_MODELS = [
    { id: "rectangular", label: "Rettangolo (stress-block)" },
    { id: "parabola", label: "Parabola-rettangolo" },
    { id: "bilinear", label: "Triangolo-rettangolo (bilineare)" },
];

/** Resistenza media a trazione del calcestruzzo (fck <= 50). */
export function fctm(fck) {
    return 0.3 * Math.pow(fck, 2 / 3);
}

function barArea(phi) {
    return (Math.PI * phi * phi) / 4;
}

const EPS_CU = 0.0035; // deformazione ultima cls
const EPS_C2 = 0.002; // ginocchio parabola-rettangolo
const EPS_C3 = 0.00175; // ginocchio triangolo-rettangolo
const EPS_S_DESIGN = 0.01; // deformazione di progetto dell'acciaio teso (10 permille)
const EPS_UD = 0.0675; // deformazione ultima di progetto dell'acciaio

// Coefficienti della risultante di compressione del cls alla fibra estrema
// (eps_c = eps_cu): psi = riempimento (C = psi*b*X*fcd), kG = posizione del
// baricentro dal lembo compresso (frazione di X).
export function getCompressionCoeffs(model) {
    if (model === "parabola") {
        const e = EPS_CU, e2 = EPS_C2;
        const psi = 1 - (1 / 3) * (e2 / e);
        const kG = (6 * e * e - 4 * e * e2 + e2 * e2) / (4 * e * (3 * e - e2));
        return { psi, kG };
    }
    if (model === "bilinear") {
        const a = EPS_C3 / EPS_CU; // frazione a strain costante
        const psi = 1 - a / 2;
        const kG = (Math.pow(1 - a, 2) / 2 + (a / 2) * ((1 - a) + a / 3)) / psi;
        return { psi, kG };
    }
    return { psi: 0.8, kG: 0.4 }; // rettangolo (stress-block)
}

/**
 * Dimensiona la sezione a PRESSOFLESSIONE (SLU) secondo tre modalita':
 *  - "fixB": fissa B, progetta d e A_s (X = xi_d * d, A's = beta*A_s);
 *  - "fixH": fissa h, progetta B e A_s (X = xi_d * d, A's = beta*A_s);
 *  - "fixBH": fissa B e h, progetta A_s (e A's se serve doppia armatura).
 *
 * Convenzioni:
 *  - N_Ed positivo in COMPRESSIONE;
 *  - M_Ed positivo se tende le fibre INFERIORI (flessione positiva);
 *    se M_Ed < 0 la sezione viene ribaltata (lato teso in alto) e si segnala
 *    con il flag `tensionTop`.
 *
 * Equilibrio (rispetto all'asse baricentrico, a h/2):
 *   (1) C_c + C's - T_s = N_Ed
 *   (2) C_c (h/2 - k_G x) + C's (h/2 - d'') + T_s (h/2 - d') = M_Ed
 * dove d'' = copriferro lato compresso, d' = copriferro lato teso.
 */
export function designSection(input) {
    const {
        mode = "fixB",
        B: Bin,
        h: hIn,
        MEd: MEd_kNm,
        NEd: NEd_kN = 0,
        beta,
        c,
        cPrime,
        fck,
        fyk,
        alphaCc,
        gammaC,
        gammaS,
        phi,
        phiStirrup,
        cLat,
        dRound,
        concreteModel = "rectangular",
        steelModel = "ep",
        ks = 1.15,
    } = input;

    const errors = [];
    if (mode !== "fixH" && !(Bin > 0)) errors.push("La larghezza B deve essere positiva.");
    if (mode !== "fixB" && !(hIn > Math.max(c, cPrime))) errors.push("L'altezza h deve essere maggiore dei copriferri.");
    if (!(Math.abs(MEd_kNm) > 0)) errors.push("Il momento M_Ed deve essere diverso da zero.");
    if (!(fck > 0)) errors.push("Selezionare una classe di calcestruzzo.");
    if (mode !== "fixBH" && !(beta >= 0 && beta < 0.95)) errors.push("beta = A's/A_s deve essere 0 ≤ β < 0,95.");
    if (errors.length > 0) return { ok: false, errors };

    const fcd = (alphaCc * fck) / gammaC;
    const fyd = fyk / gammaS;
    const epsYd = fyd / ES;
    const Ned = NEd_kN * 1000; // N (compressione +)
    const step = dRound > 0 ? dRound : 1;

    // Tensione dell'acciaio in funzione della deformazione (modello scelto)
    const sSteel = (eps) => {
        const e = Math.abs(eps);
        if (e <= epsYd) return ES * e;
        if (steelModel === "hardening")
            return Math.min(fyd * (1 + ((e - epsYd) / (EPS_UD - epsYd)) * (ks - 1)), ks * fyd);
        return fyd;
    };
    // Tensione di progetto dell'acciaio teso (a eps_s = 10 permille)
    const fs = sSteel(EPS_S_DESIGN);

    const xi = EPS_CU / (EPS_CU + EPS_S_DESIGN); // = 0.2593 (progetto, fixB/fixH)
    const xiLim = EPS_CU / (EPS_CU + epsYd); // limite di snervamento (fixBH)
    const { psi, kG } = getCompressionCoeffs(concreteModel);

    // --- Segno del momento: se negativo si progetta nel frame ribaltato ---
    const tensionTop = MEd_kNm < 0;
    const Mabs = Math.abs(MEd_kNm) * 1e6; // N·mm (frame di progetto: teso in basso)
    const cT = tensionTop ? cPrime : c;   // copriferro lato teso (dal lembo teso)
    const cC = tensionTop ? c : cPrime;   // copriferro lato compresso (dal lembo compr.)

    // Tensione acciaio compresso in funzione di x (a cC dal lembo compresso)
    const sigmaScOf = (x) => {
        const e = EPS_CU * (1 - cC / x);
        return e > 0 ? sSteel(e) : 0;
    };

    // Solutore dell'equilibrio a geometria fissata (B, h, d): determina x e le
    // armature A_s, A's soddisfacendo ESATTAMENTE le due equazioni di equilibrio.
    // Semplice armatura se x <= x_lim; altrimenti doppia (x = x_lim).
    const solveAtGeom = (Bg, hg, dg) => {
        const aT = hg / 2 - cT;
        // tentativo a semplice armatura (A's = 0): quadratica in x
        //   -psi fcd B kG x^2 + psi fcd B d x - (N_Ed*aT + M) = 0
        const A2 = -psi * fcd * Bg * kG;
        const A1 = psi * fcd * Bg * dg;
        const A0 = -(Ned * aT + Mabs);
        const disc = A1 * A1 - 4 * A2 * A0;
        let xS = Infinity;
        if (disc >= 0) {
            const r1 = (-A1 + Math.sqrt(disc)) / (2 * A2);
            const r2 = (-A1 - Math.sqrt(disc)) / (2 * A2);
            const cands = [r1, r2].filter((v) => v > 1e-6 && v < 3 * dg).sort((a, b) => a - b);
            if (cands.length) xS = cands[0];
        }
        if (Number.isFinite(xS) && xS <= xiLim * dg) {
            const Xg = xS, Cc = psi * fcd * Bg * Xg, e = EPS_CU * (1 - cC / Xg);
            return { X: Xg, As: Math.max((Cc - Ned) / fs, 0), AsPrime: 0, doubleReinf: false, sigmaSc: sigmaScOf(Xg), epsSc: e, comprYield: e >= epsYd, M1: null, M2: null };
        }
        const Xg = xiLim * dg, Cc = psi * fcd * Bg * Xg;
        const aC = hg / 2 - kG * Xg, aSp = hg / 2 - cC, e = EPS_CU * (1 - cC / Xg);
        const sc = sigmaScOf(Xg);
        const Cs = (Mabs - Cc * aC - (Cc - Ned) * aT) / (aSp + aT);
        const AsP = sc > 0 ? Math.max(Cs, 0) / sc : 0;
        return { X: Xg, As: Math.max((Cc + AsP * sc - Ned) / fs, 0), AsPrime: AsP, doubleReinf: true, sigmaSc: sc, epsSc: e, comprYield: e >= epsYd, M1: Cc * aC, M2: Mabs - Cc * aC };
    };

    let B, h, d, X, z, As, AsPrime, dReq = null, Breq = null, doubleReinf = false;
    let coeff1 = null, coeff2 = null, AsDesignRaw = null, M1 = null, M2 = null;
    let epsSc = null, sigmaSc = null, comprYield = true;
    const betaEff = mode === "fixBH" ? 0 : beta;

    if (mode === "fixBH") {
        // sezione assegnata: x e armature dall'equilibrio (A's solo se necessaria)
        B = Bin; h = hIn; d = h - cT;
        const sol = solveAtGeom(B, h, d);
        X = sol.X; As = sol.As; AsPrime = sol.AsPrime; doubleReinf = sol.doubleReinf;
        sigmaSc = sol.sigmaSc; epsSc = sol.epsSc; comprYield = sol.comprYield;
        M1 = sol.M1; M2 = sol.M2;
    } else if (mode === "fixH") {
        // fissa h, progetta B; il rapporto beta impone A's = beta*A_s (x = xi*d)
        h = hIn; d = h - cT; X = xi * d;
        sigmaSc = sigmaScOf(X);
        epsSc = EPS_CU * (1 - cC / X);
        comprYield = epsSc >= epsYd;
        const aC = h / 2 - kG * X, aSp = h / 2 - cC, aT = h / 2 - cT;
        const k1 = beta * sigmaSc - fs, k2 = beta * sigmaSc * aSp + fs * aT;
        As = Math.max((Mabs - aC * Ned) / (k2 - aC * k1), 0);
        AsPrime = Math.max(beta * As, 0);
        const P = psi * X * fcd;
        Breq = (Ned - k1 * As) / P;
        B = Math.max(Breq, 1);
        doubleReinf = AsPrime > 0;
    } else {
        // fixB: fissa B, progetta d; beta impone A's = beta*A_s (bisezione su d, x = xi*d)
        B = Bin;
        const residual = (dT) => {
            const x = xi * dT, hT = dT + cT;
            const Cc = psi * fcd * B * x, sc = sigmaScOf(x);
            const aC = hT / 2 - kG * x, aSp = hT / 2 - cC, aT = hT / 2 - cT;
            const k1 = beta * sc - fs;
            const As_ = (Ned - Cc) / k1;
            return Cc * aC + beta * As_ * sc * aSp + As_ * fs * aT - Mabs;
        };
        let lo = Math.max(cT, cC) + 2, hi = 6000;
        if (residual(lo) * residual(hi) > 0) {
            let prev = lo, fprev = residual(lo);
            for (let dd = lo + 4; dd <= hi; dd += 4) {
                const f = residual(dd);
                if (fprev * f <= 0) { lo = prev; hi = dd; break; }
                prev = dd; fprev = f;
            }
        }
        for (let i = 0; i < 100; i++) {
            const mid = (lo + hi) / 2;
            if (residual(lo) * residual(mid) <= 0) hi = mid; else lo = mid;
        }
        dReq = (lo + hi) / 2;
        d = dReq; h = d + cT; X = xi * d;
        sigmaSc = sigmaScOf(X);
        epsSc = EPS_CU * (1 - cC / X);
        comprYield = epsSc >= epsYd;
        const Cc = psi * fcd * B * X, k1 = beta * sigmaSc - fs;
        As = Math.max((Ned - Cc) / k1, 0);
        AsPrime = Math.max(beta * As, 0);
        doubleReinf = AsPrime > 0;
    }

    z = d - kG * X;

    // --- Armature minime e massime (NTC2018 4.1.6.1.1) ---
    const AsMin = Math.max(0.26 * (fctm(fck) / fyk) * B * d, 0.0013 * B * d);
    const AsMax = 0.04 * B * h;
    const AsAdopt = Math.max(As, AsMin);

    // --- Scelta barre ---
    const areaPhi = barArea(phi);
    const nBars = Math.max(2, Math.ceil(AsAdopt / areaPhi));
    const AsProvided = nBars * areaPhi;
    let nBarsPrime = 0;
    let AsPrimeProvided = 0;
    if (AsPrime > 0) {
        nBarsPrime = Math.max(2, Math.ceil(AsPrime / areaPhi));
        AsPrimeProvided = nBarsPrime * areaPhi;
    }

    const gap = Math.max(phi, 20);
    const reqWidth = nBars * phi + (nBars - 1) * gap + 2 * phiStirrup + 2 * cLat;
    const widthOk = reqWidth <= B;

    // --- Risultanti delle forze e bracci rispetto all'asse baricentrico (h/2) ---
    const Cc = psi * fcd * B * X;          // compressione cls [N]
    const Cs = AsPrime * (sigmaSc || 0);   // compressione acciaio [N]
    const Ts = As * fs;                    // trazione acciaio [N]
    const aCc = h / 2 - kG * X;            // braccio di C_c
    const aCs = h / 2 - cC;                // braccio di C's
    const aTs = h / 2 - cT;                // braccio di T_s
    const eqN = Cc + Cs - Ts;              // dovrebbe = N_Ed
    const eqM = Cc * aCc + Cs * aCs + Ts * aTs; // dovrebbe = M (frame di progetto)

    return {
        ok: true,
        errors: [],
        mode,
        NEd: Ned,
        MEd: Mabs,
        MEdSigned: tensionTop ? -Mabs : Mabs,
        tensionTop,
        cT,
        cC,
        Cc,
        Cs,
        Ts,
        aCc,
        aCs,
        aTs,
        eqN,
        eqM,
        fcd,
        fyd,
        fs,
        steelModel,
        ks,
        epsYd,
        fctm: fctm(fck),
        xi,
        xiLim,
        psi,
        kG,
        concreteModel,
        coeff1,
        coeff2,
        AsDesignRaw,
        M1,
        M2,
        gap,
        dReq,
        Breq,
        B,
        d,
        h,
        X,
        z,
        beta: betaEff,
        doubleReinf: !!doubleReinf,
        As,
        AsPrime,
        AsAdopt,
        AsMin,
        AsMax,
        belowMin: As < AsMin,
        exceedsMax: AsAdopt > AsMax,
        epsSc,
        sigmaSc,
        comprYield,
        phi,
        areaPhi,
        nBars,
        AsProvided,
        nBarsPrime,
        AsPrimeProvided,
        reqWidth,
        widthOk,
        utilization: AsProvided > 0 ? AsAdopt / AsProvided : 0,
    };
}
