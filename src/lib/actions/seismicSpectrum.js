// src/lib/actions/seismicSpectrum.js
//
// Spettro di risposta elastico e di progetto (componente orizzontale)
// secondo NTC2018 par. 3.2.3. Ordinate espresse in unita' di g.
//
//   S = SS * ST
//   TC = CC * Tc*   ;   TB = TC/3   ;   TD = 4.0 (ag/g) + 1.6
//   0<=T<TB : Se = ag S eta F0 [ T/TB + (1-T/TB)/(eta F0) ]
//   TB<=T<TC: Se = ag S eta F0
//   TC<=T<TD: Se = ag S eta F0 (TC/T)
//   T>=TD   : Se = ag S eta F0 (TC TD / T^2)
// Spettro di progetto: eta -> 1/q, con Sd >= 0.2 ag S.

export const SOIL_CATEGORIES = ["A", "B", "C", "D", "E"];

export const TOPO_CATEGORIES = [
    { id: "T1", label: "T1 (pianura)", ST: 1.0 },
    { id: "T2", label: "T2", ST: 1.2 },
    { id: "T3", label: "T3", ST: 1.2 },
    { id: "T4", label: "T4 (cresta)", ST: 1.4 },
];

export const DEFAULT_SEISMIC_INPUT = {
    agG: 0.15, // ag/g
    F0: 2.4,
    TcStar: 0.3, // Tc* [s]
    soil: "C",
    topo: "T1",
    q: 3.0, // fattore di comportamento
    xi: 5, // smorzamento [%]
};

function clamp(v, lo, hi) {
    return Math.min(Math.max(v, lo), hi);
}

/** SS e CC in funzione della categoria di sottosuolo (NTC Tab. 3.2.IV/V). */
export function soilParams(soil, agG, F0, TcStar) {
    const p = F0 * agG; // F0 * ag/g
    switch (soil) {
        case "A":
            return { SS: 1.0, CC: 1.0 };
        case "B":
            return { SS: clamp(1.4 - 0.4 * p, 1.0, 1.2), CC: 1.1 * Math.pow(TcStar, -0.2) };
        case "C":
            return { SS: clamp(1.7 - 0.6 * p, 1.0, 1.5), CC: 1.05 * Math.pow(TcStar, -0.33) };
        case "D":
            return { SS: clamp(2.4 - 1.5 * p, 0.9, 1.8), CC: 1.25 * Math.pow(TcStar, -0.5) };
        case "E":
            return { SS: clamp(2.0 - 1.1 * p, 1.0, 1.6), CC: 1.15 * Math.pow(TcStar, -0.4) };
        default:
            return { SS: 1.0, CC: 1.0 };
    }
}

function spectralValue(T, agS, eta, F0, TB, TC, TD) {
    const plateau = agS * eta * F0;
    if (T < TB) return agS * eta * F0 * (T / TB + (1 - T / TB) / (eta * F0));
    if (T < TC) return plateau;
    if (T < TD) return plateau * (TC / T);
    return plateau * ((TC * TD) / (T * T));
}

export function seismicSpectrum(input) {
    const { agG, F0, TcStar, soil, topo, q, xi } = input;
    const errors = [];
    if (!(agG > 0)) errors.push("ag/g deve essere positivo.");
    if (!(F0 >= 2.2)) errors.push("F0 deve essere ≥ 2,2.");
    if (!(TcStar > 0)) errors.push("Tc* deve essere positivo.");
    if (errors.length > 0) return { ok: false, errors };

    const { SS, CC } = soilParams(soil, agG, F0, TcStar);
    const ST = (TOPO_CATEGORIES.find((t) => t.id === topo) || { ST: 1 }).ST;
    const S = SS * ST;

    const TC = CC * TcStar;
    const TB = TC / 3;
    const TD = 4.0 * agG + 1.6;

    // fattore di smorzamento (elastico)
    const eta = Math.max(Math.sqrt(10 / (5 + xi)), 0.55);
    const etaD = 1 / q; // progetto

    const agS = agG * S;
    const SdFloor = 0.2 * agS;

    // campionamento
    const points = [];
    const Tmax = 4.0;
    const n = 200;
    for (let i = 0; i <= n; i++) {
        const T = (Tmax * i) / n;
        const Se = spectralValue(T, agS, eta, F0, TB, TC, TD);
        const Sd = Math.max(spectralValue(T, agS, etaD, F0, TB, TC, TD), SdFloor);
        points.push({ T, Se, Sd });
    }

    return {
        ok: true,
        errors: [],
        SS,
        CC,
        ST,
        S,
        TB,
        TC,
        TD,
        eta,
        etaD,
        agS,
        SePlateau: agS * eta * F0,
        SdPlateau: agS * etaD * F0,
        SdFloor,
        points,
    };
}
