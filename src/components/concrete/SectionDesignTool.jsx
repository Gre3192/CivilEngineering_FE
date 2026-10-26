// src/components/concrete/SectionDesignTool.jsx
//
// Strumento: Progetto (dimensionamento) a flessione (SLU) di una sezione
// rettangolare in c.a. — metodo degli appunti (X = 0.2593 d).

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, AlertTriangle, Info, RotateCcw, ChevronDown, Copy, Download, Check } from "lucide-react";
import {
    designSection,
    CONCRETE_CLASSES,
    STEEL_GRADES,
    CONCRETE_MODELS,
    DESIGN_MODES,
    STEEL_MODELS,
    DEFAULT_INPUT,
} from "../../lib/concrete/sectionDesign";
import Tex, { Eq, texNum as T } from "../Tex";
import ConcreteDiagram from "./ConcreteDiagram";
import SteelDiagram from "./SteelDiagram";

const BAR_DIAMETERS = [10, 12, 14, 16, 18, 20, 24, 26];
const STIRRUP_DIAMETERS = [6, 8, 10, 12];

function fmt(value, dec = 2) {
    if (value === undefined || value === null || Number.isNaN(value) || !Number.isFinite(value)) return "-";
    return Number(value).toLocaleString("it-IT", {
        minimumFractionDigits: dec,
        maximumFractionDigits: dec,
    });
}

export default function SectionDesignTool() {
    const [input, setInput] = useState(DEFAULT_INPUT);
    const [adoptedDimensions, setAdoptedDimensions] = useState({});
    const [adoptedReinforcement, setAdoptedReinforcement] = useState({});
    const [cardCommand, setCardCommand] = useState({ id: 0, open: null });
    const [showSteps, setShowSteps] = useState(false);
    const [drawUnit, setDrawUnit] = useState("mm"); // unità delle quote del disegno
    const drawingSvgRef = useRef(null);
    const forcesSvgRef = useRef(null);
    const copiedTimer = useRef(null);
    const savedTimer = useRef(null);
    const copiedTimerF = useRef(null);
    const savedTimerF = useRef(null);
    const [exportMessage, setExportMessage] = useState("");
    const [isCopied, setIsCopied] = useState(false);
    const [isSaved, setIsSaved] = useState(false);
    const [isCopiedF, setIsCopiedF] = useState(false);
    const [isSavedF, setIsSavedF] = useState(false);

    const result = useMemo(() => designSection(input), [input]);

    const createPng = async (ref, w, h) => {
        const svg = ref.current;
        if (!svg) throw new Error("Disegno non disponibile");
        const clone = svg.cloneNode(true);
        clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
        clone.setAttribute("width", String(w * 2));
        clone.setAttribute("height", String(h * 2));
        const svgBlob = new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(svgBlob);
        try {
            const image = new Image();
            const imageReady = new Promise((resolve, reject) => {
                image.onload = resolve;
                image.onerror = () => reject(new Error("Impossibile esportare il disegno"));
            });
            image.src = url;
            await imageReady;
            const canvas = document.createElement("canvas");
            canvas.width = w * 2;
            canvas.height = h * 2;
            const context = canvas.getContext("2d");
            context.fillStyle = "#ffffff";
            context.fillRect(0, 0, canvas.width, canvas.height);
            context.drawImage(image, 0, 0, canvas.width, canvas.height);
            return await new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Impossibile creare il PNG")), "image/png"));
        } finally {
            URL.revokeObjectURL(url);
        }
    };
    const runCopy = async (ref, w, h, setFlag, timer) => {
        try {
            if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") throw new Error("Copia immagine non supportata dal browser");
            const png = await createPng(ref, w, h);
            await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
            setExportMessage("");
            setFlag(true);
            window.clearTimeout(timer.current);
            timer.current = window.setTimeout(() => setFlag(false), 1600);
        } catch {
            setExportMessage("Copia non riuscita: verifica i permessi del browser");
        }
    };
    const runSave = async (ref, w, h, filename, setFlag, timer) => {
        try {
            const png = await createPng(ref, w, h);
            const url = URL.createObjectURL(png);
            const link = document.createElement("a");
            link.href = url;
            link.download = filename;
            link.click();
            window.setTimeout(() => URL.revokeObjectURL(url), 1000);
            setExportMessage("");
            setFlag(true);
            window.clearTimeout(timer.current);
            timer.current = window.setTimeout(() => setFlag(false), 1600);
        } catch {
            setExportMessage("Salvataggio non riuscito");
        }
    };
    const copyImage = () => runCopy(drawingSvgRef, BOX_W, BOX_H, setIsCopied, copiedTimer);
    const saveImage = () => runSave(drawingSvgRef, BOX_W, BOX_H, "sezione-progettata.png", setIsSaved, savedTimer);
    const copyForces = () => runCopy(forcesSvgRef, SIDE_BOX_W, SIDE_BOX_H, setIsCopiedF, copiedTimerF);
    const saveForces = () => runSave(forcesSvgRef, SIDE_BOX_W, SIDE_BOX_H, "forze-interne.png", setIsSavedF, savedTimerF);

    const calculatedB = result.ok && result.mode === "fixH" ? result.Breq : result.ok ? result.B : 0;
    const calculatedH = result.ok && result.mode === "fixB" ? result.dReq + input.c : result.ok ? result.h : 0;
    const adoptedB = Number(adoptedDimensions.B) > 0 ? Number(adoptedDimensions.B) : calculatedB;
    const adoptedH = Number(adoptedDimensions.h) > 0 ? Number(adoptedDimensions.h) : calculatedH;
    const selectedTensionBars = Number(adoptedReinforcement.tensionBars ?? result.nBars);
    const selectedTensionPhi = Number(adoptedReinforcement.tensionPhi || result.phi);
    const selectedCompressionBars = Number(adoptedReinforcement.compressionBars ?? result.nBarsPrime);
    const selectedCompressionPhi = Number(adoptedReinforcement.compressionPhi || result.phi);
    const adoptedTensionBars = selectedTensionBars >= 2 ? selectedTensionBars : result.ok ? result.nBars : 0;
    const adoptedCompressionBars = result.ok && result.AsPrime > 0
        ? selectedCompressionBars >= 2 ? selectedCompressionBars : result.nBarsPrime
        : 0;
    const adoptedTensionPhi = selectedTensionPhi > 0 ? selectedTensionPhi : result.ok ? result.phi : input.phi;
    const adoptedCompressionPhi = selectedCompressionPhi > 0 ? selectedCompressionPhi : result.ok ? result.phi : input.phi;
    const adoptedTensionArea = selectedTensionBars >= 2 && selectedTensionPhi > 0 ? selectedTensionBars * Math.PI * selectedTensionPhi ** 2 / 4 : null;
    const adoptedCompressionArea = selectedCompressionBars >= 2 && selectedCompressionPhi > 0 ? selectedCompressionBars * Math.PI * selectedCompressionPhi ** 2 / 4 : null;
    const checkedTensionArea = adoptedTensionArea ?? result.AsAdopt;
    const checkedTensionAreaIsAdopted = adoptedTensionArea !== null;
    const checkedCompressionArea = adoptedCompressionArea ?? result.AsPrimeProvided;
    const checkedCompressionAreaIsAdopted = adoptedCompressionArea !== null;
    const checkedBarCount = selectedTensionBars >= 2 ? selectedTensionBars : result.nBars;
    const checkedBarDiameter = selectedTensionPhi > 0 ? selectedTensionPhi : result.phi;
    const checkedBarGap = Math.max(checkedBarDiameter, 20);
    const checkedWidth = checkedBarCount * checkedBarDiameter + (checkedBarCount - 1) * checkedBarGap + 2 * input.phiStirrup + 2 * input.cLat;
    const checkedWidthLimit = adoptedB || result.B;
    const checkedWidthOk = checkedWidth <= checkedWidthLimit;
    const drawingResult = result.ok ? {
        ...result,
        h: adoptedH,
        d: Math.max(1, adoptedH - input.c),
        X: result.d > 0 ? result.X * Math.max(1, adoptedH - input.c) / result.d : result.X,
        nBars: adoptedTensionBars,
        nBarsPrime: adoptedCompressionBars,
        phi: adoptedTensionPhi,
        phiPrime: adoptedCompressionPhi,
    } : result;

    const setField = (f) => (v) => setInput((p) => ({ ...p, [f]: v }));
    const setNumber = (f) => (v) => setInput((p) => ({ ...p, [f]: Number(v) || 0 }));
    const setAdoptedD = (value) => setAdoptedDimensions((p) => value === ""
        ? { ...p, d: "", h: "" }
        : { ...p, d: value, h: String(Number(value) + input.c) });
    const setAdoptedH = (value) => setAdoptedDimensions((p) => value === ""
        ? { ...p, d: "", h: "" }
        : { ...p, h: value, d: String(Number(value) - input.c) });

    return (
        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
            {/* -------- INPUT -------- */}
            <div className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                    <button type="button" onClick={() => { setInput(DEFAULT_INPUT); setAdoptedDimensions({}); setAdoptedReinforcement({}); }} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50">
                        <RotateCcw size={14} /> Valori predefiniti
                    </button>
                    <div className="flex gap-2">
                        <button type="button" onClick={() => setCardCommand((p) => ({ id: p.id + 1, open: true }))} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50">Apri tutti</button>
                        <button type="button" onClick={() => setCardCommand((p) => ({ id: p.id + 1, open: false }))} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50">Collassa tutti</button>
                    </div>
                </div>
                <CollapsibleCard title="Dati di progetto" command={cardCommand}>
                    <div className="mb-3">
                        <span className="mb-1 block text-xs font-semibold text-slate-500">Fissa</span>
                        <ModeToggle value={input.mode} onChange={setField("mode")} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        {input.mode === "fixH"
                            ? <NumberField label="Altezza h" unit="mm" value={input.h} onChange={setNumber("h")} />
                            : <NumberField label="Larghezza B" unit="mm" value={input.B} onChange={setNumber("B")} />}
                        {input.mode === "fixBH"
                            ? <NumberField label="Altezza h" unit="mm" value={input.h} onChange={setNumber("h")} />
                            : <NumberField label="β = A's/As" value={input.beta} step="0.05" onChange={setNumber("beta")} />}
                        <NumberField label="Copriferro c' (compr.)" unit="mm" value={input.cPrime} onChange={setNumber("cPrime")} />
                        <NumberField label="Copriferro c (teso)" unit="mm" value={input.c} onChange={setNumber("c")} />
                        <NumberField label="Momento M_Ed" unit="kNm" value={input.MEd} onChange={setNumber("MEd")} />
                        <NumberField label="Sforzo normale N_Ed" unit="kN" value={input.NEd} onChange={setNumber("NEd")} />
                    </div>
                    <p className="mt-2 text-[11px] text-slate-400">
                        Convenzioni: N_Ed &gt; 0 compressione; M_Ed &gt; 0 tende le fibre inferiori.
                        {input.mode === "fixBH"
                            ? " Sezione assegnata: A's calcolata solo se necessaria."
                            : " β = 0 → semplice armatura (dimensiona la geometria)."}
                    </p>
                </CollapsibleCard>

                <CollapsibleCard title="Materiali" command={cardCommand}>
                    <div className="grid grid-cols-2 gap-3">
                        <SelectField label="Calcestruzzo" value={input.fck} onChange={setNumber("fck")} options={CONCRETE_CLASSES.map((c) => ({ value: c.fck, label: c.id }))} />
                        <SelectField label="Acciaio" value={input.fyk} onChange={setNumber("fyk")} options={STEEL_GRADES.map((s) => ({ value: s.fyk, label: s.id }))} />
                    </div>
                    <div className="mt-3">
                        <SelectField label="Diagramma calcestruzzo" value={input.concreteModel} onChange={setField("concreteModel")} options={CONCRETE_MODELS.map((m) => ({ value: m.id, label: m.label }))} />
                        {result.ok && <ConcreteDiagram fcd={result.fcd} model={input.concreteModel} />}
                    </div>
                    <div className="mt-3 border-t border-slate-100 pt-3">
                        <SelectField label="Diagramma acciaio" value={input.steelModel} onChange={setField("steelModel")} options={STEEL_MODELS.map((m) => ({ value: m.id, label: m.label }))} />
                        {input.steelModel === "hardening" && (
                            <div className="mt-3">
                                <NumberField label="k_s = f_t/f_y" value={input.ks} step="0.01" onChange={setNumber("ks")} />
                            </div>
                        )}
                        {result.ok && <SteelDiagram fyd={result.fyd} model={input.steelModel} ks={input.ks} />}
                    </div>
                </CollapsibleCard>

                <CollapsibleCard title="Barre" command={cardCommand}>
                    <div className="grid grid-cols-2 gap-3">
                        <SelectField label="Diametro φ" value={input.phi} onChange={setNumber("phi")} options={BAR_DIAMETERS.map((d) => ({ value: d, label: `φ ${d}` }))} />
                        <SelectField label="Staffa φ" value={input.phiStirrup} onChange={setNumber("phiStirrup")} options={STIRRUP_DIAMETERS.map((d) => ({ value: d, label: `φ ${d}` }))} />
                    </div>
                </CollapsibleCard>

                <CollapsibleCard title="Dettagli avanzati" defaultOpen={false} command={cardCommand}>
                        <div className="grid grid-cols-2 gap-3">
                            <NumberField label="Copriferro laterale" unit="mm" value={input.cLat} onChange={setNumber("cLat")} />
                            <NumberField label="Arrotond. d" unit="mm" value={input.dRound} onChange={setNumber("dRound")} />
                            <NumberField label="α_cc" value={input.alphaCc} step="0.05" onChange={setNumber("alphaCc")} />
                            <NumberField label="γ_c" value={input.gammaC} step="0.05" onChange={setNumber("gammaC")} />
                            <NumberField label="γ_s" value={input.gammaS} step="0.05" onChange={setNumber("gammaS")} />
                        </div>
                </CollapsibleCard>

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
                                    {result.errors.map((e) => <li key={e}>{e}</li>)}
                                </ul>
                            </div>
                        </div>
                    </Card>
                ) : (
                    <>
                        <div className="grid gap-4 sm:grid-cols-3">
                            <BigResult title="Larghezza B" titleSuffix="richiesta" value={fmt(result.mode === "fixH" ? result.Breq : result.B, result.mode === "fixH" ? 1 : 0)} unit="mm"
                                {...(result.mode === "fixH" || result.mode === "fixBH" ? { onReset: () => setAdoptedDimensions((p) => ({ ...p, B: "" })), resetLabel: "Ripristina larghezza richiesta" } : {})}>
                                {(result.mode === "fixH" || result.mode === "fixBH") && <NumberField label="Larghezza adottata B" unit="mm" value={adoptedDimensions.B ?? ""} onChange={(v) => setAdoptedDimensions((p) => ({ ...p, B: v }))} />}
                            </BigResult>
                            <BigResult title="Altezza h" titleSuffix="richiesta" value={fmt(result.mode === "fixB" ? result.dReq + input.c : result.h, result.mode === "fixB" ? 1 : 0)} unit="mm"
                                {...(result.mode === "fixB" || result.mode === "fixBH" ? { onReset: () => setAdoptedDimensions((p) => ({ ...p, d: "", h: "" })), resetLabel: "Ripristina altezza richiesta" } : {})}>
                                {result.mode === "fixB" && <NumberField label="Altezza adottata h" unit="mm" value={adoptedDimensions.h ?? ""} onChange={setAdoptedH} />}
                                {result.mode === "fixBH" && <NumberField label="Altezza adottata h" unit="mm" value={adoptedDimensions.h ?? ""} onChange={setAdoptedH} />}
                            </BigResult>
                            <BigResult title="Altezza utile d" titleSuffix="richiesta" value={fmt(result.mode === "fixB" ? result.dReq : result.d, result.mode === "fixB" ? 1 : 0)} unit="mm"
                                {...(result.mode === "fixB" ? { onReset: () => setAdoptedDimensions((p) => ({ ...p, d: "", h: "" })), resetLabel: "Ripristina altezza utile richiesta" } : {})}>
                                {result.mode === "fixB" && <NumberField label="Altezza utile adottata d" unit="mm" value={adoptedDimensions.d ?? ""} onChange={setAdoptedD} />}
                            </BigResult>
                        </div>

                        <Card>
                            <CardTitle>Armatura adottata</CardTitle>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="rounded-xl bg-sky-50 p-4">
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="flex items-baseline gap-1.5 text-xs font-semibold uppercase tracking-wide text-sky-700">Armatura tesa <span className="normal-case">As</span> <span className="text-[10px] font-medium normal-case tracking-normal text-slate-400">richiesta</span></p>
                                        <button type="button" onClick={() => setAdoptedReinforcement((p) => ({ ...p, tensionBars: String(result.nBars), tensionPhi: String(result.phi) }))} title="Ripristina armatura richiesta" aria-label="Ripristina armatura tesa richiesta" className="rounded-md p-1 text-slate-500 transition hover:bg-sky-100 hover:text-sky-700">
                                            <RotateCcw size={15} />
                                        </button>
                                    </div>
                                    <p className="mt-1 flex flex-wrap items-baseline gap-x-2 text-2xl font-bold text-slate-900">{result.nBars} φ {result.phi}<span className="text-sm font-medium text-slate-500">{fmt(result.AsProvided, 0)} mm²</span></p>
                                    <div className="mt-3 grid grid-cols-2 gap-3">
                                        <NumberField label="Numero adottato" value={adoptedReinforcement.tensionBars ?? String(result.nBars)} onChange={(v) => setAdoptedReinforcement((p) => ({ ...p, tensionBars: v }))} onBlur={(v) => setAdoptedReinforcement((p) => ({ ...p, tensionBars: v === "" ? "" : String(Math.max(2, Math.trunc(Number(v) || 0))) }))} min="2" step="1" />
                                        <SelectField label="Diametro adottato" value={adoptedReinforcement.tensionPhi || String(result.phi)} onChange={(v) => setAdoptedReinforcement((p) => ({ ...p, tensionPhi: v }))} options={[{ value: "", label: "Seleziona" }, ...BAR_DIAMETERS.map((d) => ({ value: d, label: `φ ${d}` }))]} />
                                    </div>
                                    <p className="mt-2 flex items-center justify-between gap-2 text-sm font-semibold text-slate-700">
                                        <span>As <span className="text-[10px] font-medium normal-case tracking-normal text-slate-400">adottata</span> = {adoptedTensionArea ? `${fmt(adoptedTensionArea, 0)} mm²` : "—"}</span>
                                        {adoptedTensionArea !== null && (adoptedTensionArea >= result.AsProvided
                                            ? <CheckCircle2 size={16} className="shrink-0 text-emerald-600" aria-label="Armatura adottata verificata" role="img" />
                                            : <AlertTriangle size={16} className="shrink-0 text-amber-500" aria-label="Armatura adottata inferiore a quella richiesta" role="img" />)}
                                    </p>
                                    <AdoptionUtilization adopted={adoptedTensionArea} required={result.AsProvided} />
                                </div>
                                {result.AsPrime > 0 && (
                                    <div className="rounded-xl bg-sky-50 p-4">
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="flex items-baseline gap-1.5 text-xs font-semibold uppercase tracking-wide text-sky-700">Armatura compressa <span className="normal-case">A's</span> <span className="text-[10px] font-medium normal-case tracking-normal text-slate-400">richiesta</span></p>
                                            <button type="button" onClick={() => setAdoptedReinforcement((p) => ({ ...p, compressionBars: String(result.nBarsPrime), compressionPhi: String(result.phi) }))} title="Ripristina armatura richiesta" aria-label="Ripristina armatura compressa richiesta" className="rounded-md p-1 text-slate-500 transition hover:bg-sky-100 hover:text-sky-700">
                                                <RotateCcw size={15} />
                                            </button>
                                        </div>
                                        <p className="mt-1 flex flex-wrap items-baseline gap-x-2 text-2xl font-bold text-slate-900">{result.nBarsPrime} φ {result.phi}<span className="text-sm font-medium text-slate-500">{fmt(result.AsPrimeProvided, 0)} mm²</span></p>
                                        <div className="mt-3 grid grid-cols-2 gap-3">
                                            <NumberField label="Numero adottato" value={adoptedReinforcement.compressionBars ?? String(result.nBarsPrime)} onChange={(v) => setAdoptedReinforcement((p) => ({ ...p, compressionBars: v }))} onBlur={(v) => setAdoptedReinforcement((p) => ({ ...p, compressionBars: v === "" ? "" : String(Math.max(2, Math.trunc(Number(v) || 0))) }))} min="2" step="1" />
                                            <SelectField label="Diametro adottato" value={adoptedReinforcement.compressionPhi || String(result.phi)} onChange={(v) => setAdoptedReinforcement((p) => ({ ...p, compressionPhi: v }))} options={[{ value: "", label: "Seleziona" }, ...BAR_DIAMETERS.map((d) => ({ value: d, label: `φ ${d}` }))]} />
                                        </div>
                                        <p className="mt-2 flex items-center justify-between gap-2 text-sm font-semibold text-slate-700">
                                            <span>A's <span className="text-[10px] font-medium normal-case tracking-normal text-slate-400">adottata</span> = {adoptedCompressionArea ? `${fmt(adoptedCompressionArea, 0)} mm²` : "—"}</span>
                                            {adoptedCompressionArea !== null && (adoptedCompressionArea >= result.AsPrimeProvided
                                                ? <CheckCircle2 size={16} className="shrink-0 text-emerald-600" aria-label="Armatura adottata verificata" role="img" />
                                                : <AlertTriangle size={16} className="shrink-0 text-amber-500" aria-label="Armatura adottata inferiore a quella richiesta" role="img" />)}
                                        </p>
                                        <AdoptionUtilization adopted={adoptedCompressionArea} required={result.AsPrimeProvided} />
                                    </div>
                                )}
                            </div>
                            <div className="mt-3 space-y-2">
                                <CheckRow ok={checkedWidthOk} label={`Ingombro barre${selectedTensionBars >= 2 || selectedTensionPhi > 0 ? " adottate" : ""}: ${fmt(checkedWidth, 0)} mm ≤ B = ${fmt(checkedWidthLimit, 0)} mm`} reference={{ ntc: "§4.1.6.1.3", ec2: "§8.2" }} />
                                <CheckRow ok={checkedTensionArea >= result.AsMin} warn label={`${checkedTensionAreaIsAdopted ? "A_s adottata" : "A_s calcolata"} ${checkedTensionArea >= result.AsMin ? "≥" : "<"} A_s,min (${fmt(checkedTensionArea, 0)} / ${fmt(result.AsMin, 0)} mm²)`} reference={{ ntc: "§4.1.6.1.1", ec2: "§9.2.1.1(1)" }} />
                                <CheckRow ok={checkedTensionArea <= result.AsMax} label={`${checkedTensionAreaIsAdopted ? "A_s adottata" : "A_s calcolata"} ${checkedTensionArea <= result.AsMax ? "≤" : ">"} A_s,max (${fmt(checkedTensionArea, 0)} / ${fmt(result.AsMax, 0)} mm²)`} reference={{ ntc: "§4.1.6.1.1", ec2: "§9.2.1.1(3)" }} />
                                {result.beta > 0 && (
                                    <CheckRow ok={checkedCompressionAreaIsAdopted ? checkedCompressionArea >= result.AsPrime : result.comprYield} warn label={checkedCompressionAreaIsAdopted
                                        ? `A'_s adottata ${checkedCompressionArea >= result.AsPrime ? "≥" : "<"} A'_s richiesta (${fmt(checkedCompressionArea, 0)} / ${fmt(result.AsPrime, 0)} mm²)`
                                        : result.comprYield ? "Acciaio compresso snervato (σ'_s = f_yd)" : "Acciaio compresso NON snervato: risultato approssimato"}
                                    reference={checkedCompressionAreaIsAdopted ? { ntc: "§4.1.2.3.4", ec2: "§6.1" } : { ntc: "§4.1.2.1.2.2", ec2: "§3.2.7" }} />
                                )}
                            </div>
                        </Card>

                        <Card>
                            <div className="mb-3 flex items-center justify-between gap-3">
                                <h3 className="text-sm font-bold text-slate-800">Sezione progettata</h3>
                                <div className="flex items-center gap-2">
                                    <select
                                        value={drawUnit}
                                        onChange={(e) => setDrawUnit(e.target.value)}
                                        aria-label="Unità di misura delle quote"
                                        className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-200"
                                    >
                                        <option value="mm">mm</option>
                                        <option value="cm">cm</option>
                                        <option value="m">m</option>
                                    </select>
                                    <button type="button" onClick={copyImage} title="Copia immagine" aria-label={isCopied ? "Immagine copiata" : "Copia immagine negli appunti"} className="rounded-full border border-slate-300 bg-white p-2 text-slate-700 shadow-sm transition hover:bg-slate-50">
                                        <span className="relative block h-[15px] w-[15px]">
                                            <Copy size={15} className={`absolute inset-0 transition-all duration-300 ease-in-out ${isCopied ? "rotate-90 scale-50 opacity-0" : "rotate-0 scale-100 opacity-100"}`} />
                                            <Check size={15} className={`absolute inset-0 transition-all duration-300 ease-in-out ${isCopied ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-50 opacity-0"}`} />
                                        </span>
                                    </button>
                                    <button type="button" onClick={saveImage} title="Salva immagine PNG" aria-label={isSaved ? "Immagine salvata" : "Salva immagine PNG"} className="rounded-full border border-slate-300 bg-white p-2 text-slate-700 shadow-sm transition hover:bg-slate-50">
                                        <span className="relative block h-[15px] w-[15px]">
                                            <Download size={15} className={`absolute inset-0 transition-all duration-300 ease-in-out ${isSaved ? "rotate-90 scale-50 opacity-0" : "rotate-0 scale-100 opacity-100"}`} />
                                            <Check size={15} className={`absolute inset-0 transition-all duration-300 ease-in-out ${isSaved ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-50 opacity-0"}`} />
                                        </span>
                                    </button>
                                </div>
                            </div>
                            {exportMessage && <p role="status" className="mb-2 text-right text-xs text-slate-500">{exportMessage}</p>}
                            <div className="mx-auto max-w-[480px]">
                                <DesignDrawing result={drawingResult} B={adoptedB} cPrime={input.cPrime} phiStirrup={input.phiStirrup} cLat={input.cLat} moment={input.MEd} mode="fixBH" unit={drawUnit} svgRef={drawingSvgRef} />
                            </div>
                        </Card>

                        <Card>
                            <div className="mb-3 flex items-center justify-between gap-3">
                                <h3 className="text-sm font-bold text-slate-800">Forze interne (sezione di lato)</h3>
                                <div className="flex items-center gap-2">
                                    <select
                                        value={drawUnit}
                                        onChange={(e) => setDrawUnit(e.target.value)}
                                        aria-label="Unità di misura delle quote"
                                        className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-200"
                                    >
                                        <option value="mm">mm</option>
                                        <option value="cm">cm</option>
                                        <option value="m">m</option>
                                    </select>
                                    <button type="button" onClick={copyForces} title="Copia immagine" aria-label={isCopiedF ? "Immagine copiata" : "Copia immagine negli appunti"} className="rounded-full border border-slate-300 bg-white p-2 text-slate-700 shadow-sm transition hover:bg-slate-50">
                                        <span className="relative block h-[15px] w-[15px]">
                                            <Copy size={15} className={`absolute inset-0 transition-all duration-300 ease-in-out ${isCopiedF ? "rotate-90 scale-50 opacity-0" : "rotate-0 scale-100 opacity-100"}`} />
                                            <Check size={15} className={`absolute inset-0 transition-all duration-300 ease-in-out ${isCopiedF ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-50 opacity-0"}`} />
                                        </span>
                                    </button>
                                    <button type="button" onClick={saveForces} title="Salva immagine PNG" aria-label={isSavedF ? "Immagine salvata" : "Salva immagine PNG"} className="rounded-full border border-slate-300 bg-white p-2 text-slate-700 shadow-sm transition hover:bg-slate-50">
                                        <span className="relative block h-[15px] w-[15px]">
                                            <Download size={15} className={`absolute inset-0 transition-all duration-300 ease-in-out ${isSavedF ? "rotate-90 scale-50 opacity-0" : "rotate-0 scale-100 opacity-100"}`} />
                                            <Check size={15} className={`absolute inset-0 transition-all duration-300 ease-in-out ${isSavedF ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-50 opacity-0"}`} />
                                        </span>
                                    </button>
                                </div>
                            </div>
                            <div className="mx-auto max-w-[480px]">
                                <SideForcesDiagram result={result} unit={drawUnit} svgRef={forcesSvgRef} />
                            </div>
                        </Card>

                        <Card>
                            <CardTitle>Dimensionamento</CardTitle>
                            <div className="grid gap-x-6 sm:grid-cols-2">
                                {result.mode === "fixBH" ? (
                                    <>
                                        <ResultRow label="x / d" value={fmt(result.X / result.d, 3)} />
                                        <ResultRow label="x_lim / d" value={fmt(result.xiLim, 3)} />
                                    </>
                                ) : (
                                    <ResultRow label="ξ = X/d" value={fmt(result.xi, 4)} />
                                )}
                                <ResultRow label="ψ / λ (cls)" value={`${fmt(result.psi, 3)} / ${fmt(result.kG, 3)}`} />
                                <ResultRow label="X (asse neutro)" value={fmt(result.X, 1)} unit="mm" />
                                <ResultRow label="z (braccio)" value={fmt(result.z, 1)} unit="mm" />
                                {result.mode === "fixH" && <ResultRow label="B richiesta" value={fmt(result.Breq, 0)} unit="mm" />}
                                <ResultRow label="f_cd" value={fmt(result.fcd, 2)} unit="MPa" />
                                <ResultRow label="f_yd" value={fmt(result.fyd, 1)} unit="MPa" />
                                <ResultRow label="A_s (calcolo)" value={fmt(result.As, 0)} unit="mm²" />
                                {result.mode === "fixBH" && result.doubleReinf && <ResultRow label="A's (calcolo)" value={fmt(result.AsPrime, 0)} unit="mm²" />}
                                <ResultRow label="A_s,min / A_s,max" value={`${fmt(result.AsMin, 0)} / ${fmt(result.AsMax, 0)}`} unit="mm²" />
                            </div>
                        </Card>

                        <Card>
                            <button type="button" aria-expanded={showSteps} onClick={() => setShowSteps((s) => !s)} className="flex w-full cursor-pointer items-center justify-between text-sm font-bold text-slate-800">
                                Foglio dei passaggi di calcolo
                                <ChevronDown size={15} aria-hidden="true" className={`text-slate-400 transition-transform duration-300 ${showSteps ? "" : "-rotate-90"}`} />
                            </button>
                            <AnimatedPanel isOpen={showSteps}>
                                <CalcReport result={result} input={input} adoptedDimensions={adoptedDimensions} />
                            </AnimatedPanel>
                        </Card>

                        <AssumptionsBox />
                    </>
                )}
            </div>
        </div>
    );
}

// -------- Foglio dei passaggi di calcolo (formule in LaTeX) --------
function CalcReport({ result, input, adoptedDimensions }) {
    const r = result;
    const { fck, fyk, alphaCc, gammaC, gammaS, phi, phiStirrup, cLat } = input;
    const B = r.B; // larghezza effettiva (progettata o assegnata)
    const mm = "\\ \\text{mm}";
    const mm2 = "\\ \\text{mm}^2";
    const MPa = "\\ \\text{MPa}";
    const uk = "\\ \\text{kN}";
    const ukm = "\\ \\text{kNm}";
    const hasCompr = r.AsPrime > 0;
    const kN = (N, d = 1) => T(N / 1000, d);      // N -> kN
    const kNm = (Nmm, d = 1) => T(Nmm / 1e6, d);  // N·mm -> kNm
    const mToStr = (lenMm) => T(lenMm / 1000, 3); // mm -> m
    const dimensionValue = (required, adopted, dec = 1) => {
        const requestedValue = `${T(required, dec)}${mm}`;
        return adopted !== undefined && adopted !== "" && Number(adopted) > 0
            ? `${requestedValue}\\to ${T(Number(adopted), dec)}${mm}`
            : requestedValue;
    };

    return (
        <div className="mt-4 space-y-5 text-sm text-slate-700">
            <Step n="1" title="Resistenze di progetto dei materiali">
                <Eq lhs="f_{cd}" sym="\dfrac{\alpha_{cc}\,f_{ck}}{\gamma_c}" num={`\\dfrac{${T(alphaCc, 2)}\\cdot ${T(fck, 0)}}{${T(gammaC, 2)}}`} val={`${T(r.fcd, 2)}${MPa}`} />
                <Eq lhs="f_{yd}" sym="\dfrac{f_{yk}}{\gamma_s}" num={`\\dfrac{${T(fyk, 0)}}{${T(gammaS, 2)}}`} val={`${T(r.fyd, 2)}${MPa}`} />
                <Eq lhs="\varepsilon_{yd}" sym="\dfrac{f_{yd}}{E_s}" num={`\\dfrac{${T(r.fyd, 1)}}{200000}`} val={`${T(r.epsYd * 1000, 2)}\\text{‰}`} />
            </Step>

            <Step n="2" title="Azioni e convenzioni di segno">
                <Tex display>{`N_{Ed}=${kN(r.NEd)}${uk}\\qquad M_{Ed}=${kNm(r.MEdSigned)}${ukm}`}</Tex>
                <p className="text-xs text-slate-400">
                    N_Ed &gt; 0 compressione; M_Ed &gt; 0 tende le fibre inferiori.
                    {r.tensionTop ? " M_Ed < 0 → sezione ribaltata: lato teso in alto, calcolo con |M_Ed|." : ""}
                </p>
            </Step>

            <Step n="3" title="Geometria, asse neutro e coefficienti del cls">
                {r.mode === "fixBH" && (
                    <>
                        <Eq lhs="B,\ h" sym="\text{assegnate}" val={`${T(r.B, 0)}\\times ${T(r.h, 0)}${mm}`} />
                        <Eq lhs="d" sym="h-c" num={`${T(r.h, 0)}-${T(r.cT, 0)}`} val={`${T(r.d, 0)}${mm}`} />
                    </>
                )}
                {r.mode === "fixH" && (
                    <>
                        <Eq lhs="h" sym="\text{assegnata}" val={dimensionValue(r.h, adoptedDimensions.h, 0)} />
                        <Eq lhs="d" sym="h-c" num={`${T(r.h, 0)}-${T(r.cT, 0)}`} val={`${T(r.d, 0)}${mm}`} />
                        <p className="text-xs text-slate-400">B dimensionata con ξ = ε_cu/(ε_cu+ε_s) = 0,2593; x e armature dall'equilibrio.</p>
                    </>
                )}
                {r.mode === "fixB" && (
                    <>
                        <Eq lhs="B" sym="\text{assegnata}" val={`${T(r.B, 0)}${mm}`} />
                        <p className="text-xs text-slate-400">d dimensionata con ξ = ε_cu/(ε_cu+ε_s) = 0,2593; x e armature dall'equilibrio.</p>
                    </>
                )}
                <Eq lhs="x" sym="\text{dall'equilibrio}" val={`${T(r.X, 1)}${mm}`} />
                <Tex display>{`\\psi=${T(r.psi, 3)}\\qquad \\lambda=${T(r.kG, 3)}\\qquad \\tfrac{x}{d}=${T(r.X / r.d, 3)}\\;${r.X / r.d > r.xiLim + 1e-4 ? ">" : "\\le"}\\;\\tfrac{x_{lim}}{d}=${T(r.xiLim, 3)}`}</Tex>
                <p className="text-xs text-slate-400">
                    {r.X / r.d > r.xiLim + 1e-4 ? "x oltre il limite di duttilità. " : "x entro il limite di duttilità. "}
                    {hasCompr ? "Doppia armatura (A's presente)." : "Semplice armatura."}
                </p>
            </Step>

            <Step n="4" title="Risultanti delle forze interne">
                <Eq lhs="C_c" sym="\psi\,f_{cd}\,B\,x" num={`${T(r.psi, 3)}\\cdot ${T(r.fcd, 2)}\\cdot ${T(B, 0)}\\cdot ${T(r.X, 1)}`} val={`${kN(r.Cc)}${uk}`} />
                {hasCompr && (
                    <>
                        <Eq lhs="\varepsilon_s'" sym="\varepsilon_{cu}\Big(1-\dfrac{c'}{x}\Big)" num={`3{,}5\\big(1-${T(r.cC, 0)}/${T(r.X, 1)}\\big)`} val={`${T(r.epsSc * 1000, 2)}\\text{‰}\\Rightarrow\\sigma_s'=${T(r.sigmaSc, 1)}${MPa}`} />
                        <Eq lhs="C_s'" sym="A_s'\,\sigma_s'" num={`${T(r.AsPrime, 0)}\\cdot ${T(r.sigmaSc, 1)}`} val={`${kN(r.Cs)}${uk}`} />
                    </>
                )}
                <Eq lhs="T_s" sym="A_s\,f_{s}" num={`${T(r.As, 0)}\\cdot ${T(r.fs, 1)}`} val={`${kN(r.Ts)}${uk}`} />
                <p className="text-xs text-slate-400">f_s = tensione dell'acciaio teso a ε_s = 10‰ ({T(r.fs, 1)} MPa).</p>
            </Step>

            <Step n="5" title="Equazioni di equilibrio (rispetto al baricentro, h/2)">
                <p className="text-xs font-semibold text-slate-500">Traslazione:</p>
                <Tex display>{`C_c+C_s'-T_s=N_{Ed}`}</Tex>
                <Tex display>{`${kN(r.Cc)}${hasCompr ? `+${kN(r.Cs)}` : ""}-${kN(r.Ts)}=${kN(r.NEd)}${uk}`}</Tex>
                <p className="mt-2 text-xs font-semibold text-slate-500">Momento (bracci dal baricentro):</p>
                <Tex display>{`C_c\\Big(\\tfrac{h}{2}-\\lambda x\\Big)+C_s'\\Big(\\tfrac{h}{2}-c'\\Big)+T_s\\Big(\\tfrac{h}{2}-c\\Big)=M_{Ed}`}</Tex>
                <Tex display>{`${kN(r.Cc)}\\cdot ${mToStr(r.aCc)}${hasCompr ? `+${kN(r.Cs)}\\cdot ${mToStr(r.aCs)}` : ""}+${kN(r.Ts)}\\cdot ${mToStr(r.aTs)}=${kNm(r.MEd)}${ukm}`}</Tex>
                <p className="text-xs text-slate-400">Forze in kN, bracci in m. {r.tensionTop ? "Equazioni nel frame ribaltato (|M_Ed|)." : ""}</p>
            </Step>

            <Step n="6" title="Incognite ricavate dall'equilibrio">
                {r.mode === "fixH" && <Eq lhs="B" sym="\text{(equilibrio)}" val={dimensionValue(r.Breq, adoptedDimensions.B, 1)} />}
                {r.mode === "fixB" && (
                    <>
                        <Eq lhs="d" sym="\text{(equilibrio)}" val={dimensionValue(r.dReq, adoptedDimensions.d, 1)} />
                        <Eq lhs="h" sym="d+c" num={`${T(r.dReq, 1)}+${T(r.cT, 0)}`} val={dimensionValue(r.h, adoptedDimensions.h, 1)} />
                    </>
                )}
                <Eq lhs="A_s" sym="\dfrac{T_s}{f_s}" num={`\\dfrac{${kN(r.Ts)}\\cdot 10^3}{${T(r.fs, 1)}}`} val={`${T(r.As, 0)}${mm2}`} />
                {hasCompr
                    ? <Eq lhs="A_s'" sym="\dfrac{C_s'}{\sigma_s'}" num={`\\dfrac{${kN(r.Cs)}\\cdot 10^3}{${T(r.sigmaSc, 1)}}`} val={`${T(r.AsPrime, 0)}${mm2}`} />
                    : <p className="text-xs text-slate-400">Armatura compressa non necessaria (A's = 0).</p>}
            </Step>

            <Step n="7" title="Armature limite (NTC2018 §4.1.6.1.1)">
                <Eq lhs="A_{s,min}" sym="\max\!\Big(0{,}26\tfrac{f_{ctm}}{f_{yk}}Bd,\;0{,}0013\,Bd\Big)" num={`\\max\\!\\Big(0{,}26\\tfrac{${T(r.fctm, 2)}}{${T(fyk, 0)}}\\cdot ${T(B, 0)}\\cdot ${T(r.d, 0)},\\;0{,}0013\\cdot ${T(B, 0)}\\cdot ${T(r.d, 0)}\\Big)`} val={`${T(r.AsMin, 0)}${mm2}`} />
                <Eq lhs="A_{s,max}" sym="0{,}04\,B\,h" num={`0{,}04\\cdot ${T(B, 0)}\\cdot ${T(r.h, 0)}`} val={`${T(r.AsMax, 0)}${mm2}`} />
                <Eq lhs="A_{s,req}" sym="\max(A_s,\,A_{s,min})" val={`${T(r.AsAdopt, 0)}${mm2}`} />
            </Step>

            <Step n="8" title="Scelta delle barre">
                <Eq lhs="A_\phi" sym="\dfrac{\pi\phi^2}{4}" num={`\\dfrac{\\pi\\cdot ${T(phi, 0)}^2}{4}`} val={`${T(r.areaPhi, 1)}${mm2}`} />
                <Eq lhs="n" sym="\left\lceil\dfrac{A_{s,req}}{A_\phi}\right\rceil" num={`\\left\\lceil\\dfrac{${T(r.AsAdopt, 0)}}{${T(r.areaPhi, 1)}}\\right\\rceil`} val={`${r.nBars}\\Rightarrow ${r.nBars}\\,\\phi${phi}`} />
                <Eq lhs="A_{s,prov}" sym="n\,A_\phi" num={`${r.nBars}\\cdot ${T(r.areaPhi, 1)}`} val={`${T(r.AsProvided, 0)}${mm2}`} />
            </Step>

            <Step n="9" title="Verifica ingombro in larghezza">
                <Eq lhs="L" sym="n\phi+(n-1)\max(\phi,20)+2\phi_{st}+2c_{lat}" num={`${r.nBars}\\cdot ${T(phi, 0)}+${r.nBars - 1}\\cdot ${T(r.gap, 0)}+2\\cdot ${T(phiStirrup, 0)}+2\\cdot ${T(cLat, 0)}`} val={`${T(r.reqWidth, 0)}${mm}`} />
                <Tex display>{`L=${T(r.reqWidth, 0)}${mm}\\;${r.widthOk ? "\\le" : ">"}\\;B=${T(B, 0)}${mm}`}</Tex>
            </Step>
        </div>
    );
}

function Step({ n, title, children }) {
    return (
        <div>
            <p className="mb-1 flex items-center gap-2 font-semibold text-slate-800">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-sky-100 text-[11px] font-bold text-sky-700">{n}</span>
                {title}
            </p>
            <div className="space-y-1.5 border-l-2 border-slate-100 pl-4">{children}</div>
        </div>
    );
}

// Togglebar per la modalità di progetto (controllo segmentato).
const MODE_SHORT = { fixB: "Base B", fixH: "Altezza h", fixBH: "B e h" };
function ModeToggle({ value, onChange }) {
    const n = DESIGN_MODES.length;
    const idx = Math.max(0, DESIGN_MODES.findIndex((m) => m.id === value));
    return (
        <div className="relative flex rounded-xl border border-slate-200 bg-slate-50 p-1">
            {/* indicatore scorrevole */}
            <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-1 left-1 rounded-lg bg-sky-600 shadow-sm transition-transform duration-300 ease-out"
                style={{ width: `calc((100% - 0.5rem) / ${n})`, transform: `translateX(${idx * 100}%)` }}
            />
            {DESIGN_MODES.map((m) => {
                const active = value === m.id;
                return (
                    <button
                        key={m.id}
                        type="button"
                        onClick={() => onChange(m.id)}
                        title={m.label}
                        aria-pressed={active}
                        className={`relative z-10 flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors duration-300 ${
                            active ? "text-white" : "text-slate-600"
                        }`}
                    >
                        {MODE_SHORT[m.id]}
                    </button>
                );
            })}
        </div>
    );
}

// Quota verticale con frecce alle due estremita' e linee di estensione.
function HDim({ dimY, xA, xB, edgeY, label, color = "#64748b" }) {
    const mid = (xA + xB) / 2;
    return (
        <g stroke={color} fill={color}>
            {/* linee di estensione dal bordo della sezione alla linea di quota */}
            <line x1={xA} y1={edgeY} x2={xA} y2={dimY} strokeWidth="0.5" strokeDasharray="2 2" />
            <line x1={xB} y1={edgeY} x2={xB} y2={dimY} strokeWidth="0.5" strokeDasharray="2 2" />
            {/* linea di quota */}
            <line x1={xA} y1={dimY} x2={xB} y2={dimY} strokeWidth="1" />
            {/* frecce */}
            <polygon points={`${xA},${dimY} ${xA + 6},${dimY - 2.5} ${xA + 6},${dimY + 2.5}`} stroke="none" />
            <polygon points={`${xB},${dimY} ${xB - 6},${dimY - 2.5} ${xB - 6},${dimY + 2.5}`} stroke="none" />
            {/* etichetta */}
            <text x={mid} y={dimY + 12} fontSize="11" fontWeight="bold" textAnchor="middle" stroke="none">{label}</text>
        </g>
    );
}

function VDim({ dimX, yA, yB, edgeX, label, color = "#475569" }) {
    const mid = (yA + yB) / 2;
    const tooShort = Math.abs(yB - yA) < 16;
    return (
        <g stroke={color} fill={color}>
            {/* linee di estensione dal bordo/feature alla linea di quota */}
            <line x1={edgeX} y1={yA} x2={dimX} y2={yA} strokeWidth="0.5" strokeDasharray="2 2" />
            <line x1={edgeX} y1={yB} x2={dimX} y2={yB} strokeWidth="0.5" strokeDasharray="2 2" />
            {/* linea di quota */}
            <line x1={dimX} y1={yA} x2={dimX} y2={yB} strokeWidth="1" />
            {/* frecce */}
            <polygon points={`${dimX},${yA} ${dimX - 2.5},${yA + 6} ${dimX + 2.5},${yA + 6}`} stroke="none" />
            <polygon points={`${dimX},${yB} ${dimX - 2.5},${yB - 6} ${dimX + 2.5},${yB - 6}`} stroke="none" />
            {/* etichetta */}
            {tooShort ? (
                <text x={dimX - 5} y={mid + 3} fontSize="11" fontWeight="bold" textAnchor="end" stroke="none">{label}</text>
            ) : (
                <text x={dimX - 4} y={mid} fontSize="11" fontWeight="bold" textAnchor="middle" stroke="none" transform={`rotate(-90 ${dimX - 4} ${mid})`}>{label}</text>
            )}
        </g>
    );
}

// -------- Disegno della sezione progettata con quote --------
// Il box (viewBox) ha dimensioni FISSE: la sezione viene scalata per entrare
// nell'area di disegno mantenendo le proporzioni, e centrata.
const BOX_W = 440;
const BOX_H = 360;
const SIDE_BOX_W = 520;
const SIDE_BOX_H = 300;

function DesignDrawing({ result, B, cPrime, phiStirrup = 8, cLat = 30, moment = 0, mode = "fixB", unit = "mm", svgRef }) {
    const { h, d, X, phi, phiPrime = phi, nBars, nBarsPrime, beta } = result;
    const cP = cPrime ?? 40;
    const c = h - d; // copriferro all'asse arm. tesa (dal lembo teso)

    // Colore delle quote B/h: grigio = dato di input, nero = valore calcolato.
    // fixB → B input, h calcolata; fixH → h input, B calcolata; fixBH → entrambe input.
    const INPUT_COLOR = "#0f172a"; // nero
    const CALC_COLOR = "#94a3b8"; // grigino
    const bColor = mode === "fixH" ? CALC_COLOR : INPUT_COLOR;
    const hColor = mode === "fixB" ? CALC_COLOR : INPUT_COLOR;

    // Comandi di visibilità (staffa / armature / quote)
    const [show, setShow] = useState({ stirrup: true, bars: true, moment: true, dims: true });
    const toggle = (k) => setShow((s) => ({ ...s, [k]: !s[k] }));

    // Unità di misura delle quote del disegno (valori memorizzati in mm).
    // Gli zeri finali dopo la virgola vengono eliminati (es. 50,0 → 50; 0,300 → 0,3).
    const U_FACTOR = { mm: 1, cm: 0.1, m: 0.001 };
    const U_DEC = { mm: 0, cm: 1, m: 3 };
    const fmtU = (mm) => {
        const v = mm * U_FACTOR[unit];
        if (!Number.isFinite(v)) return "-";
        return v.toLocaleString("it-IT", { minimumFractionDigits: 0, maximumFractionDigits: U_DEC[unit] });
    };

    // Margini per le quote (fissi) e area utile di disegno
    const mL = 72;
    const mR = 64;
    const mT = 24;
    const mB = 86;
    const availW = BOX_W - mL - mR;
    const availH = BOX_H - mT - mB;

    // Scala che fa entrare la sezione (B x h) nell'area mantenendo le proporzioni
    const scale = Math.min(availW / B, availH / h);
    const w = B * scale;
    const ht = h * scale;
    const secLeft = mL + (availW - w) / 2;
    const secTop = mT + (availH - ht) / 2;
    const secRight = secLeft + w;
    const momentX = secLeft - 62;
    const momentRadius = Math.min(55, ht * 0.3);
    const momentCurveWidth = momentRadius * 0.9;
    const yOf = (depth) => secTop + depth * scale;

    // Posizione orizzontale delle barre: l'asse delle barre d'angolo è a
    // (cLat + phi_st + phi/2) dal bordo, così poggiano dentro la staffa.
    const lat = Math.min(cLat + phiStirrup + phi / 2, B / 2 - phi / 2); // asse barra d'angolo dal bordo [mm]
    const barsAt = (n, depthY, barLat = lat) => {
        const arr = [];
        for (let i = 0; i < n; i++) {
            const pos = n === 1 ? B / 2 : barLat + ((B - 2 * barLat) * i) / (n - 1);
            arr.push({ x: secLeft + pos * scale, y: yOf(depthY) });
        }
        return arr;
    };
    const barR = Math.max(2.5, (phi * scale) / 2);
    const barRPrime = Math.max(2.5, (phiPrime * scale) / 2);
    const latPrime = Math.min(cLat + phiStirrup + phiPrime / 2, B / 2 - phiPrime / 2);
    const tensionBars = barsAt(nBars, d);
    const comprBars = nBarsPrime > 0 ? barsAt(nBarsPrime, cP, latPrime) : [];

    // Staffa TANGENTE alle armature: l'asse della staffa è distante
    // (phi/2 + phi_st/2) dall'asse delle barre, così la faccia interna tocca
    // le barre. Lati sx/dx tangenti alle barre d'angolo; lato inferiore
    // tangente alle barre tese; lato superiore tangente alle barre compresse
    // (se presenti), altrimenti al copriferro laterale.
    const off = phi / 2 + phiStirrup / 2; // distanza asse staffa - asse barra [mm]
    const offPrime = phiPrime / 2 + phiStirrup / 2;
    const xLeftA = nBarsPrime > 0 ? Math.min(lat - phi / 2, latPrime - phiPrime / 2) - phiStirrup / 2 : lat - off;
    const xRightA = nBarsPrime > 0 ? Math.max(B - lat + phi / 2, B - latPrime + phiPrime / 2) + phiStirrup / 2 : B - lat + off;
    const yBotA = Math.min(d + off, h - (cLat + phiStirrup / 2)); // depth asse inferiore
    const yTopA = nBarsPrime > 0 ? Math.max(cP - offPrime, cLat + phiStirrup / 2) : cLat + phiStirrup / 2;
    const stX = secLeft + xLeftA * scale;
    const stY = secTop + yTopA * scale;
    const stW = (xRightA - xLeftA) * scale;
    const stH = (yBotA - yTopA) * scale;
    const stR = Math.max(2, 6 * scale);
    const stWidth = Math.max(1.4, phiStirrup * scale * 0.8); // spessore visivo staffa
    const stirrupFits = stW > 8 && stH > 8;
    const showStirrup = show.stirrup && stirrupFits;

    const Toggle = ({ k, label, color }) => {
        const on = show[k];
        return (
            <button
                type="button"
                onClick={() => toggle(k)}
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                    on ? "border-slate-300 bg-white text-slate-700 shadow-sm" : "border-slate-200 bg-slate-50 text-slate-400"
                }`}
                aria-pressed={on}
            >
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: on ? color : "#cbd5e1" }} />
                {label}
            </button>
        );
    };

    return (
        <div>
            {/* comandi di visibilità dentro il box */}
            <div className="mb-2 flex flex-wrap items-center justify-center gap-2">
                <Toggle k="stirrup" label="Staffa" color="#dc2626" />
                <Toggle k="bars" label="Armature" color="#0f172a" />
                <Toggle k="moment" label="Momento" color="#16a34a" />
                <Toggle k="dims" label="Quote" color="#64748b" />
            </div>

            <svg ref={svgRef} width="100%" viewBox={`0 0 ${BOX_W} ${BOX_H}`} role="img" aria-label="Sezione progettata quotata">
                {/* zona compressa + contorno */}
                <rect x={secLeft} y={secTop} width={w} height={Math.min(X * scale, ht)} fill="#e0f2fe" />
                <rect x={secLeft} y={secTop} width={w} height={ht} fill="none" stroke="#334155" strokeWidth="2" />

                {/* staffa (tangente alle armature) */}
                {showStirrup && (
                    <>
                        <rect
                            x={stX} y={stY} width={stW} height={stH} rx={stR} ry={stR}
                            fill="none" stroke="#dc2626" strokeWidth={stWidth} strokeLinejoin="round"
                        />
                        {/* ganci di chiusura 135° (angolo in alto a sinistra) */}
                        <line x1={stX + stR} y1={stY} x2={stX + stR + 7} y2={stY + 7} stroke="#dc2626" strokeWidth={stWidth} strokeLinecap="round" />
                        <line x1={stX} y1={stY + stR} x2={stX + 7} y2={stY + stR + 7} stroke="#dc2626" strokeWidth={stWidth} strokeLinecap="round" />
                    </>
                )}

                {/* asse neutro */}
                {show.dims && X > 0 && X * scale < ht && (
                    <line x1={secLeft} y1={yOf(X)} x2={secRight} y2={yOf(X)} stroke="#0284c7" strokeWidth="1.5" strokeDasharray="6 4" />
                )}

                {/* verso del momento flettente */}
                {show.moment && (
                    <g>
                        <defs>
                            <marker id="moment-arrowhead" markerWidth="7" markerHeight="7" refX="5.5" refY="3.5" orient="auto" markerUnits="userSpaceOnUse">
                                <path d="M0,0 L7,3.5 L0,7 Z" fill="#16a34a" />
                            </marker>
                        </defs>
                        <path
                            d={`M ${momentX} ${secTop + ht / 2 + momentRadius} C ${momentX - momentCurveWidth} ${secTop + ht / 2 + momentRadius * 0.7}, ${momentX - momentCurveWidth} ${secTop + ht / 2 - momentRadius * 0.7}, ${momentX} ${secTop + ht / 2 - momentRadius}`}
                            fill="none" stroke="#16a34a" strokeWidth="2" markerEnd="url(#moment-arrowhead)"
                        />
                        <text x={momentX - momentCurveWidth} y={secTop + ht / 2 + 4} textAnchor="middle" fontSize="12" fontWeight="bold" fill="#16a34a">M</text>
                    </g>
                )}

                {/* barre */}
                {show.bars && tensionBars.map((b, i) => <circle key={`t${i}`} cx={b.x} cy={b.y} r={barR} fill="#0f172a" />)}
                {show.bars && comprBars.map((b, i) => <circle key={`c${i}`} cx={b.x} cy={b.y} r={barRPrime} fill="#64748b" />)}

                {/* quote */}
                {show.dims && (
                    <>
                        {/* a sinistra: x (asse neutro) e la colonna d + c (= h) */}
                        <VDim dimX={secLeft - 16} yA={yOf(0)} yB={yOf(X)} edgeX={secLeft} label={`x=${fmtU(X)}`} color="#0284c7" />
                        <VDim dimX={secLeft - 38} yA={yOf(0)} yB={yOf(d)} edgeX={secLeft} label={`d=${fmtU(d)}`} color="#334155" />
                        <VDim dimX={secLeft - 38} yA={yOf(d)} yB={yOf(h)} edgeX={secLeft} label={`c=${fmtU(c)}`} color="#64748b" />
                        {/* a destra: c' (lembo compresso -> As') e h */}
                        <VDim dimX={secRight + 16} yA={yOf(0)} yB={yOf(cP)} edgeX={secRight} label={`c'=${fmtU(cP)}`} color="#64748b" />
                        <VDim dimX={secRight + 38} yA={yOf(0)} yB={yOf(h)} edgeX={secRight} label={`h=${fmtU(h)}`} color={hColor} />
                    </>
                )}

                {/* base: quota con frecce (se le quote sono attive) altrimenti etichetta */}
                {show.dims ? (
                    <HDim dimY={secTop + ht + 16} xA={secLeft} xB={secRight} edgeY={secTop + ht} label={`B = ${fmtU(B)}`} color={bColor} />
                ) : (
                    <text x={secLeft + w / 2} y={secTop + ht + 20} textAnchor="middle" fontSize="11" fill={bColor}>B = {fmtU(B)}</text>
                )}
                {showStirrup && <text x={secLeft + w / 2} y={secTop + ht + 45} textAnchor="middle" fontSize="10" fill="#dc2626">staffa φ{fmt(phiStirrup, 0)} (c = {fmtU(cLat)} {unit})</text>}
                {show.bars && nBars > 0 && <text x={secLeft + w / 2} y={secTop + ht + 56} textAnchor="middle" fontSize="10" fill="#0f172a">armatura tesa φ{fmt(phi, 0)}</text>}
                {show.bars && nBarsPrime > 0 && <text x={secLeft + w / 2} y={secTop + ht + 67} textAnchor="middle" fontSize="10" fill="#64748b">armatura compressa φ{fmt(phiPrime, 0)}</text>}
            </svg>
            {show.dims && (
                <p className="mt-1 flex items-center justify-center gap-3 text-[11px] text-slate-400">
                    <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: INPUT_COLOR }} />input</span>
                    <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: CALC_COLOR }} />calcolato</span>
                </p>
            )}
        </div>
    );
}

// -------- Sezione di profilo con le risultanti delle forze interne --------
// Mostra la sezione vista di lato (profondità verticale) con l'asse neutro a X,
// la zona compressa e le risultanti: C_c (cls, compressione), C_s (acciaio
// compresso, solo doppia armatura) e T_s (acciaio teso). Flessione semplice.
function SideForcesDiagram({ result, unit = "mm", svgRef }) {
    const { h, d, X, kG, fcd, cC, cT, Cc, Cs, Ts, aCc, aCs, aTs, NEd: Ned, MEdSigned, tensionTop, sigmaSc, concreteModel = "rectangular" } = result;
    const hasCompr = result.AsPrime > 0;
    const hasN = Math.abs(Ned) > 1000; // > 1 kN
    const [show, setShow] = useState({ law: true, forces: true, dims: true, moment: true });
    const toggle = (k) => setShow((s) => ({ ...s, [k]: !s[k] }));

    const U_FACTOR = { mm: 1, cm: 0.1, m: 0.001 };
    const U_DEC = { mm: 0, cm: 1, m: 3 };
    const fmtU = (mm) => {
        const v = mm * U_FACTOR[unit];
        if (!Number.isFinite(v)) return "-";
        return v.toLocaleString("it-IT", { minimumFractionDigits: 0, maximumFractionDigits: U_DEC[unit] });
    };
    const kN = (N) => fmt(N / 1000, 1);

    // Geometria SPECCHIATA: la sezione di taglio è a sinistra del corpo trave, che
    // prosegue a destra; σ_c e le risultanti sono a sinistra del taglio.
    const W = SIDE_BOX_W, H = SIDE_BOX_H;
    const secTop = 34, secBot = 250;
    const secH = secBot - secTop;
    const scale = secH / h;
    const stressW = 50;
    const xRight = 380, xCut = 272;        // corpo trave: xCut..xRight (spostato a sinistra)
    const xStressL = xCut - stressW;       // σ_c a sinistra del taglio
    const yOf = (depth) => tensionTop ? secBot - depth * scale : secTop + depth * scale;
    const yNA = yOf(X), yEdge0 = yOf(0), yN = yOf(h / 2);

    const yCc = yOf(kG * X), yCs = yOf(cC), yTs = yOf(d);
    let lblCc = yCc, lblCs = yCs;
    if (hasCompr && Math.abs(yCc - yCs) < 13) {
        const mid = (yCc + yCs) / 2, up = mid - 7, dn = mid + 7;
        if (yCc <= yCs) { lblCc = up; lblCs = dn; } else { lblCc = dn; lblCs = up; }
    }

    const RED = "#dc2626", GREEN = "#15803d", NA_COL = "#0284c7", NCOL = "#2563eb", MCOL = "#2563eb";
    const MODEL_COL = { rectangular: "#16a34a", parabola: "#ea580c", bilinear: "#ca8a04" };
    const col = MODEL_COL[concreteModel] || "#16a34a";

    // --- diagramma σ_c (a sinistra del taglio) ---
    const EPS_CU = 0.0035, EPS_C2 = 0.002, EPS_C3 = 0.00175, LAMBDA = 0.8;
    const sigmaFrac = (depth) => {
        const e = EPS_CU * (X - depth) / X;
        if (concreteModel === "bilinear") return e >= EPS_C3 ? 1 : e / EPS_C3;
        return e >= EPS_C2 ? 1 : 1 - Math.pow(1 - e / EPS_C2, 2);
    };
    let stressPath;
    if (concreteModel === "rectangular") {
        const aDepth = Math.min(LAMBDA * X, X);
        stressPath = `M${xCut},${yEdge0} L${xStressL},${yEdge0} L${xStressL},${yOf(aDepth)} L${xCut},${yOf(aDepth)} Z`;
    } else {
        const Nn = 24, pts = [];
        for (let i = 0; i <= Nn; i++) {
            const depth = (X * i) / Nn;
            pts.push(`L${(xCut - sigmaFrac(depth) * stressW).toFixed(1)},${yOf(depth).toFixed(1)}`);
        }
        stressPath = `M${xCut},${yEdge0} ${pts.join(" ")} L${xCut},${yNA} Z`;
    }

    // frecce delle forze: a sinistra del diagramma σ_c (compressione → verso la sezione = destra)
    const xHead = xStressL - 16, L = 58, xTail = xHead - L, labX = xTail - 6;
    const compZoneTop = Math.min(yEdge0, yNA), compZoneH = Math.abs(yNA - yEdge0);
    // posizioni X delle quote (bracci) a destra della trave
    const qX = xRight + 30, qCc = xRight + 58, qTs = xRight + 86, qCs = xRight + 114;

    // azioni applicate (blu): M_Ed come ARCO curvo (punta in alto) che incrocia
    // la freccia dritta di N_Ed; N_Ed orizzontale al baricentro.
    const xcross = xTail + 16;   // punto in cui N incrocia l'arco del momento
    const bw = 24, mr = 26;      // rigonfiamento dell'arco e sua semi-altezza
    const xa = xcross + bw;      // estremi (alto/basso) dell'arco
    const momPath = tensionTop
        ? `M${xa},${yN - mr} C${xcross},${yN - mr * 0.5} ${xcross},${yN + mr * 0.5} ${xa},${yN + mr}`
        : `M${xa},${yN + mr} C${xcross},${yN + mr * 0.5} ${xcross},${yN - mr * 0.5} ${xa},${yN - mr}`;
    const xMlab = xcross + bw / 2;                        // etichetta M vicino all'arco
    const yMlab = tensionTop ? yN + mr + 14 : yN - mr - 8;

    const Toggle = ({ k, label, color }) => {
        const on = show[k];
        return (
            <button type="button" onClick={() => toggle(k)} aria-pressed={on}
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition ${on ? "border-slate-300 bg-white text-slate-700 shadow-sm" : "border-slate-200 bg-slate-50 text-slate-400"}`}>
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: on ? color : "#cbd5e1" }} />{label}
            </button>
        );
    };

    return (
        <div>
            <div className="mb-2 flex flex-wrap items-center justify-center gap-2">
                <Toggle k="law" label="Legame σc" color={col} />
                <Toggle k="forces" label="Forze" color={RED} />
                <Toggle k="dims" label="Quote" color="#64748b" />
                <Toggle k="moment" label="Momento" color={MCOL} />
            </div>

            <svg ref={svgRef} width="100%" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Legame costitutivo adottato e risultanti delle forze interne">
                <defs>
                    <marker id="sf-red" markerUnits="userSpaceOnUse" markerWidth="9" markerHeight="9" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill={RED} /></marker>
                    <marker id="sf-green" markerUnits="userSpaceOnUse" markerWidth="9" markerHeight="9" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill={GREEN} /></marker>
                    <marker id="sf-ind" markerUnits="userSpaceOnUse" markerWidth="9" markerHeight="9" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill={NCOL} /></marker>
                </defs>

                {/* zona compressa */}
                <rect x={xCut} y={compZoneTop} width={xRight - xCut} height={compZoneH} fill="#e0f2fe" />

                {/* contorno trave: taglio a sinistra (xCut), prolungamento a destra (xRight) */}
                <line x1={xCut} y1={secTop} x2={xRight} y2={secTop} stroke="#334155" strokeWidth="2" />
                <line x1={xCut} y1={secBot} x2={xRight} y2={secBot} stroke="#334155" strokeWidth="2" />
                <line x1={xCut} y1={secTop} x2={xCut} y2={secBot} stroke="#334155" strokeWidth="2" />
                <path d={`M${xRight - 1},${secTop + 5} l6,-10 M${xRight + 6},${secTop + 5} l6,-10`} stroke="#334155" strokeWidth="1.3" fill="none" />
                <path d={`M${xRight - 1},${secBot + 5} l6,-10 M${xRight + 6},${secBot + 5} l6,-10`} stroke="#334155" strokeWidth="1.3" fill="none" />

                {/* armature longitudinali continue (verso destra) */}
                {hasCompr && <line x1={xCut} y1={yCs} x2={xRight + 6} y2={yCs} stroke="#64748b" strokeWidth="2.6" strokeLinecap="round" />}
                <line x1={xCut} y1={yTs} x2={xRight + 6} y2={yTs} stroke="#0f172a" strokeWidth="2.6" strokeLinecap="round" />

                {/* asse neutro */}
                <line x1={xHead} y1={yNA} x2={xRight + 6} y2={yNA} stroke={NA_COL} strokeWidth="1.3" strokeDasharray="6 4" />

                {/* diagramma σ_c adottato */}
                {show.law && <>
                    <path d={stressPath} fill={col} fillOpacity="0.16" stroke={col} strokeWidth="1.6" strokeLinejoin="round" />
                    <text x={xStressL} y={yEdge0 + (tensionTop ? 14 : -5)} textAnchor="start" fontSize="11" fontStyle="italic" fill={col}>σ<tspan fontSize="8" dy="2">c</tspan></text>
                </>}

                {/* forze risultanti */}
                {show.forces && <>
                    {/* baricentro σ_c: qui cade C_c (tratteggio fino alla quota del braccio) */}
                    {show.dims && <line x1={xTail} y1={yCc} x2={qCc} y2={yCc} stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 3" />}
                    {show.dims && <text x={xCut - 3} y={yCc - 3} textAnchor="end" fontSize="8" fill="#64748b">G (λ·x)</text>}

                    {/* C_c (compressione → verso la sezione, destra) */}
                    <line x1={xTail} y1={yCc} x2={xHead} y2={yCc} stroke={RED} strokeWidth="2.2" markerEnd="url(#sf-red)" />
                    {lblCc !== yCc && <line x1={labX + 3} y1={yCc} x2={labX + 3} y2={lblCc} stroke={RED} strokeWidth="0.6" />}
                    <text x={labX} y={lblCc + 3.5} textAnchor="end" fontSize="11" fill={RED}>C<tspan fontSize="8" dy="2">c</tspan><tspan dy="-2"> = {kN(Cc)} kN</tspan></text>

                    {hasCompr && <>
                        {show.dims && <line x1={xTail} y1={yCs} x2={qCs} y2={yCs} stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 3" />}
                        <line x1={xTail} y1={yCs} x2={xHead} y2={yCs} stroke={RED} strokeWidth="2.2" markerEnd="url(#sf-red)" />
                        {lblCs !== yCs && <line x1={labX + 3} y1={yCs} x2={labX + 3} y2={lblCs} stroke={RED} strokeWidth="0.6" />}
                        <text x={labX} y={lblCs + 3.5} textAnchor="end" fontSize="11" fill={RED}>C<tspan fontSize="8" dy="2">s</tspan><tspan dy="-2"> = {kN(Cs)} kN</tspan></text>
                    </>}

                    {/* N_Ed al baricentro: compressione → destra, trazione → sinistra */}
                    {hasN && show.dims && <line x1={xTail} y1={yN} x2={xCut} y2={yN} stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 3" />}
                    {hasN && (Ned > 0
                        ? <line x1={xTail} y1={yN} x2={xHead} y2={yN} stroke={NCOL} strokeWidth="2.2" markerEnd="url(#sf-ind)" />
                        : <line x1={xHead} y1={yN} x2={xTail} y2={yN} stroke={NCOL} strokeWidth="2.2" markerEnd="url(#sf-ind)" />)}
                    {hasN && <text x={xcross - 6} y={yN + 16} textAnchor="end" fontSize="11" fill={NCOL}>N<tspan fontSize="8" dy="2">Ed</tspan><tspan dy="-2"> = {kN(Ned)} kN</tspan></text>}

                    {/* T_s (trazione → via dalla sezione, sinistra) */}
                    {show.dims && <line x1={xTail} y1={yTs} x2={qTs} y2={yTs} stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 3" />}
                    <line x1={xHead} y1={yTs} x2={xTail} y2={yTs} stroke={GREEN} strokeWidth="2.2" markerEnd="url(#sf-green)" />
                    <text x={labX} y={yTs + 3.5} textAnchor="end" fontSize="11" fill={GREEN}>T<tspan fontSize="8" dy="2">s</tspan><tspan dy="-2"> = {kN(Ts)} kN</tspan></text>
                </>}

                {/* quote: x (asse neutro) e bracci rispetto al baricentro (h/2) */}
                {show.dims && <>
                    {/* asse baricentrico h/2 */}
                    <line x1={xCut} y1={yN} x2={xRight + 120} y2={yN} stroke="#94a3b8" strokeWidth="0.8" strokeDasharray="4 3" />
                    <text x={xCut + 4} y={yN - 3} textAnchor="start" fontSize="8" fill="#94a3b8">baricentro (h/2)</text>
                    <VDim dimX={qX} yA={yEdge0} yB={yNA} edgeX={xRight} label={`x=${fmtU(X)}`} color={NA_COL} />
                    <VDim dimX={qCc} yA={yN} yB={yCc} edgeX={xRight} label={fmtU(Math.abs(aCc))} color="#475569" />
                    <text x={qCc + 11} y={(yN + yCc) / 2} textAnchor="middle" fontSize="10" fill="#94a3b8" transform={`rotate(-90 ${qCc + 11} ${(yN + yCc) / 2})`}>br. Cc</text>
                    {hasCompr && <>
                        <VDim dimX={qCs} yA={yN} yB={yCs} edgeX={xRight} label={fmtU(Math.abs(aCs))} color="#475569" />
                        <text x={qCs + 11} y={(yN + yCs) / 2} textAnchor="middle" fontSize="10" fill="#94a3b8" transform={`rotate(-90 ${qCs + 11} ${(yN + yCs) / 2})`}>br. C's</text>
                    </>}
                    <VDim dimX={qTs} yA={yN} yB={yTs} edgeX={xRight} label={fmtU(Math.abs(aTs))} color="#475569" />
                    <text x={qTs + 11} y={(yN + yTs) / 2} textAnchor="middle" fontSize="10" fill="#94a3b8" transform={`rotate(-90 ${qTs + 11} ${(yN + yTs) / 2})`}>br. Ts</text>
                </>}

                {/* azione applicata: M_Ed (blu) arco curvo che incrocia la freccia di N_Ed */}
                {show.moment && <>
                    <path d={momPath} fill="none" stroke={MCOL} strokeWidth="2.2" markerEnd="url(#sf-ind)" />
                    <text x={xMlab} y={yMlab} textAnchor="middle" fontSize="11" fill={MCOL}>M<tspan fontSize="8" dy="2">Ed</tspan><tspan dy="-2"> = {fmt(MEdSigned / 1e6, 1)} kNm</tspan></text>
                </>}
            </svg>
            <p className="mt-1 text-center text-[11px] leading-tight text-slate-400">
                C_c cade nel baricentro G del diagramma σ_c; i bracci sono misurati dall'asse baricentrico (h/2).
                Equilibrio: C_c{hasCompr ? " + C's" : ""} − T_s = N_Ed ({kN(Ned)} kN); momento = M_Ed.
                {tensionTop ? " M_Ed < 0: lato teso in alto." : ""}
            </p>
        </div>
    );
}

function CheckRow({ ok, label, warn, reference }) {
    return (
        <div className="relative flex items-start gap-2 text-sm">
            {ok ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" /> : <AlertTriangle size={16} className={`mt-0.5 shrink-0 ${warn ? "text-amber-500" : "text-red-500"}`} />}
            <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
                <span className="text-slate-600">{label}</span>
                {reference && <div className="group relative shrink-0">
                    <button type="button" aria-label="Mostra riferimenti normativi" aria-haspopup="true" title="Riferimenti normativi" className="rounded-full p-0.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-200">
                        <Info size={15} />
                    </button>
                    <div role="tooltip" className="invisible absolute right-0 top-full z-20 w-56 rounded-xl border border-slate-200 bg-white p-3 text-xs opacity-0 shadow-lg transition-opacity duration-150 group-hover:visible group-hover:opacity-100">
                        <p className="font-semibold text-slate-600">Riferimenti normativi</p>
                        <p className="mt-2 text-slate-500"><span className="font-semibold text-slate-600">NTC18</span> {reference.ntc}</p>
                        <p className="mt-1 text-slate-500"><span className="font-semibold text-slate-600">EC2</span> {reference.ec2}</p>
                    </div>
                </div>}
            </div>
        </div>
    );
}

function AdoptionUtilization({ adopted, required }) {
    if (!(adopted > 0) || !(required > 0)) return null;
    const utilization = (required / adopted) * 100;
    const meetsRequirement = utilization <= 100;
    const width = Math.min(100, Math.max(0, utilization));
    return (
        <div className="mt-2 flex items-center gap-3" aria-label={`Sfruttamento armatura ${fmt(utilization, 1)} per cento`}>
            <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={width} aria-valuetext={`${fmt(utilization, 1)}%`}>
                <div className={`h-full rounded-full transition-[width] duration-300 ${meetsRequirement ? "bg-emerald-500" : "bg-amber-500"}`} style={{ width: `${width}%` }} />
            </div>
            <span className={`shrink-0 text-xs font-semibold tabular-nums ${meetsRequirement ? "text-emerald-700" : "text-amber-700"}`}>{fmt(utilization, 1)}%</span>
        </div>
    );
}

function AssumptionsBox() {
    return (
        <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
            <Info size={18} className="mt-0.5 shrink-0 text-slate-400" />
            <div>
                <p className="font-semibold text-slate-600">Metodo di dimensionamento</p>
                <p className="mt-1 leading-6">
                    SLU, pressoflessione. Convenzioni: N_Ed &gt; 0 compressione, M_Ed &gt; 0
                    tende le fibre inferiori (M_Ed &lt; 0 → sezione ribaltata). La risultante del
                    cls è C_c = ψ·B·x·f_cd con baricentro a λ·x; ψ e λ dipendono dal diagramma
                    (rettangolo 0,80/0,40; parabola-rettangolo 0,81/0,416; triangolo-rettangolo
                    0,75/0,389). Le due equazioni di equilibrio rispetto al baricentro (h/2) —
                    traslazione C_c + C's − T_s = N_Ed e momento = M_Ed — forniscono le incognite:
                    A_s (e A's) in «B e h», oppure la geometria (d o B, con rapporto β = A's/A_s)
                    negli altri casi. Si adotta la geometria arrotondata e si scelgono le barre
                    verificando l'ingombro.
                </p>
            </div>
        </div>
    );
}

// -------- primitivi UI --------
function Card({ children }) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">{children}</div>;
}
function CollapsibleCard({ title, children, defaultOpen = true, command }) {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    const [contentHeight, setContentHeight] = useState(defaultOpen ? "auto" : "0px");
    const contentRef = useRef(null);
    const previousCommand = useRef(command.id);
    const setOpen = (nextOpen) => {
        if (nextOpen === isOpen) return;
        const height = contentRef.current?.scrollHeight ?? 0;
        if (nextOpen) {
            setContentHeight(`${height}px`);
            setIsOpen(true);
        } else {
            setContentHeight(`${height}px`);
            requestAnimationFrame(() => setContentHeight("0px"));
            setIsOpen(false);
        }
    };
    useLayoutEffect(() => {
        if (previousCommand.current === command.id) return;
        previousCommand.current = command.id;
        if (command.open !== null) setOpen(command.open);
    }, [command]);
    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <button type="button" aria-expanded={isOpen} onClick={() => setOpen(!isOpen)}
                className="flex w-full cursor-pointer items-center justify-between text-left text-sm font-bold text-slate-800">
                {title}
                <ChevronDown size={16} aria-hidden="true" className={`text-slate-400 transition-transform ${isOpen ? "" : "-rotate-90"}`} />
            </button>
            <div aria-hidden={!isOpen} inert={!isOpen} className="overflow-hidden transition-[height] duration-300 ease-in-out"
                style={{ height: contentHeight }} onTransitionEnd={(event) => {
                    if (event.propertyName === "height" && isOpen) setContentHeight("auto");
                }}>
                <div ref={contentRef} className="pt-3">{children}</div>
            </div>
        </section>
    );
}
function AnimatedPanel({ isOpen, children }) {
    const [height, setHeight] = useState("0px");
    const contentRef = useRef(null);
    const previousOpen = useRef(isOpen);
    useLayoutEffect(() => {
        if (previousOpen.current === isOpen) return;
        previousOpen.current = isOpen;
        const contentHeight = contentRef.current?.scrollHeight ?? 0;
        setHeight(`${contentHeight}px`);
        if (!isOpen) requestAnimationFrame(() => setHeight("0px"));
    }, [isOpen]);
    return (
        <div aria-hidden={!isOpen} inert={!isOpen} className="overflow-hidden transition-[height] duration-300 ease-in-out"
            style={{ height }} onTransitionEnd={(event) => {
                if (event.propertyName === "height" && isOpen) setHeight("auto");
            }}>
            <div ref={contentRef} className="flow-root">{children}</div>
        </div>
    );
}
function CardTitle({ children }) {
    return <h3 className="mb-3 text-sm font-bold text-slate-800">{children}</h3>;
}
function BigResult({ title, titleSuffix, value, unit, note, children, onReset, resetLabel = "Ripristina valore richiesto" }) {
    return (
        <div className="rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 to-white p-5">
            <div className="relative min-h-4">
                <p className={`flex items-baseline gap-1.5 text-xs font-semibold uppercase tracking-wide text-sky-700 ${onReset ? "pr-7" : ""}`}>
                    {title}
                    {titleSuffix && <span className="text-[10px] font-medium normal-case tracking-normal text-slate-400">{titleSuffix}</span>}
                </p>
                {onReset && <button type="button" onClick={onReset} title={resetLabel} aria-label={resetLabel} className="absolute right-0 top-0 rounded-md p-1 text-slate-500 transition hover:bg-sky-100 hover:text-sky-700">
                    <RotateCcw size={15} />
                </button>}
            </div>
            <div className="mt-1 flex items-end gap-2">
                <span className="text-3xl font-bold text-slate-900">{value}</span>
                {unit && <span className="mb-1 text-base font-semibold text-slate-400">{unit}</span>}
            </div>
            {note && <p className="mt-1 text-sm text-slate-500">{note}</p>}
            {children && <div className="mt-3">{children}</div>}
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
function NumberField({ label, unit, value, onChange, onBlur, min, step = "1" }) {
    return (
        <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-500">
                {label}{unit && <span className="ml-1 text-slate-400">[{unit}]</span>}
            </span>
            <input type="number" value={value} min={min} step={step} onChange={(e) => onChange(e.target.value)} onBlur={onBlur ? (e) => onBlur(e.target.value) : undefined}
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
