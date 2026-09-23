// src/lib/concrete/sectionDesign.js
//
// Progetto a flessione semplice (SLU) di una sezione rettangolare in c.a.
// secondo l'impostazione di Tecnica delle Costruzioni (NTC2018 / EC2).
//
// Ipotesi:
//  - diagramma delle tensioni del calcestruzzo tipo "stress-block"
//    (rettangolo: profondita' lambda*x, tensione eta*fcd);
//  - per fck <= 50 MPa: lambda = 0.8, eta = 1.0, eps_cu = 3.5 permille;
//  - acciaio elasto-plastico indefinito, Es = 200 GPa;
//  - conservazione delle sezioni piane, perfetta aderenza.
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
    b: 300, // base [mm]
    h: 500, // altezza [mm]
    c: 40, // distanza baricentro armatura tesa dal lembo teso [mm]
    cPrime: 40, // distanza armatura compressa dal lembo compresso [mm]
    MEd: 150, // momento di progetto [kNm]
    fck: 25, // [MPa]
    fyk: 450, // [MPa]
    alphaCc: 0.85,
    gammaC: 1.5,
    gammaS: 1.15,
    phi: 16, // diametro barre per il progetto [mm]
};

/** Resistenza media a trazione del calcestruzzo (fck <= 50). */
export function fctm(fck) {
    return 0.3 * Math.pow(fck, 2 / 3);
}

function barArea(phi) {
    return (Math.PI * phi * phi) / 4;
}

/**
 * Progetta l'armatura a flessione di una sezione rettangolare.
 * @returns oggetto con tutti i valori intermedi, i risultati e gli errori.
 */
export function designSection(input) {
    const {
        b,
        h,
        c,
        cPrime,
        MEd: MEd_kNm,
        fck,
        fyk,
        alphaCc,
        gammaC,
        gammaS,
        phi,
    } = input;

    const errors = [];

    if (!(b > 0)) errors.push("La base b deve essere positiva.");
    if (!(h > 0)) errors.push("L'altezza h deve essere positiva.");
    if (!(fck > 0)) errors.push("Selezionare una classe di calcestruzzo.");
    if (!(fyk > 0)) errors.push("Definire la resistenza dell'acciaio fyk.");

    const d = h - c; // altezza utile [mm]
    if (!(d > 0)) errors.push("Il copriferro c e' troppo grande rispetto ad h.");

    if (errors.length > 0) {
        return { ok: false, errors };
    }

    // --- Grandezze di calcolo dei materiali ---
    const fcd = (alphaCc * fck) / gammaC; // [MPa]
    const fyd = fyk / gammaS; // [MPa]
    const epsCu = 0.0035; // 3.5 permille
    const epsYd = fyd / ES;

    // Stress-block (fck <= 50)
    const lambda = 0.8;
    const eta = 1.0;

    // Momento sollecitante in N*mm
    const MEd = MEd_kNm * 1e6;

    // --- Limite di duttilita' (posizione asse neutro limite) ---
    // xi = x/d al limite tra snervamento acciaio e rottura cls
    const xiLim = epsCu / (epsCu + epsYd);
    const xLim = xiLim * d;
    // Momento adimensionale resistente al limite
    const muLim = lambda * xiLim * (1 - (lambda / 2) * xiLim);

    // Momento adimensionale sollecitante
    const mu = MEd / (b * d * d * (eta * fcd));

    const result = {
        ok: true,
        errors: [],
        // dati
        d,
        fcd,
        fyd,
        epsCu,
        epsYd,
        fctm: fctm(fck),
        lambda,
        eta,
        // limiti
        xiLim,
        xLim,
        muLim,
        mu,
    };

    let x, z, As, AsPrime, doubleReinf, sigmaSc, epsSc;

    if (mu <= muLim) {
        // ---- Armatura semplice ----
        doubleReinf = false;
        AsPrime = 0;

        // 0.32*xi^2 - 0.8*xi + mu = 0  ->  xi = (0.8 - sqrt(0.64 - 1.28*mu))/0.64
        const disc = 0.64 - 1.28 * mu;
        const xi = (0.8 - Math.sqrt(Math.max(disc, 0))) / 0.64;

        x = xi * d;
        z = d - (lambda / 2) * x; // braccio della coppia interna
        As = MEd / (fyd * z); // area acciaio teso [mm^2]

        result.xi = xi;
    } else {
        // ---- Doppia armatura ----
        // Si fissa x = xLim e si affida l'eccesso di momento all'acciaio compresso.
        doubleReinf = true;
        x = xLim;
        z = d - (lambda / 2) * x;

        const M1 = muLim * b * d * d * (eta * fcd); // momento della sezione a semplice armatura al limite
        const M2 = MEd - M1; // momento affidato alla coppia di armature

        // Deformazione e tensione dell'acciaio compresso
        epsSc = epsCu * ((x - cPrime) / x);
        sigmaSc = Math.min(Math.max(epsSc, 0) * ES, fyd);

        AsPrime = sigmaSc > 0 ? M2 / (sigmaSc * (d - cPrime)) : 0; // acciaio compresso
        // Acciaio teso = quota che equilibra il cls + quota della coppia
        const Ts_cls = eta * fcd * b * lambda * x; // risultante di compressione del cls
        As = (Ts_cls + AsPrime * sigmaSc) / fyd;

        result.xi = xiLim;
        result.M1 = M1;
        result.M2 = M2;
        result.epsSc = epsSc;
        result.sigmaSc = sigmaSc;
    }

    // --- Armature minime e massime (NTC2018 4.1.6.1.1) ---
    const AsMin = Math.max(0.26 * (fctm(fck) / fyk) * b * d, 0.0013 * b * d);
    const AsMax = 0.04 * b * h;

    const AsRequired = As; // da calcolo
    const AsDesign = Math.max(As, AsMin); // area da adottare (>= minima)

    // --- Scelta delle barre per l'armatura tesa ---
    const areaPhi = barArea(phi);
    const nBars = Math.max(2, Math.ceil(AsDesign / areaPhi)); // almeno 2 barre
    const AsProvided = nBars * areaPhi;

    // Barre per l'armatura compressa (se doppia armatura)
    let nBarsPrime = 0;
    let AsPrimeProvided = 0;
    if (doubleReinf && AsPrime > 0) {
        nBarsPrime = Math.max(2, Math.ceil(AsPrime / areaPhi));
        AsPrimeProvided = nBarsPrime * areaPhi;
    }

    Object.assign(result, {
        x,
        z,
        doubleReinf,
        As,
        AsPrime,
        AsRequired,
        AsDesign,
        AsMin,
        AsMax,
        exceedsMax: AsDesign > AsMax,
        belowMin: As < AsMin,
        // barre
        phi,
        areaPhi,
        nBars,
        AsProvided,
        nBarsPrime,
        AsPrimeProvided,
        utilization: AsProvided > 0 ? AsDesign / AsProvided : 0,
    });

    return result;
}
