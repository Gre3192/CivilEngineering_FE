// src/components/concrete/SectionDesignTool.jsx
//
// Strumento: Progetto a flessione (SLU) di una sezione rettangolare in c.a.
// Impostazione Tecnica delle Costruzioni (NTC2018 / EC2, stress-block).

import { useMemo, useState } from "react";
import { CheckCircle2, AlertTriangle, Info, RotateCcw } from "lucide-react";
import {
    designSection,
    CONCRETE_CLASSES,
    STEEL_GRADES,
    DEFAULT_INPUT,
} from "../../lib/concrete/sectionDesign";

const BAR_DIAMETERS = [10, 12, 14, 16, 18, 20, 24, 26];

function fmt(value, dec = 2) {
    if (value === undefined || value === null || Number.isNaN(value)) return "-";
    return Number(value).toLocaleString("it-IT", {
        minimumFractionDigits: dec,
        maximumFractionDigits: dec,
    });
}

export default function SectionDesignTool() {
    const [input, setInput] = useState(DEFAULT_INPUT);
    const [showAdvanced, setShowAdvanced] = useState(false);

    const result = useMemo(() => designSection(input), [input]);

    function setField(field, value) {
        setInput((prev) => ({ ...prev, [field]: value }));
    }

    function setNumber(field, value) {
        const n = Number(value);
        setField(field, Number.isNaN(n) ? 0 : n);
    }

    function reset() {
        setInput(DEFAULT_INPUT);
    }

    return (
        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
            {/* ---------------- INPUT ---------------- */}
            <div className="space-y-4">
                <Card>
                    <CardTitle>Geometria</CardTitle>
                    <div className="grid grid-cols-2 gap-3">
                        <NumberField
                            label="Base b"
                            unit="mm"
                            value={input.b}
                            onChange={(v) => setNumber("b", v)}
                        />
                        <NumberField
                            label="Altezza h"
                            unit="mm"
                            value={input.h}
                            onChange={(v) => setNumber("h", v)}
                        />
                        <NumberField
                            label="Copriferro c (teso)"
                            unit="mm"
                            value={input.c}
                            onChange={(v) => setNumber("c", v)}
                        />
                        <NumberField
                            label="Copriferro c' (compr.)"
                            unit="mm"
                            value={input.cPrime}
                            onChange={(v) => setNumber("cPrime", v)}
                        />
                    </div>
                </Card>

                <Card>
                    <CardTitle>Sollecitazione</CardTitle>
                    <NumberField
                        label="Momento di progetto M_Ed"
                        unit="kNm"
                        value={input.MEd}
                        onChange={(v) => setNumber("MEd", v)}
                    />
                </Card>

                <Card>
                    <CardTitle>Materiali</CardTitle>
                    <div className="grid grid-cols-2 gap-3">
                        <SelectField
                            label="Calcestruzzo"
                            value={input.fck}
                            onChange={(v) => setNumber("fck", v)}
                            options={CONCRETE_CLASSES.map((cls) => ({
                                value: cls.fck,
                                label: cls.id,
                            }))}
                        />
                        <SelectField
                            label="Acciaio"
                            value={input.fyk}
                            onChange={(v) => setNumber("fyk", v)}
                            options={STEEL_GRADES.map((s) => ({
                                value: s.fyk,
                                label: s.id,
                            }))}
                        />
                    </div>
                </Card>

                <Card>
                    <CardTitle>Barre di progetto</CardTitle>
                    <SelectField
                        label="Diametro φ"
                        value={input.phi}
                        onChange={(v) => setNumber("phi", v)}
                        options={BAR_DIAMETERS.map((d) => ({
                            value: d,
                            label: `φ ${d}`,
                        }))}
                    />
                </Card>

                <Card>
                    <button
                        type="button"
                        onClick={() => setShowAdvanced((p) => !p)}
                        className="flex w-full items-center justify-between text-sm font-semibold text-slate-600"
                    >
                        Coefficienti parziali
                        <span className="text-xs text-slate-400">
                            {showAdvanced ? "nascondi" : "mostra"}
                        </span>
                    </button>

                    {showAdvanced && (
                        <div className="mt-3 grid grid-cols-3 gap-3">
                            <NumberField
                                label="α_cc"
                                value={input.alphaCc}
                                step="0.05"
                                onChange={(v) => setNumber("alphaCc", v)}
                            />
                            <NumberField
                                label="γ_c"
                                value={input.gammaC}
                                step="0.05"
                                onChange={(v) => setNumber("gammaC", v)}
                            />
                            <NumberField
                                label="γ_s"
                                value={input.gammaS}
                                step="0.05"
                                onChange={(v) => setNumber("gammaS", v)}
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

            {/* ---------------- OUTPUT ---------------- */}
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
                        <SummaryBanner result={result} />

                        <div className="grid gap-4 md:grid-cols-[1fr_240px]">
                            <div className="space-y-4">
                                <Card>
                                    <CardTitle>Materiali e sezione</CardTitle>
                                    <ResultGrid>
                                        <ResultRow
                                            label="f_cd"
                                            value={fmt(result.fcd)}
                                            unit="MPa"
                                        />
                                        <ResultRow
                                            label="f_yd"
                                            value={fmt(result.fyd)}
                                            unit="MPa"
                                        />
                                        <ResultRow
                                            label="f_ctm"
                                            value={fmt(result.fctm)}
                                            unit="MPa"
                                        />
                                        <ResultRow
                                            label="Altezza utile d"
                                            value={fmt(result.d, 0)}
                                            unit="mm"
                                        />
                                        <ResultRow
                                            label="ε_yd"
                                            value={fmt(result.epsYd * 1000, 2)}
                                            unit="‰"
                                        />
                                        <ResultRow
                                            label="ε_cu"
                                            value={fmt(result.epsCu * 1000, 1)}
                                            unit="‰"
                                        />
                                    </ResultGrid>
                                </Card>

                                <Card>
                                    <CardTitle>Progetto a flessione</CardTitle>
                                    <ResultGrid>
                                        <ResultRow
                                            label="μ (sollecitante)"
                                            value={fmt(result.mu, 3)}
                                        />
                                        <ResultRow
                                            label="μ_lim"
                                            value={fmt(result.muLim, 3)}
                                        />
                                        <ResultRow
                                            label="ξ = x/d"
                                            value={fmt(result.xi, 3)}
                                        />
                                        <ResultRow
                                            label="Asse neutro x"
                                            value={fmt(result.x, 1)}
                                            unit="mm"
                                        />
                                        <ResultRow
                                            label="Braccio z"
                                            value={fmt(result.z, 1)}
                                            unit="mm"
                                        />
                                        {result.doubleReinf && (
                                            <>
                                                <ResultRow
                                                    label="M1 (semplice)"
                                                    value={fmt(result.M1 / 1e6, 1)}
                                                    unit="kNm"
                                                />
                                                <ResultRow
                                                    label="M2 (coppia)"
                                                    value={fmt(result.M2 / 1e6, 1)}
                                                    unit="kNm"
                                                />
                                                <ResultRow
                                                    label="σ_s' (compr.)"
                                                    value={fmt(result.sigmaSc, 1)}
                                                    unit="MPa"
                                                />
                                            </>
                                        )}
                                    </ResultGrid>
                                </Card>
                            </div>

                            <Card>
                                <CardTitle>Sezione</CardTitle>
                                <SectionDrawing input={input} result={result} />
                            </Card>
                        </div>

                        <Card>
                            <CardTitle>Armatura</CardTitle>
                            <ResultGrid>
                                <ResultRow
                                    label="A_s richiesta (calcolo)"
                                    value={fmt(result.AsRequired, 0)}
                                    unit="mm²"
                                />
                                <ResultRow
                                    label="A_s,min"
                                    value={fmt(result.AsMin, 0)}
                                    unit="mm²"
                                    warn={result.belowMin}
                                />
                                <ResultRow
                                    label="A_s,max"
                                    value={fmt(result.AsMax, 0)}
                                    unit="mm²"
                                    warn={result.exceedsMax}
                                />
                                <ResultRow
                                    label="A_s di progetto"
                                    value={fmt(result.AsDesign, 0)}
                                    unit="mm²"
                                    strong
                                />
                            </ResultGrid>

                            <div className="mt-4 rounded-xl bg-sky-50 p-4">
                                <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">
                                    Armatura tesa proposta
                                </p>
                                <p className="mt-1 text-2xl font-bold text-slate-900">
                                    {result.nBars} φ {result.phi}
                                </p>
                                <p className="mt-1 text-sm text-slate-500">
                                    A_s = {fmt(result.AsProvided, 0)} mm² · sfruttamento{" "}
                                    {fmt(result.utilization * 100, 0)}%
                                </p>

                                {result.doubleReinf && (
                                    <>
                                        <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-sky-700">
                                            Armatura compressa proposta
                                        </p>
                                        <p className="mt-1 text-2xl font-bold text-slate-900">
                                            {result.nBarsPrime} φ {result.phi}
                                        </p>
                                        <p className="mt-1 text-sm text-slate-500">
                                            A_s' = {fmt(result.AsPrimeProvided, 0)} mm²
                                        </p>
                                    </>
                                )}
                            </div>
                        </Card>

                        <AssumptionsBox />
                    </>
                )}
            </div>
        </div>
    );
}

// ---------------- Sotto-componenti ----------------

function SummaryBanner({ result }) {
    const warn = result.belowMin || result.exceedsMax;

    return (
        <div
            className={`flex items-start gap-3 rounded-2xl border p-4 ${
                warn
                    ? "border-amber-200 bg-amber-50"
                    : "border-emerald-200 bg-emerald-50"
            }`}
        >
            {warn ? (
                <AlertTriangle size={22} className="mt-0.5 shrink-0 text-amber-600" />
            ) : (
                <CheckCircle2 size={22} className="mt-0.5 shrink-0 text-emerald-600" />
            )}

            <div>
                <p className="font-semibold text-slate-800">
                    {result.doubleReinf
                        ? "Sezione a doppia armatura"
                        : "Sezione ad armatura semplice"}
                </p>
                <p className="mt-0.5 text-sm text-slate-600">
                    {result.exceedsMax
                        ? "Attenzione: A_s supera il massimo (0,04·A_c): aumentare la sezione."
                        : result.belowMin
                        ? "A_s da calcolo inferiore al minimo di normativa: si adotta A_s,min."
                        : result.doubleReinf
                        ? "μ > μ_lim: necessaria armatura compressa."
                        : "μ ≤ μ_lim: armatura tesa sufficiente."}
                </p>
            </div>
        </div>
    );
}

function SectionDrawing({ input, result }) {
    const { b, h, c, cPrime } = input;
    const { x, doubleReinf } = result;

    // Scala per adattare l'altezza a ~230 px
    const maxH = 230;
    const scale = maxH / h;
    const w = b * scale;
    const ht = h * scale;

    const padX = 30;
    const padY = 20;
    const svgW = w + padX * 2 + 40;
    const svgH = ht + padY * 2 + 20;

    const bars = distributeBars(result.nBars, b, c, scale, padX, padY + ht - c * scale);
    const barsTop = doubleReinf
        ? distributeBars(result.nBarsPrime, b, cPrime, scale, padX, padY + cPrime * scale)
        : [];

    const barR = Math.max(3, (input.phi * scale) / 2);
    const xLineY = padY + x * scale; // asse neutro (compressione in alto)

    return (
        <svg
            width="100%"
            viewBox={`0 0 ${svgW} ${svgH}`}
            className="mx-auto"
            role="img"
            aria-label="Sezione in c.a."
        >
            {/* Zona compressa (sopra l'asse neutro) */}
            <rect
                x={padX}
                y={padY}
                width={w}
                height={Math.min(x * scale, ht)}
                fill="#e0f2fe"
            />
            {/* Contorno sezione */}
            <rect
                x={padX}
                y={padY}
                width={w}
                height={ht}
                fill="none"
                stroke="#334155"
                strokeWidth="2"
            />

            {/* Asse neutro */}
            {x > 0 && x * scale < ht && (
                <line
                    x1={padX - 6}
                    y1={xLineY}
                    x2={padX + w + 6}
                    y2={xLineY}
                    stroke="#0284c7"
                    strokeWidth="1.5"
                    strokeDasharray="6 4"
                />
            )}

            {/* Barre tese */}
            {bars.map((bx, i) => (
                <circle key={`b-${i}`} cx={bx} cy={bars.y} r={barR} fill="#0f172a" />
            ))}

            {/* Barre compresse */}
            {barsTop.map((bx, i) => (
                <circle
                    key={`t-${i}`}
                    cx={bx}
                    cy={barsTop.y}
                    r={barR}
                    fill="#64748b"
                />
            ))}

            {/* Quote */}
            <text
                x={padX + w / 2}
                y={padY + ht + 15}
                textAnchor="middle"
                fontSize="11"
                fill="#64748b"
            >
                b = {b} mm
            </text>
            <text
                x={padX + w + 12}
                y={padY + ht / 2}
                textAnchor="middle"
                fontSize="11"
                fill="#64748b"
                transform={`rotate(90 ${padX + w + 12} ${padY + ht / 2})`}
            >
                h = {h} mm
            </text>
        </svg>
    );
}

// Restituisce le coordinate x delle barre e la coord y comune.
function distributeBars(n, b, cover, scale, padX, y) {
    const arr = [];
    if (n <= 0) return Object.assign(arr, { y });

    const usable = b - 2 * cover;
    for (let i = 0; i < n; i++) {
        const pos = n === 1 ? b / 2 : cover + (usable * i) / (n - 1);
        arr.push(padX + pos * scale);
    }
    arr.y = y;
    return arr;
}

function AssumptionsBox() {
    return (
        <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
            <Info size={18} className="mt-0.5 shrink-0 text-slate-400" />
            <div>
                <p className="font-semibold text-slate-600">Ipotesi di calcolo</p>
                <p className="mt-1 leading-6">
                    Flessione semplice retta, SLU. Diagramma del calcestruzzo
                    stress-block (λ=0,8; η=1,0 per fck ≤ 50 MPa), ε_cu = 3,5‰,
                    acciaio elasto-plastico con Es = 200 GPa. Progetto ad armatura
                    semplice; per μ &gt; μ_lim si introduce armatura compressa
                    (doppia armatura). Armature limite secondo NTC2018 §4.1.6.1.1.
                </p>
            </div>
        </div>
    );
}

function Card({ children }) {
    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            {children}
        </div>
    );
}

function CardTitle({ children }) {
    return (
        <h3 className="mb-3 text-sm font-bold text-slate-800">{children}</h3>
    );
}

function ResultGrid({ children }) {
    return <div className="grid grid-cols-2 gap-x-4 gap-y-2">{children}</div>;
}

function ResultRow({ label, value, unit, strong, warn }) {
    return (
        <div className="flex items-baseline justify-between border-b border-slate-100 py-1">
            <span className="text-xs text-slate-500">{label}</span>
            <span
                className={`text-sm tabular-nums ${
                    warn
                        ? "font-bold text-amber-600"
                        : strong
                        ? "font-bold text-slate-900"
                        : "font-semibold text-slate-700"
                }`}
            >
                {value}
                {unit && <span className="ml-1 text-xs text-slate-400">{unit}</span>}
            </span>
        </div>
    );
}

function NumberField({ label, unit, value, onChange, step }) {
    return (
        <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-500">
                {label}
                {unit && <span className="ml-1 text-slate-400">[{unit}]</span>}
            </span>
            <input
                type="number"
                value={value}
                step={step || "1"}
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
                    <option key={opt.label} value={opt.value}>
                        {opt.label}
                    </option>
                ))}
            </select>
        </label>
    );
}
