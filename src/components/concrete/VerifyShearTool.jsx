// src/components/concrete/VerifyShearTool.jsx
//
// Strumento: Verifica a taglio (SLU) - traliccio ad inclinazione variabile
// (NTC2018 4.1.2.3.5 / EC2).

import { useMemo, useState } from "react";
import { CheckCircle2, XCircle, Info, RotateCcw, AlertTriangle } from "lucide-react";
import {
    shearCheck,
    DEFAULT_SHEAR_INPUT,
    STIRRUP_DIAMETERS,
} from "../../lib/concrete/shearCheck";
import { CONCRETE_CLASSES, STEEL_GRADES } from "../../lib/concrete/sectionDesign";

const STRUT_COLOR = "#ea580c"; // bielle compresse (cls)
const STIRRUP_COLOR = "#2563eb"; // staffe (acciaio)

function fmt(v, dec = 0) {
    if (v === undefined || v === null || Number.isNaN(v)) return "-";
    return Number(v).toLocaleString("it-IT", {
        minimumFractionDigits: dec,
        maximumFractionDigits: dec,
    });
}

export default function VerifyShearTool() {
    const [input, setInput] = useState(DEFAULT_SHEAR_INPUT);
    const [showAdvanced, setShowAdvanced] = useState(false);

    const result = useMemo(() => shearCheck(input), [input]);

    function setField(field, value) {
        setInput((prev) => ({ ...prev, [field]: value }));
    }
    function setNumber(field, value) {
        const n = Number(value);
        setField(field, Number.isNaN(n) ? 0 : n);
    }
    function reset() {
        setInput(DEFAULT_SHEAR_INPUT);
    }

    return (
        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
            {/* -------- INPUT -------- */}
            <div className="space-y-4">
                <Card>
                    <CardTitle>Geometria</CardTitle>
                    <div className="grid grid-cols-2 gap-3">
                        <NumberField label="Larghezza b_w" unit="mm" value={input.bw} onChange={(v) => setNumber("bw", v)} />
                        <NumberField label="Altezza h" unit="mm" value={input.h} onChange={(v) => setNumber("h", v)} />
                        <NumberField label="Copriferro c" unit="mm" value={input.c} onChange={(v) => setNumber("c", v)} />
                        <NumberField label="Arm. long. A_sl" unit="mm²" value={input.Asl} onChange={(v) => setNumber("Asl", v)} />
                    </div>
                </Card>

                <Card>
                    <CardTitle>Staffe</CardTitle>
                    <div className="grid grid-cols-2 gap-3">
                        <SelectField
                            label="Diametro φ"
                            value={input.phiSw}
                            onChange={(v) => setNumber("phiSw", v)}
                            options={STIRRUP_DIAMETERS.map((d) => ({ value: d, label: `φ ${d}` }))}
                        />
                        <SelectField
                            label="Bracci"
                            value={input.nLegs}
                            onChange={(v) => setNumber("nLegs", v)}
                            options={[2, 3, 4].map((n) => ({ value: n, label: `${n}` }))}
                        />
                        <NumberField label="Passo s" unit="mm" value={input.s} onChange={(v) => setNumber("s", v)} />
                        <NumberField label="Inclinazione α" unit="°" value={input.alpha} onChange={(v) => setNumber("alpha", v)} />
                    </div>
                </Card>

                <Card>
                    <CardTitle>Traliccio</CardTitle>
                    <NumberField
                        label="Inclinazione bielle cot θ (1 – 2,5)"
                        value={input.cotgTheta}
                        onChange={(v) => setNumber("cotgTheta", v)}
                    />
                    {result.ok && result.cotTheta_opt && (
                        <button
                            type="button"
                            onClick={() => setField("cotgTheta", Number(result.cotTheta_opt.toFixed(2)))}
                            className="mt-2 text-xs font-semibold text-sky-600 hover:underline"
                        >
                            Usa cot θ ottimale = {result.cotTheta_opt.toFixed(2)}
                        </button>
                    )}
                </Card>

                <Card>
                    <CardTitle>Sollecitazioni</CardTitle>
                    <div className="grid grid-cols-2 gap-3">
                        <NumberField label="V_Ed" unit="kN" value={input.VEd} onChange={(v) => setNumber("VEd", v)} />
                        <NumberField label="N_Ed (compr. +)" unit="kN" value={input.NEd} onChange={(v) => setNumber("NEd", v)} />
                    </div>
                </Card>

                <Card>
                    <CardTitle>Materiali</CardTitle>
                    <div className="grid grid-cols-2 gap-3">
                        <SelectField
                            label="Calcestruzzo"
                            value={input.fck}
                            onChange={(v) => setNumber("fck", v)}
                            options={CONCRETE_CLASSES.map((c) => ({ value: c.fck, label: c.id }))}
                        />
                        <SelectField
                            label="Acciaio"
                            value={input.fyk}
                            onChange={(v) => setNumber("fyk", v)}
                            options={STEEL_GRADES.map((s) => ({ value: s.fyk, label: s.id }))}
                        />
                    </div>
                </Card>

                <Card>
                    <button
                        type="button"
                        onClick={() => setShowAdvanced((p) => !p)}
                        className="flex w-full items-center justify-between text-sm font-semibold text-slate-600"
                    >
                        Coefficienti parziali
                        <span className="text-xs text-slate-400">{showAdvanced ? "nascondi" : "mostra"}</span>
                    </button>
                    {showAdvanced && (
                        <div className="mt-3 grid grid-cols-3 gap-3">
                            <NumberField label="α_cc" value={input.alphaCc} onChange={(v) => setNumber("alphaCc", v)} />
                            <NumberField label="γ_c" value={input.gammaC} onChange={(v) => setNumber("gammaC", v)} />
                            <NumberField label="γ_s" value={input.gammaS} onChange={(v) => setNumber("gammaS", v)} />
                        </div>
                    )}
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

                        <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
                            <Card>
                                <CardTitle>Traliccio resistente</CardTitle>
                                <TrussDiagram result={result} />
                                <div className="mt-3 flex flex-wrap gap-4 text-xs">
                                    <LegendItem color={STRUT_COLOR} label="Bielle compresse (cls) → V_Rcd" active={result.governing === "bielle"} />
                                    <LegendItem color={STIRRUP_COLOR} label="Staffe tese (acciaio) → V_Rsd" active={result.governing === "staffe"} />
                                </div>
                            </Card>

                            <Card>
                                <CardTitle>Resistenze</CardTitle>
                                <ResultGrid>
                                    <ResultRow label="V_Rsd (staffe)" value={fmt(result.VRsd, 1)} unit="kN" highlight={result.governing === "staffe"} />
                                    <ResultRow label="V_Rcd (bielle)" value={fmt(result.VRcd, 1)} unit="kN" highlight={result.governing === "bielle"} />
                                    <ResultRow label="V_Rd = min" value={fmt(result.VRd, 1)} unit="kN" strong />
                                    <ResultRow label="V_Ed" value={fmt(result.VEd, 1)} unit="kN" />
                                    <ResultRow label="V_Rd,c (no staffe)" value={fmt(result.VRdc, 1)} unit="kN" />
                                </ResultGrid>
                                <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                                    Rottura governata da: <b>{result.governing === "staffe" ? "armatura trasversale" : "bielle compresse"}</b>
                                </p>
                            </Card>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            <Card>
                                <CardTitle>Dettagli di calcolo</CardTitle>
                                <ResultGrid>
                                    <ResultRow label="d" value={fmt(result.d, 0)} unit="mm" />
                                    <ResultRow label="z = 0,9 d" value={fmt(result.z, 0)} unit="mm" />
                                    <ResultRow label="f_cd" value={fmt(result.fcd, 2)} unit="MPa" />
                                    <ResultRow label="f'_cd = 0,5 f_cd" value={fmt(result.fcd1, 2)} unit="MPa" />
                                    <ResultRow label="f_yd" value={fmt(result.fyd, 1)} unit="MPa" />
                                    <ResultRow label="A_sw" value={fmt(result.Asw, 1)} unit="mm²" />
                                    <ResultRow label="cot θ" value={fmt(result.cotT, 2)} />
                                    <ResultRow label="α_c" value={fmt(result.alphaC, 2)} />
                                </ResultGrid>
                            </Card>

                            <Card>
                                <CardTitle>Prescrizioni sull'armatura</CardTitle>
                                <div className="space-y-2">
                                    <CheckRow ok={result.rhoWok} label={`ρ_w = ${result.rhoW.toExponential(2)} ≥ ρ_w,min = ${result.rhoWmin.toExponential(2)}`} />
                                    <CheckRow ok={result.sMaxOk} label={`Passo s ≤ s_max = ${fmt(result.sMax, 0)} mm`} />
                                    <CheckRow ok={!result.stirrupsRequired || result.verified} warn label={result.stirrupsRequired ? `V_Ed > V_Rd,c: staffe necessarie` : `V_Ed ≤ V_Rd,c: staffe non strettamente richieste`} />
                                </div>
                            </Card>
                        </div>

                        <AssumptionsBox />
                    </>
                )}
            </div>
        </div>
    );
}

// -------- Verdetto --------
function VerdictBanner({ result }) {
    const ok = result.verified;
    const util = result.utilization;
    return (
        <div className={`flex items-center gap-4 rounded-2xl border p-4 ${ok ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
            {ok ? <CheckCircle2 size={28} className="shrink-0 text-emerald-600" /> : <XCircle size={28} className="shrink-0 text-red-600" />}
            <div className="flex-1">
                <p className="text-lg font-bold text-slate-800">
                    {ok ? "Verifica a taglio soddisfatta" : "Verifica a taglio NON soddisfatta"}
                </p>
                <p className="mt-0.5 text-sm text-slate-600">
                    V_Ed / V_Rd = {fmt(util, 3)} · sfruttamento {fmt(util * 100, 0)}%
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

// -------- Schema del traliccio --------
function TrussDiagram({ result }) {
    const W = 460;
    const H = 190;
    const x0 = 40;
    const x1 = 430;
    const yTop = 45;
    const yBot = 135;
    const zpx = yBot - yTop;

    // passo orizzontale delle bielle = z * cot(theta), scalato per stare nel disegno
    const cotT = result.cotT;
    let dx = zpx * cotT;
    // limita a un massimo di pannelli visibili
    const span = x1 - x0;
    if (dx > span * 0.6) dx = span * 0.6;

    // fascio di bielle parallele (ritagliate nell'anima)
    const slope = zpx / dx; // pendenza (positiva verso l'alto a destra)
    const pitch = 46; // passo orizzontale tra le bielle nel disegno
    const struts = [];
    for (let xb = x0 - dx; xb <= x1; xb += pitch) {
        struts.push(xb);
    }

    // staffe verticali (schematiche)
    const stirrups = [];
    const nStir = 9;
    for (let i = 1; i < nStir; i++) {
        stirrups.push(x0 + (span * i) / nStir);
    }

    const thetaDeg = (Math.atan(1 / cotT) * 180) / Math.PI;
    const clipId = "truss-web-clip";

    return (
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Traliccio resistente a taglio">
            {/* corrente compresso (superiore) e teso (inferiore) */}
            <line x1={x0} y1={yTop} x2={x1} y2={yTop} stroke="#64748b" strokeWidth="3" />
            <line x1={x0} y1={yBot} x2={x1} y2={yBot} stroke="#0f172a" strokeWidth="3" />
            <text x={x1} y={yTop - 6} textAnchor="end" fontSize="9" fill="#64748b">corrente compresso</text>
            <text x={x1} y={yBot + 14} textAnchor="end" fontSize="9" fill="#334155">corrente teso (arm. long.)</text>

            <defs>
                <clipPath id={clipId}>
                    <rect x={x0} y={yTop} width={x1 - x0} height={yBot - yTop} />
                </clipPath>
            </defs>

            {/* bielle compresse (fascio di diagonali parallele) */}
            <g clipPath={`url(#${clipId})`}>
                {struts.map((xb, i) => (
                    <line
                        key={`str-${i}`}
                        x1={xb}
                        y1={yBot}
                        x2={xb + (yBot - yTop) / slope}
                        y2={yTop}
                        stroke={STRUT_COLOR}
                        strokeWidth={result.governing === "bielle" ? 5 : 3}
                        opacity={result.governing === "bielle" ? 0.85 : 0.45}
                        strokeLinecap="round"
                    />
                ))}
            </g>

            {/* staffe */}
            {stirrups.map((x, i) => (
                <line key={`st-${i}`} x1={x} y1={yTop} x2={x} y2={yBot} stroke={STIRRUP_COLOR} strokeWidth={result.governing === "staffe" ? 3 : 1.5} opacity={result.governing === "staffe" ? 1 : 0.55} />
            ))}

            {/* angolo theta */}
            <path d={`M ${x0 + 34} ${yBot} A 34 34 0 0 0 ${x0 + 34 * Math.cos(Math.atan(zpx / dx))} ${yBot - 34 * Math.sin(Math.atan(zpx / dx))}`} fill="none" stroke="#475569" strokeWidth="1" />
            <text x={x0 + 42} y={yBot - 10} fontSize="11" fill="#475569">
                θ ≈ {thetaDeg.toFixed(0)}° (cot θ = {cotT.toFixed(2)})
            </text>

            {/* quota z */}
            <line x1={x0 - 14} y1={yTop} x2={x0 - 14} y2={yBot} stroke="#94a3b8" strokeWidth="1" />
            <text x={x0 - 18} y={(yTop + yBot) / 2} textAnchor="end" fontSize="9" fill="#94a3b8" transform={`rotate(-90 ${x0 - 18} ${(yTop + yBot) / 2})`}>
                z = 0,9 d
            </text>
        </svg>
    );
}

function LegendItem({ color, label, active }) {
    return (
        <div className={`flex items-center gap-2 ${active ? "font-semibold text-slate-700" : "text-slate-400"}`}>
            <span className="h-1.5 w-5 rounded-full" style={{ background: color, opacity: active ? 1 : 0.5 }} />
            {label}
        </div>
    );
}

function CheckRow({ ok, label, warn }) {
    return (
        <div className="flex items-start gap-2 text-sm">
            {ok ? (
                <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" />
            ) : (
                <AlertTriangle size={16} className={`mt-0.5 shrink-0 ${warn ? "text-amber-500" : "text-red-500"}`} />
            )}
            <span className="text-slate-600">{label}</span>
        </div>
    );
}

function AssumptionsBox() {
    return (
        <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
            <Info size={18} className="mt-0.5 shrink-0 text-slate-400" />
            <div>
                <p className="font-semibold text-slate-600">Riferimenti e ipotesi</p>
                <p className="mt-1 leading-6">
                    NTC2018 §4.1.2.3.5 / EC2. Traliccio ad inclinazione variabile con
                    1 ≤ cot θ ≤ 2,5. V_Rsd = 0,9·d·(A_sw/s)·f_yd·(cotα+cotθ)·sinα;
                    V_Rcd = 0,9·d·b_w·α_c·f'_cd·(cotα+cotθ)/(1+cot²θ) con f'_cd = 0,5·f_cd.
                    V_Rd = min(V_Rsd, V_Rcd). V_Rd,c (senza armatura) da §4.1.2.3.5.1.
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
function ResultRow({ label, value, unit, strong, highlight }) {
    return (
        <div className={`flex items-baseline justify-between border-b border-slate-100 py-1 ${highlight ? "rounded-md bg-amber-50 px-2" : ""}`}>
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
