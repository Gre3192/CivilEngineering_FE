// src/lib/wood/woodMaterials.js
//
// Dati dei materiali legno e coefficienti secondo NTC2018 par. 4.4 / EC5.
// Valori caratteristici in N/mm^2 (MPa), densita' in kg/m^3.

export const TIMBER_CLASSES = [
    // Legno massiccio (EN 338)
    { id: "C16", type: "solid", fmk: 16, ft0k: 10, ft90k: 0.4, fc0k: 17, fc90k: 2.2, fvk: 3.2, E0mean: 8000, E005: 5400, Gmean: 500, rhok: 310 },
    { id: "C24", type: "solid", fmk: 24, ft0k: 14, ft90k: 0.4, fc0k: 21, fc90k: 2.5, fvk: 4.0, E0mean: 11000, E005: 7400, Gmean: 690, rhok: 350 },
    { id: "C27", type: "solid", fmk: 27, ft0k: 16.5, ft90k: 0.4, fc0k: 22, fc90k: 2.6, fvk: 4.0, E0mean: 11500, E005: 7700, Gmean: 720, rhok: 370 },
    { id: "C30", type: "solid", fmk: 30, ft0k: 18, ft90k: 0.4, fc0k: 23, fc90k: 2.7, fvk: 4.0, E0mean: 12000, E005: 8000, Gmean: 750, rhok: 380 },
    // Legno lamellare incollato (EN 14080)
    { id: "GL24h", type: "glulam", fmk: 24, ft0k: 19.2, ft90k: 0.5, fc0k: 24, fc90k: 2.5, fvk: 3.5, E0mean: 11500, E005: 9600, Gmean: 650, rhok: 385 },
    { id: "GL28h", type: "glulam", fmk: 28, ft0k: 22.3, ft90k: 0.5, fc0k: 28, fc90k: 2.5, fvk: 3.5, E0mean: 12600, E005: 10200, Gmean: 650, rhok: 425 },
    { id: "GL32h", type: "glulam", fmk: 32, ft0k: 25.6, ft90k: 0.5, fc0k: 32, fc90k: 2.5, fvk: 3.5, E0mean: 14200, E005: 11800, Gmean: 650, rhok: 440 },
];

export function getTimber(id) {
    return TIMBER_CLASSES.find((t) => t.id === id) || TIMBER_CLASSES[1];
}

export const SERVICE_CLASSES = [
    { id: "1", label: "Classe 1 (interno riscaldato)" },
    { id: "2", label: "Classe 2 (coperto non riscaldato)" },
    { id: "3", label: "Classe 3 (esterno)" },
];

export const LOAD_DURATIONS = [
    { id: "permanente", label: "Permanente" },
    { id: "lunga", label: "Lunga" },
    { id: "media", label: "Media" },
    { id: "breve", label: "Breve" },
    { id: "istantanea", label: "Istantanea" },
];

// k_mod (EC5 Tab. 3.1.3 / NTC Tab. 4.4.IV) per legno massiccio e lamellare.
const KMOD = {
    1: { permanente: 0.6, lunga: 0.7, media: 0.8, breve: 0.9, istantanea: 1.1 },
    2: { permanente: 0.6, lunga: 0.7, media: 0.8, breve: 0.9, istantanea: 1.1 },
    3: { permanente: 0.5, lunga: 0.55, media: 0.65, breve: 0.7, istantanea: 0.9 },
};

// k_def (EC5 Tab. 3.1.4 / NTC Tab. 4.4.V)
const KDEF = { 1: 0.6, 2: 0.8, 3: 2.0 };

export function kmod(serviceClass, duration) {
    return (KMOD[serviceClass] || KMOD[1])[duration] ?? 0.8;
}

export function kdef(serviceClass) {
    return KDEF[serviceClass] ?? 0.8;
}

// Coefficiente parziale del materiale gamma_M (NTC Tab. 4.4.III)
export function gammaM(type) {
    return type === "glulam" ? 1.45 : 1.5;
}

// Fattore di altezza k_h (EC5 3.2/3.3)
export function kh(type, h) {
    if (type === "glulam") {
        return h < 600 ? Math.min(Math.pow(600 / h, 0.1), 1.1) : 1.0;
    }
    return h < 150 ? Math.min(Math.pow(150 / h, 0.2), 1.3) : 1.0;
}

/** Resistenza di progetto X_d = kmod * X_k / gamma_M. */
export function designStrength(Xk, km, gM) {
    return (km * Xk) / gM;
}
