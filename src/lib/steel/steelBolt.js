// src/lib/steel/steelBolt.js
//
// Resistenza di un'unione bullonata a taglio secondo NTC2018 par. 4.2.8.1.1 /
// EC3 Tab. 3.4.
//   Fv,Rd = av fub As / gM2   (per piano di taglio)
//   Fb,Rd = k1 ab fu d t / gM2  (rifollamento)
//   Ft,Rd = 0.9 fub As / gM2  (trazione)
// Resistenza per bullone = min(Fv,Rd, Fb,Rd).

import { getGrade, getBoltClass, getBoltSize, GAMMA_M2 } from "./steelData.js";

export const DEFAULT_BOLT_INPUT = {
    grade: "S275", // acciaio piastra (fu)
    d: 20,
    boltClass: "8.8",
    planes: 1, // piani di taglio
    t: 10, // spessore piastra [mm]
    e1: 40,
    p1: 60,
    e2: 40,
    p2: 60,
    clearance: 2, // gioco foro [mm]
    nBolts: 4,
    NEd: 200, // [kN]
};

export function steelBolt(input) {
    const { grade, d, boltClass, planes, t, e1, p1, e2, p2, clearance, nBolts, NEd: NEd_kN } = input;
    const g = getGrade(grade);
    const bc = getBoltClass(boltClass);
    const size = getBoltSize(d);
    const As = size.As;
    const fu = g.ftk;
    const d0 = d + clearance;

    // Taglio
    const FvRd = (bc.av * bc.fub * As * planes) / GAMMA_M2;

    // Rifollamento
    const alphaD = Math.min(e1 / (3 * d0), p1 / (3 * d0) - 0.25);
    const alphaB = Math.min(alphaD, bc.fub / fu, 1.0);
    const k1 = Math.min(2.8 * (e2 / d0) - 1.7, 1.4 * (p2 / d0) - 1.7, 2.5);
    const FbRd = (k1 * alphaB * fu * d * t) / GAMMA_M2;

    // Trazione
    const FtRd = (0.9 * bc.fub * As) / GAMMA_M2;

    const FperBolt = Math.min(FvRd, FbRd);
    const governing = FvRd <= FbRd ? "taglio" : "rifollamento";
    const FjointRd = FperBolt * nBolts;

    const NEd = NEd_kN * 1000;
    const utilization = FjointRd > 0 ? NEd / FjointRd : Infinity;
    const verified = utilization <= 1;

    return {
        ok: true,
        As,
        fu,
        fub: bc.fub,
        d0,
        FvRd: FvRd / 1000,
        alphaB,
        k1,
        FbRd: FbRd / 1000,
        FtRd: FtRd / 1000,
        FperBolt: FperBolt / 1000,
        governing,
        nBolts,
        FjointRd: FjointRd / 1000,
        utilization,
        verified,
    };
}
