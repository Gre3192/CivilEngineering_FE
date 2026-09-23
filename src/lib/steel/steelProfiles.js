// src/lib/steel/steelProfiles.js
//
// Libreria di profili laminati (valori nominali da sagomari).
// A [mm^2], Iy/Iz [mm^4], Wely/Wply/Welz/Wplz [mm^3], iy/iz [mm], Avz [mm^2].

export const STEEL_PROFILES = [
    { id: "IPE200", A: 2850, h: 200, b: 100, Iy: 1943e4, Wely: 194e3, Wply: 221e3, iy: 82.6, Iz: 142e4, iz: 22.4, Avz: 1400 },
    { id: "IPE240", A: 3910, h: 240, b: 120, Iy: 3892e4, Wely: 324e3, Wply: 367e3, iy: 99.7, Iz: 284e4, iz: 26.9, Avz: 1910 },
    { id: "IPE300", A: 5380, h: 300, b: 150, Iy: 8356e4, Wely: 557e3, Wply: 628e3, iy: 124.6, Iz: 604e4, iz: 33.5, Avz: 2570 },
    { id: "IPE360", A: 7270, h: 360, b: 170, Iy: 16270e4, Wely: 904e3, Wply: 1019e3, iy: 149.5, Iz: 1043e4, iz: 37.9, Avz: 3510 },
    { id: "IPE450", A: 9880, h: 450, b: 190, Iy: 33740e4, Wely: 1500e3, Wply: 1702e3, iy: 184.8, Iz: 1676e4, iz: 41.2, Avz: 5080 },
    { id: "HEA200", A: 5380, h: 190, b: 200, Iy: 3692e4, Wely: 389e3, Wply: 429e3, iy: 82.8, Iz: 1336e4, iz: 49.8, Avz: 1810 },
    { id: "HEA240", A: 7680, h: 230, b: 240, Iy: 7763e4, Wely: 675e3, Wply: 745e3, iy: 100.5, Iz: 2769e4, iz: 60.0, Avz: 2530 },
    { id: "HEB200", A: 7810, h: 200, b: 200, Iy: 5696e4, Wely: 570e3, Wply: 643e3, iy: 85.4, Iz: 2003e4, iz: 50.7, Avz: 2480 },
    { id: "HEB240", A: 10600, h: 240, b: 240, Iy: 11260e4, Wely: 938e3, Wply: 1053e3, iy: 103.0, Iz: 3923e4, iz: 60.8, Avz: 3320 },
    { id: "HEB300", A: 14900, h: 300, b: 300, Iy: 25170e4, Wely: 1678e3, Wply: 1869e3, iy: 129.9, Iz: 8563e4, iz: 75.8, Avz: 4720 },
];

export function getProfile(id) {
    return STEEL_PROFILES.find((p) => p.id === id) || STEEL_PROFILES[2];
}
