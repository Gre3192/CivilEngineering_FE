// src/lib/actions/loadData.js
//
// Categorie d'uso (NTC2018 Tab. 3.1.II) con carichi variabili q_k e
// coefficienti di combinazione psi (Tab. 2.5.I).

export const USE_CATEGORIES = [
    { id: "A", label: "A – Residenziale", qk: 2.0, psi0: 0.7, psi1: 0.5, psi2: 0.3 },
    { id: "B", label: "B – Uffici", qk: 3.0, psi0: 0.7, psi1: 0.5, psi2: 0.3 },
    { id: "C", label: "C – Ambienti affollati", qk: 4.0, psi0: 0.7, psi1: 0.7, psi2: 0.6 },
    { id: "D", label: "D – Commerciale", qk: 4.0, psi0: 0.7, psi1: 0.7, psi2: 0.6 },
    { id: "E", label: "E – Magazzini/biblioteche", qk: 6.0, psi0: 1.0, psi1: 0.9, psi2: 0.8 },
    { id: "F", label: "F – Rimesse ≤ 30 kN", qk: 2.5, psi0: 0.7, psi1: 0.7, psi2: 0.6 },
    { id: "G", label: "G – Rimesse > 30 kN", qk: 5.0, psi0: 0.7, psi1: 0.5, psi2: 0.3 },
    { id: "H", label: "H – Coperture (manutenzione)", qk: 0.5, psi0: 0.0, psi1: 0.0, psi2: 0.0 },
    { id: "neve", label: "Neve (≤ 1000 m)", qk: 1.2, psi0: 0.5, psi1: 0.2, psi2: 0.0 },
    { id: "vento", label: "Vento", qk: 1.0, psi0: 0.6, psi1: 0.2, psi2: 0.0 },
];

export function getCategory(id) {
    return USE_CATEGORIES.find((c) => c.id === id) || USE_CATEGORIES[0];
}
