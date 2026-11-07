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
export function Eq({ lhs, sym, num, val, breakLine = true }) {
    const valPart = val != null && val !== "" ? ` = ${val}` : "";
    const numPart = breakLine ? ` \\\\ &= ${num}` : ` = ${num}`;
    const body =
        num != null && num !== ""
            ? `\\begin{aligned}${lhs} &= ${sym}${numPart}${valPart}\\end{aligned}`
            : `${lhs} = ${sym}${valPart}`;
    return <Tex display>{body}</Tex>;
}

// Formatta un numero in italiano con dec decimali, senza separatori di migliaia.
// Un valore che arrotondato è intero si scrive senza decimali ("8" e non "8,0";
// "0" e non "0,00" né "-0,0"). Usato nei fogli di calcolo e nei grafici.
export function fmtNum(v, dec = 2) {
    if (v === undefined || v === null || Number.isNaN(v) || !Number.isFinite(v)) return "-";
    const rounded = Number(Number(v).toFixed(dec));
    if (Number.isInteger(rounded)) return String(rounded === 0 ? 0 : rounded);
    return Number(v).toLocaleString("it-IT", {
        minimumFractionDigits: dec,
        maximumFractionDigits: dec,
        useGrouping: false,
    });
}

// Come fmtNum, per LaTeX (virgola decimale protetta): 14.17 -> "14{,}17".
export function texNum(v, dec = 2) {
    return fmtNum(v, dec).replace(",", "{,}");
}
