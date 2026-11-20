// src/lib/actions/snowLoad.js
//
// Carico da neve sulle coperture secondo NTC2018 par. 3.4.
//   qs = mu_i * qsk * CE * Ct
// qsk (valore caratteristico al suolo) da Tab. 3.4.I in funzione di zona e
// altitudine as; mu_i coefficiente di forma; CE esposizione; Ct termico.

export const SNOW_ZONES = [
    { id: "I-A", label: "Zona I – Alpina", base: 1.5, k: 1.39, den: 728 },
    { id: "I-M", label: "Zona I – Mediterranea", base: 1.5, k: 1.35, den: 602 },
    { id: "II", label: "Zona II", base: 1.0, k: 0.85, den: 481 },
    { id: "III", label: "Zona III", base: 0.6, k: 0.51, den: 481 },
];

// Zone di carico della neve per provincia (NTC 2018 §3.4.2, elenco per sigla).
// Le province sarde sono quelle dell'elenco della norma (CI, VS, OG, OT comprese).
const ZONE_PROVINCES = {
    "I-A": "AO BL BG BI BZ BS CO CN LC PN SO TO TN UD VB VC VI",
    "I-M": "AL AN AT BO CR FC LO MI MO MB NO PR PV PU PC RA RE RN TV VA",
    II: "AR AP AV BA BT BN CB CH FM FE FI FG FR GE GO IM IS AQ SP LU MC MN MS PD PG PE PT PO RI RO SV TE TS VE VR",
    III: "AG BR CA CL CI CE CT CZ CS KR EN GR LT LE LI MT VS ME NA NU OG OT OR PA PI PZ RG RC RM SA SS SI SR TA TR TP VV VT",
};
export const PROVINCE_ZONE = Object.fromEntries(
    Object.entries(ZONE_PROVINCES).flatMap(([z, list]) => list.split(" ").map((sg) => [sg, z])),
);
export const zoneOfProvince = (sigla) => PROVINCE_ZONE[sigla] ?? null;

// colori delle zone sulla mappa: più intensi dove il carico al suolo è maggiore
export const SNOW_ZONE_COLORS = {
    "I-A": { fill: "#1e40af", text: "#ffffff" },
    "I-M": { fill: "#3b82f6", text: "#ffffff" },
    II: { fill: "#93c5fd", text: "#0f172a" },
    III: { fill: "#dbeafe", text: "#0f172a" },
};

export const SNOW_EXPOSURE = [
    { id: "battuta", label: "Battuta dai venti", CE: 0.9 },
    { id: "normale", label: "Normale", CE: 1.0 },
    { id: "riparata", label: "Riparata", CE: 1.1 },
];

export const DEFAULT_SNOW_INPUT = {
    zone: "I-M",
    as: 300, // altitudine [m s.l.m.]
    alpha: 15, // inclinazione falda [gradi]
    exposure: "normale",
    Ct: 1.0,
};

/** Valore caratteristico del carico neve al suolo qsk [kN/m^2]. */
export function qskGround(zoneId, as) {
    const z = SNOW_ZONES.find((s) => s.id === zoneId) || SNOW_ZONES[0];
    if (as <= 200) return z.base;
    return z.k * (1 + Math.pow(as / z.den, 2));
}

/** Coefficiente di forma mu1 per coperture a una o due falde. */
export function muOne(alpha) {
    const a = Math.abs(alpha);
    if (a <= 30) return 0.8;
    if (a < 60) return (0.8 * (60 - a)) / 30;
    return 0;
}

export function snowLoad(input) {
    const { zone, as, alpha, exposure, Ct } = input;
    const errors = [];
    if (!(as >= 0)) errors.push("L'altitudine deve essere ≥ 0.");
    if (errors.length > 0) return { ok: false, errors };

    const qsk = qskGround(zone, as);
    const mu = muOne(alpha);
    const CE = (SNOW_EXPOSURE.find((e) => e.id === exposure) || { CE: 1 }).CE;
    const qs = mu * qsk * CE * Ct;

    return {
        ok: true,
        errors: [],
        qsk,
        mu,
        CE,
        Ct,
        qs,
    };
}
