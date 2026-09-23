// src/lib/actions/windLoad.js
//
// Azione del vento secondo NTC2018 par. 3.3.
//   vb = vb,0 * ca                         (velocita' base di riferimento)
//   vr = vb * cr                           (velocita' di riferimento, Tr)
//   qb = 0.5 * rho * vr^2                   (pressione cinetica di riferimento)
//   ce(z) = kr^2 ct ln(z/z0) [7 + ct ln(z/z0)]   (coeff. di esposizione)
//   p = qb * ce * cp * cd                   (pressione sulla superficie)
// rho = 1.25 kg/m^3.

const RHO = 1.25; // densita' dell'aria [kg/m^3]

// Tab. 3.3.I - zone (vb0 [m/s], a0 [m], ks [-])
export const WIND_ZONES = [
    { id: "1", label: "1 – VdA, Piemonte, Lombardia, ...", vb0: 25, a0: 1000, ks: 0.4 },
    { id: "2", label: "2 – Friuli VG, Veneto", vb0: 25, a0: 750, ks: 0.45 },
    { id: "3", label: "3 – Toscana, Marche, Umbria, ...", vb0: 27, a0: 500, ks: 0.37 },
    { id: "4", label: "4 – Lazio, Campania, ...", vb0: 28, a0: 500, ks: 0.36 },
    { id: "5", label: "5 – Emilia-Romagna", vb0: 28, a0: 750, ks: 0.4 },
    { id: "6", label: "6 – Puglia, ...", vb0: 28, a0: 500, ks: 0.36 },
    { id: "7", label: "7 – Basilicata, Calabria", vb0: 28, a0: 500, ks: 0.36 },
    { id: "8", label: "8 – Liguria", vb0: 30, a0: 500, ks: 0.37 },
    { id: "9", label: "9 – Sicilia, Sardegna", vb0: 31, a0: 500, ks: 0.32 },
];

// Tab. 3.3.II - categorie di esposizione (kr, z0 [m], zmin [m])
export const TERRAIN_CATEGORIES = [
    { id: "I", label: "I – mare / lago", kr: 0.17, z0: 0.01, zmin: 2 },
    { id: "II", label: "II – aperta con ostacoli radi", kr: 0.19, z0: 0.05, zmin: 4 },
    { id: "III", label: "III – suburbana / boschi", kr: 0.2, z0: 0.1, zmin: 5 },
    { id: "IV", label: "IV – urbana", kr: 0.22, z0: 0.3, zmin: 8 },
    { id: "V", label: "V – centri urbani estesi", kr: 0.23, z0: 0.7, zmin: 12 },
];

export const DEFAULT_WIND_INPUT = {
    zone: "3",
    as: 100, // altitudine sito [m]
    terrain: "II",
    z: 10, // quota sul suolo [m]
    ct: 1.0, // coeff. topografico
    cp: 0.8, // coeff. di pressione
    cd: 1.0, // coeff. dinamico
    Tr: 50, // periodo di ritorno [anni]
};

export function windLoad(input) {
    const { zone, as, terrain, z, ct, cp, cd, Tr } = input;
    const errors = [];
    if (!(z > 0)) errors.push("La quota z deve essere positiva.");
    if (errors.length > 0) return { ok: false, errors };

    const zn = WIND_ZONES.find((w) => w.id === zone) || WIND_ZONES[0];
    const tc = TERRAIN_CATEGORIES.find((t) => t.id === terrain) || TERRAIN_CATEGORIES[1];

    // Coefficiente di altitudine ca
    const ca = as <= zn.a0 ? 1 : 1 + zn.ks * (as / zn.a0 - 1);
    const vb = zn.vb0 * ca;

    // Coefficiente di ritorno cr
    let cr = 1;
    if (Tr && Tr !== 50 && Tr > 1) {
        cr = 0.75 * Math.sqrt(1 - 0.2 * Math.log(-Math.log(1 - 1 / Tr)));
    }
    const vr = vb * cr;

    // Pressione cinetica di riferimento [N/m^2]
    const qb = 0.5 * RHO * vr * vr;

    // Coefficiente di esposizione ce(z)
    const zEff = Math.max(z, tc.zmin);
    const lnz = Math.log(zEff / tc.z0);
    const ce = tc.kr * tc.kr * ct * lnz * (7 + ct * lnz);

    // Pressione sulla superficie [N/m^2]
    const p = qb * ce * cp * cd;

    return {
        ok: true,
        errors: [],
        ca,
        vb,
        cr,
        vr,
        qb,
        zEff,
        ce,
        p,
        kr: tc.kr,
        z0: tc.z0,
        zmin: tc.zmin,
    };
}
