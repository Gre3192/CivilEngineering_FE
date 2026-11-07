// src/lib/concrete/materialTables.js
//
// Caratteristiche delle classi di calcestruzzo e degli acciai da c.a. secondo
// NTC 2018 (§4.1.2.1, §11.2.10, §11.3.2) ed Eurocodice 2 (Tab. 3.1).
// I valori del calcestruzzo derivano da fck con le formule normative
// (arrotondati come nelle tabelle).

// Classi di resistenza previste dalle NTC 2018 (Tab. 4.1.I)
const CLASSES = [
    [8, 10], [12, 15], [16, 20], [20, 25], [25, 30], [28, 35], [30, 37], [32, 40], [35, 45],
    [40, 50], [45, 55], [50, 60], [55, 67], [60, 75], [70, 85], [80, 95], [90, 105],
];

/**
 * Righe della tabella del calcestruzzo:
 *  fcm = fck + 8; fctm = 0,30 fck^(2/3) (≤ C50/60) oppure 2,12 ln(1 + fcm/10);
 *  fctk,0.05 = 0,7 fctm; fctk,0.95 = 1,3 fctm; Ecm = 22000 (fcm/10)^0,3;
 *  deformazioni εc1, εcu1 (legame non lineare), εc2, εcu2, n (parabola-rettangolo),
 *  εc3, εcu3 (triangolo-rettangolo); stesso ordine dell'EC2 Tab. 3.1.
 */
export function concreteTable() {
    return CLASSES.map(([fck, Rck]) => {
        const fcm = fck + 8;
        const fctm = fck <= 50 ? 0.3 * Math.pow(fck, 2 / 3) : 2.12 * Math.log(1 + fcm / 10);
        const high = fck > 50;
        const k = Math.pow((90 - fck) / 100, 4);
        return {
            id: `C${fck}/${Rck}`,
            fck,
            Rck,
            fcm,
            fctm,
            fctk005: 0.7 * fctm,
            fctk095: 1.3 * fctm,
            Ecm: 22000 * Math.pow(fcm / 10, 0.3),
            epsC1: Math.min(0.7 * Math.pow(fcm, 0.31), 2.8),                // ‰
            epsCu1: high ? 2.8 + 27 * Math.pow((98 - fcm) / 100, 4) : 3.5,  // ‰
            epsC2: high ? 2.0 + 0.085 * Math.pow(fck - 50, 0.53) : 2.0,   // ‰
            epsCu2: high ? 2.6 + 35 * k : 3.5,                              // ‰
            epsC3: high ? 1.75 + 0.55 * (fck - 50) / 40 : 1.75,             // ‰
            epsCu3: high ? 2.6 + 35 * k : 3.5,                              // ‰
            n: high ? 1.4 + 23.4 * k : 2.0,
        };
    });
}

/**
 * Acciai da cemento armato (NTC 2018 Tab. 11.3.Ia / 11.3.Ib): tensioni
 * nominali, rapporti caratteristici, allungamento Agt,k, diametri ammessi.
 * fyd = fyk / 1,15; εud = 0,9 εuk (εuk = Agt,k).
 */
export const STEEL_TABLE = [
    { id: "B450C", fyNom: 450, ftNom: 540, fyk: "≥ 450", ftk: "≥ 540", ftfy: "≥ 1,15 e < 1,35", fyfyNom: "≤ 1,25", Agt: 7.5, diameters: "6 ÷ 40" },
    { id: "B450A", fyNom: 450, ftNom: 540, fyk: "≥ 450", ftk: "≥ 540", ftfy: "≥ 1,05", fyfyNom: "≤ 1,25", Agt: 2.5, diameters: "5 ÷ 10" },
].map((s) => ({ ...s, Es: 200000, fyd: s.fyNom / 1.15, epsYd: (s.fyNom / 1.15 / 200000) * 1000, epsUd: 0.9 * s.Agt * 10 }));
