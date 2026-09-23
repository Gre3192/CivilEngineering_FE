// src/components/concrete/CoverCalcTool.jsx
//
// Strumento: Calcolo del copriferro nominale (EC2 4.4.1 / NTC2018).

import { useMemo, useState } from "react";
import { AlertTriangle, Info, RotateCcw, ArrowRight } from "lucide-react";
import {
    calcCover,
    EXPOSURE_CLASSES,
    DEFAULT_COVER_INPUT,
} from "../../lib/concrete/coverCalc";
import { CONCRETE_CLASSES } from "../../lib/concrete/sectionDesign";

const BAR_DIAMETERS = [8, 10, 12, 14, 16, 18, 20, 24, 26];
const STIRRUP_DIAMETERS = [6, 8, 10, 12];

function fmt(v, dec = 0) {
    if (v === undefined || v === null || Number.isNaN(v)) return "-";
    return Number(v).toLocaleString("it-IT", {
        minimumFractionDigits: dec,
        maximumFractionDigits: dec,
    });
}

export default function CoverCalcTool() {
    const [input, setInput] = useState(DEFAULT_COVER_INPUT);
    const [showAdvanced, setShowAdvanced] = useState(false);

    const result = useMemo(() => calcCover(input), [input]);

    function setField(field, value) {
        setInput((prev) => ({ ...prev, [field]: value }));
    }
    function setNumber(field, value) {
        const n = Number(value);
        setField(field, Number.isNaN(n) ? 0 : n);
    }
    function reset() {
        setInput(DEFAULT_COVER_INPUT);
    }

    return (
        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
            {/* -------- INPUT -------- */}
            <div className="space-y-4">
                <Card>
                    <CardTitle>Esposizione e materiali</CardTitle>
                    <div className="space-y-3">
                        <SelectField
                            label="Classe di esposizione"
                            value={input.exposure}
                            onChange={(v) => setField("exposure", v)}
                            options={EXPOSURE_CLASSES.map((e) => ({
                                value: e.id,
                                label: e.label,
                            }))}
                        />
                        <SelectField
                            label="Classe di resistenza calcestruzzo"
                            value={input.fck}
                            onChange={(v) => setNumber("fck", v)}
                            options={CONCRETE_CLASSES.map((c) => ({
                                value: c.fck,
                                label: c.id,
                            }))}
                        />
                    </div>
                </Card>

                <Card>
                    <CardTitle>Barre</CardTitle>
                    <div className="grid grid-cols-2 gap-3">
                        <SelectField
                            label="Barra longitudinale φ"
                            value={input.phi}
                            onChange={(v) => setNumber("phi", v)}
                            options={BAR_DIAMETERS.map((d) => ({
                                value: d,
                                label: `φ ${d}`,
                            }))}
                        />
                        <SelectField
                            label="Staffa φ"
                            value={input.phiStirrup}
                            onChange={(v) => setNumber("phiStirrup", v)}
                            options={STIRRUP_DIAMETERS.map((d) => ({
                                value: d,
                                label: `φ ${d}`,
                            }))}
                        />
                    </div>
                </Card>

                <Card>
                    <CardTitle>Classe strutturale</CardTitle>
                    <div className="space-y-3">
                        <SelectField
                            label="Vita nominale di progetto"
                            value={input.workingLife}
                            onChange={(v) => setNumber("workingLife", v)}
                            options={[
                                { value: 50, label: "50 anni" },
                                { value: 100, label: "100 anni" },
                            ]}
                        />
                        <CheckField
                            label="Elemento a lastra (posizione barre non condizionata)"
                            checked={input.slabGeometry}
                            onChange={(v) => setField("slabGeometry", v)}
                        />
                        <CheckField
                            label="Controllo qualità speciale del calcestruzzo"
                            checked={input.qualityControl}
                            onChange={(v) => setField("qualityControl", v)}
                        />
                        <CheckField
                            label="Aggregato dg > 32 mm (c_min,b + 5 mm)"
                            checked={input.aggregateOver32}
                            onChange={(v) => setField("aggregateOver32", v)}
                        />
                    </div>
                </Card>

                <Card>
                    <button
                        type="button"
                        onClick={() => setShowAdvanced((p) => !p)}
                        className="flex w-full items-center justify-between text-sm font-semibold text-slate-600"
                    >
                        Tolleranze e riduzioni
                        <span className="text-xs text-slate-400">
                            {showAdvanced ? "nascondi" : "mostra"}
                        </span>
                    </button>

                    {showAdvanced && (
                        <div className="mt-3 grid grid-cols-2 gap-3">
                            <NumberField
                                label="Δc_dev"
                                unit="mm"
                                value={input.dCdev}
                                onChange={(v) => setNumber("dCdev", v)}
                            />
                            <NumberField
                                label="Δc_dur,γ"
                                unit="mm"
                                value={input.dCdurGamma}
                                onChange={(v) => setNumber("dCdurGamma", v)}
                            />
                            <NumberField
                                label="Δc_dur,st (inox)"
                                unit="mm"
                                value={input.dCdurSt}
                                onChange={(v) => setNumber("dCdurSt", v)}
                            />
                            <NumberField
                                label="Δc_dur,add"
                                unit="mm"
                                value={input.dCdurAdd}
                                onChange={(v) => setNumber("dCdurAdd", v)}
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
                        <div className="flex items-start gap-3 text-red-600">
                            <AlertTriangle size={20} className="mt-0.5 shrink-0" />
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
                        {/* Risultato principale */}
                        <div className="rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 to-white p-6">
                            <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">
                                Copriferro nominale
                            </p>
                            <div className="mt-1 flex items-end gap-3">
                                <span className="text-5xl font-bold text-slate-900">
                                    {fmt(result.cNom)}
                                </span>
                                <span className="mb-1 text-lg font-semibold text-slate-400">
                                    mm
                                </span>
                            </div>
                            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                                <Pill>c_min = {fmt(result.cMin)} mm</Pill>
                                <ArrowRight size={14} className="text-slate-300" />
                                <Pill>+ Δc_dev = {fmt(result.dCdev)} mm</Pill>
                                <ArrowRight size={14} className="text-slate-300" />
                                <Pill strong>c_nom = {fmt(result.cNom)} mm</Pill>
                            </div>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            {/* Determinazione di c_min */}
                            <Card>
                                <CardTitle>Determinazione di c_min</CardTitle>
                                <ResultGrid>
                                    <ResultRow
                                        label="c_min,b (aderenza)"
                                        value={fmt(result.cMinB)}
                                        unit="mm"
                                    />
                                    <ResultRow
                                        label="c_min,dur (durabilità)"
                                        value={fmt(result.cMinDur)}
                                        unit="mm"
                                    />
                                    <ResultRow
                                        label="c_min,dur corretto"
                                        value={fmt(result.cMinDurAdj)}
                                        unit="mm"
                                    />
                                    <ResultRow label="minimo assoluto" value="10" unit="mm" />
                                    <ResultRow
                                        label="c_min = max(...)"
                                        value={fmt(result.cMin)}
                                        unit="mm"
                                        strong
                                    />
                                </ResultGrid>
                                <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                                    Governa: <b>{result.governing}</b>
                                </p>
                            </Card>

                            {/* Classe strutturale */}
                            <Card>
                                <CardTitle>
                                    Classe strutturale ({result.exposure.id})
                                </CardTitle>
                                <div className="space-y-1.5">
                                    {result.classSteps.map((s, i) => (
                                        <div
                                            key={i}
                                            className="flex items-center justify-between border-b border-slate-100 py-1 text-sm"
                                        >
                                            <span className="text-slate-500">
                                                {s.label}
                                            </span>
                                            <span
                                                className={`font-semibold tabular-nums ${
                                                    s.delta < 0
                                                        ? "text-emerald-600"
                                                        : s.delta > 0
                                                        ? "text-amber-600"
                                                        : "text-slate-700"
                                                }`}
                                            >
                                                {s.value}
                                            </span>
                                        </div>
                                    ))}
                                    <div className="flex items-center justify-between pt-2">
                                        <span className="text-sm font-semibold text-slate-700">
                                            Classe risultante
                                        </span>
                                        <span className="rounded-lg bg-slate-900 px-3 py-1 text-sm font-bold text-white">
                                            S{result.structuralClass}
                                        </span>
                                    </div>
                                </div>
                            </Card>
                        </div>

                        <div className="grid gap-4 md:grid-cols-[240px_1fr]">
                            <Card>
                                <CardTitle>Dettaglio</CardTitle>
                                <CoverDrawing input={input} result={result} />
                            </Card>

                            <Card>
                                <CardTitle>Copriferro all'asse barra</CardTitle>
                                <p className="text-sm leading-6 text-slate-500">
                                    Distanza dal lembo al baricentro della barra
                                    longitudinale (utile come copriferro "c" per il
                                    calcolo dell'altezza utile d):
                                </p>
                                <div className="mt-3 rounded-xl bg-sky-50 p-4">
                                    <p className="text-sm text-slate-600">
                                        c + φ_staffa + φ/2 ={" "}
                                        {fmt(result.cNom)} + {input.phiStirrup} +{" "}
                                        {input.phi / 2}
                                    </p>
                                    <p className="mt-1 text-2xl font-bold text-slate-900">
                                        {fmt(result.cAxisFromStirrup)} mm
                                    </p>
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

// -------- Disegno del dettaglio copriferro --------
function CoverDrawing({ input, result }) {
    const W = 200;
    const H = 200;
    const cover = result.cNom;
    // scala: assumiamo un bordo di riferimento di ~120 mm rappresentato
    const scale = 1.1;
    const coverPx = Math.min(cover * scale, 90);
    const stirrupPx = input.phiStirrup * scale;
    const barPx = input.phi * scale;

    return (
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Dettaglio copriferro">
            {/* calcestruzzo */}
            <rect x="10" y="10" width={W - 20} height={H - 20} fill="#f1f5f9" stroke="#334155" strokeWidth="2" />
            {/* bordo inferiore/sinistro = superficie esterna */}

            {/* staffa (linea) */}
            <rect
                x={10 + coverPx}
                y={10 + coverPx}
                width={W - 20 - coverPx - 10}
                height={H - 20 - coverPx - 10}
                fill="none"
                stroke="#0284c7"
                strokeWidth={Math.max(2, stirrupPx)}
                opacity="0.5"
            />

            {/* barra longitudinale (in angolo) */}
            <circle
                cx={10 + coverPx + stirrupPx + barPx / 2}
                cy={10 + coverPx + stirrupPx + barPx / 2}
                r={Math.max(4, barPx / 2)}
                fill="#0f172a"
            />

            {/* quota copriferro */}
            <line x1="10" y1={10 + coverPx / 2} x2={10 + coverPx} y2={10 + coverPx / 2} stroke="#dc2626" strokeWidth="1" />
            <text x={12 + coverPx + 2} y={12 + coverPx / 2 + 4} fontSize="11" fill="#dc2626">
                c = {fmt(cover)} mm
            </text>
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
                    EC2 (EN 1992-1-1) §4.4.1 e NTC2018. c_nom = c_min + Δc_dev con
                    c_min = max(c_min,b; c_min,dur + Δc_dur,γ − Δc_dur,st − Δc_dur,add;
                    10 mm). c_min,dur da Tab. 4.4N e classe strutturale (base S4) da
                    Tab. 4.3N. Valori raccomandati EC2: gli Annessi Nazionali possono
                    differire.
                </p>
            </div>
        </div>
    );
}

// -------- primitivi UI --------
function Card({ children }) {
    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            {children}
        </div>
    );
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
            <span
                className={`text-sm tabular-nums ${
                    strong ? "font-bold text-slate-900" : "font-semibold text-slate-700"
                }`}
            >
                {value}
                {unit && <span className="ml-1 text-xs text-slate-400">{unit}</span>}
            </span>
        </div>
    );
}
function Pill({ children, strong }) {
    return (
        <span
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                strong ? "bg-sky-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"
            }`}
        >
            {children}
        </span>
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
            <span className="mb-1 block text-xs font-semibold text-slate-500">
                {label}
            </span>
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
