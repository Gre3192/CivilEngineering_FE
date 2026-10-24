// src/components/concrete/ConcreteDiagram.jsx
// Grafico del legame costitutivo del calcestruzzo (sigma-eps) con assi a freccia:
// rettangolo (stress-block), parabola-rettangolo, triangolo-rettangolo.

const EPS_CU = 0.0035;
const EPS_C2 = 0.002;
const EPS_C3 = 0.00175;
const LAMBDA = 0.8;
const EPS_C4 = (1 - LAMBDA) * EPS_CU; // inizio del blocco rettangolare (0.70‰)

const COLOR = {
    rectangular: "#16a34a",
    parabola: "#ea580c",
    bilinear: "#ca8a04",
};

const permille = (e) =>
    (e * 1000).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ConcreteDiagram({ fcd, model }) {
    const W = 320;
    const H = 186;
    const ox = 50; // origine X
    const oy = H - 44; // origine Y
    const plotW = W - ox - 26; // larghezza fino a eps_cu
    const plotH = oy - 26; // altezza fino a f_cd
    const col = COLOR[model] || "#0284c7";
    const fcdTxt = fcd.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const sx = (e) => ox + (e / EPS_CU) * plotW;
    const sy = (s) => oy - (s / fcd) * plotH;
    const yF = sy(fcd);
    const xCu = sx(EPS_CU);

    // Curva della funzione (con discesa verticale a eps_cu)
    let curve, knee;
    if (model === "rectangular") {
        curve = `M${sx(0)},${oy} L${sx(EPS_C4)},${oy} L${sx(EPS_C4)},${yF} L${xCu},${yF} L${xCu},${oy}`;
        knee = EPS_C4;
    } else {
        const sigma = (e) =>
            model === "bilinear"
                ? e >= EPS_C3 ? fcd : (fcd * e) / EPS_C3
                : e >= EPS_C2 ? fcd : fcd * (1 - Math.pow(1 - e / EPS_C2, 2));
        knee = model === "bilinear" ? EPS_C3 : EPS_C2;
        const N = 40;
        const pts = [];
        for (let i = 0; i <= N; i++) {
            const e = (knee * i) / N; // tratto crescente fino al ginocchio
            pts.push(`${i === 0 ? "M" : "L"}${sx(e).toFixed(1)},${sy(sigma(e)).toFixed(1)}`);
        }
        curve = `${pts.join(" ")} L${xCu},${yF} L${xCu},${oy}`;
    }
    const area = `${curve} Z`;

    const kneeLabel = model === "rectangular" ? "c4" : model === "bilinear" ? "c3" : "c2";

    return (
        <div className="mt-3">
            <svg width="100%" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Legame costitutivo calcestruzzo">
                <defs>
                    <marker id="cd-arrow" markerWidth="8" markerHeight="8" refX="1" refY="3" orient="auto">
                        <path d="M0,0 L6,3 L0,6 Z" fill="#334155" />
                    </marker>
                </defs>

                {/* area e curva */}
                <path d={area} fill={col} fillOpacity="0.14" />
                <path d={curve} fill="none" stroke={col} strokeWidth="2.2" strokeLinejoin="round" />

                {/* guida f_cd */}
                <line x1={ox} y1={yF} x2={sx(knee)} y2={yF} stroke="#94a3b8" strokeWidth="0.75" strokeDasharray="3 3" />
                {/* linea verticale al ginocchio */}
                <line x1={sx(knee)} y1={oy} x2={sx(knee)} y2={yF} stroke="#cbd5e1" strokeWidth="0.75" strokeDasharray="2 2" />

                {/* assi a freccia */}
                <line x1={ox} y1={oy} x2={W - 8} y2={oy} stroke="#334155" strokeWidth="1.2" markerEnd="url(#cd-arrow)" />
                <line x1={ox} y1={oy} x2={ox} y2={10} stroke="#334155" strokeWidth="1.2" markerEnd="url(#cd-arrow)" />

                {/* etichette assi */}
                <text x={ox - 10} y={18} textAnchor="middle" fontSize="12" fontStyle="italic" fill="#334155">σ</text>
                <text x={W - 10} y={oy + 16} textAnchor="middle" fontSize="12" fontStyle="italic" fill="#334155">ε</text>

                {/* f_cd sull'asse + valore */}
                <text x={ox - 6} y={yF + 3} textAnchor="end" fontSize="10" fill="#334155">
                    f<tspan fontSize="7" dy="2">cd</tspan>
                </text>
                <text x={ox + 6} y={yF - 4} textAnchor="start" fontSize="8" fill="#64748b">{fcdTxt} MPa</text>

                {/* marcatori di deformazione + valori */}
                <text x={sx(knee)} y={oy + 15} textAnchor="middle" fontSize="10" fill="#334155">
                    ε<tspan fontSize="7" dy="2">{kneeLabel}</tspan>
                </text>
                <text x={sx(knee)} y={oy + 27} textAnchor="middle" fontSize="8" fill="#64748b">{permille(knee)}‰</text>
                <text x={xCu} y={oy + 15} textAnchor="middle" fontSize="10" fill="#334155">
                    ε<tspan fontSize="7" dy="2">cu</tspan>
                </text>
                <text x={xCu} y={oy + 27} textAnchor="middle" fontSize="8" fill="#64748b">{permille(EPS_CU)}‰</text>
            </svg>
            {model === "rectangular" && (
                <p className="mt-1 text-[11px] leading-tight text-slate-400">
                    Blocco equivalente (λ=0,8; η=1,0): σ = f_cd da ε_c4 = (1−λ)·ε_cu = 0,70‰ a ε_cu;
                    profondità λ·x.
                </p>
            )}
        </div>
    );
}
