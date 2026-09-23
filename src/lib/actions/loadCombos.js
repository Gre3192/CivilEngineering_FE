// src/lib/actions/loadCombos.js
//
// Combinazioni delle azioni secondo NTC2018 par. 2.5.3.
//   SLU fondamentale : gG1 G1 + gG2 G2 + gQ Qk1 + sum gQ psi0i Qki
//   SLE rara         : G1 + G2 + Qk1 + sum psi0i Qki
//   SLE frequente    : G1 + G2 + psi11 Qk1 + sum psi2i Qki
//   SLE quasi perm.  : G1 + G2 + sum psi2i Qki
//   Sismica          : E + G1 + G2 + sum psi2i Qki
// L'azione variabile "dominante" e' scelta per massimizzare la combinazione.

export const DEFAULT_COMBO_INPUT = {
    G1: 5.0, // permanenti strutturali [kN/m^2]
    G2: 3.0, // permanenti non strutturali [kN/m^2]
    gammaG1: 1.3,
    gammaG2: 1.5,
    gammaQ: 1.5,
    actions: [
        { name: "Cat. A", Qk: 2.0, psi0: 0.7, psi1: 0.5, psi2: 0.3 },
        { name: "Neve", Qk: 1.2, psi0: 0.5, psi1: 0.2, psi2: 0.0 },
        { name: "Vento", Qk: 1.0, psi0: 0.6, psi1: 0.2, psi2: 0.0 },
    ],
};

export function loadCombos(input) {
    const { G1, G2, gammaG1, gammaG2, gammaQ, actions } = input;
    const acts = (actions || []).filter((a) => Number(a.Qk) > 0);

    const permSLU = gammaG1 * G1 + gammaG2 * G2;
    const permSLE = G1 + G2;

    // SLU fondamentale: prova ogni azione come dominante
    let slu = permSLU;
    let sluLeading = null;
    let sleRara = permSLE;
    let raraLeading = null;
    let sleFreq = permSLE;
    let freqLeading = null;

    if (acts.length === 0) {
        slu = permSLU;
        sleRara = permSLE;
        sleFreq = permSLE;
    } else {
        for (let i = 0; i < acts.length; i++) {
            // SLU
            let sVal = permSLU + gammaQ * acts[i].Qk;
            let rVal = permSLE + acts[i].Qk;
            let fVal = permSLE + acts[i].psi1 * acts[i].Qk;
            for (let j = 0; j < acts.length; j++) {
                if (j === i) continue;
                sVal += gammaQ * acts[j].psi0 * acts[j].Qk;
                rVal += acts[j].psi0 * acts[j].Qk;
                fVal += acts[j].psi2 * acts[j].Qk;
            }
            if (sVal > slu) {
                slu = sVal;
                sluLeading = acts[i].name;
            }
            if (rVal > sleRara) {
                sleRara = rVal;
                raraLeading = acts[i].name;
            }
            if (fVal > sleFreq) {
                sleFreq = fVal;
                freqLeading = acts[i].name;
            }
        }
    }

    // Quasi permanente e sismica: sum psi2 Qk
    let sumPsi2 = 0;
    for (const a of acts) sumPsi2 += a.psi2 * a.Qk;
    const sleQP = permSLE + sumPsi2;
    const sismica = permSLE + sumPsi2; // parte gravitazionale (+ E)

    return {
        ok: true,
        permSLU,
        permSLE,
        slu,
        sluLeading,
        sleRara,
        raraLeading,
        sleFreq,
        freqLeading,
        sleQP,
        sismica,
        nActions: acts.length,
    };
}
