// src/lib/concrete/deflection.js
//
// Verifica di deformabilità (frecce) delle travi della Struttura, NTC 2018
// §4.1.2.2.2 e Circolare §C4.1.2.2.2 (EC2 §7.4).
//
// 1) Verifica semplificata (snellezza), che consente di omettere il calcolo:
//      λ = l/h ≤ K·[11 + 0,0015·fck/(ρ + ρ')]·[500·As,eff/(fyk·As,calc)]
//    con K dallo schema (appoggiata 1,0; campata terminale 1,3; intermedia 1,5;
//    mensola 0,4); As,eff/As,calc = 1 (a favore di sicurezza); luci > 7 m con
//    tramezzi fragili: × 7/l.
// 2) Calcolo della freccia per integrazione delle curvature, combinazione quasi
//    permanente, lungo termine:
//      1/r = ζ·M/(Ec,eff·I_II) + (1 − ζ)·M/(Ec,eff·I_I)
//      ζ = 1 − β·(Mcr/M)²  (|M| > Mcr, altrimenti 0), β = 0,5 carichi di lunga durata
//      Ec,eff = Ecm/(1 + φ), αe = Es/Ec,eff, Mcr = fctm·I_I/(h − y_G)
//    Limiti: f∞ ≤ L/250; con tramezzi fragili anche f∞ − f0(G1) ≤ L/500
//    (incremento dopo la loro costruzione). Per le mensole L = 2·luce.
//
// I momenti vengono dall'analisi elastica (beamAnalysis); la parte variabile
// (ψ2·Q) si dispone, per ogni campata, sulle campate che ne aumentano la freccia.
// Le curvature si integrano due volte fra due appoggi consecutivi (spostamenti
// nulli sugli appoggi); le mensole partono dalla rotazione dell'appoggio.
//
// Unità: m, kN, kNm in ingresso; sezioni in mm, mm², mm⁴, MPa; frecce in mm.

import { Mx } from "./beamAnalysis.js";

const ES = 200000;
const N = 80;                                   // tratti per campata
export const DEFL_DEFAULT = { phi: 2.5, partitions: false };

export const fctmOf = (fck) => (fck <= 50 ? 0.3 * fck ** (2 / 3) : 2.12 * Math.log(1 + (fck + 8) / 10));
export const EcmOf = (fck) => 22000 * ((fck + 8) / 10) ** 0.3;

// sezione rettangolare armata, distanze dal lembo compresso: As tesa (a d = h − c),
// As2 compressa (a c). Stato I omogeneizzato (αe − 1) e stato II fessurato (αe).
export function sectionStiffness({ b, h, c, As, As2 = 0, alphaE }) {
    const d = h - c, d2 = c;
    const A = b * h + (alphaE - 1) * (As + As2);
    const yG = ((b * h * h) / 2 + (alphaE - 1) * (As * d + As2 * d2)) / A;
    const I1 = (b * h ** 3) / 12 + b * h * (h / 2 - yG) ** 2 + (alphaE - 1) * (As * (d - yG) ** 2 + As2 * (yG - d2) ** 2);
    let x = null, I2 = null;
    if (As > 0) {
        const aa = b / 2, bb = alphaE * (As + As2), cc = -alphaE * (As * d + As2 * d2);
        x = (-bb + Math.sqrt(bb * bb - 4 * aa * cc)) / (2 * aa);
        I2 = (b * x ** 3) / 3 + alphaE * As * (d - x) ** 2 + alphaE * As2 * (x - d2) ** 2;
    }
    return { d, yG, I1, x, I2, Wt: I1 / (h - yG) };
}

// curvatura [1/m] di una sezione: M [kNm], E [MPa]
function curvature(M, sec, mat, beta) {
    const r = M >= 0 ? sec.pos : sec.neg;          // armatura del lato teso
    const st = sectionStiffness({ b: mat.b, h: mat.h, c: mat.c, As: r?.As ?? 0, As2: r?.As2 ?? 0, alphaE: ES / mat.E });
    const Mcr = (mat.fctm * st.Wt) / 1e6;          // kNm
    const k1 = (M * 1e6) / (mat.E * st.I1) * 1e3;  // 1/m
    if (Math.abs(M) <= Mcr) return { M, Mcr, zeta: 0, I1: st.I1, I2: st.I2, x: st.x, kap: k1, missing: false };
    if (!r || !(r.As > 0)) return { M, Mcr, zeta: null, I1: st.I1, I2: null, x: null, kap: k1, missing: true };
    const zeta = 1 - beta * (Mcr / M) ** 2;
    const k2 = (M * 1e6) / (mat.E * st.I2) * 1e3;
    return { M, Mcr, zeta, I1: st.I1, I2: st.I2, x: st.x, kap: zeta * k2 + (1 - zeta) * k1, missing: false };
}

// ---------------------------------------------------------------------------
// integrazione delle curvature: w'' = −1/r (w verso il basso), curvatura
// lineare a tratti → θ e w esatti sul tratto
// ---------------------------------------------------------------------------
function integrate(beam, kap) {
    const n = beam.spans.length, sup = beam.nodes.map((nd) => nd.type !== "free");
    const w = beam.spans.map(() => new Array(N + 1).fill(0));
    const thNode = new Array(n + 1).fill(null);    // rotazione (dw/dx) ai nodi appoggiati
    const step = (j, i, dir, st) => {               // avanza di un tratto nella campata j
        const h = beam.spans[j].L / N;
        const ka = kap[j][dir > 0 ? i : i], kb = kap[j][dir > 0 ? i + 1 : i - 1];
        const th = st.th, wn = st.w + h * th - (h * h * (2 * ka + kb)) / 6;
        return { w: wn, th: th - (h * (ka + kb)) / 2 };
    };
    // tratti fra appoggi consecutivi: partenza con w = θ = 0, poi correzione della corda
    let a = sup.findIndex(Boolean);
    while (a >= 0) {
        let bIdx = -1;
        for (let i = a + 1; i <= n; i++) if (sup[i]) { bIdx = i; break; }
        if (bIdx < 0) break;
        let st = { w: 0, th: 0 };
        const seq = [];
        for (let j = a; j < bIdx; j++) {
            for (let i = 0; i <= N; i++) {
                if (i > 0) st = step(j, i - 1, 1, st);
                seq.push({ j, i, s: (j === a ? 0 : beam.spans.slice(a, j).reduce((t, sp) => t + sp.L, 0)) + (beam.spans[j].L * i) / N, w: st.w, th: st.th });
            }
        }
        const Ls = seq[seq.length - 1].s, wEnd = st.w;
        seq.forEach((p) => { w[p.j][p.i] = p.w - (wEnd * p.s) / Ls; });
        thNode[a] = thNode[a] ?? -wEnd / Ls;
        thNode[bIdx] = st.th - wEnd / Ls;
        // rotazione a sinistra dell'appoggio b (per una mensola a destra)
        a = bIdx;
    }
    // mensole: partono dall'appoggio con θ = 0 (incastro) o con la rotazione del tratto adiacente
    const first = sup.indexOf(true), last = sup.lastIndexOf(true);
    if (first > 0) {
        const nd = beam.nodes[first];
        let st = { w: 0, th: nd.type === "fixed" ? 0 : -(thNode[first] ?? 0) };   // ds = −dx
        for (let j = first - 1; j >= 0; j--) {
            for (let i = N; i >= 0; i--) {
                if (i < N) st = step(j, i + 1, -1, st);
                w[j][i] = st.w;
            }
        }
    }
    if (last >= 0 && last < n) {
        const nd = beam.nodes[last];
        let st = { w: 0, th: nd.type === "fixed" ? 0 : (thNode[last] ?? 0) };
        for (let j = last; j < n; j++) {
            for (let i = 0; i <= N; i++) {
                if (i > 0) st = step(j, i - 1, 1, st);
                w[j][i] = st.w;
            }
        }
    }
    return w;
}

// tipo di campata per la verifica semplificata
function spanKind(beam, j) {
    const n = beam.nodes, a = n[j], b = n[j + 1];
    if (a.type === "free" || b.type === "free") return { kind: "mensola", K: 0.4, cant: true };
    const cont = (nd, i) => nd.type === "fixed" || (i > 0 && i < n.length - 1 && nd.continuous !== false);
    const c = (cont(a, j) ? 1 : 0) + (cont(b, j + 1) ? 1 : 0);
    return c === 0 ? { kind: "appoggiata", K: 1.0, cant: false }
        : c === 1 ? { kind: "campata terminale", K: 1.3, cant: false }
            : { kind: "campata intermedia", K: 1.5, cant: false };
}

// ---------------------------------------------------------------------------
// VERIFICA: reinf = { pos: [per campata {As, As2}], neg: [per nodo {As, As2}] }
// (pos: tesa inferiore in campata; neg: tesa superiore sull'appoggio)
// ---------------------------------------------------------------------------
export function beamDeflection(beam, an, reinf, opts = {}) {
    if (!an?.ok || !an.ends) return { ok: false };
    const { phi = DEFL_DEFAULT.phi, partitions = DEFL_DEFAULT.partitions } = opts;
    const { b, h, c, fck, fyk } = beam.section;
    const Ecm = EcmOf(fck), fctm = fctmOf(fck), Eeff = Ecm / (1 + phi);
    const matL = { b, h, c, E: Eeff, fctm }, mat0 = { b, h, c, E: Ecm, fctm };
    const n = beam.spans.length;
    const qp = an.combos.find((x) => x.state === "Q");
    const grid = beam.spans.map((sp) => Array.from({ length: N + 1 }, (_, i) => (sp.L * i) / N));
    // armatura in ogni punto: campata (M ≥ 0) e appoggio più vicino (M < 0); le
    // mensole usano l'appoggio da cui sporgono
    const secAt = (j, i) => {
        const nd0 = beam.nodes[j], nd1 = beam.nodes[j + 1];
        const node = nd0.type === "free" ? j + 1 : nd1.type === "free" ? j : (i <= N / 2 ? j : j + 1);
        return { pos: reinf.pos?.[j] ?? null, neg: reinf.neg?.[node] ?? null };
    };
    const momentG = (j, xl, g2 = true) => Mx(an.ends.G1[j], xl) + (g2 ? Mx(an.ends.G2[j], xl) : 0);
    const momentU = (k, j, xl) => Mx(an.ends.U[k][j], xl);

    // disposizione dei variabili per la freccia di ogni campata: linee elastiche
    // (EI = 1) dei carichi unitari, punto di controllo = massima freccia elastica sotto G
    const elastic = (fn) => integrate(beam, grid.map((xs, j) => xs.map((x) => fn(j, x))));
    const wG = elastic((j, x) => momentG(j, x));
    const wU = beam.spans.map((_, k) => elastic((j, x) => momentU(k, j, x)));
    // (mensola: l'estremo libero)
    const ctrl = wG.map((ws, j) => (beam.nodes[j].type === "free" ? 0 : beam.nodes[j + 1].type === "free" ? N
        : ws.reduce((bi, v, i) => (v > ws[bi] ? i : bi), 0)));

    const spans = beam.spans.map((sp, j) => {
        const loaded = beam.spans.map((_, k) => wU[k][j][ctrl[j]] > 1e-12 && Math.abs(qp?.qQ[k] ?? 0) > 1e-12);
        const Mqp = (jj, x) => momentG(jj, x) + beam.spans.reduce((t, _, k) => t + (loaded[k] ? qp.qQ[k] * momentU(k, jj, x) : 0), 0);
        // lungo termine, combinazione quasi permanente
        const cv = grid.map((xs, jj) => xs.map((x, i) => curvature(Mqp(jj, x), secAt(jj, i), matL, 0.5)));
        const wInf = integrate(beam, cv.map((r) => r.map((q) => q.kap)));
        // istantanea sotto G1 (al momento della costruzione dei tramezzi)
        const cv0 = grid.map((xs, jj) => xs.map((x, i) => curvature(momentG(jj, x, false), secAt(jj, i), mat0, 1.0)));
        const w0 = integrate(beam, cv0.map((r) => r.map((q) => q.kap)));
        const ws = wInf[j].map((v) => v * 1000);                     // mm
        const iMax = ws.reduce((bi, v, i) => (Math.abs(v) > Math.abs(ws[bi]) ? i : bi), 0);
        const dws = ws.map((v, i) => v - w0[j][i] * 1000);
        const iIncr = dws.reduce((bi, v, i) => (Math.abs(v) > Math.abs(dws[bi]) ? i : bi), 0);
        const kind = spanKind(beam, j);
        const Leff = kind.cant ? 2 * sp.L : sp.L;
        const f = ws[iMax], fLim = (Leff * 1000) / 250;
        const fIncr = dws[iIncr], fIncrLim = (Leff * 1000) / 500;
        const missing = cv[j].some((q) => q.missing);

        // verifica semplificata: armatura della sezione di campata (mensola: appoggio)
        const rr = kind.cant ? reinf.neg?.[beam.nodes[j].type === "free" ? j + 1 : j] : reinf.pos?.[j];
        const d = h - c;
        const rho = rr ? rr.As / (b * d) : null, rho2 = rr ? (rr.As2 ?? 0) / (b * d) : null;
        const lam = sp.L / (h / 1000);
        let lamLim = rho > 0 ? kind.K * (11 + (0.0015 * fck) / (rho + rho2)) * (500 / fyk) : null;
        const red = partitions && sp.L > 7 ? 7 / sp.L : 1;
        if (lamLim !== null) lamLim *= red;

        return {
            j, L: sp.L, Leff, ...kind, loaded, ctrl: ctrl[j],
            xs: grid[j], w: ws, wAll: wInf.map((r) => r.map((v) => v * 1000)), cv: cv[j],
            f, xf: grid[j][iMax], fLim, ok: !missing && Math.abs(f) <= fLim,
            dw: dws, fIncr, xIncr: grid[j][iIncr], fIncrLim, okIncr: !missing && Math.abs(fIncr) <= fIncrLim,
            missing, rho, rho2, lam, lamLim, red, simpleOk: lamLim !== null ? lam <= lamLim : null,
        };
    });
    return { ok: true, Ecm, Eeff, fctm, phi, partitions, alphaE: ES / Eeff, spans, n };
}
