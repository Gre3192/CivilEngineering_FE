// src/components/Sym.jsx
// Testo semplice con pedici: "f_cd", "A'_s", "A_s,min", "ε_c4", "A's" diventano
// f<sub>cd</sub>, A'<sub>s</sub>, ... senza il trattino basso.

import { Children } from "react";

// simbolo (lettera, anche greca, con eventuali apici) + "_" + pedice, oppure la
// forma breve A's / C's / σ's (apice e pedice s)
const SUB_RE = /([A-Za-zα-ωΑ-ΩφΦ]'*)_([A-Za-z0-9]+(?:,[A-Za-z0-9]+)*)|([ACσ]')(s)(?![A-Za-z])/g;

export function sub(text) {
    if (typeof text !== "string") return text;
    const parts = [];
    let last = 0;
    for (const m of text.matchAll(SUB_RE)) {
        if (m.index > last) parts.push(text.slice(last, m.index));
        parts.push(m[1] ?? m[3], <sub key={m.index}>{m[2] ?? m[4]}</sub>);
        last = m.index + m[0].length;
    }
    if (last === 0) return text;
    if (last < text.length) parts.push(text.slice(last));
    return parts;
}

export default function Sym({ children }) {
    return <>{Children.map(children, sub)}</>;
}
