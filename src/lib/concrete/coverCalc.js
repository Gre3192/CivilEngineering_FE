// src/lib/concrete/coverCalc.js
//
// Calcolo del copriferro nominale secondo EC2 (EN 1992-1-1) par. 4.4.1,
// impostazione Tecnica delle Costruzioni / NTC2018.
//
//   c_nom = c_min + Dc_dev
//   c_min = max( c_min,b ; c_min,dur + Dc_dur,g - Dc_dur,st - Dc_dur,add ; 10 mm )
//
// c_min,dur dalla Tab. 4.4N in funzione di classe di esposizione e classe
// strutturale; classe strutturale base S4 modificata secondo Tab. 4.3N.
//
// I valori numerici sono quelli "raccomandati" da EC2: alcuni Annessi
// Nazionali possono differire.

// Classi di esposizione (raggruppate come nella Tab. 4.4N).
export const EXPOSURE_CLASSES = [
    { id: "X0", group: "X0", label: "X0 – Nessun rischio di corrosione/attacco" },
    { id: "XC1", group: "XC1", label: "XC1 – Carbonatazione: asciutto o perm. bagnato" },
    { id: "XC2", group: "XC2/XC3", label: "XC2 – Carbonatazione: bagnato, raram. asciutto" },
    { id: "XC3", group: "XC2/XC3", label: "XC3 – Carbonatazione: umidità moderata" },
    { id: "XC4", group: "XC4", label: "XC4 – Carbonatazione: cicli bagnato/asciutto" },
    { id: "XD1", group: "XD1/XS1", label: "XD1 – Cloruri non marini: umidità moderata" },
    { id: "XD2", group: "XD2/XS2", label: "XD2 – Cloruri non marini: bagnato, raram. asciutto" },
    { id: "XD3", group: "XD3/XS3", label: "XD3 – Cloruri non marini: cicli bagnato/asciutto" },
    { id: "XS1", group: "XD1/XS1", label: "XS1 – Cloruri marini: aria salmastra" },
    { id: "XS2", group: "XD2/XS2", label: "XS2 – Cloruri marini: perm. immerso" },
    { id: "XS3", group: "XD3/XS3", label: "XS3 – Cloruri marini: zone di marea/spruzzi" },
];

// Tab. 4.4N — c_min,dur [mm] per classe strutturale S1..S6.
const C_MIN_DUR = {
    X0: [10, 10, 10, 10, 15, 20],
    XC1: [10, 10, 10, 15, 20, 25],
    "XC2/XC3": [10, 15, 20, 25, 30, 35],
    XC4: [15, 20, 25, 30, 35, 40],
    "XD1/XS1": [20, 25, 30, 35, 40, 45],
    "XD2/XS2": [25, 30, 35, 40, 45, 50],
    "XD3/XS3": [30, 35, 40, 45, 50, 55],
};

// Tab. 4.3N — classe di resistenza minima (fck) per la riduzione di 1 classe.
const STRENGTH_REDUCTION_FCK = {
    X0: 30,
    XC1: 30,
    "XC2/XC3": 35,
    XC4: 40,
    "XD1/XS1": 40,
    "XD2/XS2": 40,
    "XD3/XS3": 45,
};

export const DEFAULT_COVER_INPUT = {
    exposure: "XC2", // classe di esposizione
    phi: 16, // diametro barra longitudinale [mm]
    phiStirrup: 8, // diametro staffa [mm] (per copriferro alla staffa)
    fck: 30, // classe di resistenza [MPa] (per Tab. 4.3N)
    workingLife: 50, // vita nominale [anni]: 50 o 100
    slabGeometry: false, // elemento a lastra -> -1 classe
    qualityControl: false, // controllo qualità speciale -> -1 classe
    aggregateOver32: false, // dg > 32 mm -> c_min,b + 5
    dCdev: 10, // tolleranza di posa Dc_dev [mm]
    dCdurGamma: 0, // maggiorazione di sicurezza
    dCdurSt: 0, // riduzione acciaio inox
    dCdurAdd: 0, // riduzione protezione aggiuntiva
};

function clamp(v, lo, hi) {
    return Math.min(Math.max(v, lo), hi);
}

function getExposure(id) {
    return EXPOSURE_CLASSES.find((e) => e.id === id) || null;
}

/**
 * Calcola il copriferro nominale.
 * @returns oggetto con classe strutturale, contributi e c_nom.
 */
export function calcCover(input) {
    const {
        exposure,
        phi,
        phiStirrup,
        fck,
        workingLife,
        slabGeometry,
        qualityControl,
        aggregateOver32,
        dCdev,
        dCdurGamma,
        dCdurSt,
        dCdurAdd,
    } = input;

    const errors = [];

    const exp = getExposure(exposure);
    if (!exp) errors.push("Selezionare una classe di esposizione valida.");
    if (!(phi > 0)) errors.push("Il diametro della barra deve essere positivo.");
    if (!(fck > 0)) errors.push("Selezionare una classe di resistenza.");

    if (errors.length > 0) {
        return { ok: false, errors };
    }

    const group = exp.group;

    // --- Classe strutturale (base S4, Tab. 4.3N) ---
    const steps = [];
    let sc = 4;
    steps.push({ label: "Classe base", value: "S4", delta: 0 });

    if (workingLife >= 100) {
        sc += 2;
        steps.push({ label: "Vita nominale ≥ 100 anni", value: "+2", delta: 2 });
    }

    const strengthThreshold = STRENGTH_REDUCTION_FCK[group];
    if (fck >= strengthThreshold) {
        sc -= 1;
        steps.push({
            label: `Classe resistenza ≥ C${strengthThreshold}`,
            value: "−1",
            delta: -1,
        });
    }

    if (slabGeometry) {
        sc -= 1;
        steps.push({ label: "Elemento a lastra", value: "−1", delta: -1 });
    }

    if (qualityControl) {
        sc -= 1;
        steps.push({ label: "Controllo qualità speciale", value: "−1", delta: -1 });
    }

    const structuralClass = clamp(sc, 1, 6);

    // --- c_min,dur (Tab. 4.4N) ---
    const cMinDur = C_MIN_DUR[group][structuralClass - 1];

    // --- c_min,b (aderenza) ---
    let cMinB = phi;
    if (aggregateOver32) cMinB += 5;

    // --- c_min ---
    const cMinDurAdj = Math.max(0, cMinDur + dCdurGamma - dCdurSt - dCdurAdd);
    const cMin = Math.max(cMinB, cMinDurAdj, 10);

    // --- c_nom ---
    const cNom = cMin + dCdev;

    // Quale termine governa c_min?
    let governing = "minimo assoluto (10 mm)";
    if (cMinB >= cMinDurAdj && cMinB >= 10) governing = "aderenza (c_min,b)";
    else if (cMinDurAdj >= cMinB && cMinDurAdj >= 10) governing = "durabilità (c_min,dur)";

    // Copriferro all'asse della barra (utile per l'altezza utile d)
    // c' = c_nom (alla staffa) + phiStirrup + phi/2 se si parte dalla staffa,
    // qui c_nom è riferito alla superficie della barra piu' esterna.
    const cAxisFromStirrup = cNom + phiStirrup + phi / 2;

    return {
        ok: true,
        errors: [],
        exposure: exp,
        group,
        structuralClass,
        classSteps: steps,
        cMinDur,
        cMinB,
        cMinDurAdj,
        cMin,
        dCdev,
        cNom,
        governing,
        cAxisFromStirrup,
    };
}
