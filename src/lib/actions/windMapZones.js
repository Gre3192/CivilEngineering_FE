// src/lib/actions/windMapZones.js
//
// Zone del vento sulla mappa delle province: in Sardegna la zona dipende dal
// lato della retta Capo Teulada – Isola della Maddalena (NTC 2018 Tab. 3.3.I):
// zona 5 a oriente, zona 6 a occidente.

import { PROVINCES, SARDINIA_LINE } from "./italyProvincesMap.js";
import { WIND_PROVINCE_ZONE, isSardinia } from "./windLoad.js";

const [X1, Y1, X2, Y2] = SARDINIA_LINE;
// positivo a oriente della retta, negativo a occidente (coordinate della mappa)
export const sardiniaSide = (x, y) => (X2 - X1) * (y - Y1) - (Y2 - Y1) * (x - X1);
export const sardiniaZoneAt = (x, y) => (sardiniaSide(x, y) > 0 ? "5" : "6");

// zona di una provincia scelta senza un punto preciso (dall'elenco): in Sardegna
// quella del baricentro della provincia
export function defaultWindZone(sigla) {
    if (!isSardinia(sigla)) return WIND_PROVINCE_ZONE[sigla] ?? "1";
    const p = PROVINCES.find((q) => q.sigla === sigla);
    return p ? sardiniaZoneAt(p.cx, p.cy) : "5";
}
