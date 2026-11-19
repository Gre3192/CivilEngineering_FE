// src/lib/concrete/beamAnalysis.js
//
// Struttura (travi dell'edificio): schema statico composto (campate, vincoli, continuità
// sugli appoggi), carichi distribuiti per campata, soluzione col metodo degli
// spostamenti (elementi trave di Eulero-Bernoulli, EI costante), inviluppi
// SLU con alternanza dei carichi variabili, combinazioni SLE e traslazione
// del diagramma del momento (NTC 2018 §4.1.2.3.5.4, EC2 §9.2.1.3).
//
// Convenzioni: x [m] dal nodo sinistro; carichi verso il basso positivi [kN/m];
// M > 0 tende le fibre inferiori (momento "positivo" in campata), V = dM/dx.

import { USE_CATEGORIES } from "../actions/loadData.js";

export const SUPPORT_TYPES = [
    { id: "fixed", label: "Incastro" },
    { id: "pin", label: "Appoggio" },
    { id: "free", label: "Libero" },
];

export const GAMMA_DEFAULT = { g1: 1.3, g2: 1.5, q: 1.5 };

const nz = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
// valore di una voce di carico: kN/m; kN/m² × b; kN/m³ × b × h
export const itemValue = (it) => (it.mode === "area" ? nz(it.value) * nz(it.width)
    : it.mode === "volume" ? nz(it.value) * nz(it.width) * nz(it.height ?? 1)
        : nz(it.value));

// Carico variabile di una campata. Le voci di q_k possono avere categorie
// diverse (NTC Tab. 2.5.I): ogni categoria è un'azione variabile; si combinano
// con un'azione principale e le altre ridotte (NTC §2.5.3):
//   u  (SLU / rara)     = max_i [Q_i + Σ_j≠i ψ0j·Q_j]
//   f  (frequente)      = max_i [ψ1i·Q_i + Σ_j≠i ψ2j·Q_j]
//   qp (quasi perm.)    = Σ_j ψ2j·Q_j
export function spanVariable(sp, beam) {
    const cat0 = USE_CATEGORIES.find((c) => c.id === beam.category) ?? USE_CATEGORIES[0];
    const items = sp.items?.q;
    const byCat = new Map();
    if (items?.length) {
        for (const it of items) {
            const c = USE_CATEGORIES.find((u) => u.id === (it.cat ?? beam.category)) ?? cat0;
            byCat.set(c.id, { c, Q: (byCat.get(c.id)?.Q ?? 0) + itemValue(it) });
        }
    } else byCat.set(cat0.id, { c: cat0, Q: nz(sp.q) });
    const gs = [...byCat.values()].filter((x) => Math.abs(x.Q) > 1e-12);
    if (!gs.length) return { u: 0, f: 0, qp: 0, groups: [], multi: false };
    const comb = (lead, other) => Math.max(...gs.map((gi) => gs.reduce((t, gj) => t + (gj === gi ? lead(gj) : other(gj)), 0)));
    return {
        u: comb((g) => g.Q, (g) => g.c.psi0 * g.Q),
        f: comb((g) => g.c.psi1 * g.Q, (g) => g.c.psi2 * g.Q),
        qp: gs.reduce((t, g) => t + g.c.psi2 * g.Q, 0),
        groups: gs,
        multi: gs.length > 1,
    };
}

// ---------------------------------------------------------------------------
// COMBINAZIONI DI CARICO (NTC 2018 §2.5.3)
// ---------------------------------------------------------------------------
// Azioni variabili della trave: ogni categoria d'uso presente nelle voci di q_k è
// un'azione Q_i, con il proprio valore su ciascuna campata.
const catOf = (id, beam) => USE_CATEGORIES.find((c) => c.id === id)
    ?? USE_CATEGORIES.find((c) => c.id === beam.category) ?? USE_CATEGORIES[0];
export function variableActions(beam) {
    const map = new Map();
    const add = (c, j, v) => {
        if (!map.has(c.id)) map.set(c.id, { c, Q: beam.spans.map(() => 0) });
        map.get(c.id).Q[j] += v;
    };
    beam.spans.forEach((sp, j) => {
        const items = sp.items?.q;
        if (items?.length) items.forEach((it) => add(catOf(it.cat ?? beam.category, beam), j, itemValue(it)));
        else add(catOf(beam.category, beam), j, nz(sp.q));
    });
    return [...map.values()].filter((a) => a.Q.some((q) => Math.abs(q) > 1e-12));
}

export const COMBO_STATES = [
    { id: "U", label: "SLU", long: "SLU (STR)" },
    { id: "R", label: "SLE rara", long: "SLE rara (caratteristica)" },
    { id: "F", label: "SLE frequente", long: "SLE frequente" },
    { id: "Q", label: "SLE quasi permanente", long: "SLE quasi permanente" },
];

// Elenco delle combinazioni secondo lo schema della norma:
//   ciclo sull'azione variabile dominante k = 1…n
//     SLU       γG1·G1 + γG2·G2 + γQ·Q_k + Σ_j≠k γQ·ψ0j·Q_j
//     rara      G1 + G2 + Q_k + Σ_j≠k ψ0j·Q_j
//     frequente G1 + G2 + ψ1k·Q_k + Σ_j≠k ψ2j·Q_j
//   senza variabile dominante
//     quasi permanente  G1 + G2 + Σ_j ψ2j·Q_j
// Per ogni combinazione: coefficienti di G1, G2 e di ciascuna Q_i, carichi
// risultanti per campata (parte permanente qG e variabile qQ, totale q).
export function loadCombinations(beam) {
    const gm = beam.gamma ?? GAMMA_DEFAULT;
    const gSelf = beam.selfWeight ? (25 * beam.section.b * beam.section.h) / 1e6 : 0;
    const G1 = beam.spans.map((s) => nz(s.g1) + gSelf), G2 = beam.spans.map((s) => nz(s.g2));
    const acts = variableActions(beam);
    const n = acts.length;
    const combos = [];
    const make = (state, k, cG1, cG2, coef) => {
        const qG = beam.spans.map((_, j) => cG1 * G1[j] + cG2 * G2[j]);
        const qQ = beam.spans.map((_, j) => acts.reduce((t, a, i) => t + coef[i] * a.Q[j], 0));
        const nIn = combos.filter((c) => c.state === state).length + 1;
        combos.push({
            id: `${state}${k ?? ""}`, state, index: nIn, lead: k ?? null, cG1, cG2, coef,
            qG, qQ, q: qG.map((g, j) => g + qQ[j]),
        });
    };
    const cyc = n ? acts.map((_, k) => k) : [null];
    cyc.forEach((k) => make("U", k, gm.g1, gm.g2, acts.map((a, i) => (i === k ? gm.q : gm.q * a.c.psi0))));
    cyc.forEach((k) => make("R", k, 1, 1, acts.map((a, i) => (i === k ? 1 : a.c.psi0))));
    cyc.forEach((k) => make("F", k, 1, 1, acts.map((a, i) => (i === k ? a.c.psi1 : a.c.psi2))));
    make("Q", null, 1, 1, acts.map((a) => a.c.psi2));
    return { acts, combos, G1, G2, gSelf, gamma: gm };
}

let uid = 0;
export const newId = (p = "id") => `${p}${Date.now().toString(36)}${(uid++).toString(36)}`;

export function newBeam(name = "T1") {
    return {
        id: newId("b"),
        name,
        section: { b: 300, h: 500, c: 40, fck: 25, fyk: 450 },
        selfWeight: true,                 // peso proprio 25 kN/m³·b·h aggiunto a g₁
        nodes: [{ type: "pin", continuous: true }, { type: "pin", continuous: true }, { type: "pin", continuous: true }],
        spans: [{ L: 5, g1: 10, g2: 8, q: 6 }, { L: 4, g1: 10, g2: 8, q: 6 }],
        category: "A",
        gamma: { ...GAMMA_DEFAULT },
        cotTheta: 2.5,                    // traslazione: a_l = 0,9 d (cot θ − cot α)/2
        alphaDeg: 90,
        sections: [],
    };
}

// ---------------------------------------------------------------------------
// SOLUTORE: metodo degli spostamenti, un elemento per campata
// ---------------------------------------------------------------------------
// gradi di libertà: abbassamento v per nodo; rotazione θ per nodo, sdoppiata
// (sinistra/destra) sui nodi interni "sconnessi" (cerniera)
function dofMap(beam) {
    const n = beam.nodes.length;
    let k = 0;
    const v = [], thL = [], thR = [];
    for (let i = 0; i < n; i++) {
        v[i] = k++;
        const internal = i > 0 && i < n - 1;
        const hinge = internal && beam.nodes[i].continuous === false;
        thL[i] = k++;
        thR[i] = hinge ? k++ : thL[i];
    }
    return { v, thL, thR, ndof: k };
}

// risolve per carichi distribuiti uniformi qs[j] (uno per campata) e un'eventuale
// forza concentrata point = { j, a, P } (campata, ascissa dal nodo sinistro, verso
// il basso) → forze di estremità di ogni campata {V0, M0} (forza verso l'alto,
// momento antiorario)
function solve(beam, qs, point = null) {
    const { v, thL, thR, ndof } = dofMap(beam);
    const K = Array.from({ length: ndof }, () => new Float64Array(ndof));
    const P = new Float64Array(ndof);
    const elDofs = [];
    beam.spans.forEach((sp, j) => {
        const L = sp.L, q = qs[j];
        const d = [v[j], thR[j], v[j + 1], thL[j + 1]];
        elDofs.push(d);
        const k = [
            [12 / L ** 3, 6 / L ** 2, -12 / L ** 3, 6 / L ** 2],
            [6 / L ** 2, 4 / L, -6 / L ** 2, 2 / L],
            [-12 / L ** 3, -6 / L ** 2, 12 / L ** 3, -6 / L ** 2],
            [6 / L ** 2, 2 / L, -6 / L ** 2, 4 / L],
        ];
        for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) K[d[a]][d[b]] += k[a][b];
        // forze nodali equivalenti (carico verso il basso)
        const fe = [-q * L / 2, -q * L * L / 12, -q * L / 2, q * L * L / 12];
        const fp = pointFE(point, j, L);
        for (let a = 0; a < 4; a++) P[d[a]] += fe[a] - fp[a];
    });
    // vincoli
    const fixedDof = new Set();
    beam.nodes.forEach((nd, i) => {
        if (nd.type === "fixed") { fixedDof.add(v[i]); fixedDof.add(thL[i]); fixedDof.add(thR[i]); }
        else if (nd.type === "pin") fixedDof.add(v[i]);
    });
    const free = [...Array(ndof).keys()].filter((i) => !fixedDof.has(i));
    const m = free.length;
    const A = free.map((i) => free.map((j) => K[i][j]));
    const bvec = free.map((i) => P[i]);
    // eliminazione di Gauss con pivot: matrice singolare → schema labile
    for (let c = 0; c < m; c++) {
        let piv = c;
        for (let r = c + 1; r < m; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
        const scale = Math.max(1, ...A[c].map(Math.abs));
        if (Math.abs(A[piv][c]) < 1e-10 * scale) return { ok: false };
        [A[c], A[piv]] = [A[piv], A[c]]; [bvec[c], bvec[piv]] = [bvec[piv], bvec[c]];
        for (let r = c + 1; r < m; r++) {
            const f = A[r][c] / A[c][c];
            if (!f) continue;
            for (let k = c; k < m; k++) A[r][k] -= f * A[c][k];
            bvec[r] -= f * bvec[c];
        }
    }
    const xf = new Float64Array(m);
    for (let r = m - 1; r >= 0; r--) {
        let s = bvec[r];
        for (let k = r + 1; k < m; k++) s -= A[r][k] * xf[k];
        xf[r] = s / A[r][r];
    }
    const U = new Float64Array(ndof);
    free.forEach((i, k) => { U[i] = xf[k]; });
    // forze di estremità dell'elemento (sinistra): f = k·u − fe
    const ends = beam.spans.map((sp, j) => {
        const L = sp.L, q = qs[j], d = elDofs[j].map((i) => U[i]);
        const fp = pointFE(point, j, L);
        const V0 = (12 * d[0] + 6 * L * d[1] - 12 * d[2] + 6 * L * d[3]) / L ** 3 + q * L / 2 + fp[0];
        const M0 = (6 * L * d[0] + 4 * L * L * d[1] - 6 * L * d[2] + 2 * L * L * d[3]) / L ** 3 + q * L * L / 12 + fp[1];
        return point && point.j === j ? { V0, M0, q, P: point.P, a: point.a } : { V0, M0, q };
    });
    return { ok: true, ends };
}

// reazioni di incastro perfetto (verso l'alto, antiorarie a sinistra) di una forza
// concentrata P alla distanza a dal nodo sinistro: P·b²(3a+b)/L³, P·a·b²/L², …
function pointFE(point, j, L) {
    if (!point || point.j !== j) return [0, 0, 0, 0];
    const a = point.a, b = L - a, P = point.P;
    return [P * b * b * (3 * a + b) / L ** 3, P * a * b * b / L ** 2, P * a * a * (a + 3 * b) / L ** 3, -P * a * a * b / L ** 2];
}

// M(x), V(x) di una campata dalle forze di estremità
// momento nella campata (estremità e carico dell'elemento), x dal nodo sinistro;
// la forza concentrata conta per x > a (taglio subito a destra della forza)
export const Mx = (e, x) => -e.M0 + e.V0 * x - (e.q * x * x) / 2 - (e.P && x > e.a ? e.P * (x - e.a) : 0);
export const Vx = (e, x) => e.V0 - e.q * x - (e.P && x > e.a ? e.P : 0);

// ---------------------------------------------------------------------------
// LINEE DI INFLUENZA (forza unitaria viaggiante verso il basso) di M o V nella
// sezione x0. Sugli appoggi interni il taglio è quello a destra (a sinistra
// sull'ultimo nodo). L'area della linea sulla campata k è l'effetto in x0 di un
// carico unitario distribuito sulla sola campata k.
// ---------------------------------------------------------------------------
export function locate(beam, x0, side = "dx") {
    let acc = 0;
    for (let j = 0; j < beam.spans.length; j++) {
        const L = beam.spans[j].L;
        // su un nodo interno, «sx» = estremità destra della campata a sinistra
        if (side === "sx" && j > 0 && Math.abs(x0 - acc) < 1e-9) return { j: j - 1, xl: beam.spans[j - 1].L, x0: acc - beam.spans[j - 1].L };
        if (x0 < acc + L - 1e-9 || j === beam.spans.length - 1) return { j, xl: Math.min(L, Math.max(0, x0 - acc)), x0: acc };
        acc += L;
    }
    return { j: 0, xl: 0, x0: 0 };
}
export function influenceLine(beam, x0, kind = "M", side = "dx", nPer = 48) {
    if (validateBeam(beam).length) return { ok: false };
    const { j: j0, xl: xl0 } = locate(beam, x0, side);
    const at = (r) => (kind === "M" ? Mx(r.ends[j0], xl0) : Vx(r.ends[j0], xl0));
    const zero = beam.spans.map(() => 0);
    const pts = [];
    let acc = 0;
    for (let k = 0; k < beam.spans.length; k++) {
        const L = beam.spans[k].L;
        const as = Array.from({ length: nPer + 1 }, (_, i) => (L * i) / nPer);
        if (k === j0) as.push(...(kind === "M" ? [xl0] : [Math.max(0, xl0 - 1e-7 * L), Math.min(L, xl0 + 1e-7 * L)]));
        const sorted = [...new Set(as)].sort((p, q) => p - q);
        for (const a of sorted) {
            const r = solve(beam, zero, { j: k, a, P: 1 });
            if (!r.ok) return { ok: false };
            pts.push({ span: k, a, x: acc + a, eta: at(r) });
        }
        acc += L;
    }
    // aree esatte: carico unitario distribuito sulla campata k
    const areas = beam.spans.map((_, k) => at(solve(beam, beam.spans.map((__, j) => (j === k ? 1 : 0)))));
    return { ok: true, kind, x0, side, j0, xl0, pts, areas };
}

// procedimento per una combinazione: con le aree A_k della linea di influenza,
//   S_max = Σ_k q_G,k·A_k + Σ_k max(0, q_Q,k·A_k)
//   S_min = Σ_k q_G,k·A_k + Σ_k min(0, q_Q,k·A_k)
export function influenceProcedure(il, combo) {
    const rows = il.areas.map((A, k) => {
        const g = combo.qG[k] * A, qv = combo.qQ[k] * A;
        return { k, A, qG: combo.qG[k], qQ: combo.qQ[k], g, qv, max: qv > 1e-12, min: qv < -1e-12 };
    });
    const G = rows.reduce((t, r) => t + r.g, 0);
    const Smax = G + rows.reduce((t, r) => t + Math.max(0, r.qv), 0);
    const Smin = G + rows.reduce((t, r) => t + Math.min(0, r.qv), 0);
    return { rows, G, Smax, Smin };
}

// diagramma di M o V lungo la trave per una disposizione di carico q[k] (kN/m)
export function diagramFor(beam, qs, kind = "M", nPer = 80) {
    const r = solve(beam, qs);
    if (!r.ok) return [];
    const out = [];
    let acc = 0;
    beam.spans.forEach((sp, j) => {
        for (let i = 0; i <= nPer; i++) {
            const xl = (sp.L * i) / nPer;
            out.push({ span: j, x: acc + xl, v: kind === "M" ? Mx(r.ends[j], xl) : Vx(r.ends[j], xl) });
        }
        acc += sp.L;
    });
    return out;
}

// ---------------------------------------------------------------------------
// ANALISI: risposte elementari, inviluppi, combinazioni
// ---------------------------------------------------------------------------
export function validateBeam(beam) {
    const err = [];
    if (beam.spans.length < 1) err.push("Serve almeno una campata.");
    if (beam.nodes.length !== beam.spans.length + 1) err.push("Numero di vincoli incoerente con le campate.");
    beam.spans.forEach((s, j) => { if (!(s.L > 0)) err.push(`Campata ${j + 1}: luce non valida.`); });
    const { b, h, c } = beam.section;
    if (!(b > 0 && h > 0)) err.push("Sezione non valida.");
    if (!(c > 0 && c < h / 2)) err.push("Copriferro non valido.");
    return err;
}

export function analyzeBeam(beam, nPerSpan = 80) {
    const errors = validateBeam(beam);
    if (errors.length) return { ok: false, errors };
    const { b, h, c } = beam.section;
    const gSelf = beam.selfWeight ? (25 * b * h) / 1e6 : 0;          // kN/m
    const cat = USE_CATEGORIES.find((u) => u.id === beam.category) ?? USE_CATEGORIES[0];
    const gm = beam.gamma ?? GAMMA_DEFAULT;
    const LC = loadCombinations(beam);

    // risposte elementari: G1 (con peso proprio), G2 su tutte le campate; Q su ciascuna campata
    const rG1 = solve(beam, beam.spans.map((s) => s.g1 + gSelf));
    if (!rG1.ok) return { ok: false, errors: ["Schema labile: aggiungi vincoli o rendi continua la trave (una cerniera interna richiede appoggi su entrambi i lati)."] };
    const rG2 = solve(beam, beam.spans.map((s) => s.g2));
    // risposte a carico unitario sulla sola campata k: la parte variabile di ogni
    // combinazione si alterna campata per campata (si carica dove aggrava)
    const rU = beam.spans.map((_, k) => solve(beam, beam.spans.map((__, j) => (j === k ? 1 : 0))));
    const combos = LC.combos;
    // estremi di ogni combinazione su tutta la trave, con le campate caricate dai variabili
    const ext = combos.map(() => ({ Mmax: { v: -Infinity }, Mmin: { v: Infinity }, Vabs: { v: -Infinity } }));
    const loaded = (c, u, sgn) => c.qQ.map((q, k) => (sgn * q * u[k] > 1e-12 ? k : -1)).filter((k) => k >= 0);

    // campionamento
    const xs0 = [];                      // ascissa di inizio di ogni campata
    let acc = 0;
    beam.spans.forEach((s) => { xs0.push(acc); acc += s.L; });
    const Ltot = acc;
    const pts = [];
    beam.spans.forEach((s, j) => {
        for (let i = 0; i <= nPerSpan; i++) {
            const xl = (s.L * i) / nPerSpan;
            const g1 = Mx(rG1.ends[j], xl), g2 = Mx(rG2.ends[j], xl);
            const vg1 = Vx(rG1.ends[j], xl), vg2 = Vx(rG2.ends[j], xl);
            const mu = rU.map((r) => Mx(r.ends[j], xl)), vu = rU.map((r) => Vx(r.ends[j], xl));
            const x = xs0[j] + xl;
            const p = { span: j, xl, x };
            // inviluppo di ogni stato = estremo sulle sue combinazioni; in ciascuna i
            // permanenti sono sempre presenti, i variabili alternati sulle campate
            for (const st of ["U", "R", "F", "Q"]) {
                p[`Mmax${st}`] = -Infinity; p[`Mmin${st}`] = Infinity; p[`Vmax${st}`] = -Infinity; p[`Vmin${st}`] = Infinity;
            }
            combos.forEach((c, ci) => {
                const MG = c.cG1 * g1 + c.cG2 * g2, VG = c.cG1 * vg1 + c.cG2 * vg2;
                let mP = MG, mN = MG, vP = VG, vN = VG;
                c.qQ.forEach((q, k) => {
                    const m = q * mu[k], v = q * vu[k];
                    if (m > 0) mP += m; else mN += m;
                    if (v > 0) vP += v; else vN += v;
                });
                const st = c.state;
                if (mP > p[`Mmax${st}`]) p[`Mmax${st}`] = mP;
                if (mN < p[`Mmin${st}`]) p[`Mmin${st}`] = mN;
                if (vP > p[`Vmax${st}`]) p[`Vmax${st}`] = vP;
                if (vN < p[`Vmin${st}`]) p[`Vmin${st}`] = vN;
                const e = ext[ci];
                if (mP > e.Mmax.v) e.Mmax = { v: mP, x, spans: loaded(c, mu, 1) };
                if (mN < e.Mmin.v) e.Mmin = { v: mN, x, spans: loaded(c, mu, -1) };
                const va = Math.max(vP, -vN);
                if (va > e.Vabs.v) e.Vabs = { v: va, x, spans: vP >= -vN ? loaded(c, vu, 1) : loaded(c, vu, -1) };
            });
            pts.push(p);
        }
    });

    // traslazione del diagramma del momento: a_l = z (cot θ − cot α)/2, z = 0,9 d
    const d = (h - c) / 1000;                                        // m
    const cotA = Math.abs(beam.alphaDeg - 90) < 1e-9 ? 0 : 1 / Math.tan((beam.alphaDeg * Math.PI) / 180);
    const aL = Math.max(0, (0.9 * d * (beam.cotTheta - cotA)) / 2);
    pts.forEach((p) => {
        let mx = p.MmaxU, mn = p.MminU;
        for (const q of pts) if (Math.abs(q.x - p.x) <= aL + 1e-9) { if (q.MmaxU > mx) mx = q.MmaxU; if (q.MminU < mn) mn = q.MminU; }
        p.MmaxT = mx; p.MminT = mn;
    });

    // reazioni vincolari SLU (inviluppo) agli appoggi: salto del taglio
    // reazioni vincolari: forza verticale (verso l'alto) e momento (antiorario) di
    // ogni nodo vincolato = somma delle forze di estremità delle campate che vi
    // concorrono (salto del taglio: R_i = V_i,dx − V_i,sx)
    const nodeReac = (r) => beam.nodes.map((_, i) => {
        let Rv = 0, Mr = 0;
        if (i > 0) {                                     // estremità destra della campata i−1
            const e = r.ends[i - 1], L = beam.spans[i - 1].L;
            Rv += e.q * L - e.V0;
            Mr += -e.M0 + e.V0 * L - (e.q * L * L) / 2;
        }
        if (i < beam.spans.length) { const e = r.ends[i]; Rv += e.V0; Mr += e.M0; } // estremità sinistra della campata i
        return { R: Rv, M: Mr };
    });
    const RG1 = nodeReac(rG1), RG2 = nodeReac(rG2);
    // coefficienti delle formule: reazione per carico unitario sulla sola campata k,
    // R_i = Σ c_ik·q_k·L_k (forza) e M_i = Σ m_ik·q_k·L_k² (momento d'incastro)
    const RU = rU.map(nodeReac);
    const sluC = combos.filter((c) => c.state === "U");
    // carico SLU per campata con tutte le campate caricate: il massimo sulle combinazioni SLU
    const qd = beam.spans.map((_, j) => Math.max(...sluC.map((c) => c.q[j])));
    const reac = beam.nodes.map((nd, i) => {
        // inviluppo SLU delle reazioni: estremo sulle combinazioni, variabili alternati
        const comb = (key, sgn) => {
            const vals = sluC.map((c) => c.cG1 * RG1[i][key] + c.cG2 * RG2[i][key]
                + RU.reduce((t, r, k) => t + (sgn > 0 ? Math.max(0, c.qQ[k] * r[i][key]) : Math.min(0, c.qQ[k] * r[i][key])), 0));
            return sgn > 0 ? Math.max(...vals) : Math.min(...vals);
        };
        return {
            node: i, type: nd.type,
            G1: RG1[i], G2: RG2[i],
            Rmax: comb("R", 1), Rmin: comb("R", -1),
            Mmax: comb("M", 1), Mmin: comb("M", -1),
            cR: RU.map((r, k) => r[i].R / beam.spans[k].L),
            cM: RU.map((r, k) => r[i].M / beam.spans[k].L ** 2),
            Rfull: RU.reduce((t, r, k) => t + r[i].R * qd[k], 0),
            Mfull: RU.reduce((t, r, k) => t + r[i].M * qd[k], 0),
        };
    });
    // combinazione più gravosa di ogni stato: quella col massimo |M| (a parità, il
    // taglio); per ogni effetto anche la combinazione che lo rende massimo
    const comboResults = combos.map((c, ci) => ({ ...c, ...ext[ci], Mabs: Math.max(ext[ci].Mmax.v, -ext[ci].Mmin.v) }));
    const governing = {};
    for (const st of COMBO_STATES) {
        const list = comboResults.filter((c) => c.state === st.id);
        const pick = (better) => list.reduce((b, c) => (better(c, b) ? c : b), list[0]).id;
        governing[st.id] = {
            id: pick((c, b) => c.Mabs > b.Mabs + 1e-9 || (Math.abs(c.Mabs - b.Mabs) <= 1e-9 && c.Vabs.v > b.Vabs.v + 1e-9)),
            Mmax: pick((c, b) => c.Mmax.v > b.Mmax.v + 1e-9),
            Mmin: pick((c, b) => c.Mmin.v < b.Mmin.v - 1e-9),
            Vabs: pick((c, b) => c.Vabs.v > b.Vabs.v + 1e-9),
        };
    }
    return { ok: true, errors: [], pts, Ltot, xs0, gSelf, cat, aL, d, reac, gamma: gm, qd, acts: LC.acts, combos: comboResults, governing,
        // risposte elementari (per le frecce): G1, G2 e carico unitario su ciascuna campata
        ends: { G1: rG1.ends, G2: rG2.ends, U: rU.map((r) => r.ends) } };
}

// valori dell'inviluppo nella sezione di ascissa x (interpolazione; sugli
// appoggi interni si prende il valore più gravoso fra i due lati)
export function valuesAt(an, x) {
    const keys = ["MmaxU", "MminU", "VmaxU", "VminU", "MmaxR", "MminR", "MmaxF", "MminF", "MmaxQ", "MminQ", "MmaxT", "MminT", "VmaxR", "VminR"];
    const cand = [];
    for (let i = 1; i < an.pts.length; i++) {
        const a = an.pts[i - 1], b = an.pts[i];
        if (a.span !== b.span) continue;
        if (x >= a.x - 1e-9 && x <= b.x + 1e-9) {
            const t = b.x === a.x ? 0 : (x - a.x) / (b.x - a.x);
            cand.push(Object.fromEntries(keys.map((k) => [k, a[k] + t * (b[k] - a[k])])));
        }
    }
    if (!cand.length) return null;
    const out = {};
    for (const k of keys) {
        const vals = cand.map((c) => c[k]);
        out[k] = k.includes("max") ? Math.max(...vals) : Math.min(...vals);
    }
    out.VabsU = Math.max(Math.abs(out.VmaxU), Math.abs(out.VminU));
    return out;
}

// sezioni caratteristiche: appoggi/incastri e massimo momento positivo di ogni campata
export function characteristicSections(beam, an) {
    const out = [];
    beam.nodes.forEach((nd, i) => {
        if (nd.type === "free") return;
        const x = an.xs0[i] ?? an.Ltot;
        out.push({ x, label: i === 0 ? "Appoggio sx" : i === beam.nodes.length - 1 ? "Appoggio dx" : `Appoggio ${i + 1}` });
    });
    beam.spans.forEach((s, j) => {
        const sp = an.pts.filter((p) => p.span === j);
        const best = sp.reduce((m, p) => (p.MmaxU > m.MmaxU ? p : m), sp[0]);
        if (best && best.MmaxU > 1e-6) out.push({ x: best.x, label: `Campata ${j + 1}` });
    });
    return out;
}
