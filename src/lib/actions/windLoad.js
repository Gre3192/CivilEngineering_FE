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

// NTC 2018 Tab. 3.3.I - zone (v_b,0 [m/s], a_0 [m], k_s [-])
//   c_a = 1                          per a_s <= a_0
//   c_a = 1 + k_s (a_s/a_0 - 1)      per a_0 < a_s <= 1500 m
export const WIND_ZONES = [
    { id: "1", label: "Zona 1", where: "Valle d'Aosta, Piemonte, Lombardia, Trentino-Alto Adige, Veneto, Friuli-Venezia Giulia (esclusa la provincia di Trieste)", vb0: 25, a0: 1000, ks: 0.4 },
    { id: "2", label: "Zona 2", where: "Emilia-Romagna", vb0: 25, a0: 750, ks: 0.45 },
    { id: "3", label: "Zona 3", where: "Toscana, Marche, Umbria, Lazio, Abruzzo, Molise, Puglia, Campania, Basilicata, Calabria (esclusa la provincia di Reggio Calabria)", vb0: 27, a0: 500, ks: 0.37 },
    { id: "4", label: "Zona 4", where: "Sicilia e provincia di Reggio Calabria", vb0: 28, a0: 500, ks: 0.36 },
    { id: "5", label: "Zona 5", where: "Sardegna, a oriente della retta Capo Teulada – Isola della Maddalena", vb0: 28, a0: 750, ks: 0.4 },
    { id: "6", label: "Zona 6", where: "Sardegna, a occidente della retta Capo Teulada – Isola della Maddalena", vb0: 28, a0: 500, ks: 0.36 },
    { id: "7", label: "Zona 7", where: "Liguria", vb0: 28, a0: 1000, ks: 0.54 },
    { id: "8", label: "Zona 8", where: "Provincia di Trieste", vb0: 30, a0: 1500, ks: 0.5 },
    { id: "9", label: "Zona 9", where: "Isole (esclusi Sicilia e Sardegna) e mare aperto", vb0: 31, a0: 500, ks: 0.32 },
];

// zona per provincia (per sigla); "S" = Sardegna, zona 5 o 6 secondo la retta
const ZONE_PROVINCES = {
    1: "AO AL AT BI CN NO TO VB VC BG BS CO CR LC LO MB MI MN PV SO VA BZ TN BL PD RO TV VE VI VR GO PN UD",
    2: "BO FC FE MO PC PR RA RE RN",
    3: "AR FI GR LI LU MS PI PO PT SI AN AP FM MC PU PG TR FR LT RI RM VT AQ CH PE TE CB IS BA BR BT FG LE TA AV BN CE NA SA MT PZ CS CZ KR VV",
    4: "AG CL CT EN ME PA RG SR TP RC",
    S: "CA CI NU OG OR OT SS VS",
    7: "GE IM SP SV",
    8: "TS",
};
export const WIND_PROVINCE_ZONE = Object.fromEntries(
    Object.entries(ZONE_PROVINCES).flatMap(([z, list]) => list.split(" ").map((sg) => [sg, z])),
);
export const isSardinia = (sigla) => WIND_PROVINCE_ZONE[sigla] === "S";
// zone ammesse per una provincia: quella della regione (5 o 6 in Sardegna) e la 9
// (isole minori e mare aperto, che sulla mappa non compaiono)
export const allowedWindZones = (sigla) => (isSardinia(sigla) ? ["5", "6", "9"] : WIND_PROVINCE_ZONE[sigla] ? [WIND_PROVINCE_ZONE[sigla], "9"] : WIND_ZONES.map((z) => z.id));

// colori delle zone sulla mappa (qualitativi: ogni zona riconoscibile)
export const WIND_ZONE_COLORS = {
    1: "#7dd3fc", 2: "#6ee7b7", 3: "#fde68a", 4: "#fdba74", 5: "#c4b5fd",
    6: "#f9a8d4", 7: "#bef264", 8: "#fca5a5", 9: "#a5b4fc",
};

// Tab. 3.3.II - categorie di esposizione (kr, z0 [m], zmin [m])
export const TERRAIN_CATEGORIES = [
    { id: "I", label: "I – mare / lago", kr: 0.17, z0: 0.01, zmin: 2 },
    { id: "II", label: "II – aperta con ostacoli radi", kr: 0.19, z0: 0.05, zmin: 4 },
    { id: "III", label: "III – suburbana / boschi", kr: 0.2, z0: 0.1, zmin: 5 },
    { id: "IV", label: "IV – urbana", kr: 0.22, z0: 0.3, zmin: 8 },
    { id: "V", label: "V – centri urbani estesi", kr: 0.23, z0: 0.7, zmin: 12 },
];

// NTC 2018 Tab. 3.3.III - classi di rugosità del terreno
export const ROUGHNESS_CLASSES = [
    { id: "A", label: "A – aree urbane con almeno il 15% della superficie coperto da edifici di altezza media > 15 m" },
    { id: "B", label: "B – aree urbane (non di classe A), suburbane, industriali e boschive" },
    { id: "C", label: "C – aree con ostacoli diffusi (alberi, case, muri, recinzioni…); aree non riconducibili ad A, B, D" },
    { id: "D", label: "D – mare e fascia costiera entro 2 km; lago (largo ≥ 1 km) e fascia entro 1 km; aree prive di ostacoli o con rari ostacoli isolati (aperta campagna, aeroporti, aree agricole, pascoli, zone paludose o sabbiose, superfici innevate o ghiacciate)" },
];

// NTC 2018 Fig. 3.3.2 - categoria di esposizione da zona, classe di rugosità,
// distanza dalla costa e altitudine. Fasce di distanza come nella figura:
// 2 km, poi 10 km, poi 30 km (cumulate: 2, 12, 42 km; la norma precisa che entro
// circa 40 km dalla costa la categoria non dipende dall'altitudine).
// null = classe non ammessa (entro 2 km dalla costa la classe è D).
const FIG_332 = {
    "1-5": {
        bands: ["entro 2 km dalla costa", "2–12 km", "12–42 km", "oltre 42 km, a_s ≤ 500 m", "oltre 42 km, 500 < a_s ≤ 750 m", "oltre 42 km, a_s > 750 m"],
        A: [null, "IV", "IV", "V", "V", "V"],
        B: [null, "III", "III", "IV", "IV", "IV"],
        C: [null, "*", "III", "III", "IV", "IV"],          // * II in zona 1,2,3,4; III in zona 5
        D: ["I", "II", "II", "II", "III", "**"],          // ** III in zona 2,3,4,5; IV in zona 1
    },
    6: {
        bands: ["entro 2 km dalla costa", "2–12 km", "12–42 km", "oltre 42 km, a_s ≤ 500 m", "oltre 42 km, a_s > 500 m"],
        A: [null, "III", "IV", "V", "V"],
        B: [null, "II", "III", "IV", "IV"],
        C: [null, "II", "III", "III", "IV"],
        D: ["I", "I", "II", "II", "III"],
    },
    "7-8": {
        bands: ["entro 1,5 km dalla costa", "1,5–2 km", "oltre 2 km"],
        A: [null, null, "IV"],
        B: [null, null, "IV"],
        C: [null, null, "III"],
        D: ["I", "II", "*"],                              // * II in zona 8; III in zona 7
    },
    9: {
        bands: ["mare", "costa"],
        A: [null, "I"], B: [null, "I"], C: [null, "I"], D: ["I", "I"],
    },
};
const figKey = (zone) => (["1", "2", "3", "4", "5"].includes(zone) ? "1-5" : zone === "6" ? 6 : zone === "7" || zone === "8" ? "7-8" : 9);
export const exposureFigure = (zone) => FIG_332[figKey(zone)];

// fascia della figura per distanza [km] e altitudine [m]
export function exposureBand(zone, dist, as) {
    const k = figKey(zone);
    if (k === 9) return dist <= 0 ? 0 : 1;
    if (k === "7-8") return dist <= 1.5 ? 0 : dist <= 2 ? 1 : 2;
    if (dist <= 2) return 0;
    if (dist <= 12) return 1;
    if (dist <= 42) return 2;
    if (k === 6) return as <= 500 ? 3 : 4;
    return as <= 500 ? 3 : as <= 750 ? 4 : 5;
}

// valore di una casella, con le note della figura risolte per la zona
export function figureCell(zone, cls, band) {
    const v = FIG_332[figKey(zone)][cls][band];
    if (v === "*") return figKey(zone) === "1-5" ? (zone === "5" ? "III" : "II") : zone === "8" ? "II" : "III";
    if (v === "**") return zone === "1" ? "IV" : "III";
    return v;
}

export function exposureCategory({ zone, roughness, dist, as }) {
    const band = exposureBand(zone, dist, as);
    const cat = figureCell(zone, roughness, band);
    return { band, cat, bandLabel: FIG_332[figKey(zone)].bands[band] };
}

export const DEFAULT_WIND_INPUT = {
    province: "MI",
    comune: null,
    distRef: "centro",
    zone: "1",
    as: 100, // altitudine sito [m]
    terrain: "II",
    catMode: "auto", // categoria di esposizione: "auto" (Fig. 3.3.2) o "manual"
    roughness: "C", // classe di rugosità (Tab. 3.3.III)
    dist: 50, // distanza dalla costa [km]
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
