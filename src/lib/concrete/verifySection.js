// src/lib/concrete/verifySection.js
//
// Verifica a pressoflessione retta (SLU) di una sezione rettangolare in c.a.
// con armatura assegnata, mediante il dominio di resistenza M-N costruito
// CAMPO PER CAMPO in forma chiusa (vedi domainFields.js e il laboratorio
// "Dominio M-N per campi"): pivot A (acciaio a ε_su), B (cls a ε_cu),
// C (cls a ε_c2 / ε_c3, sezione interamente compressa); ψ, λ e α dai legami.
//
// Convenzioni: N > 0 compressione; M riferito a h/2, M > 0 tende le fibre
// inferiori (armatura A_s, copriferro c). Input NEd in kN, MEd in kNm.
// Il punto (N_Ed, M_Ed) è verificato se, allo stesso N, M_Rd,− ≤ M_Ed ≤ M_Rd,+.

import { buildDomainData, concreteParams, verifyDomain } from "./domainFields";

const ES = 200000; // modulo elastico acciaio [MPa]
const EPS_UD = 0.0675; // ε_ud = 0,9·ε_uk (B450C)

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
    steelModel: "ep", // "ep" | "hardening" | "ductile"
    ks: 1.15, // ft/fy (incrudimento acciaio; B450C: k >= 1.15)
};

// Modelli costitutivi dell'acciaio selezionabili.
export const STEEL_MODELS = [
    { id: "ep", label: "Elasto-plastico (εud = 67,5‰)" },
    { id: "hardening", label: "Incrudente (k_s)" },
    { id: "ductile", label: "Indefinitamente duttile" },
];

// Diagrammi costitutivi del calcestruzzo selezionabili.
export const CONCRETE_MODELS = [
    { id: "rectangular", label: "Rettangolo (stress-block)" },
    { id: "parabola", label: "Parabola-rettangolo" },
    { id: "bilinear", label: "Triangolo-rettangolo (bilineare)" },
];

// Metadati dei campi di rottura (1..6).
export const FAILURE_FIELDS = {
    1: { id: 1, label: "Campo 1", desc: "Trazione, asse neutro esterno (pivot A)" },
    2: { id: 2, label: "Campo 2", desc: "Pivot A: acciaio a ε_su, cls non al limite" },
    3: { id: 3, label: "Campo 3", desc: "Pivot B: acciaio teso snervato" },
    4: { id: 4, label: "Campo 4", desc: "Pivot B: acciaio teso non snervato" },
    5: { id: 5, label: "Campo 5", desc: "Pivot B: asse neutro sotto l'armatura tesa" },
    6: { id: 6, label: "Campo 6", desc: "Pivot C: sezione interamente compressa" },
};

// dati della verifica → dati del dominio per campi
export function toFieldsInput(input) {
    return {
        b: input.b, h: input.h,
        dInf: input.c, dSup: input.cPrime,
        As: input.As, AsP: input.AsPrime,
        fck: input.fck, fyk: input.fyk,
        alphaCc: input.alphaCc, gammaC: input.gammaC, gammaS: input.gammaS,
        epsSu: EPS_UD,
        epsCu: concreteParams(input.fck).epsCu,
        concLaw: { rectangular: "stressblock", parabola: "parabola", bilinear: "bilinear" }[input.concreteModel] ?? "stressblock",
        steelLaw: { ep: "epp", hardening: "hard", ductile: "ductile" }[input.steelModel] ?? "epp",
        k: input.ks ?? 1.15,
    };
}

export function verifySection(input) {
    const { b, h, c, cPrime, As, AsPrime, fck, fyk, gammaS, NEd, MEd, concreteModel = "rectangular", steelModel = "ep", ks = 1.15 } = input;

    const errors = [];
    if (!(b > 0)) errors.push("La base b deve essere positiva.");
    if (!(h > 0)) errors.push("L'altezza h deve essere positiva.");
    if (!(c > 0) || !(cPrime > 0)) errors.push("I copriferri c e c' devono essere positivi.");
    if (h > 0 && c > 0 && cPrime > 0 && !(h > c + cPrime)) errors.push("I copriferri sono troppo grandi rispetto ad h (serve h > c + c').");
    if (!(As >= 0)) errors.push("L'armatura tesa As non e' valida.");
    if (!(AsPrime >= 0)) errors.push("L'armatura compressa As' non e' valida.");
    if (!(fck > 0)) errors.push("Selezionare una classe di calcestruzzo.");
    if (!(fyk > 0) || !(gammaS > 0)) errors.push("Acciaio non valido.");
    if (steelModel === "hardening" && !(ks >= 1)) errors.push("k_s deve essere almeno 1.");
    if (errors.length > 0) return { ok: false, errors };

    const fin = toFieldsInput(input);
    const data = buildDomainData(fin);
    const v = verifyDomain(data, NEd, MEd);
    const p = v.sign > 0 ? data.pos : data.neg;   // ramo del momento sollecitante

    return {
        ok: true,
        errors: [],
        data,
        fcd: data.pos.fcd,
        fyd: data.pos.fyd,
        epsYd: data.pos.fyd / ES,
        epsCu: data.pos.epsCu,
        epsSu: data.pos.epsSu,
        d: data.pos.d,
        dPrime: cPrime,
        NEd,
        MEd,
        ...v,
        failureField: v.rd ? v.rd.field : null,
        failureSub: v.rd ? v.rd.sub : null,
        xiDesign: v.rd ? v.rd.xi : null,
        xDesign: v.rd && Number.isFinite(v.rd.xi) ? v.rd.xi * p.d : null,
        dBranch: p.d,
        // punto di progetto per il grafico (anche adimensionale, sul ramo del momento)
        design: { N: NEd, M: MEd, nu: (NEd * 1000) / p.bdf, mu: (MEd * 1e6) / p.bd2f, ok: v.verified, sign: v.sign, rd: v.rd },
        concreteModel,
        steelModel,
        ks,
    };
}
