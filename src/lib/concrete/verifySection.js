// src/lib/concrete/verifySection.js
//
// Verifica a pressoflessione retta (SLU) di una sezione rettangolare in c.a.
// con armatura assegnata, mediante costruzione del dominio di resistenza M-N.
// Impostazione Tecnica delle Costruzioni (NTC2018 / EC2).
//
// Ipotesi:
//  - conservazione delle sezioni piane, perfetta aderenza;
//  - calcestruzzo: stress-block (lambda=0.8, eta=1.0 per fck<=50), non reagente
//    a trazione;
//  - acciaio elasto-plastico, Es=200 GPa, deformazione limite eps_su;
//  - rottura definita dai pivot A (acciaio teso a eps_su), B (cls a eps_cu),
//    C (cls a eps_c2, sezione interamente compressa).
//
// Convenzioni: compressione POSITIVA; N>0 compressione; M riferito al
// baricentro geometrico, M>0 tende le fibre inferiori (armatura As).
// Lunghezze mm, forze N, momenti N*mm. Input NEd in kN, MEd in kNm.

const ES = 200000; // modulo elastico acciaio [MPa]

export const DEFAULT_VERIFY_INPUT = {
    b: 300,
    h: 500,
    c: 40, // copriferro all'asse armatura tesa (inferiore)
    cPrime: 40, // copriferro all'asse armatura compressa (superiore)
    As: 1206, // armatura tesa [mm^2] (~6 phi 16)
    AsPrime: 402, // armatura compressa [mm^2] (~2 phi 16)
    fck: 25,
    fyk: 450,
    alphaCc: 0.85,
    gammaC: 1.5,
    gammaS: 1.15,
    NEd: 0, // sforzo normale di progetto [kN] (compressione +)
    MEd: 150, // momento di progetto [kNm]
    concreteModel: "rectangular", // diagramma costitutivo del cls
};

const EPS_CU = 0.0035; // 3.5 permille (deformazione ultima cls)
const EPS_C2 = 0.002; // 2.0 permille (parabola-rettangolo)
const EPS_C3 = 0.00175; // 1.75 permille (triangolo-rettangolo / bilineare)
const EPS_SU = 0.0675; // eps_ud ~ 0.9*eps_uk (B450C)
const LAMBDA = 0.8;
const ETA = 1.0;

// Diagrammi costitutivi del calcestruzzo selezionabili.
export const CONCRETE_MODELS = [
    { id: "rectangular", label: "Rettangolo (stress-block)" },
    { id: "parabola", label: "Parabola-rettangolo" },
    { id: "bilinear", label: "Triangolo-rettangolo (bilineare)" },
];

// Deformazione al "ginocchio" del diagramma (inizio del tratto costante),
// usata anche come deformazione del pivot C (sezione tutta compressa).
function pivotStrain(model) {
    return model === "bilinear" ? EPS_C3 : EPS_C2;
}

// Tensione del calcestruzzo per un dato diagramma costitutivo (compressione +).
function sigmaC(eps, model, fcd) {
    if (eps <= 0) return 0;
    if (model === "parabola") {
        return eps >= EPS_C2 ? fcd : fcd * (1 - Math.pow(1 - eps / EPS_C2, 2));
    }
    if (model === "bilinear") {
        return eps >= EPS_C3 ? fcd : (fcd * eps) / EPS_C3;
    }
    return fcd; // rettangolo: tensione costante eta*fcd (gestito a parte)
}

// Risultante di compressione del calcestruzzo e suo momento rispetto al
// baricentro. Il rettangolo (stress-block) e' in forma chiusa; parabola e
// bilineare sono integrati numericamente sulla zona compressa.
function concreteResultant(x, curv, p) {
    const { b, h, fcd, model } = p;
    if (x <= 0) return { Nc: 0, Mc: 0 };

    if (model === "rectangular") {
        const a = Math.min(LAMBDA * x, h);
        const Nc = ETA * fcd * b * a;
        return { Nc, Mc: Nc * (h / 2 - a / 2) };
    }

    const yEnd = Math.min(x, h);
    const n = 48;
    const dy = yEnd / n;
    let Nc = 0;
    let Mc = 0;
    for (let i = 0; i < n; i++) {
        const y = (i + 0.5) * dy;
        const s = sigmaC(curv * (x - y), model, fcd);
        if (s <= 0) continue;
        const dN = s * b * dy;
        Nc += dN;
        Mc += dN * (h / 2 - y);
    }
    return { Nc, Mc };
}

function clamp(v, lo, hi) {
    return Math.min(Math.max(v, lo), hi);
}

// Metadati dei campi di rottura (1..6).
export const FAILURE_FIELDS = {
    1: { id: 1, label: "Campo 1", desc: "Trazione (asse neutro esterno)" },
    2: { id: 2, label: "Campo 2", desc: "Pivot A: acciaio a ε_su, cls non al limite" },
    3: { id: 3, label: "Campo 3", desc: "Pivot B: acciaio snervato (duttile)" },
    4: { id: 4, label: "Campo 4", desc: "Pivot B: acciaio teso non snervato" },
    5: { id: 5, label: "Campo 5", desc: "Pivot B: asse neutro sotto l'armatura tesa" },
    6: { id: 6, label: "Campo 6", desc: "Pivot C: sezione interamente compressa" },
};

// Classifica il campo di rottura in base alla posizione x dell'asse neutro.
function classifyField(x, p) {
    if (x <= 0) return 1; // tutta la sezione tesa
    if (x <= p.xAB) return 2; // pivot A
    if (x <= p.xLim) return 3; // pivot B, acciaio snervato
    if (x <= p.d) return 4; // pivot B, acciaio teso non snervato
    if (x <= p.h) return 5; // pivot B, asse neutro sotto As
    return 6; // pivot C
}

// Punto del dominio per una data posizione x dell'asse neutro (dal lembo
// compresso). Restituisce {x, N, M} in N e N*mm.
function domainPoint(x, p) {
    const { h, d, dPrime, As, AsPrime, fyd, xAB, yC, epsC0 } = p;

    let curv; // curvatura (deformazione per unita' di lunghezza)
    if (x <= xAB) {
        // pivot A: acciaio teso a eps_su (comprende x<=0, trazione)
        curv = EPS_SU / (d - x);
    } else if (x <= h) {
        // pivot B: fibra compressa a eps_cu
        curv = EPS_CU / x;
    } else {
        // pivot C: rotazione attorno al punto a eps_c0 (2 o 1.75 permille)
        curv = epsC0 / (x - yC);
    }

    // deformazione a profondita' y (compressione positiva)
    const strainAt = (y) => curv * (x - y);

    // Risultante di compressione del calcestruzzo (diagramma scelto)
    const { Nc, Mc } = concreteResultant(x, curv, p);

    // Acciai
    const sigmaS = clamp(ES * strainAt(d), -fyd, fyd);
    const sigmaSp = clamp(ES * strainAt(dPrime), -fyd, fyd);
    const Fs = As * sigmaS;
    const Fsp = AsPrime * sigmaSp;

    const N = Nc + Fs + Fsp;
    const M = Mc + Fs * (h / 2 - d) + Fsp * (h / 2 - dPrime);

    return { x, N, M, field: classifyField(x, p) };
}

// Traccia un ramo del dominio (M>0, armatura As tesa in basso).
function buildBranch(p) {
    const pts = [];
    const xStart = -3 * p.h;
    const xEnd = 12 * p.h;
    const steps = 700;

    for (let i = 0; i <= steps; i++) {
        const x = xStart + ((xEnd - xStart) * i) / steps;
        pts.push(domainPoint(x, p));
    }
    return pts;
}

// Interpola M sul ramo per un dato N (N monotono crescente con x).
// Restituisce { M, x, field } oppure null se fuori dal range assiale.
function momentAtN(branch, Ntarget) {
    for (let i = 1; i < branch.length; i++) {
        const a = branch[i - 1];
        const b = branch[i];
        if (
            (Ntarget >= a.N && Ntarget <= b.N) ||
            (Ntarget <= a.N && Ntarget >= b.N)
        ) {
            const t = b.N === a.N ? 0 : (Ntarget - a.N) / (b.N - a.N);
            return {
                M: a.M + t * (b.M - a.M),
                x: a.x + t * (b.x - a.x),
                field: t < 0.5 ? a.field : b.field,
            };
        }
    }
    return null; // fuori dominio (N eccessivo)
}

export function verifySection(input) {
    const {
        b,
        h,
        c,
        cPrime,
        As,
        AsPrime,
        fck,
        fyk,
        alphaCc,
        gammaC,
        gammaS,
        NEd: NEd_kN,
        MEd: MEd_kNm,
        concreteModel = "rectangular",
    } = input;

    const errors = [];
    if (!(b > 0)) errors.push("La base b deve essere positiva.");
    if (!(h > 0)) errors.push("L'altezza h deve essere positiva.");
    if (!(As >= 0)) errors.push("L'armatura tesa As non e' valida.");
    if (!(AsPrime >= 0)) errors.push("L'armatura compressa As' non e' valida.");
    if (!(fck > 0)) errors.push("Selezionare una classe di calcestruzzo.");

    const d = h - c;
    const dPrime = cPrime;
    if (!(d > 0)) errors.push("Il copriferro c e' troppo grande rispetto ad h.");

    if (errors.length > 0) return { ok: false, errors };

    const fcd = (alphaCc * fck) / gammaC;
    const fyd = fyk / gammaS;
    const epsYd = fyd / ES;
    const epsC0 = pivotStrain(concreteModel); // deformazione del pivot C
    const yC = h * (1 - epsC0 / EPS_CU);

    // xAB: confine campo 2/3 (pivot A/B); xLim: confine campo 3/4 (snervamento).
    const xAB = (d * EPS_CU) / (EPS_CU + EPS_SU);
    const xLim = (d * EPS_CU) / (EPS_CU + epsYd);

    const p = {
        b, h, d, dPrime, As, AsPrime, fcd, fyd, xAB, xLim, yC, epsC0,
        model: concreteModel,
    };

    // Ramo positivo (As tesa in basso)
    const posBranch = buildBranch(p);

    // Ramo negativo: sezione ribaltata, momento cambiato di segno.
    // I confini dei campi vanno ricalcolati sull'altezza utile ribaltata.
    const dFlip = h - dPrime;
    const pFlip = {
        ...p,
        As: AsPrime,
        AsPrime: As,
        d: dFlip,
        dPrime: h - d,
        xAB: (dFlip * EPS_CU) / (EPS_CU + EPS_SU),
        xLim: (dFlip * EPS_CU) / (EPS_CU + epsYd),
    };
    const negBranch = buildBranch(pFlip).map((pt) => ({
        x: pt.x,
        N: pt.N,
        M: -pt.M,
        field: pt.field,
    }));

    // Estremi assiali
    const NRdMin = posBranch[0].N; // trazione pura (~ -(As+As')*fyd)
    const NRdMax = posBranch[posBranch.length - 1].N; // compressione ~ massima

    // Verifica al valore NEd
    const NEd = NEd_kN * 1000;
    const MEd = MEd_kNm * 1e6;
    const resAtN = momentAtN(posBranch, NEd); // {M,x,field} o null
    const res0 = momentAtN(posBranch, 0);
    const MRdAtN = resAtN ? resAtN.M : null;
    const MRd0 = res0 ? res0.M : null;

    // Momento resistente massimo (punto bilanciato) del ramo positivo
    let MRdMax = -Infinity;
    let NatMmax = 0;
    for (const pt of posBranch) {
        if (pt.M > MRdMax) {
            MRdMax = pt.M;
            NatMmax = pt.N;
        }
    }

    const axialInRange = NEd >= NRdMin && NEd <= NRdMax;
    const utilization =
        MRdAtN && MRdAtN > 0 ? Math.abs(MEd) / MRdAtN : Infinity;
    const verified = axialInRange && MRdAtN !== null && Math.abs(MEd) <= MRdAtN;
    const failureField = resAtN ? resAtN.field : null;

    // Dominio chiuso per il disegno (kN, kNm), con il campo di ciascun punto
    const toKN = (pt) => ({ N: pt.N / 1000, M: pt.M / 1e6, field: pt.field });
    const domain = [
        ...posBranch.map(toKN),
        ...negBranch.slice().reverse().map(toKN),
    ];

    return {
        ok: true,
        errors: [],
        fcd,
        fyd,
        epsYd,
        d,
        dPrime,
        xAB,
        // risultati (kN, kNm)
        NEd: NEd_kN,
        MEd: MEd_kNm,
        NRdMin: NRdMin / 1000,
        NRdMax: NRdMax / 1000,
        MRd0: MRd0 !== null ? MRd0 / 1e6 : null,
        MRdAtN: MRdAtN !== null ? MRdAtN / 1e6 : null,
        MRdMax: MRdMax / 1e6,
        NatMmax: NatMmax / 1000,
        axialInRange,
        utilization,
        verified,
        failureField,
        domain,
        // dati per il diagramma dei piani di rottura
        h,
        yC,
        xLim,
        xDesign: resAtN ? resAtN.x : null,
        epsCu: EPS_CU,
        epsC2: EPS_C2,
        epsC3: EPS_C3,
        epsC0,
        epsSu: EPS_SU,
        concreteModel,
    };
}
