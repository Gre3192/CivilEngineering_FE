// src/components/concrete/VerifyCrackTool.jsx
//
// Strumento: Verifica a fessurazione (SLE) - NTC2018 4.1.2.2.4 / EC2 7.3.4.

import { useMemo, useState } from "react";
import { CheckCircle2, XCircle, Info, RotateCcw } from "lucide-react";
import {
    crackCheck,
    DEFAULT_CRACK_INPUT,
    CRACK_LIMITS,
} from "../../lib/concrete/crackCheck";
import { CONCRETE_CLASSES } from "../../lib/concrete/sectionDesign";

function fmt(v, dec = 0) {
    if (v === undefined || v === null || Number.isNaN(v) || !Number.isFinite(v)) return "-";
    return Number(v).toLocaleString("it-IT", {
        minimumFractionDigits: dec,
        maximumFractionDigits: dec,
    });
}

const BAR_DIAMETERS = [8, 10, 12, 14, 16, 18, 20, 24, 26];

export default function VerifyCrackTool() {
    const [input, setInput] = useState(DEFAULT_CRACK_INPUT);

    const result = useMemo(() => crackCheck(input), [input]);

    function setField(field, value) {
        setInput((prev) => ({ ...prev, [field]: value }));
    }
    function setNumber(field, value) {
        const n = Number(value);
        setField(field, Number.isNaN(n) ? 0 : n);
    }
    function reset() {
        setInput(DEFAULT_CRACK_INPUT);
    }

    return (
        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
            {/* -------- INPUT -------- */}
            <div className="space-y-4">
                <Card>
                    <CardTitle>Geometria</CardTitle>
                    <div className="grid grid-cols-2 gap-3">
                        <NumberField label="Base b" unit="mm" value={input.b} onChange={(v) => setNumber("b", v)} />
                        <NumberField label="Altezza h" unit="mm" value={input.h} onChange={(v) => setNumber("h", v)} />
                        <NumberField label="Copriferro c (teso)" unit="mm" value={input.c} onChange={(v) => setNumber("c", v)} />
                        <NumberField label="Copriferro c' (compr.)" unit="mm" value={input.cPrime} onChange={(v) => setNumber("cPrime", v)} />
                    </div>
                </Card>

                <Card>
                    <CardTitle>Armatura</CardTitle>
                    <div className="grid grid-cols-2 gap-3">
                        <NumberField label="A_s (tesa)" unit="mm²" value={input.As} onChange={(v) => setNumber("As", v)} />
                        <NumberField label="A_s' (compressa)" unit="mm²" value={input.AsPrime} onChange={(v) => setNumber("AsPrime", v)} />
                        <SelectField
                            label="Diametro φ"
                            value={input.phi}
                            onChange={(v) => setNumber("phi", v)}
                            options={BAR_DIAMETERS.map((d) => ({ value: d, label: `φ ${d}` }))}
                        />
                    </div>
                </Card>

                <Card>
                    <CardTitle>Sollecitazione (SLE)</CardTitle>
                    <NumberField label="Momento M_Ser" unit="kNm" value={input.MSer} onChange={(v) => setNumber("MSer", v)} />
                </Card>

                <Card>
                    <CardTitle>Materiale e condizioni</CardTitle>
                    <div className="space-y-3">
                        <SelectField
                            label="Calcestruzzo"
                            value={input.fck}
                            onChange={(v) => setNumber("fck", v)}
                            options={CONCRETE_CLASSES.map((c) => ({ value: c.fck, label: c.id }))}
                        />
                        <SelectField
                            label="Durata dei carichi"
                            value={input.longTerm ? "long" : "short"}
                            onChange={(v) => setField("longTerm", v === "long")}
                            options={[
                                { value: "long", label: "Lunga durata (k_t = 0,4)" },
                                { value: "short", label: "Breve durata (k_t = 0,6)" },
                            ]}
                        />
                        <SelectField
                            label="Limite di ampiezza w_lim"
                            value={String(input.wLim)}
                            onChange={(v) => setField("wLim", Number(v))}
                            options={CRACK_LIMITS.map((l) => ({ value: l.id, label: l.label }))}
                        />
                    </div>
                </Card>

                <button
                    type="button"
                    onClick={reset}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                    <RotateCcw size={15} />
                    Valori predefiniti
                </button>
            </div>

            {/* -------- OUTPUT -------- */}
            <div className="space-y-4">
                {!result.ok ? (
                    <Card>
                        <div className="flex items-start gap-3 text-red-600">
                            <XCircle size={20} className="mt-0.5 shrink-0" />
                            <div>
                                <p className="font-semibold">Dati non validi</p>
                                <ul className="mt-1 list-disc pl-5 text-sm text-slate-600">
                                    {result.errors.map((e) => (
                                        <li key={e}>{e}</li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </Card>
                ) : (
                    <>
                        <VerdictBanner result={result} />

                        <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
                            <Card>
                                <CardTitle>Area efficace A_c,eff</CardTitle>
                                <CrackSectionDrawing result={result} />
                                <p className="mt-2 text-[11px] leading-tight text-slate-400">
                                    In azzurro la zona di calcestruzzo teso efficace
                                    attorno alle barre; tratteggiato l'asse neutro (stadio II).
                                </p>
                            </Card>

                            <div className="space-y-4">
                                <Card>
                                    <CardTitle>Ampiezza delle fessure</CardTitle>
                                    <ResultGrid>
                                        <ResultRow label="σ_s (acciaio)" value={fmt(result.sigmaS, 1)} unit="MPa" />
                                        <ResultRow label="s_r,max" value={fmt(result.srMax, 1)} unit="mm" />
                                        <ResultRow label="ε_sm − ε_cm" value={fmt(result.epsDiff * 1000, 3)} unit="‰" />
                                        <ResultRow label="w_k" value={fmt(result.wk, 3)} unit="mm" strong />
                                        <ResultRow label="w_lim" value={fmt(result.wLim, 1)} unit="mm" />
                                    </ResultGrid>
                                </Card>

                                <Card>
                                    <CardTitle>Stadio II e area efficace</CardTitle>
                                    <ResultGrid>
                                        <ResultRow label="α_e = E_s/E_cm" value={fmt(result.alphaE, 2)} />
                                        <ResultRow label="Asse neutro x" value={fmt(result.x, 1)} unit="mm" />
                                        <ResultRow label="f_ctm" value={fmt(result.fctm, 2)} unit="MPa" />
                                        <ResultRow label="h_c,eff" value={fmt(result.hcEff, 0)} unit="mm" />
                                        <ResultRow label="ρ_p,eff" value={fmt(result.rhoEff * 100, 2)} unit="%" />
                                        <ResultRow label="k_t" value={fmt(result.kt, 1)} />
                                    </ResultGrid>
                                </Card>
                            </div>
                        </div>

                        <AssumptionsBox />
                    </>
                )}
            </div>
        </div>
    );
}

function VerdictBanner({ result }) {
    const ok = result.verified;
    const util = result.utilization;
    return (
        <div className={`flex items-center gap-4 rounded-2xl border p-4 ${ok ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
            {ok ? <CheckCircle2 size={28} className="shrink-0 text-emerald-600" /> : <XCircle size={28} className="shrink-0 text-red-600" />}
            <div className="flex-1">
                <p className="text-lg font-bold text-slate-800">
                    {ok ? "Fessurazione verificata" : "Fessurazione NON verificata"}
                </p>
                <p className="mt-0.5 text-sm text-slate-600">
                    w_k = {fmt(result.wk, 3)} mm / w_lim = {fmt(result.wLim, 1)} mm · {fmt(util * 100, 0)}%
                </p>
            </div>
            <div className="w-40">
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/70">
                    <div className={`h-full rounded-full ${ok ? "bg-emerald-500" : "bg-red-500"}`} style={{ width: `${Math.min(util * 100, 100)}%` }} />
                </div>
            </div>
        </div>
    );
}

// -------- Disegno sezione con area efficace --------
function CrackSectionDrawing({ result }) {
    const { b, h, d, x, hcEff, nBars, phi } = result;

    const maxH = 240;
    const scale = maxH / h;
    const w = b * scale;
    const ht = h * scale;
    const padX = 24;
    const padY = 16;
    const svgW = w + padX * 2 + 30;
    const svgH = ht + padY * 2 + 14;

    const yTop = padY;
    const yOf = (depth) => yTop + depth * scale;

    // barre tese
    const bars = [];
    const lat = 30; // margine laterale schematico [mm]
    for (let i = 0; i < nBars; i++) {
        const pos = nBars === 1 ? b / 2 : lat + ((b - 2 * lat) * i) / (nBars - 1);
        bars.push(padX + pos * scale);
    }
    const barR = Math.max(3, (phi * scale) / 2);

    return (
        <svg width="100%" viewBox={`0 0 ${svgW} ${svgH}`} role="img" aria-label="Sezione con area efficace">
            {/* zona compressa */}
            <rect x={padX} y={yTop} width={w} height={Math.min(x * scale, ht)} fill="#e0f2fe" />
            {/* area efficace tesa (in basso) */}
            <rect x={padX} y={yOf(h - hcEff)} width={w} height={hcEff * scale} fill="#38bdf8" opacity="0.35" />
            {/* contorno */}
            <rect x={padX} y={yTop} width={w} height={ht} fill="none" stroke="#334155" strokeWidth="2" />

            {/* asse neutro */}
            {x > 0 && x * scale < ht && (
                <line x1={padX - 6} y1={yOf(x)} x2={padX + w + 6} y2={yOf(x)} stroke="#0284c7" strokeWidth="1.5" strokeDasharray="6 4" />
            )}

            {/* barre */}
            {bars.map((bx, i) => (
                <circle key={i} cx={bx} cy={yOf(d)} r={barR} fill="#0f172a" />
            ))}

            {/* quote */}
            <text x={padX + w / 2} y={yOf(x) - 4} textAnchor="middle" fontSize="9" fill="#0284c7">x = {fmt(x, 0)}</text>
            <text x={padX + w + 4} y={yOf(h - hcEff / 2)} fontSize="9" fill="#0369a1" transform={`rotate(90 ${padX + w + 4} ${yOf(h - hcEff / 2)})`} textAnchor="middle">h_c,eff = {fmt(hcEff, 0)}</text>
            <text x={padX + w / 2} y={svgH - 2} textAnchor="middle" fontSize="9" fill="#64748b">b = {fmt(b, 0)} mm</text>
        </svg>
    );
}

function AssumptionsBox() {
    return (
        <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
            <Info size={18} className="mt-0.5 shrink-0 text-slate-400" />
            <div>
                <p className="font-semibold text-slate-600">Riferimenti e ipotesi</p>
                <p className="mt-1 leading-6">
                    NTC2018 §4.1.2.2.4 / EC2 §7.3.4. w_k = s_r,max·(ε_sm−ε_cm) con
                    ε_sm−ε_cm = [σ_s − k_t·(f_ct,eff/ρ_p,eff)·(1+α_e·ρ_p,eff)]/E_s ≥
                    0,6·σ_s/E_s. σ_s da analisi in stadio II (sezione fessurata
                    elastica). s_r,max = k3·c + k1·k2·k4·φ/ρ_p,eff (k1=0,8; k2=0,5;
                    k3=3,4; k4=0,425); se le barre sono distanti, s_r,max=1,3·(h−x).
                    f_ct,eff = f_ctm, E_cm = 22000·(f_cm/10)^0,3.
                </p>
            </div>
        </div>
    );
}

// -------- primitivi UI --------
function Card({ children }) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">{children}</div>;
}
function CardTitle({ children }) {
    return <h3 className="mb-3 text-sm font-bold text-slate-800">{children}</h3>;
}
function ResultGrid({ children }) {
    return <div className="grid grid-cols-1 gap-y-1">{children}</div>;
}
function ResultRow({ label, value, unit, strong }) {
    return (
        <div className="flex items-baseline justify-between border-b border-slate-100 py-1">
            <span className="text-xs text-slate-500">{label}</span>
            <span className={`text-sm tabular-nums ${strong ? "font-bold text-slate-900" : "font-semibold text-slate-700"}`}>
                {value}
                {unit && <span className="ml-1 text-xs text-slate-400">{unit}</span>}
            </span>
        </div>
    );
}
function NumberField({ label, unit, value, onChange }) {
    return (
        <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-500">
                {label}
                {unit && <span className="ml-1 text-slate-400">[{unit}]</span>}
            </span>
            <input
                type="number"
                value={value}
                step="1"
                onChange={(e) => onChange(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            />
        </label>
    );
}
function SelectField({ label, value, onChange, options }) {
    return (
        <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-500">{label}</span>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            >
                {options.map((opt) => (
                    <option key={String(opt.value) + opt.label} value={opt.value}>
                        {opt.label}
                    </option>
                ))}
            </select>
        </label>
    );
}
