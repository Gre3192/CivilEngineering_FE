// src/components/actions/SeismicSpectrumTool.jsx
import { useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";
import {
    seismicSpectrum,
    DEFAULT_SEISMIC_INPUT,
    SOIL_CATEGORIES,
    TOPO_CATEGORIES,
} from "../../lib/actions/seismicSpectrum";
import { Card, CardTitle, ResultGrid, ResultRow, NumberField, SelectField, InfoBox, fmt } from "./kit";

export default function SeismicSpectrumTool() {
    const [input, setInput] = useState(DEFAULT_SEISMIC_INPUT);
    const result = useMemo(() => seismicSpectrum(input), [input]);

    const set = (f) => (v) => setInput((p) => ({ ...p, [f]: v }));
    const setN = (f) => (v) => setInput((p) => ({ ...p, [f]: Number(v) || 0 }));

    return (
        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
            <div className="space-y-4">
                <Card>
                    <CardTitle>Pericolosità di base</CardTitle>
                    <div className="grid grid-cols-2 gap-3">
                        <NumberField label="a_g / g" value={input.agG} step="0.01" onChange={setN("agG")} />
                        <NumberField label="F₀" value={input.F0} step="0.1" onChange={setN("F0")} />
                        <NumberField label="T_c*" unit="s" value={input.TcStar} step="0.05" onChange={setN("TcStar")} />
                        <NumberField label="ξ smorz." unit="%" value={input.xi} step="1" onChange={setN("xi")} />
                    </div>
                </Card>
                <Card>
                    <CardTitle>Sito e struttura</CardTitle>
                    <div className="grid grid-cols-2 gap-3">
                        <SelectField label="Sottosuolo" value={input.soil} onChange={set("soil")} options={SOIL_CATEGORIES.map((s) => ({ value: s, label: `Categoria ${s}` }))} />
                        <SelectField label="Topografia" value={input.topo} onChange={set("topo")} options={TOPO_CATEGORIES.map((t) => ({ value: t.id, label: t.label }))} />
                        <NumberField label="q (comportamento)" value={input.q} step="0.1" onChange={setN("q")} />
                    </div>
                </Card>
                <button type="button" onClick={() => setInput(DEFAULT_SEISMIC_INPUT)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">
                    <RotateCcw size={15} /> Valori predefiniti
                </button>
            </div>

            <div className="space-y-4">
                {!result.ok ? (
                    <Card>
                        <ul className="list-disc pl-5 text-sm text-red-600">
                            {result.errors.map((e) => <li key={e}>{e}</li>)}
                        </ul>
                    </Card>
                ) : (
                    <>
                        <Card>
                            <CardTitle>Spettro di risposta (orizzontale)</CardTitle>
                            <SpectrumChart result={result} />
                            <div className="mt-2 flex gap-4 text-xs">
                                <span className="flex items-center gap-2"><span className="h-1 w-5 rounded bg-emerald-500" /> Elastico S_e(T)</span>
                                <span className="flex items-center gap-2"><span className="h-1 w-5 rounded bg-slate-400" /> Progetto S_d(T)</span>
                            </div>
                        </Card>
                        <div className="grid gap-4 md:grid-cols-2">
                            <Card>
                                <CardTitle>Amplificazioni</CardTitle>
                                <ResultGrid>
                                    <ResultRow label="S_S (sottosuolo)" value={fmt(result.SS, 3)} />
                                    <ResultRow label="S_T (topografia)" value={fmt(result.ST, 2)} />
                                    <ResultRow label="S = S_S·S_T" value={fmt(result.S, 3)} strong />
                                    <ResultRow label="C_C" value={fmt(result.CC, 3)} />
                                    <ResultRow label="η (elastico)" value={fmt(result.eta, 3)} />
                                </ResultGrid>
                            </Card>
                            <Card>
                                <CardTitle>Periodi e ordinate</CardTitle>
                                <ResultGrid>
                                    <ResultRow label="T_B" value={fmt(result.TB, 3)} unit="s" />
                                    <ResultRow label="T_C" value={fmt(result.TC, 3)} unit="s" />
                                    <ResultRow label="T_D" value={fmt(result.TD, 2)} unit="s" />
                                    <ResultRow label="S_e,max" value={fmt(result.SePlateau, 3)} unit="g" strong />
                                    <ResultRow label="S_d,max" value={fmt(result.SdPlateau, 3)} unit="g" />
                                </ResultGrid>
                            </Card>
                        </div>
                        <InfoBox>
                            NTC2018 §3.2.3. S=S_S·S_T; T_C=C_C·T_c*; T_B=T_C/3;
                            T_D=4·(a_g/g)+1,6. Spettro di progetto con η=1/q e limite
                            inferiore S_d ≥ 0,2·a_g·S.
                        </InfoBox>
                    </>
                )}
            </div>
        </div>
    );
}

function SpectrumChart({ result }) {
    const { points, TB, TC, TD } = result;
    const W = 620, H = 300, m = { t: 16, r: 16, b: 40, l: 52 };
    const iw = W - m.l - m.r, ih = H - m.t - m.b;

    const Tmax = 4;
    const Smax = Math.max(...points.map((p) => p.Se)) * 1.1 || 1;
    const sx = (T) => m.l + (T / Tmax) * iw;
    const sy = (S) => m.t + (1 - S / Smax) * ih;

    const path = (key) => points.map((p, i) => `${i === 0 ? "M" : "L"}${sx(p.T).toFixed(1)},${sy(p[key]).toFixed(1)}`).join(" ");

    const gridT = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4];
    const gridS = [];
    const step = Smax > 0.6 ? 0.2 : 0.1;
    for (let s = 0; s <= Smax; s += step) gridS.push(s);

    return (
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Spettro di risposta">
            {gridS.map((s, i) => (
                <g key={`gs-${i}`}>
                    <line x1={m.l} y1={sy(s)} x2={m.l + iw} y2={sy(s)} stroke="#f1f5f9" strokeWidth="1" />
                    <text x={m.l - 6} y={sy(s) + 3} textAnchor="end" fontSize="9" fill="#94a3b8">{s.toFixed(2)}</text>
                </g>
            ))}
            {gridT.map((t, i) => (
                <text key={`gt-${i}`} x={sx(t)} y={m.t + ih + 14} textAnchor="middle" fontSize="9" fill="#94a3b8">{t}</text>
            ))}
            {/* periodi notevoli */}
            {[["T_B", TB], ["T_C", TC], ["T_D", TD]].map(([lbl, t]) => t <= Tmax && (
                <g key={lbl}>
                    <line x1={sx(t)} y1={m.t} x2={sx(t)} y2={m.t + ih} stroke="#e2e8f0" strokeWidth="1" strokeDasharray="3 3" />
                    <text x={sx(t)} y={m.t + 9} textAnchor="middle" fontSize="8" fill="#64748b">{lbl}</text>
                </g>
            ))}
            <line x1={m.l} y1={m.t + ih} x2={m.l + iw} y2={m.t + ih} stroke="#cbd5e1" strokeWidth="1" />
            <line x1={m.l} y1={m.t} x2={m.l} y2={m.t + ih} stroke="#cbd5e1" strokeWidth="1" />
            <path d={path("Sd")} fill="none" stroke="#94a3b8" strokeWidth="2" strokeDasharray="6 3" />
            <path d={path("Se")} fill="none" stroke="#059669" strokeWidth="2.5" />
            <text x={m.l + iw / 2} y={H - 4} textAnchor="middle" fontSize="10" fill="#475569">T [s]</text>
            <text x={14} y={m.t + ih / 2} textAnchor="middle" fontSize="10" fill="#475569" transform={`rotate(-90 14 ${m.t + ih / 2})`}>S/g</text>
        </svg>
    );
}
