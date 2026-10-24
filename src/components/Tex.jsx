// src/components/Tex.jsx
// Renderizza una formula LaTeX con KaTeX.
import katex from "katex";

export default function Tex({ children, display = false }) {
    let html = "";
    try {
        html = katex.renderToString(String(children), {
            throwOnError: false,
            displayMode: display,
        });
    } catch {
        html = String(children);
    }
    return (
        <span
            className={display ? "block overflow-x-auto py-0.5" : ""}
            dangerouslySetInnerHTML={{ __html: html }}
        />
    );
}

// Equazione su due righe con "=" allineati (formula / numeri sostituiti),
// seguita dal valore. lhs = formula simbolica; num = numeri sostituiti; val =
// risultato. Se num manca, resta su una riga.
export function Eq({ lhs, sym, num, val }) {
    const valPart = val != null && val !== "" ? ` = ${val}` : "";
    const body =
        num != null && num !== ""
            ? `\\begin{aligned}${lhs} &= ${sym} \\\\ &= ${num}${valPart}\\end{aligned}`
            : `${lhs} = ${sym}${valPart}`;
    return <Tex display>{body}</Tex>;
}

// Formatta un numero per LaTeX (virgola decimale protetta, senza separatori di
// migliaia): 14.17 -> "14{,}17".
export function texNum(v, dec = 2) {
    if (v === undefined || v === null || Number.isNaN(v) || !Number.isFinite(v)) return "-";
    const s = Number(v).toLocaleString("it-IT", {
        minimumFractionDigits: dec,
        maximumFractionDigits: dec,
        useGrouping: false,
    });
    return s.replace(",", "{,}");
}
