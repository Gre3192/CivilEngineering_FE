// src/lib/concrete/domainFields.js
//
// Laboratorio (temporaneo): costruzione del dominio M-N di una sezione
// rettangolare in c.a. CAMPO PER CAMPO, con le formule chiuse degli appunti
// della prof. (vedi DOC/dominio-MN-campi.md). Serve a controllare le formule
// prima di riscrivere la verifica sezione.
//
// Convenzioni (come negli appunti):
//  - x dal lembo superiore (compresso nel ramo M > 0) verso il basso, ξ = x/d;
//  - d' copriferro inferiore (lato A_s), d'' superiore (lato A'_s), h = d + d';
//  - N > 0 compressione, M rispetto ad h/2, M > 0 tende le fibre inferiori;
//  - acciaio elastico-perfettamente plastico (f'_yd = f_yd), ε_su = 10‰.
// Ramo M < 0: stessa sezione ribaltata (A_s ↔ A'_s, d' ↔ d''), M cambia segno.
//
// Accanto alle formule c'è un calcolo NUMERICO indipendente (piano di
// deformazione + legami costitutivi, in coordinate dimensionali) usato come
// riferimento per controllare le formule di ciascun campo.

export const ES = 200000; // [MPa]

export const DEFAULT_DOMAIN_INPUT = {
    b: 300,
    h: 500,
    dInf: 40,  // d'  copriferro inferiore (all'asse di A_s)
    dSup: 40,  // d'' copriferro superiore (all'asse di A'_s)
    As: 1206,  // 6φ16
    AsP: 402,  // 2φ16
    fck: 25,
    fyk: 450,
    alphaCc: 0.85,
    gammaC: 1.5,
    gammaS: 1.15,
    epsSu: 0.01,
    epsCu: 0.0035,
};

// Parametri di un ramo. sign = +1 (M > 0, A_s in basso) o −1 (ribaltato).
export function branchParams(input, sign = 1) {
    const { b, h, alphaCc, fck, gammaC, fyk, gammaS, epsSu, epsCu } = input;
    const flip = sign < 0;
    const As = flip ? input.AsP : input.As;
    const AsP = flip ? input.As : input.AsP;
    const dInf = flip ? input.dSup : input.dInf; // d'  (lato A_s del ramo)
    const dSup = flip ? input.dInf : input.dSup; // d'' (lato A'_s del ramo)
    const d = h - dInf;
    const fcd = (alphaCc * fck) / gammaC;
    const fyd = fyk / gammaS;
    const epsSe = fyd / ES;
    const bdf = b * d * fcd;
    return {
        sign, b, h, d, dInf, dSup, As, AsP, fcd, fyd, epsSe, epsSu, epsCu,
        delta1: dInf / d,            // δ'
        delta2: dSup / d,            // δ''
        omegaS: (As * fyd) / bdf,    // ω_s
        omegaSP: (AsP * fyd) / bdf,  // ω'_s
        armS: (1 - dInf / d) / 2,                  // (h/2 − d')/d  = (1 − δ')/2
        armSP: (1 + dInf / d - 2 * dSup / d) / 2,  // (h/2 − d'')/d = (1 + δ' − 2δ'')/2
        bdf,
        bd2f: bdf * d,
    };
}

// adimensionali → N [kN], M [kNm] con il segno del ramo
const toNM = (p, nu, mu) => ({ nu, mu: p.sign * mu, N: (nu * p.bdf) / 1000, M: (p.sign * mu * p.bd2f) / 1e6 });

// ---------------------------------------------------------------------------
// CAMPO 1: −∞ < ξ ≤ 0, pivot A (A_s a ε_su), calcestruzzo tutto teso
// ---------------------------------------------------------------------------
export function field1(p) {
    const { epsSu, epsSe, delta2 } = p;
    const epsS12 = epsSu * delta2;                         // ε'_s1/2 = ε_su δ''
    const xi1ab = (epsSu * delta2 - epsSe) / (epsSu - epsSe); // ξ_1a/1b
    const has1b = epsS12 < epsSe;                           // A'_s elastica sulla retta 1/2
    // congruenza: ε'_s = ε_su (δ'' − ξ)/(1 − ξ)   (ξ = −∞ → ε_su)
    const epsSP = (xi) => (xi === -Infinity ? epsSu : (epsSu * (delta2 - xi)) / (1 - xi));
    const sub = (xi) => (has1b && xi > xi1ab ? "1b" : "1a");
    // tasso di lavoro di A'_s: 1 in 1a, E_s ε'_s / f_yd in 1b
    const alphaSP = (xi) => (sub(xi) === "1a" ? 1 : (ES * epsSP(xi)) / p.fyd);
    const point = (xi) => {
        const a = alphaSP(xi);
        const nu = -(p.omegaS + a * p.omegaSP);
        const mu = p.omegaS * p.armS - a * p.omegaSP * p.armSP;
        return { xi, sub: sub(xi), epsSP: epsSP(xi), alphaSP: a, sigmaSP: a * p.fyd, ...toNM(p, nu, mu) };
    };
    // tratto 1b (curva) da ξ_1a/1b a 0; il campo 1a è un punto
    const curve = [];
    if (has1b) {
        const n = 40;
        for (let i = 0; i <= n; i++) curve.push(point(xi1ab + ((0 - xi1ab) * i) / n));
    }
    return { epsS12, xi1ab, x1ab: xi1ab * p.d, has1b, epsSP, alphaSP, sub, point, pointA: point(-Infinity), curve };
}

// ---------------------------------------------------------------------------
// Calcestruzzo: parabola-rettangolo (n = 2, ε_c2 = 2‰, fck ≤ 50 MPa).
// ψ (riempimento) e λ (posizione di C_c dal lembo compresso, in frazione di x)
// in funzione della deformazione ε_c del lembo compresso (vedi "Coefficienti
// parabola…pdf" in DOC).
// ---------------------------------------------------------------------------
export const EPS_C2 = 0.002;
export function sigmaC(e, fcd) {
    if (e <= 0) return 0;
    return e >= EPS_C2 ? fcd : fcd * (1 - (1 - e / EPS_C2) ** 2);
}
export function psiLambda(epsC) {
    const e2 = EPS_C2;
    if (epsC <= 0) return { psi: 0, lam: 1 / 3 };
    if (epsC <= e2) {
        return { psi: (epsC / (3 * e2 * e2)) * (3 * e2 - epsC), lam: (4 * e2 - epsC) / (4 * (3 * e2 - epsC)) };
    }
    return {
        psi: 1 - e2 / (3 * epsC),
        lam: (6 * epsC * epsC - 4 * epsC * e2 + e2 * e2) / (4 * epsC * (3 * epsC - e2)),
    };
}

// ---------------------------------------------------------------------------
// CAMPO 2: 0 ≤ ξ ≤ ξ_H = ε_cu/(ε_su + ε_cu), pivot A; cls compresso (ψ, λ).
// Segni: deformazioni e tensioni dell'acciaio positive in TRAZIONE, negative
// in compressione (A'_s passa da tesa a compressa).
// ---------------------------------------------------------------------------
export function field2(p) {
    const { epsSu, epsSe, epsCu, delta2, fyd } = p;
    const xiH = epsCu / (epsSu + epsCu);
    const epsSP = (xi) => (-epsSu * (xi - delta2)) / (1 - xi);   // ε'_s (trazione +)
    const epsC = (xi) => (epsSu * xi) / (1 - xi);                // ε_c lembo compresso
    const epsS12 = epsSP(0), epsS23 = epsSP(xiH);
    // confine 2a/2b: ε'_s = ε'_se = −ε_se (snervamento in compressione)
    const xi2ab = (epsSu * delta2 + epsSe) / (epsSu + epsSe);
    const has2b = xi2ab < xiH;
    const sub = (xi) => (has2b && xi >= xi2ab ? "2b" : "2a");
    // tasso di lavoro con segno: α'_s = σ'_s / f_yd ∈ [−1, 1]
    const alphaSP = (xi) => Math.max(-1, Math.min(1, (ES * epsSP(xi)) / fyd));
    const point = (xi) => {
        const ec = epsC(xi);
        const { psi, lam } = psiLambda(ec);
        const a = alphaSP(xi);
        const nu = psi * xi - a * p.omegaSP - p.omegaS;
        const mu = psi * xi * ((1 + p.delta1) / 2 - lam * xi) - a * p.omegaSP * p.armSP + p.omegaS * p.armS;
        return { xi, sub: sub(xi), epsC: ec, psi, lam, epsSP: epsSP(xi), alphaSP: a, sigmaSP: a * fyd, ...toNM(p, nu, mu) };
    };
    const xs = Array.from({ length: 61 }, (_, i) => (xiH * i) / 60);
    if (has2b && xi2ab > 0) xs.push(xi2ab);
    const curve = xs.sort((a, b) => a - b).map(point);
    return { xiH, xH: xiH * p.d, epsSP, epsC, epsS12, epsS23, xi2ab, x2ab: xi2ab * p.d, has2b, sub, alphaSP, point, curve };
}

// ---------------------------------------------------------------------------
// CAMPO 3: ξ_H ≤ ξ ≤ ξ_N = ε_cu/(ε_cu + ε_se), pivot B (lembo compresso a ε_cu),
// A_s snervata (ε_se ≤ ε_s ≤ ε_su); ψ e λ costanti (diagramma completo).
// ---------------------------------------------------------------------------
export function field3(p) {
    const { epsSu, epsSe, epsCu, delta2, fyd } = p;
    const xiH = epsCu / (epsSu + epsCu), xiN = epsCu / (epsCu + epsSe);
    const epsSP = (xi) => (-epsCu * (xi - delta2)) / xi;     // ε'_s (trazione +)
    const epsS = (xi) => (epsCu * (1 - xi)) / xi;            // ε_s (trazione +)
    const epsS23 = epsSP(xiH), epsS34 = epsSP(xiN);
    // confine 3a/3b: ε'_s = ε'_se = −ε_se → ξ = ε_cu δ''/(ε_cu + ε'_se)
    const xi3ab = epsCu > epsSe ? (epsCu * delta2) / (epsCu - epsSe) : Infinity;
    const has3a = xi3ab > xiH, has3b = xi3ab < xiN;
    const sub = (xi) => (!has3a ? "3b" : !has3b ? "3a" : xi < xi3ab ? "3a" : "3b");
    const alphaSP = (xi) => Math.max(-1, Math.min(1, (ES * epsSP(xi)) / fyd));
    const { psi, lam } = psiLambda(epsCu);
    // copriferro per cui A'_s snerva proprio sulla retta 2/3
    const dSup23 = ((epsCu - epsSe) * xiH * p.d) / epsCu;
    const point = (xi) => {
        const a = alphaSP(xi);
        const aS = Math.min(1, (ES * epsS(xi)) / fyd); // = 1 nel campo 3
        const nu = psi * xi - a * p.omegaSP - aS * p.omegaS;
        const mu = psi * xi * ((1 + p.delta1) / 2 - lam * xi) - a * p.omegaSP * p.armSP + aS * p.omegaS * p.armS;
        return { xi, sub: sub(xi), epsC: epsCu, psi, lam, epsS: epsS(xi), epsSP: epsSP(xi), alphaSP: a, sigmaSP: a * fyd, ...toNM(p, nu, mu) };
    };
    const xs = Array.from({ length: 61 }, (_, i) => xiH + ((xiN - xiH) * i) / 60);
    if (has3a && has3b) xs.push(xi3ab);
    const curve = xs.sort((a, b) => a - b).map(point);
    return { xiH, xiN, xH: xiH * p.d, xN: xiN * p.d, epsSP, epsS, epsS23, epsS34, xi3ab, x3ab: xi3ab * p.d, has3a, has3b, sub, alphaSP, psi, lam, dSup23, point, curve };
}

// ---------------------------------------------------------------------------
// CAMPO 4: ξ_N ≤ ξ ≤ 1, pivot B, A_s ELASTICA (σ_s = E_s ε_s); A'_s tipicamente
// snervata, altrimenti sottocampi 4a (elastica) / 4b (plastica).
// ---------------------------------------------------------------------------
export function field4(p) {
    const { epsSe, epsCu, delta2, fyd } = p;
    const xiN = epsCu / (epsCu + epsSe);
    const epsSP = (xi) => (-epsCu * (xi - delta2)) / xi;     // ε'_s (trazione +)
    const epsS = (xi) => (epsCu * (1 - xi)) / xi;            // ε_s (trazione +)
    const epsS34 = epsSP(xiN), epsS45 = epsSP(1);
    // confine 4a/4b (stessa retta del confine 3a/3b): ξ = ε_cu δ''/(ε_cu + ε'_se)
    const xi4ab = epsCu > epsSe ? (epsCu * delta2) / (epsCu - epsSe) : Infinity;
    const has4a = xi4ab > xiN, has4b = xi4ab < 1;
    const split = has4a && has4b;
    const sub = (xi) => (split ? (xi < xi4ab ? "4a" : "4b") : "4");
    const alphaSP = (xi) => Math.max(-1, Math.min(1, (ES * epsSP(xi)) / fyd));
    const alphaS = (xi) => Math.max(-1, Math.min(1, (ES * epsS(xi)) / fyd)); // elastica nel campo 4
    const { psi, lam } = psiLambda(epsCu);
    const point = (xi) => {
        const a = alphaSP(xi), aS = alphaS(xi);
        const nu = psi * xi - a * p.omegaSP - aS * p.omegaS;
        const mu = psi * xi * ((1 + p.delta1) / 2 - lam * xi) - a * p.omegaSP * p.armSP + aS * p.omegaS * p.armS;
        return { xi, sub: sub(xi), epsC: epsCu, psi, lam, epsS: epsS(xi), alphaS: aS, sigmaS: aS * fyd, epsSP: epsSP(xi), alphaSP: a, sigmaSP: a * fyd, ...toNM(p, nu, mu) };
    };
    const xs = Array.from({ length: 61 }, (_, i) => xiN + ((1 - xiN) * i) / 60);
    if (split) xs.push(xi4ab);
    const curve = xs.sort((a, b) => a - b).map(point);
    return { xiN, xN: xiN * p.d, epsSP, epsS, epsS34, epsS45, xi4ab, x4ab: xi4ab * p.d, has4a, has4b, split, sub, alphaSP, alphaS, psi, lam, point, curve };
}

// ---------------------------------------------------------------------------
// CAMPO 5: 1 ≤ ξ ≤ 1 + δ' (d ≤ x ≤ h), pivot B, A_s COMPRESSA (tipicamente
// elastica). Se A'_s non è ancora snervata: sottocampi 5a / 5b.
// ---------------------------------------------------------------------------
export function field5(p) {
    const { epsSe, epsCu, delta1, delta2, fyd } = p;
    const xiE = 1 + delta1;                                   // x = h
    const epsSP = (xi) => (-epsCu * (xi - delta2)) / xi;      // ε'_s (trazione +)
    const epsS = (xi) => (-epsCu * (xi - 1)) / xi;            // ε_s ≤ 0 (compressione)
    const epsS45 = epsSP(1), epsS56 = epsSP(xiE), epsAs56 = epsS(xiE);
    const xi5ab = epsCu > epsSe ? (epsCu * delta2) / (epsCu - epsSe) : Infinity;
    const split = xi5ab > 1 && xi5ab < xiE;
    const has5b = xi5ab < xiE;
    const sub = (xi) => (split ? (xi < xi5ab ? "5a" : "5b") : "5");
    const alphaSP = (xi) => Math.max(-1, Math.min(1, (ES * epsSP(xi)) / fyd));
    const alphaS = (xi) => Math.max(-1, Math.min(1, (ES * epsS(xi)) / fyd));
    const { psi, lam } = psiLambda(epsCu);
    const point = (xi) => {
        const a = alphaSP(xi), aS = alphaS(xi);
        const nu = psi * xi - a * p.omegaSP - aS * p.omegaS;
        const mu = psi * xi * ((1 + p.delta1) / 2 - lam * xi) - a * p.omegaSP * p.armSP + aS * p.omegaS * p.armS;
        return { xi, sub: sub(xi), epsC: epsCu, psi, lam, epsS: epsS(xi), alphaS: aS, sigmaS: aS * fyd, epsSP: epsSP(xi), alphaSP: a, sigmaSP: a * fyd, ...toNM(p, nu, mu) };
    };
    const xs = Array.from({ length: 41 }, (_, i) => 1 + (delta1 * i) / 40);
    if (split) xs.push(xi5ab);
    const curve = xs.sort((a, b) => a - b).map(point);
    return { xiE, epsSP, epsS, epsS45, epsS56, epsAs56, xi5ab, x5ab: xi5ab * p.d, split, has5b, sub, alphaSP, alphaS, psi, lam, point, curve };
}

// ---------------------------------------------------------------------------
// CAMPO 6: 1 + δ' ≤ ξ < +∞ (h ≤ x), pivot C (punto F a profondità t con ε_c2),
// sezione interamente compressa; ψ e λ riferiti all'altezza h (C_c = bψh f_cd a λh).
// ---------------------------------------------------------------------------
// ψ, λ dell'intera sezione con lembo superiore a ε_cs e inferiore a ε_ci (entrambi
// compressi): differenza fra il blocco 0…x (ε_cs) e il blocco h…x (ε_ci).
export function psiLambdaFull(xd, h, epsCs, epsCi) {
    if (!Number.isFinite(xd)) return { psi: 1, lam: 0.5 }; // deformazione uniforme ε_c2
    const A = psiLambda(epsCs), Bk = psiLambda(epsCi);
    const F1 = xd * A.psi, F2 = (xd - h) * Bk.psi;          // forze (÷ b f_cd)
    const psi = (F1 - F2) / h;
    const mom = F1 * A.lam * xd - F2 * (h + Bk.lam * (xd - h)); // momento rispetto al lembo superiore
    return { psi, lam: mom / (psi * h) / h };
}
export function field6(p) {
    const { epsSe, epsCu, delta1, delta2, fyd, d, h } = p;
    const epsC2 = EPS_C2;
    const t = ((epsCu - epsC2) * h) / epsCu;                  // profondità del punto F
    const tD = t / d;
    const xi0 = 1 + delta1;                                   // x = h (retta 5/6)
    // deformazioni (trazione +) per ξ finito; ξ = ∞ → −ε_c2 ovunque
    const strain = (xi, y) => (xi === Infinity ? -epsC2 : (-epsC2 * (xi - y)) / (xi - tD)); // y = profondità/d
    const epsS = (xi) => strain(xi, 1), epsSP = (xi) => strain(xi, delta2);
    const epsCs = (xi) => -strain(xi, 0), epsCi = (xi) => -strain(xi, xi0);
    // confine 6a/6b: |ε_s| = ε_se
    const xi6ab = (epsC2 - epsSe * tD) / (epsC2 - epsSe);
    const has6b = epsC2 > epsSe;
    const sub = (xi) => (has6b && xi >= xi6ab ? "6b" : "6a");
    const alphaSP = (xi) => Math.max(-1, Math.min(1, (ES * epsSP(xi)) / fyd));
    const alphaS = (xi) => Math.max(-1, Math.min(1, (ES * epsS(xi)) / fyd));
    const coef = (xi) => psiLambdaFull(xi === Infinity ? Infinity : xi * d, h, epsCs(xi), epsCi(xi));
    const point = (xi) => {
        const { psi, lam } = coef(xi);
        const a = alphaSP(xi), aS = alphaS(xi);
        const nu = psi * xi0 - a * p.omegaSP - aS * p.omegaS;
        const mu = psi * xi0 * (xi0 / 2 - lam * xi0) - a * p.omegaSP * p.armSP + aS * p.omegaS * p.armS;
        return { xi, sub: sub(xi), epsC: epsCs(xi), epsCs: epsCs(xi), epsCi: epsCi(xi), psi, lam, epsS: epsS(xi), alphaS: aS, sigmaS: aS * fyd, epsSP: epsSP(xi), alphaSP: a, sigmaSP: a * fyd, ...toNM(p, nu, mu) };
    };
    // campionamento: ξ = ξ0 + u/(1 − u) (fitto vicino a x = h), più il punto all'infinito
    const xs = Array.from({ length: 80 }, (_, i) => { const u = i / 80; return xi0 + u / (1 - u); });
    if (has6b && xi6ab > xi0) xs.push(xi6ab);
    const curve = [...xs.sort((a, b) => a - b).map(point), point(Infinity)];
    // massima compressione pura: μ = 0 nel campo 6 (bisezione), se c'è un cambio di segno
    let pureComp = null;
    const mu0 = point(xi0).mu * p.sign, muInf = point(Infinity).mu * p.sign;
    if (Math.abs(muInf) < 1e-9) pureComp = point(Infinity);   // armatura "bilanciata": M = 0 solo all'infinito
    else if (mu0 * muInf < 0) {
        let a = xi0, b = xi0 + 1;
        while (point(b).mu * p.sign * mu0 > 0 && b < 1e7) b = xi0 + (b - xi0) * 2;
        if (point(b).mu * p.sign * mu0 <= 0) {
            for (let k = 0; k < 80; k++) { const m = (a + b) / 2; if (point(m).mu * p.sign * mu0 > 0) a = m; else b = m; }
            pureComp = point((a + b) / 2);
        }
    }
    return { xi0, t, tD, epsC2, xi6ab, x6ab: xi6ab * d, has6b, epsS, epsSP, epsCs, epsCi, strain, sub, alphaSP, alphaS, coef, point, curve, pureComp, epsAs56: epsS(xi0), epsS56: epsSP(xi0) };
}
// pivot C: piano di deformazione per F (stesso integratore a strisce)
export function numericPivotC(p, xi) {
    const t = ((p.epsCu - EPS_C2) * p.h) / p.epsCu;
    if (xi === Infinity) return numericPivotA(p, xi, () => -EPS_C2);
    return numericPivotA(p, xi, (y) => (-EPS_C2 * (xi * p.d - y)) / (xi * p.d - t));
}

// Trazione pura massima (M = 0) quando h/2 non è il baricentro delle resistenze
// (appunti p. 76): collassano le barre del lato "più debole" a momento e le
// altre restano sotto lo snervamento.
export function pureTension(input) {
    const p = branchParams(input, 1);
    const RS = p.As * p.fyd * (p.h / 2 - p.dInf);   // momento di A_s a snervamento
    const RSP = p.AsP * p.fyd * (p.h / 2 - p.dSup); // momento di A'_s a snervamento
    if (Math.abs(RS - RSP) < 1e-6 * Math.max(RS, RSP, 1)) {
        return { centroid: true, N: -(p.As + p.AsP) * p.fyd / 1000, sigmaS: p.fyd, sigmaSP: p.fyd };
    }
    if (RS > RSP) {
        // A'_s snervata, A_s con σ_s = A'_s f_yd (h/2 − d'') / [A_s (h/2 − d')]
        const sigmaS = RSP / (p.As * (p.h / 2 - p.dInf));
        return { centroid: false, yielded: "AsP", sigmaS, sigmaSP: p.fyd, N: -(p.As * sigmaS + p.AsP * p.fyd) / 1000 };
    }
    const sigmaSP = RS / (p.AsP * (p.h / 2 - p.dSup));
    return { centroid: false, yielded: "As", sigmaS: p.fyd, sigmaSP, N: -(p.As * p.fyd + p.AsP * sigmaSP) / 1000 };
}

// ---------------------------------------------------------------------------
// Riferimento numerico indipendente: dato x (pivot A), piano di deformazione,
// tensioni dai legami e risultanti sommate in coordinate dimensionali.
// Calcestruzzo parabola-rettangolo integrato a strisce (nullo nel campo 1).
// ---------------------------------------------------------------------------
// pivot B (lembo compresso a ε_cu): stesso calcolo con il piano di deformazione per B
export function numericPivotB(p, xi) {
    return numericPivotA(p, xi, (y) => (p.epsCu * (y - xi * p.d)) / (xi * p.d));
}
export function numericPivotA(p, xi, epsFn = null) {
    const { b, h, d, dSup, As, AsP, fyd, fcd, epsSu } = p;
    const yS = d, ySP = dSup; // profondità delle armature dal lembo superiore del ramo
    // deformazione di trazione (positiva) alla profondità y
    const eps = epsFn ?? ((y) => (xi === -Infinity ? epsSu : (epsSu * (y - xi * d)) / (d - xi * d)));
    const sig = (e) => Math.sign(e) * Math.min(ES * Math.abs(e), fyd); // + trazione
    const Ts = As * sig(eps(yS)), TsP = AsP * sig(eps(ySP));
    let Cc = 0, McC = 0; // calcestruzzo compresso (ε < 0): strisce solo sulla zona compressa
    const yc = xi === -Infinity ? 0 : Math.min(Math.max(xi * d, 0), h);
    const n = 2000;
    for (let i = 0; i < n; i++) {
        const y = ((i + 0.5) * yc) / n, e = -eps(y);
        if (e <= 0) continue;
        const s = e >= 0.002 ? fcd : fcd * (1 - (1 - e / 0.002) ** 2);
        const dC = s * b * (yc / n);
        Cc += dC; McC += dC * (h / 2 - y);
    }
    const N = Cc - Ts - TsP;                                    // compressione +
    const M = McC + Ts * (yS - h / 2) - TsP * (h / 2 - ySP);     // rispetto ad h/2
    return { N: N / 1000, M: (p.sign * M) / 1e6 };
}

// Estensione dell'intero dominio (tutti i campi, entrambi i rami) calcolata
// numericamente con i pivot A / B / C: serve solo a fissare gli assi del
// grafico, così non cambiano scala mentre si aggiungono i campi o si muove ξ.
export function domainExtents(input) {
    let maxN = 0, maxM = 0, maxNu = 0, maxMu = 0;
    for (const sign of [1, -1]) {
        const p = branchParams(input, sign);
        const { b, h, d, dSup, As, AsP, fyd, fcd, epsSu, epsCu } = p;
        const xiAB = epsCu / (epsCu + epsSu);
        const yC = h * (1 - 0.002 / epsCu); // pivot C (ε_c2 = 2‰)
        const sig = (e) => Math.sign(e) * Math.min(ES * Math.abs(e), fyd);
        for (let i = 0; i <= 400; i++) {
            const x = -2 * h + (i / 400) * 8 * h;
            // deformazione di compressione (+) alla profondità y
            const eps = x <= xiAB * d ? (y) => (epsSu * (x - y)) / (d - x)
                : x <= h ? (y) => (epsCu * (x - y)) / x
                    : (y) => (0.002 * (x - y)) / (x - yC);
            let N = As * sig(eps(d)) + AsP * sig(eps(dSup));
            let M = As * sig(eps(d)) * (h / 2 - d) + AsP * sig(eps(dSup)) * (h / 2 - dSup);
            for (let k = 0; k < 60; k++) {
                const y = ((k + 0.5) * h) / 60, e = eps(y);
                if (e <= 0) continue;
                const s = e >= 0.002 ? fcd : fcd * (1 - (1 - e / 0.002) ** 2);
                N += s * b * (h / 60); M += s * b * (h / 60) * (h / 2 - y);
            }
            maxN = Math.max(maxN, Math.abs(N) / 1000); maxM = Math.max(maxM, Math.abs(M) / 1e6);
            maxNu = Math.max(maxNu, Math.abs(N) / p.bdf); maxMu = Math.max(maxMu, Math.abs(M) / p.bd2f);
        }
    }
    return { N: maxN, M: maxM, nu: maxNu, mu: maxMu };
}

// Confini dei campi in ξ (rette limite) e campo di appartenenza di un ξ
export function fieldLimits(p) {
    return {
        xi12: 0,
        xi23: p.epsCu / (p.epsCu + p.epsSu),   // x_H: pivot A → B
        xi34: p.epsCu / (p.epsCu + p.epsSe),   // snervamento di A_s
        xi45: 1,                               // asse neutro sull'armatura tesa
        xi56: p.h / p.d,                       // asse neutro sul lembo inferiore (1 + δ')
    };
}
export function fieldOf(p, xi) {
    const L = fieldLimits(p);
    if (xi <= L.xi12) return 1;
    if (xi <= L.xi23) return 2;
    if (xi <= L.xi34) return 3;
    if (xi <= L.xi45) return 4;
    if (xi <= L.xi56) return 5;
    return 6;
}

// Metadati dei campi (intervalli in ξ; i campi non ancora trattati restano "in attesa")
export const FIELDS = [
    { id: 1, title: "Campo 1", subtitle: "Trazione, asse neutro esterno (pivot A)", ready: true },
    { id: 2, title: "Campo 2", subtitle: "Campo delle deboli armature (pivot A)", ready: true },
    { id: 3, title: "Campo 3", subtitle: "Pivot B, acciaio snervato", ready: true },
    { id: 4, title: "Campo 4", subtitle: "Pivot B, acciaio teso non snervato", ready: true },
    { id: 5, title: "Campo 5", subtitle: "Pivot B, asse neutro sotto l'armatura tesa", ready: true },
    { id: 6, title: "Campo 6", subtitle: "Pivot C, sezione interamente compressa", ready: true },
];
