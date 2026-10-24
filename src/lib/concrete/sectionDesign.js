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
    MEd: 150, // momento di progetto [kNm]
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
 * Dimensiona la sezione a flessione secondo tre modalita':
 *  - "fixB": fissa B, progetta d e A_s (X = xi_d * d);
 *  - "fixH": fissa h, progetta B e A_s (X = xi_d * d);
 *  - "fixBH": fissa B e h, progetta A_s (x dall'equilibrio, eventuale doppia armatura).
 */
export function designSection(input) {
    const {
        mode = "fixB",
        B: Bin,
        h: hIn,
        MEd: MEd_kNm,
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
    if (mode !== "fixB" && !(hIn > c)) errors.push("L'altezza h deve essere maggiore del copriferro c.");
    if (!(MEd_kNm > 0)) errors.push("Il momento M_Ed deve essere positivo.");
    if (!(fck > 0)) errors.push("Selezionare una classe di calcestruzzo.");
    if (mode !== "fixBH" && !(beta >= 0 && beta < 0.95)) errors.push("beta = A's/A_s deve essere 0 ≤ β < 0,95.");
    if (errors.length > 0) return { ok: false, errors };

    const fcd = (alphaCc * fck) / gammaC;
    const fyd = fyk / gammaS;
    const epsYd = fyd / ES;
    const MEd = MEd_kNm * 1e6;
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

    let B, h, d, X, z, As, AsPrime, dReq, Breq, doubleReinf;
    let coeff1 = null, coeff2 = null, AsDesignRaw = null, M1 = null, M2 = null;
    let epsSc = null, sigmaSc = null, comprYield = true;
    const betaEff = mode === "fixBH" ? 0 : beta; // in fixBH l'armatura compr. deriva dall'equilibrio

    if (mode === "fixB") {
        B = Bin;
        const kGxi = kG * xi;
        const K = fs / (B * psi * xi * fcd);
        coeff2 = K * fs * (1 - beta) * ((1 - kGxi) + kGxi * beta);
        coeff1 = beta * fs * cPrime;
        AsDesignRaw = (coeff1 + Math.sqrt(coeff1 * coeff1 + 4 * coeff2 * MEd)) / (2 * coeff2);
        dReq = K * AsDesignRaw * (1 - beta);
        d = Math.ceil(dReq / step) * step;
        h = d + c;
        X = xi * d;
        z = d - kG * X;
        As = MEd / ((d - kG * X + beta * (kG * X - cPrime)) * fs);
        AsPrime = beta * As;
        epsSc = EPS_CU * (1 - cPrime / X);
        sigmaSc = sSteel(Math.max(epsSc, 0));
        comprYield = epsSc >= epsYd;
    } else if (mode === "fixH") {
        h = hIn;
        d = h - c;
        X = xi * d;
        z = d - kG * X;
        As = MEd / ((d - kG * X + beta * (kG * X - cPrime)) * fs);
        AsPrime = beta * As;
        // Larghezza richiesta dall'equilibrio alla traslazione
        Breq = (As * fs * (1 - beta)) / (psi * xi * d * fcd);
        B = Math.ceil(Breq / step) * step;
        epsSc = EPS_CU * (1 - cPrime / X);
        sigmaSc = sSteel(Math.max(epsSc, 0));
        comprYield = epsSc >= epsYd;
    } else {
        // fixBH: sezione assegnata, x dall'equilibrio
        B = Bin;
        h = hIn;
        d = h - c;
        // psi fcd B kG x^2 - psi fcd B d x + MEd = 0
        const A2 = psi * fcd * B * kG;
        const A1 = -psi * fcd * B * d;
        const disc = A1 * A1 - 4 * A2 * MEd;
        let xSingle = disc >= 0 ? (-A1 - Math.sqrt(disc)) / (2 * A2) : Infinity;
        if (disc >= 0 && xSingle <= xiLim * d) {
            doubleReinf = false;
            X = xSingle;
            z = d - kG * X;
            As = (psi * fcd * B * X) / fs;
            AsPrime = 0;
        } else {
            doubleReinf = true;
            X = xiLim * d;
            z = d - kG * X;
            M1 = psi * fcd * B * X * (d - kG * X);
            M2 = MEd - M1;
            epsSc = EPS_CU * (1 - cPrime / X);
            sigmaSc = sSteel(Math.max(epsSc, 0));
            comprYield = epsSc >= epsYd;
            AsPrime = sigmaSc > 0 ? M2 / (sigmaSc * (d - cPrime)) : 0;
            As = (psi * fcd * B * X) / fs + M2 / (fs * (d - cPrime));
        }
    }

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

    return {
        ok: true,
        errors: [],
        mode,
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
