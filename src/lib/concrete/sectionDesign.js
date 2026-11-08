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
    dInf: 40, // d': copriferro verticale inferiore, all'asse delle barre inferiori [mm]
    dSup: 40, // d'': copriferro verticale superiore, all'asse delle barre superiori [mm]
    fck: 25, // [MPa]
    fyk: 450, // [MPa]
    steelGrade: "B450C", // classe dell'acciaio (B450C / B450A)
    alphaCc: 0.85,
    gammaC: 1.5,
    gammaS: 1.15,
    phi: 16, // diametro barre longitudinali [mm]
    phiStirrup: 8, // diametro staffa [mm]
    cLeft: 30, // c: copriferro orizzontale sinistro, netto alla staffa [mm]
    cRight: 30, // c': copriferro orizzontale destro, netto alla staffa [mm]
    dRound: 10, // arrotondamento della dimensione progettata [mm]
    concreteModel: "rectangular", // diagramma costitutivo del cls
    steelModel: "ep", // "ep" elasto-plastico | "hardening" incrudente
    ks: 1.15, // ft/fy (incrudimento)
    multiLayer: false, // consente di disporre le barre su più file se non entrano in una
    maxLayersBot: 2, // numero massimo di file inferiori
    maxLayersTop: 2, // numero massimo di file superiori
    hangerBars: true, // 2 barre costruttive (reggistaffa) sul lato compresso se A's non serve
    phiHanger: 12, // diametro delle barre costruttive [mm]
    hangerInCalc: false, // considera le barre superiori nel calcolo (A's assegnata)
    sectionType: "rect", // "rect" rettangolare | "T" a T (ala sul lembo superiore)
    bw: 300, // larghezza dell'anima della sezione a T [mm]
    hf: 120, // spessore s dell'ala della sezione a T [mm]
    flangeMethod: "simplified", // ala compressa: "simplified" (ali a f_cd) | "exact" (integrazione σ-ε)
};

export const DESIGN_MODES = [
    { id: "fixB", label: "Fissa base B (progetta h)" },
    { id: "fixH", label: "Fissa altezza h (progetta B)" },
    { id: "fixBH", label: "Fissa base e altezza (progetta Aₛ)" },
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
 *   (2) C_c (h/2 - k_G x) + C's (h/2 - d_C) + T_s (h/2 - d_T) = M_Ed
 * dove d_T = copriferro verticale lato teso (d' se M_Ed > 0, d'' se M_Ed < 0)
 * e d_C = copriferro verticale lato compresso.
 * Copriferri: d' / d'' verticali inferiore / superiore (all'asse delle barre),
 * c / c' orizzontali sinistro / destro (netti alla staffa).
 *
 * Con "multiLayer" le barre che non entrano in una fila (interferro minimo
 * max(φ, 20 mm)) vanno su più file, fino al massimo indicato: il baricentro
 * delle barre si sposta verso l'interno di δ e il copriferro di calcolo diventa
 * d' + δ (d'' + δ). Poiché δ dipende dal numero di barre, che dipende a sua
 * volta dal calcolo, si itera fino a che la disposizione non cambia più.
 */
export function designSection(input) {
    const multi = !!input.multiLayer;
    const maxRows = (v) => (multi ? Math.max(1, Math.trunc(Number(v)) || 1) : 1);
    let addInf = 0, addSup = 0, r, layInf, laySup;
    for (let it = 0; it < 12; it++) {
        r = designSectionCore({ ...input, dInf: input.dInf + addInf, dSup: input.dSup + addSup });
        if (!r.ok) return r;
        const common = { phi: r.phi, B: r.isT ? r.bw : r.B, cLeft: r.cLeft, cRight: r.cRight, phiStirrup: input.phiStirrup };
        layInf = barRows({ ...common, ...(r.tensionTop ? { phi: r.phiPrime } : {}), n: r.tensionTop ? r.nBarsPrime : r.nBars, maxRows: maxRows(input.maxLayersBot) });
        laySup = barRows({ ...common, ...(r.tensionTop ? {} : { phi: r.phiPrime }), n: r.tensionTop ? r.nBars : r.nBarsPrime, maxRows: maxRows(input.maxLayersTop) });
        if (Math.abs(layInf.delta - addInf) < 1e-9 && Math.abs(laySup.delta - addSup) < 1e-9) break;
        addInf = layInf.delta;
        addSup = laySup.delta;
    }
    const layT = r.tensionTop ? laySup : layInf;
    const layC = r.tensionTop ? layInf : laySup;
    return {
        ...r,
        layInf, laySup, layT, layC,
        dInfNom: input.dInf, dSupNom: input.dSup,         // copriferri nominali (alla fila esterna)
        dTNom: r.tensionTop ? input.dSup : input.dInf,     // lato teso
        dCNom: r.tensionTop ? input.dInf : input.dSup,     // lato compresso
        reqWidth: layT.width,                              // ingombro della fila più piena
        widthOk: layT.width <= (r.isT ? r.bw : r.B), // nella T le barre stanno nell'anima
    };
}

/**
 * Disposizione di n barre di diametro phi su una o più file (al massimo maxRows):
 * si riempie la fila esterna con il massimo numero di barre che entrano con
 * l'interferro minimo max(φ, 20 mm), poi le successive; l'ultima fila prende le
 * barre rimanenti (se eccedono, l'ingombro non è verificato). Le file interne
 * distano (φ + max(φ, 20 mm)) tra gli assi. delta = spostamento del baricentro
 * delle barre verso l'interno rispetto all'asse della fila esterna [mm].
 */
export function barRows({ n, phi, B, cLeft, cRight, phiStirrup, maxRows = 1 }) {
    const gapH = Math.max(phi, 20);                         // interferro orizzontale minimo
    const sV = phi + Math.max(phi, 20);                     // passo verticale tra gli assi delle file
    const span = B - cLeft - cRight - 2 * phiStirrup - phi; // distanza tra gli assi delle barre d'angolo
    const perRowMax = Math.max(1, Math.floor(span / (phi + gapH) + 1e-9) + 1);
    const rows = [];
    if (n > 0) {
        const k = Math.min(Math.max(1, Math.trunc(maxRows) || 1), Math.ceil(n / perRowMax));
        let left = n;
        for (let i = 0; i < k; i++) {
            const take = i === k - 1 ? left : Math.min(perRowMax, left);
            rows.push(take);
            left -= take;
        }
        // niente file interne con una sola barra: se possibile se ne sposta una
        for (let i = rows.length - 1; i > 0; i--) if (rows[i] === 1 && rows[i - 1] > 2) { rows[i - 1]--; rows[i]++; }
    }
    const delta = n > 0 ? rows.reduce((sum, ni, i) => sum + ni * i * sV, 0) / n : 0;
    const nMax = rows.length ? Math.max(...rows) : 0;
    const width = nMax > 0 ? nMax * phi + (nMax - 1) * gapH + 2 * phiStirrup + cLeft + cRight : 0;
    return { rows, perRowMax, sV, gapH, delta, nMax, width, fits: rows.every((ni) => ni <= perRowMax) };
}

function designSectionCore(input) {
    const {
        mode = "fixB",
        B: Bin,
        h: hIn,
        MEd: MEd_kNm,
        NEd: NEd_kN = 0,
        beta,
        dInf,
        dSup,
        cLeft = 30,
        cRight = 30,
        fck,
        fyk,
        alphaCc,
        gammaC,
        gammaS,
        phi,
        phiStirrup,
        dRound,
        concreteModel = "rectangular",
        steelModel = "ep",
        ks = 1.15,
        AsPrimeGiven = 0,
        nBarsPrimeGiven = 0,
        phiPrimeGiven = 0,
        sectionType = "rect",
        bw: bwIn = 300,
        hf: hfIn = 120,
        flangeMethod = "simplified",
    } = input;
    const isT = sectionType === "T";
    const tBw = Number(bwIn) || 0, tS = Number(hfIn) || 0; // anima e spessore dell'ala
    // armatura compressa ASSEGNATA (barre superiori scelte dall'utente e
    // considerate nel calcolo): C's = A's f_yd noto, β non si usa
    const given = AsPrimeGiven > 0;

    const errors = [];
    if (mode !== "fixH" && !(Bin > 0)) errors.push("La larghezza B deve essere positiva.");
    if (mode !== "fixB" && !(hIn > Math.max(dInf, dSup))) errors.push("L'altezza h deve essere maggiore dei copriferri.");
    if (!(Math.abs(MEd_kNm) > 0)) errors.push("Il momento M_Ed deve essere diverso da zero.");
    if (!(fck > 0)) errors.push("Selezionare una classe di calcestruzzo.");
    if (!given && mode !== "fixBH" && !(beta >= 0 && beta < 0.95)) errors.push("beta = A's/A_s deve essere 0 ≤ β < 0,95.");
    if (isT) {
        if (!(tBw > 0)) errors.push("La larghezza dell'anima b_w deve essere positiva.");
        if (!(tS > 0)) errors.push("Lo spessore dell'ala s deve essere positivo.");
        if (mode !== "fixH" && Bin > 0 && tBw > Bin) errors.push("La larghezza dell'ala B deve essere maggiore o uguale a b_w.");
        if (mode !== "fixB" && hIn > 0 && !(hIn > tS)) errors.push("L'altezza h deve essere maggiore dello spessore dell'ala s.");
    }
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
    const cT = tensionTop ? dSup : dInf;  // copriferro verticale lato teso (dal lembo teso)
    const cC = tensionTop ? dInf : dSup;  // copriferro verticale lato compresso (dal lembo compr.)

    // Ipotesi di progetto (procedimento "SLU - Tensioni normali"):
    //  - stato deformativo al limite tra campo 2 e campo 3: x = xi*d = 0,2593 d;
    //  - armatura compressa snervata: sigma's = f_yd (da verificare a posteriori).
    const sigmaScDes = fyd;
    const epsScOf = (x) => EPS_CU * (1 - cC / x);

    // Semplice armatura a sezione assegnata (A's = 0): x libero dall'equilibrio.
    //   -psi fcd B kG x^2 + psi fcd B d x - (N_Ed*aT + M) = 0
    const simpleAtGeom = (Bg, hg, dg) => {
        const aT = hg / 2 - cT;
        const A2 = -psi * fcd * Bg * kG;
        const A1 = psi * fcd * Bg * dg;
        const A0 = -(Ned * aT + Mabs);
        const disc = A1 * A1 - 4 * A2 * A0;
        let xS = NaN;
        if (disc >= 0) {
            const r1 = (-A1 + Math.sqrt(disc)) / (2 * A2);
            const r2 = (-A1 - Math.sqrt(disc)) / (2 * A2);
            const cands = [r1, r2].filter((v) => v > 1e-6 && v < 3 * dg).sort((a, b) => a - b);
            if (cands.length) xS = cands[0];
        }
        const Cc = psi * fcd * Bg * xS;
        return { X: xS, As: Math.max((Cc - Ned) / fs, 0) };
    };

    // --- Sezione a T (ala sul lembo superiore) ---------------------------------
    // Profondità y misurate dal lembo COMPRESSO: con M_Ed > 0 è quello superiore
    // (ala compressa), con M_Ed < 0 quello inferiore (anima compressa, ala tesa).
    // Tensione nel cls alla profondità y (ε = ε_cu (x − y)/x) secondo il legame:
    const sigmaC = (y, x) => {
        const e = (EPS_CU * (x - y)) / x;
        if (e <= 0) return 0;
        if (concreteModel === "rectangular") return y <= 0.8 * x ? fcd : 0; // stress-block λ = 0,8
        if (concreteModel === "bilinear") return e >= EPS_C3 ? fcd : (fcd * e) / EPS_C3;
        return e >= EPS_C2 ? fcd : fcd * (1 - Math.pow(1 - e / EPS_C2, 2));
    };
    // ∫σ dy e ∫σ·y dy su [a, b] (Simpson), spezzando nei punti in cui il legame
    // cambia andamento (fine dello stress-block o ginocchio), così è esatto/regolare
    const intSigma = (a, b, x) => {
        if (!(b > a)) return { F: 0, M: 0 };
        const kink = concreteModel === "rectangular" ? 0.8 * x
            : x * (1 - (concreteModel === "bilinear" ? EPS_C3 : EPS_C2) / EPS_CU);
        const pts = kink > a && kink < b ? [a, kink, b] : [a, b];
        let F = 0, M = 0;
        for (let k = 0; k < pts.length - 1; k++) {
            const p0 = pts[k], p1 = pts[k + 1], n = 200, hh = (p1 - p0) / n;
            // valuta σ leggermente all'interno del tratto per non cadere sulla discontinuità
            const sig = (y) => sigmaC(Math.min(Math.max(y, p0 + 1e-9 * hh), p1 - 1e-9 * hh), x);
            let f = 0, m = 0;
            for (let i = 0; i <= n; i++) {
                const y = p0 + i * hh, w = i === 0 || i === n ? 1 : i % 2 ? 4 : 2, sv = sig(y);
                f += w * sv; m += w * sv * y;
            }
            F += (f * hh) / 3; M += (m * hh) / 3;
        }
        return { F, M };
    };
    // Risultante del cls compresso: C_c, profondità y_c del suo punto di
    // applicazione, quota d'anima e d'ali (sbalzi B − b_w) e posizione dell'asse neutro.
    const concreteRes = (x, Bg, hg) => {
        if (!isT) return { Cc: psi * fcd * Bg * x, yc: kG * x, CcW: psi * fcd * Bg * x, CcF: 0, inFlange: true };
        const ov = Math.max(Bg - tBw, 0); // sbalzi dell'ala
        if (!tensionTop && flangeMethod !== "exact") {
            // metodo semplificato: asse neutro "nell'ala" se Ψx ≤ s (rettangolo B),
            // altrimenti anima Ψ b_w x f_cd (a λx) + sbalzi (B − b_w) s f_cd (a s/2)
            if (psi * x <= tS) return { Cc: psi * fcd * Bg * x, yc: kG * x, CcW: psi * fcd * tBw * x, CcF: psi * fcd * ov * x, inFlange: true };
            const CcW = psi * fcd * tBw * x, CcF = ov * tS * fcd;
            return { Cc: CcW + CcF, yc: (CcW * kG * x + CcF * tS / 2) / (CcW + CcF), CcW, CcF, inFlange: false };
        }
        if (tensionTop && flangeMethod !== "exact" && psi * x <= hg - tS) {
            // anima compressa: rettangolo di larghezza b_w
            return { Cc: psi * fcd * tBw * x, yc: kG * x, CcW: psi * fcd * tBw * x, CcF: 0, inFlange: true };
        }
        // integrazione del diagramma σ-ε sull'area compressa reale
        const xa = Math.min(x, hg);
        const web = intSigma(0, xa, x);
        const fl = tensionTop ? intSigma(hg - tS, xa, x) : intSigma(0, Math.min(tS, xa), x);
        const CcW = tBw * web.F, CcF = ov * fl.F, Cc = CcW + CcF;
        return { Cc, yc: (tBw * web.M + ov * fl.M) / Cc, CcW, CcF, inFlange: tensionTop ? xa <= hg - tS : xa <= tS };
    };
    // baricentro della sezione (profondità dal lembo compresso)
    const centroid = (Bg, hg) => {
        if (!isT) return hg / 2;
        const top = (Bg * tS * tS / 2 + tBw * (hg - tS) * (hg + tS) / 2) / (Bg * tS + tBw * (hg - tS));
        return tensionTop ? hg - top : top;
    };
    let flangeNotNeeded = false;

    let B, h, d, X, z, As, AsPrime, dReq = null, Breq = null, doubleReinf = false;
    let coeff1 = null, coeff2 = null, AsDesignRaw = null, M1 = null, M2 = null;
    let epsSc = null, sigmaSc = null, comprYield = true;
    let xFromXi = true; // x = xi*d (ipotesi campo 2-3); false se x ricavato dall'equilibrio
    const betaEff = mode === "fixBH" || given ? 0 : beta;

    if (isT) {
        // Sezione a T: soluzione numerica delle stesse equazioni di equilibrio,
        // rispetto al baricentro y_G della sezione:
        //   C_c + C's − T_s = N_Ed
        //   C_c (y_G − y_c) + C's (y_G − d_C) + T_s (d − y_G) = M_Ed
        // (equivalente: C_c (d − y_c) + C's (d − d_C) = M_Ed + N_Ed (d − y_G)).
        sigmaSc = sigmaScDes;
        const Csg = given ? AsPrimeGiven * sigmaSc : 0;
        // A_s dalla traslazione (β oppure A's assegnata)
        const asOf = (Cc) => (given ? (Cc + Csg - Ned) / fs : (Cc - Ned) / (fs - beta * sigmaSc));
        const resid = (Bg, hg, dg, x) => {
            const { Cc, yc } = concreteRes(x, Bg, hg);
            const yG = centroid(Bg, hg), As_ = asOf(Cc), Cs = given ? Csg : beta * sigmaSc * As_;
            return Cc * (yG - yc) + Cs * (yG - cC) + As_ * fs * (dg - yG) - Mabs;
        };
        const bisect = (fn, lo, hi) => {
            for (let i = 0; i < 120; i++) { const mid = (lo + hi) / 2; if (fn(lo) * fn(mid) <= 0) hi = mid; else lo = mid; }
            return (lo + hi) / 2;
        };
        if (mode === "fixB") {
            B = Bin;
            const fn = (dT) => resid(B, dT + cT, dT, xi * dT);
            let lo = Math.max(cT, cC, tS) + 2, hi = lo + 4;
            while (fn(lo) * fn(hi) > 0 && hi < 8000) hi += 4;
            dReq = bisect(fn, lo, hi);
            d = dReq; h = d + cT; X = xi * d;
        } else if (mode === "fixH") {
            h = hIn; d = h - cT; X = xi * d;
            const fn = (Bg) => resid(Bg, h, d, X);
            if (fn(tBw) >= 0) { Breq = tBw; flangeNotNeeded = true; } // basta l'anima
            else { let hi = tBw * 2; while (fn(hi) < 0 && hi < 1e6) hi *= 2; Breq = bisect(fn, tBw, hi); }
            B = Math.max(Breq, 1);
        } else {
            B = Bin; h = hIn; d = h - cT;
            const yG = centroid(B, h), target = Mabs + Ned * (d - yG);
            const solveX = (Cs) => bisect((x) => { const r = concreteRes(x, B, h); return r.Cc * (d - r.yc) + Cs * (d - cC) - target; }, 1e-3, d);
            if (given) {
                X = solveX(Csg); xFromXi = false; AsPrime = AsPrimeGiven; doubleReinf = true;
            } else {
                X = xi * d;
                const r0 = concreteRes(X, B, h);
                const Cs = (target - r0.Cc * (d - r0.yc)) / (d - cC);
                if (Cs > 0) { AsPrime = Cs / sigmaSc; doubleReinf = true; }
                else { X = solveX(0); xFromXi = false; AsPrime = 0; doubleReinf = false; }
            }
        }
        const Ccf = concreteRes(X, B, h).Cc;
        if (mode === "fixBH") {
            As = Math.max((Ccf + AsPrime * sigmaSc - Ned) / fs, 0);
        } else {
            As = Math.max(asOf(Ccf), 0);
            AsPrime = given ? AsPrimeGiven : Math.max(beta * As, 0);
            doubleReinf = AsPrime > 0;
        }
        epsSc = epsScOf(X);
        comprYield = epsSc >= epsYd;
    } else if (given) {
        // Armatura compressa assegnata: C's = A's f_yd. Le due equazioni si
        // combinano nell'equilibrio alla rotazione attorno all'armatura tesa:
        //   C_c (d - kG x) + C's (d - d_C) = M_Ed + N_Ed (h/2 - d_T)
        // e A_s = (C_c + C's - N_Ed) / f_s dalla traslazione.
        sigmaSc = sigmaScDes;
        const Csg = AsPrimeGiven * sigmaSc;
        AsPrime = AsPrimeGiven;
        doubleReinf = true;
        if (mode === "fixBH") {
            // B, h note: incognite x e A_s
            B = Bin; h = hIn; d = h - cT;
            const Ms = Mabs + Ned * (h / 2 - cT) - Csg * (d - cC);
            const P = psi * fcd * B;
            const disc = d * d - (4 * kG * Ms) / P;
            X = disc >= 0 ? (d - Math.sqrt(disc)) / (2 * kG) : d / (2 * kG);
            X = Math.max(X, 1e-3);
            xFromXi = false;
        } else if (mode === "fixH") {
            // h nota, x = xi d: incognite B e A_s
            h = hIn; d = h - cT; X = xi * d;
            const Cc = (Mabs + Ned * (h / 2 - cT) - Csg * (d - cC)) / (d - kG * X);
            Breq = Cc / (psi * X * fcd);
            B = Math.max(Breq, 1);
        } else {
            // B nota, x = xi d, h = d + d_T: equazione di 2° grado in d
            //   a d² + (C's - N/2) d - (C's d_C + M - N d_T / 2) = 0
            B = Bin;
            const a = psi * fcd * B * xi * (1 - kG * xi);
            const b = Csg - Ned / 2, c0 = Csg * cC + Mabs - (Ned * cT) / 2;
            dReq = (-b + Math.sqrt(b * b + 4 * a * c0)) / (2 * a);
            d = dReq; h = d + cT; X = xi * d;
        }
        const Cc = psi * fcd * B * X;
        As = Math.max((Cc + Csg - Ned) / fs, 0);
        epsSc = epsScOf(X);
        comprYield = epsSc >= epsYd;
    } else if (mode === "fixBH") {
        // B e h assegnate: x = xi*d, incognite A_s e A's dalle due equazioni:
        //   C_c + A's f_yd - A_s f_s = N_Ed
        //   C_c (h/2 - kG x) + A's f_yd (h/2 - c') + A_s f_s (h/2 - c) = M_Ed
        B = Bin; h = hIn; d = h - cT; X = xi * d;
        const Cc = psi * fcd * B * X;
        const aC = h / 2 - kG * X, aSp = h / 2 - cC, aT = h / 2 - cT;
        const Cs = (Mabs - Cc * aC - (Cc - Ned) * aT) / (aSp + aT);
        if (Cs > 0) {
            // doppia armatura: serve armatura compressa
            sigmaSc = sigmaScDes;
            AsPrime = Cs / sigmaSc;
            As = Math.max((Cc + Cs - Ned) / fs, 0);
            doubleReinf = true;
            M1 = Cc * aC;
            M2 = Mabs - M1;
        } else {
            // A's non necessaria (verrebbe negativa): semplice armatura, x dall'equilibrio
            const sol = simpleAtGeom(B, h, d);
            X = sol.X; As = sol.As; AsPrime = 0; sigmaSc = sigmaScDes;
            doubleReinf = false;
            xFromXi = false;
        }
        epsSc = epsScOf(X);
        comprYield = epsSc >= epsYd;
    } else if (mode === "fixH") {
        // fissa h, progetta B; il rapporto beta impone A's = beta*A_s (x = xi*d)
        h = hIn; d = h - cT; X = xi * d;
        sigmaSc = sigmaScDes;
        epsSc = epsScOf(X);
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
            const Cc = psi * fcd * B * x, sc = sigmaScDes;
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
        sigmaSc = sigmaScDes;
        epsSc = epsScOf(X);
        comprYield = epsSc >= epsYd;
        const Cc = psi * fcd * B * X, k1 = beta * sigmaSc - fs;
        As = Math.max((Ned - Cc) / k1, 0);
        AsPrime = Math.max(beta * As, 0);
        doubleReinf = AsPrime > 0;
    }

    const cr = concreteRes(X, B, h);   // risultante del cls
    const yG = centroid(B, h);          // baricentro della sezione (h/2 per il rettangolo)
    z = d - cr.yc;

    // --- Armature minime e massime (NTC2018 4.1.6.1.1) ---
    // b_t = larghezza media della zona tesa (T: anima se l'ala è compressa)
    const bt = isT ? (tensionTop ? B : tBw) : B;
    const Ac = isT ? B * tS + tBw * (h - tS) : B * h;
    const AsMin = Math.max(0.26 * (fctm(fck) / fyk) * bt * d, 0.0013 * bt * d);
    const AsMax = 0.04 * Ac;
    const AsAdopt = Math.max(As, AsMin);

    // --- Scelta barre ---
    const areaPhi = barArea(phi);
    const nBars = Math.max(2, Math.ceil(AsAdopt / areaPhi));
    const AsProvided = nBars * areaPhi;
    let nBarsPrime = 0;
    let AsPrimeProvided = 0;
    if (given) {
        nBarsPrime = nBarsPrimeGiven;
        AsPrimeProvided = AsPrimeGiven;
    } else if (AsPrime > 0) {
        nBarsPrime = Math.max(2, Math.ceil(AsPrime / areaPhi));
        AsPrimeProvided = nBarsPrime * areaPhi;
    }

    const gap = Math.max(phi, 20);
    const reqWidth = nBars * phi + (nBars - 1) * gap + 2 * phiStirrup + cLeft + cRight; // n·φ + (n-1)·i + 2·φ_st + c + c'
    const widthOk = reqWidth <= (isT ? tBw : B); // le barre stanno nell'anima

    // --- Risultanti delle forze e bracci rispetto all'asse baricentrico (h/2) ---
    const Cc = cr.Cc;                      // compressione cls [N]
    const Cs = AsPrime * (sigmaSc || 0);   // compressione acciaio [N]
    const Ts = As * fs;                    // trazione acciaio [N]
    const aCc = yG - cr.yc;                // braccio di C_c
    const aCs = yG - cC;                   // braccio di C's
    const aTs = h - cT - yG;               // braccio di T_s
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
        xFromXi,
        cT,
        cC,
        cLeft,
        cRight,
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
        phiPrime: given ? phiPrimeGiven : phi,
        givenTop: given,
        isT,
        sectionType: isT ? "T" : "rect",
        bw: isT ? tBw : B,
        hf: isT ? tS : 0,
        flangeMethod,
        flangeNotNeeded,
        yG,
        yc: cr.yc,
        CcW: cr.CcW,
        CcF: cr.CcF,
        inFlange: cr.inFlange,
        bt,
        Ac,
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

/**
 * Forze interne della sezione ADOTTATA (dimensioni e barre commerciali), a
 * rottura con eps_c = eps_cu al lembo compresso (campi 3-4) e diagramma del cls
 * con i coefficienti psi / k_G del legame scelto.
 * L'asse neutro x si ricava dall'equilibrio alla traslazione
 *   psi·B·x·f_cd + A's·sigma's(x) - A_s·sigma_s(x) = N_Ed
 * con le tensioni dell'acciaio dal legame adottato (snervato o elastico).
 * Restituisce forze, bracci rispetto a h/2 e il momento resistente M_Rd.
 */
export function analyzeSection({ B, h, cT, cC, As, AsPrime = 0, NEd = 0, fcd, fyd, psi, kG, steelModel = "ep", ks = 1.15 }) {
    const d = h - cT;
    const epsYd = fyd / ES;
    const sSteel = (eps) => {
        const e = Math.abs(eps);
        let s;
        if (e <= epsYd) s = ES * e;
        else if (steelModel === "hardening") s = Math.min(fyd * (1 + ((e - epsYd) / (EPS_UD - epsYd)) * (ks - 1)), ks * fyd);
        else s = fyd;
        return Math.sign(eps) * s;
    };
    const epsS = (x) => (EPS_CU * (d - x)) / x;     // acciaio teso (+ = trazione)
    const epsSc = (x) => (EPS_CU * (x - cC)) / x;   // acciaio compresso (+ = compressione)
    const resid = (x) => psi * fcd * B * x + AsPrime * sSteel(epsSc(x)) - As * sSteel(epsS(x)) - NEd;
    let lo = 1e-3, hi = h;
    for (let i = 0; i < 200; i++) {
        const mid = (lo + hi) / 2;
        if (resid(mid) > 0) hi = mid; else lo = mid;
    }
    const x = (lo + hi) / 2;
    const sigmaS = sSteel(epsS(x));
    const sigmaSc = sSteel(epsSc(x));
    const Cc = psi * fcd * B * x;
    const Cs = AsPrime * sigmaSc;
    const Ts = As * sigmaS;
    const aCc = h / 2 - kG * x;
    const aCs = h / 2 - cC;
    const aTs = h / 2 - cT;
    return {
        B, h, d, x, As, AsPrime,
        epsS: epsS(x), epsSc: epsSc(x), sigmaS, sigmaSc,
        Cc, Cs, Ts, aCc, aCs, aTs,
        MRd: Cc * aCc + Cs * aCs + Ts * aTs, // N·mm, rispetto all'asse baricentrico
    };
}
