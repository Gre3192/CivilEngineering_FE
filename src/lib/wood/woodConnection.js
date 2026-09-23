// src/lib/wood/woodConnection.js
//
// Capacita' portante di un connettore a gambo cilindrico (spinotto/bullone/
// chiodo) in unioni legno-legno, secondo EC5 par. 8.2 (teoria di Johansen).
// Effetto fune (Fax) trascurato a favore di sicurezza.
//
//   fh,0,k = 0.082 (1-0.01 d) rho_k           (spinotti/bulloni, preforo)
//   fh,k   = 0.082 rho_k d^-0.3               (chiodi, senza preforo)
//   My,Rk  = 0.3 fu,k d^2.6
//   Fv,Rd  = kmod Fv,Rk / gamma_M
//
// Forze in N, lunghezze mm, tensioni N/mm^2.

import { getTimber, kmod as kmodFn } from "./woodMaterials.js";

const GAMMA_M_CONN = 1.5; // NTC Tab. 4.4.III (unioni)

export const FASTENER_TYPES = [
    { id: "dowel", label: "Spinotto / bullone (preforo)" },
    { id: "nail", label: "Chiodo (senza preforo)" },
];

export const DEFAULT_CONN_INPUT = {
    timber: "C24",
    fastener: "dowel",
    d: 12, // diametro [mm]
    fuk: 400, // resistenza a trazione connettore [N/mm^2]
    t1: 40, // spessore elemento laterale [mm]
    t2: 80, // spessore elemento centrale/secondo [mm]
    shear: "double", // "single" o "double"
    n: 4, // numero connettori
    serviceClass: "1",
    duration: "media",
};

function embedment(type, d, rhok) {
    if (type === "nail") return 0.082 * rhok * Math.pow(d, -0.3);
    return 0.082 * (1 - 0.01 * d) * rhok;
}

export function woodConnection(input) {
    const { timber, fastener, d, fuk, t1, t2, shear, n, serviceClass, duration } = input;
    const errors = [];
    if (!(d > 0)) errors.push("Il diametro deve essere positivo.");
    if (!(t1 > 0 && t2 > 0)) errors.push("Gli spessori devono essere positivi.");
    if (errors.length > 0) return { ok: false, errors };

    const t = getTimber(timber);
    const rhok = t.rhok;
    const km = kmodFn(serviceClass, duration);

    const fh1 = embedment(fastener, d, rhok);
    const fh2 = fh1; // stessa specie per entrambi gli elementi
    const beta = fh2 / fh1;
    const My = 0.3 * fuk * Math.pow(d, 2.6);

    let modes = {};
    let FvRk;

    if (shear === "single") {
        const r = t2 / t1;
        const a = fh1 * t1 * d;
        const b = fh2 * t2 * d;
        const c =
            ((fh1 * t1 * d) / (1 + beta)) *
            (Math.sqrt(beta + 2 * beta * beta * (1 + r + r * r) + beta ** 3 * r * r) - beta * (1 + r));
        const dd =
            1.05 *
            ((fh1 * t1 * d) / (2 + beta)) *
            (Math.sqrt(2 * beta * (1 + beta) + (4 * beta * (2 + beta) * My) / (fh1 * d * t1 * t1)) - beta);
        const e =
            1.05 *
            ((fh1 * t2 * d) / (1 + 2 * beta)) *
            (Math.sqrt(2 * beta * beta * (1 + beta) + (4 * beta * (1 + 2 * beta) * My) / (fh1 * d * t2 * t2)) - beta);
        const f = 1.15 * Math.sqrt((2 * beta) / (1 + beta)) * Math.sqrt(2 * My * fh1 * d);
        modes = { a, b, c, d: dd, e, f };
        FvRk = Math.min(a, b, c, dd, e, f);
    } else {
        // Doppia sezione: t1 laterale, t2 centrale
        const g = fh1 * t1 * d;
        const h = 0.5 * fh2 * t2 * d;
        const j =
            1.05 *
            ((fh1 * t1 * d) / (2 + beta)) *
            (Math.sqrt(2 * beta * (1 + beta) + (4 * beta * (2 + beta) * My) / (fh1 * d * t1 * t1)) - beta);
        const k = 1.15 * Math.sqrt((2 * beta) / (1 + beta)) * Math.sqrt(2 * My * fh1 * d);
        modes = { g, h, j, k };
        FvRk = Math.min(g, h, j, k); // per piano di taglio
    }

    const planes = shear === "double" ? 2 : 1;
    const FvRkPerFastener = FvRk * planes;
    const FvRd = (km * FvRkPerFastener) / GAMMA_M_CONN;
    const FtotRd = FvRd * n;

    // modo governante
    const modeEntries = Object.entries(modes);
    const governingMode = modeEntries.reduce((a, c) => (c[1] < a[1] ? c : a), modeEntries[0]);

    return {
        ok: true,
        errors: [],
        rhok,
        km,
        gammaM: GAMMA_M_CONN,
        fh1,
        beta,
        My,
        modes,
        governingMode: governingMode[0],
        FvRk,
        planes,
        FvRkPerFastener,
        FvRd,
        n,
        FtotRd,
    };
}
