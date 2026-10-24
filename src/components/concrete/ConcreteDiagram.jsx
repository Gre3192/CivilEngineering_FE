// src/components/concrete/ConcreteDiagram.jsx
// Grafico del legame costitutivo del calcestruzzo (sigma-eps) per il diagramma
// scelto: rettangolo (stress-block), parabola-rettangolo, triangolo-rettangolo.

const EPS_CU = 0.0035;
const EPS_C2 = 0.002;
const EPS_C3 = 0.00175;

export default function ConcreteDiagram({ fcd, model }) {
    const W = 300;
    const H = 150;
    const m = { l: 46, r: 14, t: 12, b: 30 };
    const iw = W - m.l - m.r;
    const ih = H - m.t - m.b;
    const epsMax = EPS_CU;

    const sx = (e) => m.l + (e / epsMax) * iw;
    const sy = (s) => m.t + (1 - s / fcd) * ih;

    const sigma = (e) => {
        if (model === "parabola") return e >= EPS_C2 ? fcd : fcd * (1 - Math.pow(1 - e / EPS_C2, 2));
        if (model === "bilinear") return e >= EPS_C3 ? fcd : (fcd * e) / EPS_C3;
        return fcd; // rettangolo: tensione costante (blocco equivalente)
    };

    const N = 40;
    const pts = [];
    for (let i = 0; i <= N; i++) {
        const e = (epsMax * i) / N;
        pts.push([sx(e), sy(sigma(e))]);
    }
    const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
    const area = `M${sx(0)},${sy(0)} ${line.slice(1)} L${sx(epsMax)},${sy(0)} Z`;
    const knee = model === "bilinear" ? EPS_C3 : model === "parabola" ? EPS_C2 : null;

    return (
        <div className="mt-3">
            <svg width="100%" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Legame costitutivo calcestruzzo">
                <line x1={m.l} y1={m.t} x2={m.l} y2={m.t + ih} stroke="#cbd5e1" strokeWidth="1" />
                <line x1={m.l} y1={m.t + ih} x2={m.l + iw} y2={m.t + ih} stroke="#cbd5e1" strokeWidth="1" />
                <path d={area} fill="#bae6fd" fillOpacity="0.5" />
                <path d={line} fill="none" stroke="#0284c7" strokeWidth="2" />
                <line x1={m.l} y1={sy(fcd)} x2={m.l + iw} y2={sy(fcd)} stroke="#94a3b8" strokeWidth="0.75" strokeDasharray="3 3" />
                <text x={m.l - 4} y={sy(fcd) + 3} textAnchor="end" fontSize="9" fill="#64748b">f_cd</text>
                <text x={m.l - 4} y={sy(0) + 3} textAnchor="end" fontSize="9" fill="#94a3b8">0</text>
                {knee && (
                    <>
                        <line x1={sx(knee)} y1={sy(fcd)} x2={sx(knee)} y2={m.t + ih} stroke="#cbd5e1" strokeWidth="0.75" strokeDasharray="2 2" />
                        <text x={sx(knee)} y={m.t + ih + 12} textAnchor="middle" fontSize="8" fill="#94a3b8">{(knee * 1000).toFixed(2)}‰</text>
                    </>
                )}
                <text x={sx(epsMax)} y={m.t + ih + 12} textAnchor="middle" fontSize="8" fill="#94a3b8">{(epsMax * 1000).toFixed(1)}‰</text>
                <text x={m.l + iw / 2} y={H - 2} textAnchor="middle" fontSize="9" fill="#64748b">ε_c</text>
            </svg>
            {model === "rectangular" && (
                <p className="mt-1 text-[11px] leading-tight text-slate-400">
                    Blocco equivalente: tensione η·f_cd costante su profondità λ·x (λ=0,8; η=1,0).
                </p>
            )}
        </div>
    );
}
