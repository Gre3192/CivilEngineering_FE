// src/lib/wood/woodSLE.js
//
// Verifica di deformabilita' (SLE) di una trave in legno appoggiata soggetta a
// carico uniforme, secondo NTC2018 par. 4.4.7 / EC5 par. 7.2.
//
//   w_inst = 5 w L^4 / (384 E0,mean I)        (freccia istantanea)
//   w_fin  = w_inst,G (1+kdef) + w_inst,Q (1 + psi2 kdef)   (freccia finale)
// Limiti tipici: w_inst <= L/300 ; w_fin <= L/250.

import { getTimber, kdef as kdefFn } from "./woodMaterials.js";

export const DEFAULT_WOOD_SLE_INPUT = {
    timber: "C24",
    serviceClass: "1",
    L: 4.5, // luce [m]
    b: 120,
    h: 240,
    g: 3.0, // permanente [kN/m]
    q: 2.0, // variabile [kN/m]
    psi2: 0.3,
    limInst: 300, // w_inst <= L/limInst
    limFin: 250, // w_fin <= L/limFin
};

function udlDeflection(wNmm, Lmm, E, I) {
    return (5 * wNmm * Math.pow(Lmm, 4)) / (384 * E * I);
}

export function woodSLE(input) {
    const { timber, serviceClass, L, b, h, g, q, psi2, limInst, limFin } = input;
    const errors = [];
    if (!(L > 0)) errors.push("La luce L deve essere positiva.");
    if (!(b > 0 && h > 0)) errors.push("Le dimensioni della sezione devono essere positive.");
    if (errors.length > 0) return { ok: false, errors };

    const t = getTimber(timber);
    const E = t.E0mean;
    const I = (b * Math.pow(h, 3)) / 12; // mm^4
    const Lmm = L * 1000;
    const kdef = kdefFn(serviceClass);

    // 1 kN/m = 1 N/mm
    const wInstG = udlDeflection(g, Lmm, E, I);
    const wInstQ = udlDeflection(q, Lmm, E, I);
    const wInst = wInstG + wInstQ;
    const wFin = wInstG * (1 + kdef) + wInstQ * (1 + psi2 * kdef);

    const limInstMm = Lmm / limInst;
    const limFinMm = Lmm / limFin;

    const uInst = wInst / limInstMm;
    const uFin = wFin / limFinMm;
    const verified = uInst <= 1 && uFin <= 1;

    return {
        ok: true,
        errors: [],
        E,
        I,
        kdef,
        wInstG,
        wInstQ,
        wInst,
        wFin,
        limInstMm,
        limFinMm,
        uInst,
        uFin,
        verified,
        Lmm,
    };
}
