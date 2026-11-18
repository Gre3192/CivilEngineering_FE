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

import { USE_CATEGORIES } from "../actions/loadData";

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

// risolve per carichi distribuiti uniformi qs[j] (uno per campata) → reazioni
// di estremità di ogni campata {V0, M0} (forza verso l'alto, momento antiorario)
function solve(beam, qs) {
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
        for (let a = 0; a < 4; a++) P[d[a]] += fe[a];
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
        const V0 = (12 * d[0] + 6 * L * d[1] - 12 * d[2] + 6 * L * d[3]) / L ** 3 + q * L / 2;
        const M0 = (6 * L * d[0] + 4 * L * L * d[1] - 6 * L * d[2] + 2 * L * L * d[3]) / L ** 3 + q * L * L / 12;
        return { V0, M0, q };
    });
    return { ok: true, ends };
}

// M(x), V(x) di una campata dalle forze di estremità
const Mx = (e, x) => -e.M0 + e.V0 * x - (e.q * x * x) / 2;
const Vx = (e, x) => e.V0 - e.q * x;

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

    // risposte elementari: G1 (con peso proprio), G2 su tutte le campate; Q su ciascuna campata
    const rG1 = solve(beam, beam.spans.map((s) => s.g1 + gSelf));
    if (!rG1.ok) return { ok: false, errors: ["Schema labile: aggiungi vincoli o rendi continua la trave (una cerniera interna richiede appoggi su entrambi i lati)."] };
    const rG2 = solve(beam, beam.spans.map((s) => s.g2));
    // variabile per campata: u per SLU e rara; frequente e quasi permanente come frazioni di u
    const sv = beam.spans.map((sp) => spanVariable(sp, beam));
    const fF = sv.map((v) => (v.u > 1e-12 ? v.f / v.u : cat.psi1));
    const fQ = sv.map((v) => (v.u > 1e-12 ? v.qp / v.u : cat.psi2));
    const rQ = beam.spans.map((_, k) => solve(beam, beam.spans.map((s, j) => (j === k ? sv[j].u : 0))));

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
            const mq = rQ.map((r) => Mx(r.ends[j], xl)), vq = rQ.map((r) => Vx(r.ends[j], xl));
            const pos = (a, w = null) => a.reduce((t, z, k) => t + (w ? w[k] : 1) * Math.max(0, z), 0), neg = (a, w = null) => a.reduce((t, z, k) => t + (w ? w[k] : 1) * Math.min(0, z), 0);
            const MG = gm.g1 * g1 + gm.g2 * g2, VG = gm.g1 * vg1 + gm.g2 * vg2;
            const Gk = g1 + g2, VGk = vg1 + vg2;
            pts.push({
                span: j, xl, x: xs0[j] + xl,
                // SLU: permanenti sempre (γ sfavorevoli), variabili alternati → inviluppo esatto
                MmaxU: MG + gm.q * pos(mq), MminU: MG + gm.q * neg(mq),
                VmaxU: VG + gm.q * pos(vq), VminU: VG + gm.q * neg(vq),
                // SLE: rara (Q con ψ = 1), frequente (ψ1), quasi permanente (ψ2)
                MmaxR: Gk + pos(mq), MminR: Gk + neg(mq),
                MmaxF: Gk + pos(mq, fF), MminF: Gk + neg(mq, fF),
                MmaxQ: Gk + pos(mq, fQ), MminQ: Gk + neg(mq, fQ),
                VmaxR: VGk + pos(vq), VminR: VGk + neg(vq),
            });
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
    const RG1 = nodeReac(rG1), RG2 = nodeReac(rG2), RQ = rQ.map(nodeReac);
    // coefficienti delle formule: reazione per carico unitario sulla sola campata k,
    // R_i = Σ c_ik·q_k·L_k (forza) e M_i = Σ m_ik·q_k·L_k² (momento d'incastro)
    const RU = beam.spans.map((_, k) => nodeReac(solve(beam, beam.spans.map((__, j) => (j === k ? 1 : 0)))));
    // carico SLU di progetto per campata con tutte le campate caricate
    const qd = beam.spans.map((s, j) => gm.g1 * (s.g1 + gSelf) + gm.g2 * s.g2 + gm.q * sv[j].u);
    const reac = beam.nodes.map((nd, i) => {
        const comb = (key, gQ, sgn) => gm.g1 * RG1[i][key] + gm.g2 * RG2[i][key] + gQ * RQ.reduce((t, r) => t + (sgn > 0 ? Math.max(0, r[i][key]) : Math.min(0, r[i][key])), 0);
        return {
            node: i, type: nd.type,
            G1: RG1[i], G2: RG2[i], Q: RQ.map((r) => r[i]),
            Rmax: comb("R", gm.q, 1), Rmin: comb("R", gm.q, -1),
            Mmax: comb("M", gm.q, 1), Mmin: comb("M", gm.q, -1),
            cR: RU.map((r, k) => r[i].R / beam.spans[k].L),
            cM: RU.map((r, k) => r[i].M / beam.spans[k].L ** 2),
            Rfull: RU.reduce((t, r, k) => t + r[i].R * qd[k], 0),
            Mfull: RU.reduce((t, r, k) => t + r[i].M * qd[k], 0),
        };
    });
    return { ok: true, errors: [], pts, Ltot, xs0, gSelf, cat, aL, d, reac, gamma: gm, qd };
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
