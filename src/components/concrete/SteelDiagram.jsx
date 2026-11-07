// src/components/concrete/SteelDiagram.jsx
// Grafico del legame costitutivo dell'acciaio (sigma-eps), ramo di trazione:
// elasto-plastico oppure incrudente (k_s), con assi a freccia e valori.

import { useId } from "react";
import { sub } from "../Sym";
import { fmtNum } from "../Tex";
import useCenteredViewBox from "./useCenteredViewBox";

const ES = 200000; // MPa
const EPS_UD = 0.0675; // deformazione ultima di progetto (B450C)
const COLOR = "#4f46e5"; // indaco

const permille = (e) => fmtNum(e * 1000, 2);

export default function SteelDiagram({ fyd, model = "ep", ks = 1.15 }) {
    // id univoco del marker: lo stesso grafico può comparire più volte nella pagina
    const arrowId = "sd-arrow-" + useId().replace(/[^A-Za-z0-9_-]/g, "");
    const W = 320;
    const H = 186;
    const ox = 50;
    const oy = H - 44;
    const plotW = W - ox - 34;
    const plotH = oy - 34;

    const hardening = model === "hardening";
    const ftd = ks * fyd; // tensione all'estremo (incrudente)
    const sMax = hardening ? ftd : fyd;
    const epsYd = fyd / ES;

    // Asse ε "spezzato": il tratto elastico [0, eps_yd] occupa una frazione
    // maggiore della larghezza, così se ne apprezza l'inclinazione; il tratto
    // plastico [eps_yd, eps_ud] e' compresso nella parte restante.
    const fracElastic = 0.22;
    const sx = (e) =>
        e <= epsYd
            ? ox + (e / epsYd) * fracElastic * plotW
            : ox + fracElastic * plotW + ((e - epsYd) / (EPS_UD - epsYd)) * (1 - fracElastic) * plotW;
    const sy = (s) => oy - (s / sMax) * plotH;
    const xYd = sx(epsYd);
    const xUd = sx(EPS_UD);
    const yYd = sy(fyd);
    const yTop = sy(sMax);

    // curva: ramo elastico + plateau (o incrudimento)
    const curve = `M${ox},${oy} L${xYd},${yYd} L${xUd},${yTop}`;
    const area = `${curve} L${xUd},${oy} Z`;

    const fydTxt = fmtNum(fyd, 2);
    const ftdTxt = fmtNum(ftd, 2);
    const [svgRef, viewBox] = useCenteredViewBox(W, H, [fydTxt, ftdTxt, model]);

    return (
        <div className="mt-3">
            <svg ref={svgRef} width="100%" viewBox={viewBox} role="img" aria-label="Legame costitutivo acciaio">
                <defs>
                    <marker id={arrowId} markerWidth="8" markerHeight="8" refX="1" refY="3" orient="auto">
                        <path d="M0,0 L6,3 L0,6 Z" fill="#334155" />
                    </marker>
                </defs>

                {/* area e curva */}
                <path d={area} fill={COLOR} fillOpacity="0.12" />
                <path d={curve} fill="none" stroke={COLOR} strokeWidth="2.2" strokeLinejoin="round" />

                {/* guide f_yd / f_td */}
                <line x1={ox} y1={yYd} x2={xYd} y2={yYd} stroke="#94a3b8" strokeWidth="0.75" strokeDasharray="3 3" />
                <line x1={xYd} y1={oy} x2={xYd} y2={yYd} stroke="#cbd5e1" strokeWidth="0.75" strokeDasharray="2 2" />
                {hardening && <line x1={ox} y1={yTop} x2={xUd} y2={yTop} stroke="#94a3b8" strokeWidth="0.5" strokeDasharray="3 3" />}

                {/* assi a freccia */}
                <line x1={ox} y1={oy} x2={W - 22} y2={oy} stroke="#334155" strokeWidth="1.2" markerEnd={`url(#${arrowId})`} />
                <line x1={ox} y1={oy} x2={ox} y2={10} stroke="#334155" strokeWidth="1.2" markerEnd={`url(#${arrowId})`} />
                {/* marcatore di interruzione di scala sull'asse ε */}
                <path d={`M${xYd + 2},${oy + 4} l5,-8 M${xYd + 7},${oy + 4} l5,-8`} stroke="#334155" strokeWidth="1" fill="none" />

                {/* etichette assi */}
                <text x={ox + 8} y={14} textAnchor="start" fontSize="12" fill="#334155"><tspan fontStyle="italic">σ</tspan><tspan fontSize="9"> (MPa)</tspan></text>
                <text x={W - 11} y={oy + 4} textAnchor="start" fontSize="12" fontStyle="italic" fill="#334155">ε</text>

                {/* f_yd */}
                <text x={ox - 6} y={yYd + 3} textAnchor="end" fontSize="10" fill="#334155">
                    f<tspan fontSize="7" dy="2">yd</tspan>
                </text>
                {/* valore di f_yd a sinistra del ginocchio, sopra il tratteggio */}
                <text x={xYd - 4} y={yYd - 4} textAnchor="end" fontSize="8" fill="#64748b">{fydTxt}</text>
                {hardening && <>
                    <text x={ox - 6} y={yTop + 3} textAnchor="end" fontSize="10" fill="#334155">
                        f<tspan fontSize="7" dy="2">td</tspan>
                    </text>
                    {/* valore di f_td in cima al ramo incrudente, vicino alla punta */}
                    <text x={xUd} y={yTop - 4} textAnchor="end" fontSize="8" fill="#64748b">{ftdTxt}</text>
                </>}

                {/* deformazioni */}
                <text x={xYd} y={oy + 15} textAnchor="middle" fontSize="10" fill="#334155">
                    ε<tspan fontSize="7" dy="2">yd</tspan>
                </text>
                <text x={xYd} y={oy + 27} textAnchor="middle" fontSize="8" fill="#64748b">{permille(epsYd)}‰</text>
                <text x={xUd} y={oy + 15} textAnchor="middle" fontSize="10" fill="#334155">
                    ε<tspan fontSize="7" dy="2">ud</tspan>
                </text>
                <text x={xUd} y={oy + 27} textAnchor="middle" fontSize="8" fill="#64748b">{permille(EPS_UD)}‰</text>
            </svg>
            <p className="mt-1 text-[11px] leading-tight text-slate-400">
                {sub(hardening
                    ? "Incrudente: σ cresce da f_yd (a ε_yd) a k_s·f_yd (a ε_ud); E_s = 200 GPa."
                    : "Elasto-plastico: tratto elastico fino a ε_yd, poi plateau a f_yd; E_s = 200 GPa.")}
                {" "}Asse ε con scala spezzata (tratto elastico ingrandito).
            </p>
        </div>
    );
}
