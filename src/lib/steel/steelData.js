// src/lib/steel/steelData.js
//
// Dati dei materiali e coefficienti per l'acciaio secondo NTC2018 par. 4.2 / EC3.
// Tensioni in N/mm^2, aree mm^2, lunghezze mm.

export const E_STEEL = 210000; // modulo elastico [MPa]

// Coefficienti parziali (NTC2018 par. 4.2.4.1.1)
export const GAMMA_M0 = 1.05; // resistenza sezioni
export const GAMMA_M1 = 1.05; // resistenza all'instabilita'
export const GAMMA_M2 = 1.25; // resistenza sezioni forate / unioni

// Acciai da carpenteria (t <= 40 mm). betaW per le saldature (EC3 4.5.3.2)
export const STEEL_GRADES = [
    { id: "S235", fyk: 235, ftk: 360, betaW: 0.8 },
    { id: "S275", fyk: 275, ftk: 430, betaW: 0.85 },
    { id: "S355", fyk: 355, ftk: 510, betaW: 0.9 },
    { id: "S420", fyk: 420, ftk: 520, betaW: 1.0 },
    { id: "S460", fyk: 460, ftk: 540, betaW: 1.0 },
];

export function getGrade(id) {
    return STEEL_GRADES.find((g) => g.id === id) || STEEL_GRADES[2];
}

// Classi dei bulloni (NTC Tab. 4.2.XII): fyb, fub [N/mm^2]
export const BOLT_CLASSES = [
    { id: "4.6", fyb: 240, fub: 400, av: 0.6 },
    { id: "5.6", fyb: 300, fub: 500, av: 0.6 },
    { id: "6.8", fyb: 480, fub: 600, av: 0.5 },
    { id: "8.8", fyb: 640, fub: 800, av: 0.6 },
    { id: "10.9", fyb: 900, fub: 1000, av: 0.5 },
];

export function getBoltClass(id) {
    return BOLT_CLASSES.find((b) => b.id === id) || BOLT_CLASSES[3];
}

// Bulloni: diametro d [mm], area resistente As [mm^2]
export const BOLT_SIZES = [
    { d: 12, As: 84.3 },
    { d: 14, As: 115 },
    { d: 16, As: 157 },
    { d: 18, As: 192 },
    { d: 20, As: 245 },
    { d: 22, As: 303 },
    { d: 24, As: 353 },
    { d: 27, As: 459 },
    { d: 30, As: 561 },
];

export function getBoltSize(d) {
    return BOLT_SIZES.find((b) => b.d === Number(d)) || BOLT_SIZES[4];
}

// Curve di instabilita' - fattore di imperfezione alpha (EC3 Tab. 6.1)
export const BUCKLING_CURVES = [
    { id: "a0", label: "a0", alpha: 0.13 },
    { id: "a", label: "a", alpha: 0.21 },
    { id: "b", label: "b", alpha: 0.34 },
    { id: "c", label: "c", alpha: 0.49 },
    { id: "d", label: "d", alpha: 0.76 },
];

export function getCurve(id) {
    return BUCKLING_CURVES.find((c) => c.id === id) || BUCKLING_CURVES[2];
}

export function epsilon(fyk) {
    return Math.sqrt(235 / fyk);
}
