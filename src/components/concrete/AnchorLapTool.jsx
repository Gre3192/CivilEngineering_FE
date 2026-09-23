// src/components/concrete/AnchorLapTool.jsx
//
// Strumento: Ancoraggi e sovrapposizioni (EC2 8.4 / 8.7, NTC2018 4.1.6.1.4).

import { useMemo, useState } from "react";
import { Info, RotateCcw } from "lucide-react";
import {
    anchorLap,
    DEFAULT_ANCHOR_INPUT,
    LAP_PERCENTAGES,
} from "../../lib/concrete/anchorLap";
import { CONCRETE_CLASSES, STEEL_GRADES } from "../../lib/concrete/sectionDesign";

const BAR_DIAMETERS = [8, 10, 12, 14, 16, 18, 20, 24, 26, 32];

function fmt(v, dec = 0) {
    if (v === undefined || v === null || Number.isNaN(v)) return "-";
    return Number(v).toLocaleString("it-IT", {
        minimumFractionDigits: dec,
        maximumFractionDigits: dec,
    });
}

export default function AnchorLapTool() {
    const [input, setInput] = useState(DEFAULT_ANCHOR_INPUT);
    const [showAdvanced, setShowAdvanced] = useState(false);

    const result = useMemo(() => anchorLap(input), [input]);

    function setField(field, value) {
        setInput((prev) => ({ ...prev, [field]: value }));
    }
    function setNumber(field, value) {
        const n = Number(value);
        setField(field, Number.isNaN(n) ? 0 : n);
    }
    function reset() {
        setInput(DEFAULT_ANCHOR_INPUT);
    }

    const fydRounded = result.ok ? Math.round(result.fyd) : 391;

    return (
        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
            {/* -------- INPUT -------- */}
            <div className="space-y-4">
                <Card>
                    <CardTitle>Barra e materiali</CardTitle>
                    <div className="grid grid-cols-2 gap-3">
                        <SelectField
                            label="Diametro φ"
                            value={input.phi}
                            onChange={(v) => setNumber("phi", v)}
                            options={BAR_DIAMETERS.map((d) => ({ value: d, label: `φ ${d}` }))}
                        />
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
                        <NumberField
                            label="σ_sd"
                            unit="MPa"
                            value={input.sigmaSd || ""}
                            placeholder={`${fydRounded} (f_yd)`}
                            onChange={(v) => setNumber("sigmaSd", v)}
                        />
                    </div>
                    <p className="mt-2 text-[11px] text-slate-400">
                        σ_sd vuoto = f_yd (ancoraggio totale).
                    </p>
                </Card>

                <Card>
                    <CardTitle>Condizioni</CardTitle>
                    <div className="grid grid-cols-2 gap-3">
                        <SelectField
                            label="Sollecitazione"
                            value={input.solic}
                            onChange={(v) => setField("solic", v)}
                            options={[
                                { value: "tension", label: "Trazione" },
                                { value: "compression", label: "Compressione" },
                            ]}
                        />
                        <SelectField
                            label="Aderenza"
                            value={input.bond}
                            onChange={(v) => setField("bond", v)}
                            options={[
                                { value: "good", label: "Buona (η₁=1)" },
                                { value: "poor", label: "Scarsa (η₁=0,7)" },
                            ]}
                        />
                        <SelectField
                            label="Forma barra"
                            value={input.shape}
                            onChange={(v) => setField("shape", v)}
                            options={[
                                { value: "straight", label: "Dritta" },
                                { value: "bent", label: "Piegata/uncinata" },
                            ]}
                        />
                        <NumberField label="Ricoprimento c_d" unit="mm" value={input.cd} onChange={(v) => setNumber("cd", v)} />
                    </div>
                    {input.solic === "compression" && (
                        <p className="mt-2 text-[11px] text-amber-600">
                            In compressione α₁…α₅ = 1 (nessuna riduzione).
                        </p>
                    )}
                </Card>

                <Card>
                    <CardTitle>Sovrapposizione</CardTitle>
                    <SelectField
                        label="Barre sovrapposte nella zona (α₆)"
                        value={input.lapPct}
                        onChange={(v) => setField("lapPct", v)}
                        options={LAP_PERCENTAGES.map((p) => ({ value: p.id, label: `${p.label} (α₆=${p.a6.toString().replace(".", ",")})` }))}
                    />
                </Card>

                <Card>
                    <button
                        type="button"
                        onClick={() => setShowAdvanced((p) => !p)}
                        className="flex w-full items-center justify-between text-sm font-semibold text-slate-600"
                    >
                        Parametri avanzati
                        <span className="text-xs text-slate-400">{showAdvanced ? "nascondi" : "mostra"}</span>
                    </button>
                    {showAdvanced && (
                        <div className="mt-3 space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <NumberField label="α₃ (confinamento)" value={input.alpha3} onChange={(v) => setNumber("alpha3", v)} />
                                <NumberField label="α₅ (pressione tr.)" value={input.alpha5} onChange={(v) => setNumber("alpha5", v)} />
                                <NumberField label="γ_c" value={input.gammaC} onChange={(v) => setNumber("gammaC", v)} />
                                <NumberField label="γ_s" value={input.gammaS} onChange={(v) => setNumber("gammaS", v)} />
                            </div>
                            <CheckField
                                label="Armatura trasversale saldata (α₄=0,7)"
                                checked={input.welded}
                                onChange={(v) => setField("welded", v)}
                            />
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
                        <div className="text-sm text-red-600">
                            <p className="font-semibold">Dati non validi</p>
                            <ul className="mt-1 list-disc pl-5 text-slate-600">
                                {result.errors.map((e) => (
                                    <li key={e}>{e}</li>
                                ))}
                            </ul>
                        </div>
                    </Card>
                ) : (
                    <>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <BigResult
                                title="Ancoraggio l_bd"
                                value={fmt(result.lbd, 0)}
                                phi={result.lbdPhi}
                                diagram={<AnchorDiagram />}
                            />
                            <BigResult
                                title="Sovrapposizione l₀"
                                value={fmt(result.l0, 0)}
                                phi={result.l0Phi}
                                diagram={<LapDiagram />}
                            />
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            <Card>
                                <CardTitle>Aderenza e ancoraggio di base</CardTitle>
                                <ResultGrid>
                                    <ResultRow label="σ_sd" value={fmt(result.sigma, 1)} unit="MPa" />
                                    <ResultRow label="f_ctm" value={fmt(result.fctm, 2)} unit="MPa" />
                                    <ResultRow label="f_ctd" value={fmt(result.fctd, 3)} unit="MPa" />
                                    <ResultRow label="η₁ · η₂" value={`${fmt(result.eta1, 1)} · ${fmt(result.eta2, 2)}`} />
                                    <ResultRow label="f_bd" value={fmt(result.fbd, 2)} unit="MPa" />
                                    <ResultRow label="l_b,rqd" value={fmt(result.lbrqd, 0)} unit="mm" strong />
                                </ResultGrid>
                            </Card>

                            <Card>
                                <CardTitle>Coefficienti e minimi</CardTitle>
                                <ResultGrid>
                                    <ResultRow label="α₁ (forma)" value={fmt(result.a1, 2)} />
                                    <ResultRow label="α₂ (ricopr.)" value={fmt(result.a2, 3)} />
                                    <ResultRow label="α₃ · α₄ · α₅" value={`${fmt(result.a3, 2)} · ${fmt(result.a4, 2)} · ${fmt(result.a5, 2)}`} />
                                    <ResultRow label="α₂·α₃·α₅ (≥0,7)" value={fmt(result.prod235, 3)} />
                                    <ResultRow label="α₆ (sovrap.)" value={fmt(result.a6, 2)} />
                                    <ResultRow label="l_b,min" value={fmt(result.lbMin, 0)} unit="mm" />
                                    <ResultRow label="l₀,min" value={fmt(result.l0Min, 0)} unit="mm" />
                                </ResultGrid>
                            </Card>
                        </div>

                        <AssumptionsBox />
                    </>
                )}
            </div>
        </div>
    );
}

function BigResult({ title, value, phi, diagram }) {
    return (
        <div className="rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 to-white p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">{title}</p>
            <div className="mt-1 flex items-end gap-2">
                <span className="text-4xl font-bold text-slate-900">{value}</span>
                <span className="mb-1 text-base font-semibold text-slate-400">mm</span>
            </div>
            <p className="mt-1 text-sm font-semibold text-slate-500">≈ {fmt(phi, 0)} φ</p>
            <div className="mt-3">{diagram}</div>
        </div>
    );
}

function AnchorDiagram() {
    return (
        <svg width="100%" viewBox="0 0 260 70" role="img" aria-label="Ancoraggio">
            <rect x="0" y="10" width="90" height="50" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1" />
            <line x1="20" y1="35" x2="255" y2="35" stroke="#0f172a" strokeWidth="4" />
            <line x1="90" y1="12" x2="90" y2="58" stroke="#64748b" strokeWidth="1" strokeDasharray="3 3" />
            <line x1="90" y1="50" x2="255" y2="50" stroke="#0284c7" strokeWidth="1" />
            <line x1="90" y1="46" x2="90" y2="54" stroke="#0284c7" strokeWidth="1" />
            <line x1="255" y1="46" x2="255" y2="54" stroke="#0284c7" strokeWidth="1" />
            <text x="172" y="64" textAnchor="middle" fontSize="10" fill="#0369a1" fontWeight="bold">l_bd</text>
            <text x="45" y="24" textAnchor="middle" fontSize="9" fill="#64748b">cls</text>
        </svg>
    );
}

function LapDiagram() {
    return (
        <svg width="100%" viewBox="0 0 260 70" role="img" aria-label="Sovrapposizione">
            <line x1="0" y1="28" x2="180" y2="28" stroke="#0f172a" strokeWidth="4" />
            <line x1="80" y1="42" x2="260" y2="42" stroke="#334155" strokeWidth="4" />
            <line x1="80" y1="56" x2="180" y2="56" stroke="#0284c7" strokeWidth="1" />
            <line x1="80" y1="52" x2="80" y2="60" stroke="#0284c7" strokeWidth="1" />
            <line x1="180" y1="52" x2="180" y2="60" stroke="#0284c7" strokeWidth="1" />
            <text x="130" y="70" textAnchor="middle" fontSize="10" fill="#0369a1" fontWeight="bold">l₀</text>
        </svg>
    );
}

function AssumptionsBox() {
    return (
        <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
            <Info size={18} className="mt-0.5 shrink-0 text-slate-400" />
            <div>
                <p className="font-semibold text-slate-600">Riferimenti</p>
                <p className="mt-1 leading-6">
                    EC2 (EN 1992-1-1) §8.4 e §8.7 / NTC2018 §4.1.6.1.4. f_bd =
                    2,25·η₁·η₂·f_ctd; l_b,rqd = (φ/4)(σ_sd/f_bd); l_bd =
                    α₁α₂α₃α₄α₅·l_b,rqd ≥ l_b,min; l₀ = α₁α₂α₃α₅α₆·l_b,rqd ≥ l₀,min.
                    l_b,min = max(0,3·l_b,rqd; 10φ; 100 mm) in trazione (0,6·l_b,rqd
                    in compressione); l₀,min = max(0,3·α₆·l_b,rqd; 15φ; 200 mm).
                    α₃, α₅ posti a 1 salvo modifica. Valori raccomandati EC2.
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
function NumberField({ label, unit, value, onChange, placeholder }) {
    return (
        <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-500">
                {label}
                {unit && <span className="ml-1 text-slate-400">[{unit}]</span>}
            </span>
            <input
                type="number"
                value={value}
                placeholder={placeholder}
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
function CheckField({ label, checked, onChange }) {
    return (
        <label className="flex cursor-pointer items-start gap-2.5">
            <input
                type="checkbox"
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-400"
            />
            <span className="text-sm text-slate-600">{label}</span>
        </label>
    );
}
