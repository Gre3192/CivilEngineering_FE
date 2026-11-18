// src/components/concrete/VerifySectionTool.jsx
//
// Strumento: Verifica a pressoflessione retta (SLU) di una sezione
// rettangolare in c.a. con il dominio di resistenza M-N costruito campo per
// campo (forme chiuse del laboratorio "Dominio M-N per campi"): dominio con il
// punto di progetto, disegno dei campi sullo stato di rottura e, in un modal,
// gli accordion con la teoria completa di ciascun campo.

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, XCircle, Info, RotateCcw, Layers, X, Crosshair } from "lucide-react";
import {
    verifySection,
    DEFAULT_VERIFY_INPUT,
    FAILURE_FIELDS,
    CONCRETE_MODELS,
    STEEL_MODELS,
} from "../../lib/concrete/verifySection";
import { pointAt, uToXi, xiToU } from "../../lib/concrete/domainFields";
import { CONCRETE_CLASSES, STEEL_GRADES } from "../../lib/concrete/sectionDesign";
import ConcreteDiagram from "./ConcreteDiagram";
import SteelDiagram from "./SteelDiagram";
import { AllFieldsCard, DomainChart, FieldsPanel } from "./DomainFieldsTool";

// Colori dei campi di rottura (gli stessi del laboratorio)
const FIELD_COLORS = { 1: "#7c3aed", 2: "#2563eb", 3: "#db2777", 4: "#ca8a04", 5: "#ea580c", 6: "#dc2626" };

function fmt(v, dec = 0) {
    if (v === undefined || v === null || Number.isNaN(v)) return "-";
    if (v === Infinity) return "+∞";
    if (v === -Infinity) return "−∞";
    return Number(v).toLocaleString("it-IT", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

// initialInput: dati di partenza (es. dalla sezione di una trave dell'edificio)
export default function VerifySectionTool({ initialInput = null } = {}) {
    const [input, setInput] = useState(() => (initialInput ? { ...DEFAULT_VERIFY_INPUT, ...initialInput } : DEFAULT_VERIFY_INPUT));
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [adim, setAdim] = useState(false);
    const [showFields, setShowFields] = useState(false);
    const [allMode, setAllMode] = useState("fields");

    const result = useMemo(() => verifySection(input), [input]);

    // disegno dei campi: parte dallo stato di rottura di progetto e ci torna
    // ogni volta che cambia (cambiando i dati il cursore si riallinea)
    const designKey = result.ok && result.rd ? `${result.sign}:${result.rd.xi}` : "none";
    const designSlider = result.ok && result.rd ? Math.round(1000 * xiToU(result.rd.xi)) : 500;
    const [view, setView] = useState({ key: null, slider: 500, branch: 1 });
    const cur = view.key === designKey ? view : { key: designKey, slider: designSlider, branch: result.ok ? result.sign : 1 };
    const atDesign = cur.slider === designSlider && cur.branch === (result.ok ? result.sign : 1);
    const closeFields = useCallback(() => setShowFields(false), []);
    // sullo stato di progetto si usa ξ esatto (il cursore ha passi finiti)
    const viewXi = atDesign && result.ok && result.rd ? result.rd.xi : uToXi(cur.slider / 1000);

    function setField(field, value) {
        setInput((prev) => ({ ...prev, [field]: value }));
    }
    function setNumber(field, value) {
        const n = Number(value);
        setField(field, Number.isNaN(n) ? 0 : n);
    }

    return (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
            {/* -------- INPUT -------- */}
            <div className="space-y-4">
                <Card>
                    <CardTitle>Geometria</CardTitle>
                    <div className="grid grid-cols-2 gap-3">
                        <NumberField label="Base b" unit="mm" value={input.b} onChange={(v) => setNumber("b", v)} />
                        <NumberField label="Altezza h" unit="mm" value={input.h} onChange={(v) => setNumber("h", v)} />
                        <NumberField label="Copriferro c (inferiore)" unit="mm" value={input.c} onChange={(v) => setNumber("c", v)} />
                        <NumberField label="Copriferro c' (superiore)" unit="mm" value={input.cPrime} onChange={(v) => setNumber("cPrime", v)} />
                    </div>
                </Card>

                <Card>
                    <CardTitle>Armatura</CardTitle>
                    <div className="grid grid-cols-2 gap-3">
                        <NumberField label="A_s (inferiore)" unit="mm²" value={input.As} onChange={(v) => setNumber("As", v)} />
                        <NumberField label="A_s' (superiore)" unit="mm²" value={input.AsPrime} onChange={(v) => setNumber("AsPrime", v)} />
                    </div>
                </Card>

                <Card>
                    <CardTitle>Sollecitazioni di progetto</CardTitle>
                    <div className="grid grid-cols-2 gap-3">
                        <NumberField label="N_Ed (compr. +)" unit="kN" value={input.NEd} onChange={(v) => setNumber("NEd", v)} />
                        <NumberField label="M_Ed" unit="kNm" value={input.MEd} onChange={(v) => setNumber("MEd", v)} />
                    </div>
                    <p className="mt-2 text-[11px] leading-4 text-slate-400">M_Ed &gt; 0 tende le fibre inferiori (A_s), M_Ed &lt; 0 quelle superiori: si usa il ramo del dominio con lo stesso segno.</p>
                </Card>

                <Card>
                    <CardTitle>Materiali</CardTitle>
                    <div className="grid grid-cols-2 gap-3">
                        <SelectField label="Calcestruzzo" value={input.fck} onChange={(v) => setNumber("fck", v)}
                            options={CONCRETE_CLASSES.map((c) => ({ value: c.fck, label: c.id }))} />
                        <SelectField label="Acciaio" value={input.fyk} onChange={(v) => setNumber("fyk", v)}
                            options={STEEL_GRADES.map((s) => ({ value: s.fyk, label: s.id }))} />
                    </div>
                </Card>

                <Card>
                    <CardTitle>Diagramma calcestruzzo</CardTitle>
                    <SelectField label="Modello costitutivo" value={input.concreteModel} onChange={(v) => setField("concreteModel", v)}
                        options={CONCRETE_MODELS.map((m) => ({ value: m.id, label: m.label }))} />
                    {result.ok && <ConcreteDiagram fcd={result.fcd} model={input.concreteModel} />}
                </Card>

                <Card>
                    <CardTitle>Diagramma acciaio</CardTitle>
                    <SelectField label="Modello costitutivo" value={input.steelModel} onChange={(v) => setField("steelModel", v)}
                        options={STEEL_MODELS.map((m) => ({ value: m.id, label: m.label }))} />
                    {input.steelModel === "hardening" && (
                        <div className="mt-3">
                            <NumberField label="k_s = f_t/f_y" value={input.ks} step="0.01" onChange={(v) => setNumber("ks", v)} />
                        </div>
                    )}
                    {input.steelModel === "ductile" && (
                        <p className="mt-2 text-[11px] leading-4 text-slate-400">Senza limite di deformazione dell'acciaio non c'è il pivot A: i campi 1 e 2 non esistono, la crisi è sempre lato calcestruzzo.</p>
                    )}
                    {result.ok && <SteelDiagram fyd={result.fyd} model={input.steelModel === "hardening" ? "hardening" : "ep"} ks={input.ks} />}
                </Card>

                <Card>
                    <button type="button" onClick={() => setShowAdvanced((p) => !p)} className="flex w-full items-center justify-between text-sm font-semibold text-slate-600">
                        Coefficienti parziali
                        <span className="text-xs text-slate-400">{showAdvanced ? "nascondi" : "mostra"}</span>
                    </button>
                    {showAdvanced && (
                        <div className="mt-3 grid grid-cols-3 gap-3">
                            <NumberField label="α_cc" value={input.alphaCc} step="0.05" onChange={(v) => setNumber("alphaCc", v)} />
                            <NumberField label="γ_c" value={input.gammaC} step="0.05" onChange={(v) => setNumber("gammaC", v)} />
                            <NumberField label="γ_s" value={input.gammaS} step="0.05" onChange={(v) => setNumber("gammaS", v)} />
                        </div>
                    )}
                </Card>

                <button type="button" onClick={() => setInput(initialInput ? { ...DEFAULT_VERIFY_INPUT, ...initialInput } : DEFAULT_VERIFY_INPUT)}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">
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
                                    {result.errors.map((e) => <li key={e}>{e}</li>)}
                                </ul>
                            </div>
                        </div>
                    </Card>
                ) : (
                    <>
                        <VerdictBanner result={result} />

                        <Card>
                                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                    <h3 className="text-sm font-bold text-slate-800">Dominio di resistenza M-N</h3>
                                    <Segmented value={adim ? "adim" : "dim"} onChange={(v) => setAdim(v === "adim")}
                                        options={[{ value: "dim", label: "N, M" }, { value: "adim", label: "ν, μ" }]} />
                                </div>
                                <DomainChart data={result.data} adim={adim} design={result.design}
                                    global={{ pt: pointAt(result.data, cur.branch, viewXi) }} />
                            </Card>

                            <div className="grid gap-4 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
                                <Card>
                                    <CardTitle>Risultati</CardTitle>
                                    <ResultGrid>
                                        <ResultRow label={`M_Rd @ N_Ed (ramo M ${result.sign > 0 ? ">" : "<"} 0)`} value={fmt(result.MRdAtN, 1)} unit="kNm" strong />
                                        <ResultRow label="M_Ed" value={fmt(result.MEd, 1)} unit="kNm" />
                                        <ResultRow label="M_Rd (N = 0)" value={fmt(result.MRd0, 1)} unit="kNm" />
                                        <ResultRow label="M_Rd,max (ramo +)" value={fmt(result.MRdMax, 1)} unit="kNm" />
                                        <ResultRow label="N @ M_Rd,max" value={fmt(result.NatMmax, 0)} unit="kN" />
                                        <ResultRow label="M_Rd,min (ramo −)" value={fmt(result.MRdMin, 1)} unit="kNm" />
                                        <ResultRow label="N_Rd trazione" value={fmt(result.NRdMin, 0)} unit="kN" />
                                        <ResultRow label="N_Rd compressione" value={fmt(result.NRdMax, 0)} unit="kN" />
                                    </ResultGrid>

                                    {result.failureField && (
                                        <div className="mt-3 space-y-1 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
                                            <p className="flex items-center gap-2">
                                                <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: FIELD_COLORS[result.failureField] }} />
                                                <span>Rottura in <b>{FAILURE_FIELDS[result.failureField].label}</b>{result.failureSub && result.failureSub !== String(result.failureField) ? <> (sottocampo <b>{result.failureSub}</b>)</> : ""} – {FAILURE_FIELDS[result.failureField].desc}</span>
                                            </p>
                                            <p className="pl-5 text-slate-500">ξ = x/d = <b>{fmt(result.xiDesign, 4)}</b>{result.xDesign !== null ? <>, x = <b>{fmt(result.xDesign, 1)}</b> mm</> : ""}</p>
                                        </div>
                                    )}

                                    <button type="button" onClick={() => setShowFields(true)}
                                        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700">
                                        <Layers size={16} />
                                        Campi di rottura: teoria e formule
                                    </button>
                                </Card>

                                <Card>
                                    <CardTitle>Materiali</CardTitle>
                                    <ResultGrid>
                                        <ResultRow label="f_cd" value={fmt(result.fcd, 2)} unit="MPa" />
                                        <ResultRow label="f_yd" value={fmt(result.fyd, 2)} unit="MPa" />
                                        <ResultRow label="ε_cu" value={fmt(result.epsCu * 1000, 2)} unit="‰" />
                                        <ResultRow label="ε_su" value={result.epsSu === Infinity ? "∞" : fmt(result.epsSu * 1000, 1)} unit="‰" />
                                        <ResultRow label="d (ramo +)" value={fmt(result.d, 0)} unit="mm" />
                                    </ResultGrid>
                                </Card>
                            </div>

                        <AllFieldsCard data={result.data} branch={cur.branch} onBranch={(v) => setView({ ...cur, branch: v })}
                            slider={cur.slider} onSlider={(v) => setView({ ...cur, slider: v })} mode={allMode} onMode={setAllMode} xi={viewXi}
                            title="Campi di rottura sulla sezione"
                            actions={
                                <button type="button" disabled={atDesign} onClick={() => setView({ key: designKey, slider: designSlider, branch: result.sign })}
                                    className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-default disabled:opacity-50">
                                    <Crosshair size={13} />
                                    Stato di progetto
                                </button>}
                            intro={
                                <p className="mb-3 text-xs leading-5 text-slate-600">
                                    Il disegno parte dallo <b>stato di rottura di progetto</b> (stesso N<sub>Ed</sub>, ramo del segno di M<sub>Ed</sub>): asse neutro,
                                    deformazioni, legami percorsi e forze interne. Trascina la freccia dell'asse neutro o usa il cursore per percorrere tutti
                                    i campi: il rombo nel dominio segue lo stato del disegno.
                                </p>} />

                        <AssumptionsBox />
                    </>
                )}
            </div>

            {showFields && result.ok && <FieldsModal result={result} onClose={closeFields} />}
        </div>
    );
}

// -------- Modal con gli accordion dei campi della sezione corrente --------
function FieldsModal({ result, onClose }) {
    useEffect(() => {
        const onKey = (e) => { if (e.key === "Escape") onClose(); };
        window.addEventListener("keydown", onKey);
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
    }, [onClose]);
    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 p-3 backdrop-blur-[2px] sm:p-6"
            role="dialog" aria-modal="true" aria-label="Campi di rottura" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="flex max-h-full w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-slate-50 shadow-2xl">
                <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-3">
                    <div>
                        <p className="text-sm font-bold text-slate-800">Campi di rottura della sezione</p>
                        <p className="text-xs text-slate-500">Per ogni campo: stati deformativi, legami, congruenza e sottocampi, equazioni, stato corrente con il controllo numerico.</p>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Chiudi" title="Chiudi (Esc)" className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800">
                        <X size={18} />
                    </button>
                </div>
                <div className="overflow-y-auto p-4 sm:p-5">
                    <FieldsPanel data={result.data} design={result.design} />
                </div>
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
                <p className="text-lg font-bold text-slate-800">{ok ? "Verifica soddisfatta" : "Verifica NON soddisfatta"}</p>
                <p className="mt-0.5 text-sm text-slate-600">
                    {!result.axialInRange
                        ? `Sforzo normale N_Ed fuori dal dominio resistente (${fmt(result.NRdMin, 0)} ≤ N_Rd ≤ ${fmt(result.NRdMax, 0)} kN).`
                        : !ok && util <= 1
                            ? "Il punto esce dal dominio dal lato del ramo opposto: la sezione asimmetrica non ammette un momento così piccolo a questo N_Ed."
                            : Number.isFinite(util)
                                ? `M_Ed / M_Rd(N_Ed) = ${fmt(util, 3)} · sfruttamento ${fmt(util * 100, 0)}%`
                                : `A N_Ed = ${fmt(result.NEd, 0)} kN il dominio non raggiunge momenti di questo segno: il punto è fuori.`}
                </p>
                {result.axialInRange && (
                    <p className="mt-0.5 text-xs text-slate-500">
                        A N_Ed = {fmt(result.NEd, 0)} kN: M_Rd,− = {fmt(result.rdNeg.M, 1)} kNm ≤ M ≤ M_Rd,+ = {fmt(result.rdPos.M, 1)} kNm
                    </p>
                )}
            </div>
            {result.axialInRange && Number.isFinite(util) && (ok || util > 1) && (
                <div className="w-40">
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/70">
                        <div className={`h-full rounded-full ${ok ? "bg-emerald-500" : "bg-red-500"}`} style={{ width: `${Math.min(util * 100, 100)}%` }} />
                    </div>
                </div>
            )}
        </div>
    );
}

function AssumptionsBox() {
    return (
        <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
            <Info size={18} className="mt-0.5 shrink-0 text-slate-400" />
            <div>
                <p className="font-semibold text-slate-600">Ipotesi di calcolo</p>
                <p className="mt-1 leading-6">
                    Pressoflessione retta, SLU, sezioni piane e perfetta aderenza. Dominio M-N costruito campo per campo in forma chiusa:
                    pivot A (acciaio a ε_ud = 67,5‰), B (cls a ε_cu), C (cls a ε_c2 = 2‰, o ε_c3 = 1,75‰ con il triangolo-rettangolo).
                    Calcestruzzo non reagente a trazione, con ψ e λ del diagramma scelto (lo stress-block è σ = f_cd per ε ≥ 0,2·ε_cu:
                    0,8x nei campi 3–5); acciaio con E_s = 200 GPa. N &gt; 0 compressione, M riferito a h/2, M &gt; 0 tende A_s.
                    Verifica: allo stesso N_Ed, M_Rd,− ≤ M_Ed ≤ M_Rd,+. Le formule di ogni campo, con il confronto numerico, sono nel pannello
                    «Campi di rottura».
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
function Segmented({ value, onChange, options }) {
    return (
        <div className="inline-flex rounded-xl bg-slate-100 p-1">
            {options.map((o) => (
                <button key={o.value} type="button" onClick={() => onChange(o.value)}
                    className={`cursor-pointer rounded-lg px-3 py-1 text-xs font-semibold transition ${value === o.value ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                    {o.label}
                </button>
            ))}
        </div>
    );
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
function NumberField({ label, unit, value, onChange, step = "1" }) {
    return (
        <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-500">
                {label}
                {unit && <span className="ml-1 text-slate-400">[{unit}]</span>}
            </span>
            <input type="number" value={value} step={step} onChange={(e) => onChange(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100" />
        </label>
    );
}
function SelectField({ label, value, onChange, options }) {
    return (
        <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-500">{label}</span>
            <select value={value} onChange={(e) => onChange(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100">
                {options.map((opt) => <option key={String(opt.value) + opt.label} value={opt.value}>{opt.label}</option>)}
            </select>
        </label>
    );
}
