// src/components/concrete/SectionDesignTool.jsx
//
// Strumento: Progetto (dimensionamento) a flessione (SLU) di una sezione
// rettangolare o a T in c.a. — metodo degli appunti (X = 0.2593 d).

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, AlertTriangle, Info, RotateCcw, ChevronDown, Copy, Download, Check, FileDown, Eye, X as XIcon } from "lucide-react";
import {
    designSection,
    CONCRETE_CLASSES,
    STEEL_GRADES,
    CONCRETE_MODELS,
    DESIGN_MODES,
    STEEL_MODELS,
    DEFAULT_INPUT,
    barRows,
} from "../../lib/concrete/sectionDesign";
import Tex, { Eq, fmtNum, texNum as T } from "../Tex";
import Sym, { sub } from "../Sym";
import { concreteTable, STEEL_TABLE } from "../../lib/concrete/materialTables";
import ConcreteDiagram from "./ConcreteDiagram";
import SteelDiagram from "./SteelDiagram";
import { buildSectionDxf } from "../../lib/concrete/sectionDxf";

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
    const [materialInfo, setMaterialInfo] = useState(null); // "concrete" | "steel" | null
    const [drawUnit, setDrawUnit] = useState("mm"); // unità delle quote del disegno
    const drawingSvgRef = useRef(null);
    const forcesSvgRef = useRef(null);
    const copiedTimer = useRef(null);
    const savedTimer = useRef(null);
    const dxfSavedTimer = useRef(null);
    const copiedTimerF = useRef(null);
    const savedTimerF = useRef(null);
    const [exportMessage, setExportMessage] = useState("");
    const [isCopied, setIsCopied] = useState(false);
    const [isSaved, setIsSaved] = useState(false);
    const [isDxfSaved, setIsDxfSaved] = useState(false);
    const [isCopiedF, setIsCopiedF] = useState(false);
    const [isSavedF, setIsSavedF] = useState(false);

    const isTsec = input.sectionType === "T";
    // barre superiori considerate nel calcolo: A's assegnata dal box "Armatura compressa"
    const topGiven = !!(input.hangerBars && input.hangerInCalc);
    const givenN = topGiven ? Math.max(2, Math.trunc(Number(adoptedReinforcement.compressionBars)) || 2) : 0;
    const givenPhi = topGiven ? Number(adoptedReinforcement.compressionPhi) || input.phiHanger || 12 : 0;
    const result = useMemo(() => designSection(topGiven
        ? { ...input, AsPrimeGiven: givenN * Math.PI * givenPhi ** 2 / 4, nBarsPrimeGiven: givenN, phiPrimeGiven: givenPhi }
        : input), [input, topGiven, givenN, givenPhi]);

    const createPng = async (ref, w0, h0) => {
        const svg = ref.current;
        if (!svg) throw new Error("Disegno non disponibile");
        // proporzioni dal viewBox effettivo (il disegno della sezione è ritagliato)
        const vb = svg.viewBox?.baseVal;
        const w = vb?.width || w0, h = vb?.height || h0;
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
    const reportRef = useRef(null);
    const REPORT_TITLE = "Progetto sezione c.a. - Passaggi di calcolo";
    const [previewHtml, setPreviewHtml] = useState(null);
    const closePreview = useCallback(() => setPreviewHtml(null), []);
    const exportPdf = () => {
        try {
            printReport(reportRef.current, REPORT_TITLE);
            setExportMessage("");
        } catch {
            setExportMessage("Esportazione PDF non riuscita");
        }
    };
    const openPreview = () => {
        try {
            setPreviewHtml(buildReportHtml(reportRef.current, REPORT_TITLE));
            setExportMessage("");
        } catch {
            setExportMessage("Anteprima PDF non riuscita");
        }
    };

    // valori commerciali proposti: arrotondamento per eccesso al passo "Arrotond." delle
    // dimensioni di cassero (h o B); d segue da h meno il copriferro al baricentro
    // delle barre tese
    const roundStep = input.dRound > 0 ? input.dRound : 10;
    const roundUp = (v) => Math.ceil(v / roundStep) * roundStep;
    const calculatedB = result.ok && result.mode === "fixH" ? roundUp(result.Breq) : result.ok ? result.B : 0;
    const calculatedH = result.ok && result.mode === "fixB" ? roundUp(result.dReq + result.cT) : result.ok ? result.h : 0;
    const adoptedB = Number(adoptedDimensions.B) > 0 ? Number(adoptedDimensions.B) : calculatedB;
    const adoptedH = Number(adoptedDimensions.h) > 0 ? Number(adoptedDimensions.h) : calculatedH;
    const selectedTensionBars = Number(adoptedReinforcement.tensionBars ?? result.nBars);
    const selectedTensionPhi = Number(adoptedReinforcement.tensionPhi || result.phi);
    const selectedCompressionBars = Number(adoptedReinforcement.compressionBars ?? result.nBarsPrime);
    const selectedCompressionPhi = Number(adoptedReinforcement.compressionPhi || result.phiPrime || result.phi);
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
    const checkedWidthLimit = result.isT ? result.bw : adoptedB || result.B; // le barre stanno nell'anima della T
    // disposizione delle barre adottate su una o più file (stesso criterio del calcolo)
    const rowsMax = (top) => (input.multiLayer ? Math.max(1, Math.trunc(top ? input.maxLayersTop : input.maxLayersBot) || 1) : 1);
    const rowArgs = { B: result.isT ? result.bw : checkedWidthLimit, cLeft: input.cLeft, cRight: input.cRight, phiStirrup: input.phiStirrup };
    const adoptedLayT = barRows({ ...rowArgs, n: adoptedTensionBars, phi: adoptedTensionPhi, maxRows: rowsMax(result.tensionTop) });
    const adoptedLayC = barRows({ ...rowArgs, n: adoptedCompressionBars, phi: adoptedCompressionPhi, maxRows: rowsMax(!result.tensionTop) });
    // ingombro della fila più numerosa
    const checkedWidth = adoptedLayT.width;
    const checkedWidthOk = checkedWidth <= checkedWidthLimit;
    const checkedGapC = Math.max(adoptedCompressionPhi, 20);
    const checkedWidthC = adoptedLayC.width;
    const checkedWidthCOk = checkedWidthC <= checkedWidthLimit;
    // altezza utile della sezione adottata: al baricentro delle barre tese
    const coverT = result.ok ? result.dTNom + adoptedLayT.delta : input.dInf; // al baricentro delle barre tese
    // 2 barre costruttive (reggistaffa) sul lato compresso se l'armatura compressa non serve
    const hanger = result.ok && input.hangerBars && !(adoptedCompressionBars > 0) ? { n: 2, phi: input.phiHanger || 12 } : null;
    const adoptedD = result.ok ? Math.max(1, adoptedH - coverT) : 0;
    const drawingResult = result.ok ? {
        ...result,
        h: adoptedH,
        d: adoptedD,
        // asse neutro secondo l'ipotesi di progetto (x = ξ·d), salvo il caso
        // "B e h" senza armatura compressa in cui x viene dall'equilibrio
        X: result.xFromXi ? result.xi * adoptedD : result.X,
        nBars: adoptedTensionBars,
        nBarsPrime: adoptedCompressionBars,
        phi: adoptedTensionPhi,
        phiPrime: adoptedCompressionPhi,
    } : result;

    const saveSectionDxf = () => {
        try {
            const dxf = buildSectionDxf({
                result: drawingResult,
                B: adoptedB,
                layT: adoptedLayT,
                layC: adoptedLayC,
                hanger,
                dTNom: result.dTNom,
                dCNom: result.dCNom,
                phiStirrup: input.phiStirrup,
                cLeft: input.cLeft,
                cRight: input.cRight,
            });
            const url = URL.createObjectURL(new Blob([dxf], { type: "application/dxf" }));
            const link = document.createElement("a");
            link.href = url;
            link.download = "sezione-progettata-1-1mm.dxf";
            link.click();
            window.setTimeout(() => URL.revokeObjectURL(url), 1000);
            setExportMessage("");
            setIsDxfSaved(true);
            window.clearTimeout(dxfSavedTimer.current);
            dxfSavedTimer.current = window.setTimeout(() => setIsDxfSaved(false), 1600);
        } catch {
            setExportMessage("Esportazione DXF non riuscita");
        }
    };

    const setField = (f) => (v) => setInput((p) => ({ ...p, [f]: v }));
    const setNumber = (f) => (v) => setInput((p) => ({ ...p, [f]: Number(v) || 0 }));
    // Cambio del tipo di sezione: valori predefiniti che verificano la sezione e,
    // per la T, ne mostrano bene la forma (ala 600×80, anima 300, h ≈ 300 mm).
    const changeSectionType = (type) => {
        if (type === (input.sectionType ?? "rect")) return;
        setInput((p) => (type === "T"
            ? { ...p, sectionType: "T", B: 600, bw: 300, hf: 80, h: 300, MEd: 100, NEd: 0 }
            : { ...p, sectionType: "rect", B: DEFAULT_INPUT.B, h: DEFAULT_INPUT.h, MEd: DEFAULT_INPUT.MEd, NEd: DEFAULT_INPUT.NEd }));
        setAdoptedDimensions({});
        setAdoptedReinforcement({});
    };
    const setAdoptedD = (value) => setAdoptedDimensions((p) => value === ""
        ? { ...p, d: "", h: "" }
        : { ...p, d: value, h: String(+(Number(value) + coverT).toFixed(1)) });
    const setAdoptedH = (value) => setAdoptedDimensions((p) => value === ""
        ? { ...p, d: "", h: "" }
        : { ...p, h: value, d: undefined });
    // la dimensione adottata è h: d si ricava sempre da h e dal copriferro al
    // baricentro delle barre tese attuale (cambia se le barre passano su più
    // file); il testo digitato in d si mostra solo finché è coerente con h
    const typedD = adoptedDimensions.d;
    const shownD = typedD === "" ? ""
        : typedD !== undefined && Math.abs(Number(typedD) + coverT - adoptedH) < 0.051 ? typedD
            : String(+(adoptedH - coverT).toFixed(1));

    return (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
            {materialInfo && <MaterialInfoModal kind={materialInfo} fck={input.fck} steelGrade={input.steelGrade ?? "B450C"} onClose={() => setMaterialInfo(null)} />}
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
                        <span className="mb-1 block text-xs font-semibold text-slate-500">Sezione</span>
                        <SegmentedToggle value={input.sectionType ?? "rect"} onChange={changeSectionType}
                            options={[{ id: "rect", label: "Rettangolare" }, { id: "T", label: "a T" }]} />
                    </div>
                    <div className="mb-3">
                        <span className="mb-1 block text-xs font-semibold text-slate-500">Fissa</span>
                        <ModeToggle value={input.mode} onChange={setField("mode")} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        {input.mode === "fixH"
                            ? <NumberField label="Altezza h" unit="mm" value={input.h} onChange={setNumber("h")} />
                            : <NumberField label={isTsec ? "Larghezza ala B" : "Larghezza B"} unit="mm" value={input.B} onChange={setNumber("B")} />}
                        {input.mode === "fixBH"
                            ? <NumberField label="Altezza h" unit="mm" value={input.h} onChange={setNumber("h")} />
                            : <NumberField label={<>β = A's/As{topGiven && <span className="ml-1 font-normal text-slate-400">(A's assegnata)</span>}</>} value={input.beta} step="0.05" onChange={setNumber("beta")} disabled={topGiven} />}
                    </div>
                    {isTsec && (
                        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                            <p className="mb-2 text-xs font-semibold text-slate-600">Sezione a T</p>
                            <div className="grid grid-cols-2 gap-3">
                                <NumberField label="b_w" hint="larghezza anima" unit="mm" value={input.bw} onChange={setNumber("bw")} />
                                <NumberField label="s" hint="spessore ala" unit="mm" value={input.hf} onChange={setNumber("hf")} />
                            </div>
                            <div className="mt-3">
                                <SelectField label="Compressione dell'ala" value={input.flangeMethod ?? "simplified"} onChange={setField("flangeMethod")}
                                    options={[{ value: "simplified", label: "Semplificato (ali a f_cd)" }, { value: "exact", label: "Esatto (integrazione σ-ε)" }]} />
                            </div>
                        </div>
                    )}
                    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <p className="mb-2 text-xs font-semibold text-slate-600">Copriferri</p>
                        <div className="grid grid-cols-2 gap-3">
                            <NumberField label="d'" hint="verticale inferiore" unit="mm" value={input.dInf} onChange={setNumber("dInf")} />
                            <NumberField label="d''" hint="verticale superiore" unit="mm" value={input.dSup} onChange={setNumber("dSup")} />
                            <NumberField label="c" hint="orizzontale sinistro" unit="mm" value={input.cLeft} onChange={setNumber("cLeft")} />
                            <NumberField label="c'" hint="orizzontale destro" unit="mm" value={input.cRight} onChange={setNumber("cRight")} />
                        </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                        <NumberField label="Momento M_Ed" unit="kNm" value={input.MEd} onChange={setNumber("MEd")} />
                        <NumberField label="Sforzo normale N_Ed" unit="kN" value={input.NEd} onChange={setNumber("NEd")} />
                    </div>
                    <p className="mt-2 text-[11px] text-slate-400"><Sym>
                        Convenzioni: M_Ed &gt; 0 tende le fibre inferiori; N_Ed &gt; 0 compressione.
                        {input.mode === "fixBH"
                            ? " Sezione assegnata: A's calcolata solo se necessaria."
                            : " β = 0 → semplice armatura (dimensiona la geometria)."}
                    </Sym></p>
                </CollapsibleCard>

                <CollapsibleCard title="Materiali" command={cardCommand}>
                    <div className="grid grid-cols-2 gap-3">
                        <SelectField label="Calcestruzzo" value={input.fck} onChange={setNumber("fck")} options={CONCRETE_CLASSES.map((c) => ({ value: c.fck, label: c.id }))}
                            labelExtra={<InfoButton label="Caratteristiche delle classi di calcestruzzo" onClick={() => setMaterialInfo("concrete")} />} />
                        <SelectField label="Acciaio" value={input.steelGrade ?? "B450C"}
                            onChange={(v) => setInput((p) => ({ ...p, steelGrade: v, fyk: STEEL_GRADES.find((g) => g.id === v)?.fyk ?? p.fyk }))}
                            options={STEEL_GRADES.map((g) => ({ value: g.id, label: g.id }))}
                            labelExtra={<InfoButton label="Caratteristiche degli acciai da cemento armato" onClick={() => setMaterialInfo("steel")} />} />
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
                    <label className="mt-3 flex cursor-pointer items-start gap-2 text-xs font-semibold text-slate-600">
                        <input type="checkbox" checked={!!input.hangerBars} onChange={(e) => setField("hangerBars")(e.target.checked)} className="mt-0.5 h-4 w-4 accent-sky-600" />
                        <span>Barre {input.MEd < 0 ? "inferiori" : "superiori"} costruttive (2 reggistaffa)<span className="block text-[10px] font-normal text-slate-400">per ancorare la staffa se il calcolo non richiede armatura compressa</span></span>
                    </label>
                    {input.hangerBars && (
                        <div className="mt-3 space-y-3 border-l-2 border-slate-100 pl-3">
                            <label className="flex cursor-pointer items-start gap-2 text-xs font-semibold text-slate-600">
                                <input type="checkbox" checked={!!input.hangerInCalc} onChange={(e) => setField("hangerInCalc")(e.target.checked)} className="mt-0.5 h-4 w-4 accent-sky-600" />
                                <span>Considera le barre {input.MEd < 0 ? "inferiori" : "superiori"} nel calcolo<span className="block text-[10px] font-normal text-slate-400">A's assegnata (si sceglie nel box Armatura compressa); sostituisce β</span></span>
                            </label>
                            {!input.hangerInCalc && (
                                <div className="grid grid-cols-2 gap-3">
                                    <SelectField label="Diametro reggistaffa" value={input.phiHanger} onChange={setNumber("phiHanger")} options={BAR_DIAMETERS.map((d) => ({ value: d, label: `φ ${d}` }))} />
                                </div>
                            )}
                        </div>
                    )}
                    <label className="mt-3 flex cursor-pointer items-start gap-2 text-xs font-semibold text-slate-600">
                        <input type="checkbox" checked={!!input.multiLayer} onChange={(e) => setField("multiLayer")(e.target.checked)} className="mt-0.5 h-4 w-4 accent-sky-600" />
                        <span>Armature su più file<span className="block text-[10px] font-normal text-slate-400">se le barre non entrano in una fila con l'interferro minimo</span></span>
                    </label>
                    {input.multiLayer && (
                        <div className="mt-3 grid grid-cols-2 gap-3">
                            <NumberField label="Max file inferiori" value={input.maxLayersBot} min="1" step="1" onChange={setNumber("maxLayersBot")} />
                            <NumberField label="Max file superiori" value={input.maxLayersTop} min="1" step="1" onChange={setNumber("maxLayersTop")} />
                        </div>
                    )}
                </CollapsibleCard>

                <CollapsibleCard title="Dettagli avanzati" defaultOpen={false} command={cardCommand}>
                        <div className="grid grid-cols-2 gap-3">
                            <NumberField label="Arrotond. h / B" unit="mm" value={input.dRound} onChange={setNumber("dRound")} />
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
                                    {result.errors.map((e) => <li key={e}>{sub(e)}</li>)}
                                </ul>
                            </div>
                        </div>
                    </Card>
                ) : (
                    <>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                            <BigResult title="Larghezza B" titleSuffix="richiesta" value={fmt(result.mode === "fixH" ? result.Breq : result.B, result.mode === "fixH" ? 1 : 0)} unit="mm"
                                {...(result.mode === "fixH" || result.mode === "fixBH" ? { onReset: () => setAdoptedDimensions((p) => ({ ...p, B: undefined })), resetLabel: "Ripristina larghezza adottata minima" } : {})}>
                                {(result.mode === "fixH" || result.mode === "fixBH") && <NumberField label="Larghezza adottata B" unit="mm" value={adoptedDimensions.B ?? String(calculatedB)} onChange={(v) => setAdoptedDimensions((p) => ({ ...p, B: v }))} />}
                                {result.mode === "fixH" && <AdoptionUtilization adopted={adoptedB} required={result.Breq} label="Sfruttamento larghezza" errorText="dimensione insufficiente" />}
                            </BigResult>
                            <BigResult title="Altezza h" titleSuffix="richiesta" value={fmt(result.mode === "fixB" ? result.dReq + result.cT : result.h, result.mode === "fixB" ? 1 : 0)} unit="mm"
                                {...(result.mode === "fixB" || result.mode === "fixBH" ? { onReset: () => setAdoptedDimensions((p) => ({ ...p, d: undefined, h: undefined })), resetLabel: "Ripristina altezza adottata minima" } : {})}>
                                {result.mode === "fixB" && <NumberField label="Altezza adottata h" unit="mm" value={adoptedDimensions.h ?? String(calculatedH)} onChange={setAdoptedH} />}
                                {result.mode === "fixB" && <AdoptionUtilization adopted={adoptedH} required={result.dReq + result.cT} label="Sfruttamento altezza" errorText="dimensione insufficiente" />}
                                {result.mode === "fixBH" && <NumberField label="Altezza adottata h" unit="mm" value={adoptedDimensions.h ?? String(calculatedH)} onChange={setAdoptedH} />}
                            </BigResult>
                            <BigResult title="Altezza utile d" titleSuffix="richiesta" value={fmt(result.mode === "fixB" ? result.dReq : result.d, result.mode === "fixB" ? 1 : 0)} unit="mm"
                                {...(result.mode === "fixB" ? { onReset: () => setAdoptedDimensions((p) => ({ ...p, d: undefined, h: undefined })), resetLabel: "Ripristina altezza utile adottata minima" } : {})}>
                                {result.mode === "fixB" && <NumberField label="Altezza utile adottata d" unit="mm" value={shownD} onChange={setAdoptedD} />}
                                {result.mode === "fixB" && <AdoptionUtilization adopted={adoptedD} required={result.dReq} label="Sfruttamento altezza utile" errorText="dimensione insufficiente" />}
                            </BigResult>
                        </div>

                        <Card>
                            <CardTitle>Armatura adottata</CardTitle>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="rounded-xl bg-sky-50 p-4">
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="flex items-baseline gap-1.5 text-xs font-semibold uppercase tracking-wide text-sky-700">Armatura tesa <span className="normal-case">A<sub>s</sub></span> <span className="text-[10px] font-medium normal-case tracking-normal text-slate-400">richiesta</span></p>
                                        <button type="button" onClick={() => setAdoptedReinforcement((p) => ({ ...p, tensionBars: String(result.nBars), tensionPhi: String(result.phi) }))} title="Ripristina armatura tesa adottata minima" aria-label="Ripristina armatura tesa adottata minima" className="rounded-md p-1 text-slate-500 transition hover:bg-sky-100 hover:text-sky-700">
                                            <RotateCcw size={15} />
                                        </button>
                                    </div>
                                    <p className="mt-1 flex flex-wrap items-baseline gap-x-1.5 text-2xl font-bold text-slate-900">{fmt(result.As, 1)}<span className="text-sm font-medium text-slate-500">mm²</span></p>
                                    <div className="mt-3 grid grid-cols-2 gap-3">
                                        <NumberField label="Numero adottato" value={adoptedReinforcement.tensionBars ?? String(result.nBars)} onChange={(v) => setAdoptedReinforcement((p) => ({ ...p, tensionBars: v }))} onBlur={(v) => setAdoptedReinforcement((p) => ({ ...p, tensionBars: v === "" ? "" : String(Math.max(2, Math.trunc(Number(v) || 0))) }))} min="2" step="1" />
                                        <SelectField label="Diametro adottato" value={adoptedReinforcement.tensionPhi || String(result.phi)} onChange={(v) => setAdoptedReinforcement((p) => ({ ...p, tensionPhi: v }))} options={[{ value: "", label: "Seleziona" }, ...BAR_DIAMETERS.map((d) => ({ value: d, label: `φ ${d}` }))]} />
                                    </div>
                                    <p className="mt-2 flex items-center justify-between gap-2 text-sm font-semibold text-slate-700">
                                        <span>A<sub>s</sub> <span className="text-[10px] font-medium normal-case tracking-normal text-slate-400">adottata</span> = {adoptedTensionArea ? `${adoptedTensionBars} φ ${adoptedTensionPhi} = ${fmt(adoptedTensionArea, 0)} mm²` : "—"}</span>
                                        {adoptedTensionArea !== null && (adoptedTensionArea >= result.As
                                            ? <CheckCircle2 size={16} className="shrink-0 text-emerald-600" aria-label="Armatura adottata verificata" role="img" />
                                            : <AlertTriangle size={16} className="shrink-0 text-red-600" aria-label="Armatura adottata inferiore a quella richiesta" role="img" />)}
                                    </p>
                                    <AdoptionUtilization adopted={adoptedTensionArea} required={result.As} />
                                </div>
                                {result.AsPrime > 0 && (
                                    <div className="rounded-xl bg-sky-50 p-4">
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="flex items-baseline gap-1.5 text-xs font-semibold uppercase tracking-wide text-sky-700">Armatura compressa <span className="normal-case">A'<sub>s</sub></span> <span className="text-[10px] font-medium normal-case tracking-normal text-slate-400">{topGiven ? "assegnata" : "richiesta"}</span></p>
                                            <button type="button" onClick={() => setAdoptedReinforcement((p) => (topGiven ? { ...p, compressionBars: undefined, compressionPhi: undefined } : { ...p, compressionBars: String(result.nBarsPrime), compressionPhi: String(result.phi) }))} title="Ripristina armatura compressa adottata minima" aria-label="Ripristina armatura compressa adottata minima" className="rounded-md p-1 text-slate-500 transition hover:bg-sky-100 hover:text-sky-700">
                                                <RotateCcw size={15} />
                                            </button>
                                        </div>
                                        <p className="mt-1 flex flex-wrap items-baseline gap-x-1.5 text-2xl font-bold text-slate-900">{fmt(result.AsPrime, 1)}<span className="text-sm font-medium text-slate-500">mm²</span></p>
                                        <div className="mt-3 grid grid-cols-2 gap-3">
                                            <NumberField label="Numero adottato" value={adoptedReinforcement.compressionBars ?? String(result.nBarsPrime)} onChange={(v) => setAdoptedReinforcement((p) => ({ ...p, compressionBars: v }))} onBlur={(v) => setAdoptedReinforcement((p) => ({ ...p, compressionBars: v === "" ? "" : String(Math.max(2, Math.trunc(Number(v) || 0))) }))} min="2" step="1" />
                                            <SelectField label="Diametro adottato" value={adoptedReinforcement.compressionPhi || String(result.phiPrime || result.phi)} onChange={(v) => setAdoptedReinforcement((p) => ({ ...p, compressionPhi: v }))} options={[{ value: "", label: "Seleziona" }, ...BAR_DIAMETERS.map((d) => ({ value: d, label: `φ ${d}` }))]} />
                                        </div>
                                        <p className="mt-2 flex items-center justify-between gap-2 text-sm font-semibold text-slate-700">
                                            <span>A'<sub>s</sub> <span className="text-[10px] font-medium normal-case tracking-normal text-slate-400">adottata</span> = {adoptedCompressionArea ? `${adoptedCompressionBars} φ ${adoptedCompressionPhi} = ${fmt(adoptedCompressionArea, 0)} mm²` : "—"}</span>
                                            {adoptedCompressionArea !== null && (adoptedCompressionArea >= result.AsPrime
                                                ? <CheckCircle2 size={16} className="shrink-0 text-emerald-600" aria-label="Armatura adottata verificata" role="img" />
                                                : <AlertTriangle size={16} className="shrink-0 text-red-600" aria-label="Armatura adottata inferiore a quella richiesta" role="img" />)}
                                        </p>
                                        <AdoptionUtilization adopted={adoptedCompressionArea} required={result.AsPrime} />
                                    </div>
                                )}
                            </div>
                            <div className="mt-3 space-y-2">
                                <CheckRow ok={checkedWidthOk} label={`Ingombro barre tese${selectedTensionBars >= 2 || selectedTensionPhi > 0 ? " adottate" : ""}: ${fmt(checkedWidth, 0)} mm ${checkedWidthOk ? "≤" : ">"} ${result.isT ? "b_w" : "B"} = ${fmt(checkedWidthLimit, 0)} mm`} reference={{ ntc: "§4.1.6.1.3", ec2: "§8.2" }} />
                                {adoptedCompressionBars > 0 && <CheckRow ok={checkedWidthCOk} label={`Ingombro barre compresse adottate: ${fmt(checkedWidthC, 0)} mm ${checkedWidthCOk ? "≤" : ">"} ${result.isT ? "b_w" : "B"} = ${fmt(checkedWidthLimit, 0)} mm`} reference={{ ntc: "§4.1.6.1.3", ec2: "§8.2" }} />}
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
                                    <button type="button" onClick={saveSectionDxf} title={isDxfSaved ? "DXF scaricato" : "Esporta DXF 1:1 per AutoCAD"} aria-label={isDxfSaved ? "DXF scaricato" : "Esporta sezione progettata in DXF in scala 1:1"} className="rounded-full border border-slate-300 bg-white p-2 text-slate-700 shadow-sm transition hover:bg-slate-50">
                                        <span className="relative block h-[15px] w-[15px]">
                                            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" className={`absolute inset-0 transition-all duration-300 ease-in-out ${isDxfSaved ? "rotate-90 scale-50 opacity-0" : "rotate-0 scale-100 opacity-100"}`} aria-hidden="true">
                                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                                                <path d="M14 2v6h6" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                                                <text x="5.1" y="16.2" fill="currentColor" fontSize="5.6" fontWeight="700" fontFamily="sans-serif">DXF</text>
                                            </svg>
                                            <Check size={15} className={`absolute inset-0 transition-all duration-300 ease-in-out ${isDxfSaved ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-50 opacity-0"}`} />
                                        </span>
                                    </button>
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
                            <div className="mx-auto max-w-[560px]">
                                <DesignDrawing result={drawingResult} B={adoptedB} layT={adoptedLayT} layC={adoptedLayC} hanger={hanger} dTNom={result.dTNom} dCNom={result.dCNom} phiStirrup={input.phiStirrup} cLeft={input.cLeft} cRight={input.cRight} moment={input.MEd} mode="fixBH" unit={drawUnit} svgRef={drawingSvgRef} />
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
                            <div className="flex items-center gap-2">
                                <button type="button" aria-expanded={showSteps} onClick={() => setShowSteps((s) => !s)} className="flex min-w-0 flex-1 cursor-pointer items-center justify-between text-left text-sm font-bold text-slate-800">
                                    Foglio dei passaggi di calcolo
                                    <ChevronDown size={15} aria-hidden="true" className={`text-slate-400 transition-transform duration-300 ${showSteps ? "" : "-rotate-90"}`} />
                                </button>
                                <button type="button" onClick={openPreview} title="Anteprima del PDF" aria-label="Anteprima del PDF dei passaggi di calcolo" className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50">
                                    <Eye size={14} />
                                    Anteprima
                                </button>
                                <button type="button" onClick={exportPdf} title="Esporta i passaggi in PDF" aria-label="Esporta i passaggi di calcolo in PDF" className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50">
                                    <FileDown size={14} />
                                    PDF
                                </button>
                            </div>
                            <AnimatedPanel isOpen={showSteps}>
                                <div ref={reportRef}>
                                <CalcReport result={result} input={input}
                                    sectionDrawing={<DesignDrawing result={drawingResult} B={adoptedB} layT={adoptedLayT} layC={adoptedLayC} hanger={hanger} dTNom={result.dTNom} dCNom={result.dCNom} phiStirrup={input.phiStirrup} cLeft={input.cLeft} cRight={input.cRight} moment={input.MEd} mode="fixBH" unit={drawUnit} bare />}
                                    forcesDrawing={<SideForcesDiagram result={result} unit={drawUnit} bare />}
                                    commercial={result.ok ? {
                                    B: adoptedB, h: adoptedH, d: adoptedD,
                                    nT: checkedBarCount, phiT: checkedBarDiameter, AsT: checkedBarCount * Math.PI * checkedBarDiameter ** 2 / 4,
                                    nC: adoptedCompressionBars, phiC: adoptedCompressionPhi, AsC: adoptedCompressionBars * Math.PI * adoptedCompressionPhi ** 2 / 4,
                                    gap: checkedBarGap, width: checkedWidth, rowsT: adoptedLayT.rows, rowsC: adoptedLayC.rows, hanger, widthOk: checkedWidthOk, widthLimit: checkedWidthLimit,
                                } : null} />
                                </div>
                            </AnimatedPanel>
                        </Card>

                        {previewHtml && <PdfPreview html={previewHtml} title={REPORT_TITLE} onClose={closePreview} />}
                    </>
                )}
            </div>
        </div>
    );
}

// Documento HTML del foglio dei passaggi con gli stessi stili della pagina, per
// la stampa ("Salva come PDF": testo e formule restano vettoriali) e per
// l'anteprima, dove a schermo il foglio è impaginato come una pagina A4.
// Il foglio è nel DOM anche quando la card è chiusa.
function buildReportHtml(node, title) {
    if (!node) throw new Error("Foglio non disponibile");
    const styles = [...document.querySelectorAll('link[rel="stylesheet"], style')].map((el) => el.outerHTML).join("\n");
    const date = new Date().toLocaleDateString("it-IT");
    return `<!doctype html><html lang="it"><head><meta charset="utf-8"><base href="${document.baseURI}"><title>${title}</title>${styles}
<style>
    @page { size: A4; margin: 15mm 14mm; }
    html, body { background: #fff; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .overflow-x-auto { overflow: visible !important; }
    .katex-display, svg, .rounded-xl, p { break-inside: avoid; }
    @media screen {
        html { background: #e2e8f0; }
        body { box-sizing: border-box; width: 210mm; min-height: 297mm; margin: 24px auto; padding: 15mm 14mm; box-shadow: 0 4px 16px rgb(15 23 42 / 0.15); }
    }
</style></head>
<body class="text-slate-700">
    <header class="mb-2 flex items-baseline justify-between border-b border-slate-200 pb-2">
        <h1 class="text-base font-bold text-slate-900">${title}</h1>
        <span class="text-xs text-slate-400">${date}</span>
    </header>
    ${node.innerHTML}
</body></html>`;
}

// Apre la finestra di stampa dell'iframe dopo che stili e font (KaTeX) sono caricati.
async function printFrame(iframe, title) {
    const doc = iframe.contentDocument;
    while (doc.readyState !== "complete") await new Promise((r) => window.setTimeout(r, 50));
    await doc.fonts?.ready;
    const prevTitle = document.title;
    document.title = title; // nome proposto per il file PDF
    iframe.contentWindow.focus();
    iframe.contentWindow.print(); // bloccante finché la finestra di stampa è aperta
    document.title = prevTitle;
}

// Stampa il foglio in un iframe nascosto.
function printReport(node, title) {
    const html = buildReportHtml(node, title);
    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
    document.body.appendChild(iframe);
    iframe.contentDocument.open();
    iframe.contentDocument.write(html);
    iframe.contentDocument.close();
    printFrame(iframe, title).finally(() => window.setTimeout(() => iframe.remove(), 1000));
}

// Pulsante "i" (come quello dei riferimenti normativi) che apre un approfondimento.
function InfoButton({ label, onClick }) {
    return (
        <button type="button" title={label} aria-label={label}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClick(); }}
            className="rounded-full p-0.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-200">
            <Info size={14} />
        </button>
    );
}

function useModalTransition(onClose) {
    const [isVisible, setIsVisible] = useState(false);
    const closeTimeoutRef = useRef(null);
    const onCloseRef = useRef(onClose);
    const isClosingRef = useRef(false);

    useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
    useEffect(() => {
        let secondFrame;
        const firstFrame = requestAnimationFrame(() => {
            secondFrame = requestAnimationFrame(() => setIsVisible(true));
        });
        return () => {
            cancelAnimationFrame(firstFrame);
            if (secondFrame !== undefined) cancelAnimationFrame(secondFrame);
            if (closeTimeoutRef.current !== null) window.clearTimeout(closeTimeoutRef.current);
        };
    }, []);

    const close = useCallback(() => {
        if (isClosingRef.current) return;
        isClosingRef.current = true;
        setIsVisible(false);
        const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
        closeTimeoutRef.current = window.setTimeout(() => onCloseRef.current(), reducedMotion ? 0 : 400);
    }, []);

    const finishClose = useCallback((event) => {
        if (isVisible || !isClosingRef.current || (event && (event.target !== event.currentTarget || event.propertyName !== "opacity"))) return;
        if (closeTimeoutRef.current !== null) window.clearTimeout(closeTimeoutRef.current);
        onCloseRef.current();
    }, [isVisible]);

    return { isVisible, close, finishClose };
}

// Modal con la tabella delle classi di calcestruzzo o degli acciai (NTC 2018 /
// EC2), con la riga della classe in uso evidenziata.
function MaterialInfoModal({ kind, fck, steelGrade, onClose }) {
    const { isVisible, close, finishClose } = useModalTransition(onClose);
    useEffect(() => {
        const onKey = (e) => { if (e.key === "Escape") close(); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [close]);
    const isConcrete = kind === "concrete";
    const th = "whitespace-nowrap border-b border-slate-200 px-2 py-1.5 text-center align-bottom font-semibold text-slate-600 first:text-left";
    const td = "whitespace-nowrap px-2 py-1 text-center tabular-nums first:text-left";
    const rowCls = (on) => (on ? "bg-sky-100 font-semibold text-slate-900" : "odd:bg-white even:bg-slate-50 text-slate-600");
    return createPortal((
        <div role="dialog" aria-modal="true" aria-label={isConcrete ? "Classi di calcestruzzo" : "Acciai da cemento armato"} className={`fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/60 p-2 transition-opacity duration-300 ease-in-out motion-reduce:transition-none ${isVisible ? "opacity-100" : "opacity-0"} sm:p-6`} onClick={close} onTransitionEnd={finishClose}>
            <div className={`w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl transition-transform duration-300 ease-in-out motion-reduce:transition-none ${isVisible ? "translate-y-0 scale-100" : "translate-y-2 scale-[0.98]"}`} onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
                    <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-800">{isConcrete ? "Classi di resistenza del calcestruzzo" : "Acciai per cemento armato"}</p>
                        <p className="text-[11px] text-slate-400">{isConcrete ? "NTC 2018 §4.1.2.1, §11.2.10 · EC2 Tab. 3.1" : "NTC 2018 §11.3.2 (Tab. 11.3.Ia / 11.3.Ib) · EC2 §3.2"}</p>
                    </div>
                    <button type="button" onClick={close} aria-label="Chiudi" className="rounded-full p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800">
                        <XIcon size={18} />
                    </button>
                </div>
                <div className="overflow-x-auto p-4">
                    {isConcrete ? (
                        <table className="w-full border-collapse text-xs">
                            <thead>
                                <tr>
                                    <th className={th}>Classe</th>
                                    <th className={th}>f<sub>ck</sub><span className="block text-[10px] font-normal text-slate-400">[MPa]</span></th>
                                    <th className={th}>R<sub>ck</sub><span className="block text-[10px] font-normal text-slate-400">[MPa]</span></th>
                                    <th className={th}>f<sub>cm</sub><span className="block text-[10px] font-normal text-slate-400">[MPa]</span></th>
                                    <th className={th}>f<sub>ctm</sub><span className="block text-[10px] font-normal text-slate-400">[MPa]</span></th>
                                    <th className={th}>f<sub>ctk,0,05</sub><span className="block text-[10px] font-normal text-slate-400">[MPa]</span></th>
                                    <th className={th}>f<sub>ctk,0,95</sub><span className="block text-[10px] font-normal text-slate-400">[MPa]</span></th>
                                    <th className={th}>E<sub>cm</sub><span className="block text-[10px] font-normal text-slate-400">[MPa]</span></th>
                                    <th className={th}>ε<sub>c1</sub><span className="block text-[10px] font-normal text-slate-400">[‰]</span></th>
                                    <th className={th}>ε<sub>cu1</sub><span className="block text-[10px] font-normal text-slate-400">[‰]</span></th>
                                    <th className={th}>ε<sub>c2</sub><span className="block text-[10px] font-normal text-slate-400">[‰]</span></th>
                                    <th className={th}>ε<sub>cu2</sub><span className="block text-[10px] font-normal text-slate-400">[‰]</span></th>
                                    <th className={th}>n</th>
                                    <th className={th}>ε<sub>c3</sub><span className="block text-[10px] font-normal text-slate-400">[‰]</span></th>
                                    <th className={th}>ε<sub>cu3</sub><span className="block text-[10px] font-normal text-slate-400">[‰]</span></th>
                                </tr>
                            </thead>
                            <tbody>
                                {concreteTable().map((c) => (
                                    <tr key={c.id} className={rowCls(c.fck === fck)} aria-current={c.fck === fck ? "true" : undefined}>
                                        <td className={td}>{c.id}</td>
                                        <td className={td}>{fmtNum(c.fck, 0)}</td>
                                        <td className={td}>{fmtNum(c.Rck, 0)}</td>
                                        <td className={td}>{fmtNum(c.fcm, 0)}</td>
                                        <td className={td}>{fmt(c.fctm, 2)}</td>
                                        <td className={td}>{fmt(c.fctk005, 2)}</td>
                                        <td className={td}>{fmt(c.fctk095, 2)}</td>
                                        <td className={td}>{fmt(c.Ecm, 0)}</td>
                                        <td className={td}>{fmt(c.epsC1, 2)}</td>
                                        <td className={td}>{fmt(c.epsCu1, 2)}</td>
                                        <td className={td}>{fmt(c.epsC2, 2)}</td>
                                        <td className={td}>{fmt(c.epsCu2, 2)}</td>
                                        <td className={td}>{fmt(c.n, 2)}</td>
                                        <td className={td}>{fmt(c.epsC3, 2)}</td>
                                        <td className={td}>{fmt(c.epsCu3, 2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <table className="w-full border-collapse text-xs">
                            <thead>
                                <tr>
                                    <th className={th}>Acciaio</th>
                                    <th className={th}>f<sub>y,nom</sub><span className="block text-[10px] font-normal text-slate-400">[MPa]</span></th>
                                    <th className={th}>f<sub>t,nom</sub><span className="block text-[10px] font-normal text-slate-400">[MPa]</span></th>
                                    <th className={th}>f<sub>yk</sub><span className="block text-[10px] font-normal text-slate-400">[MPa]</span></th>
                                    <th className={th}>f<sub>tk</sub><span className="block text-[10px] font-normal text-slate-400">[MPa]</span></th>
                                    <th className={th}>(f<sub>t</sub>/f<sub>y</sub>)<sub>k</sub></th>
                                    <th className={th}>(f<sub>y</sub>/f<sub>y,nom</sub>)<sub>k</sub></th>
                                    <th className={th}>A<sub>gt,k</sub><span className="block text-[10px] font-normal text-slate-400">[%]</span></th>
                                    <th className={th}>E<sub>s</sub><span className="block text-[10px] font-normal text-slate-400">[MPa]</span></th>
                                    <th className={th}>f<sub>yd</sub><span className="block text-[10px] font-normal text-slate-400">[MPa]</span></th>
                                    <th className={th}>ε<sub>yd</sub><span className="block text-[10px] font-normal text-slate-400">[‰]</span></th>
                                    <th className={th}>ε<sub>ud</sub><span className="block text-[10px] font-normal text-slate-400">[‰]</span></th>
                                    <th className={th}>Diametri φ<span className="block text-[10px] font-normal text-slate-400">[mm]</span></th>
                                </tr>
                            </thead>
                            <tbody>
                                {STEEL_TABLE.map((g) => (
                                    <tr key={g.id} className={rowCls(g.id === steelGrade)} aria-current={g.id === steelGrade ? "true" : undefined}>
                                        <td className={td}>{g.id}</td>
                                        <td className={td}>{fmtNum(g.fyNom, 0)}</td>
                                        <td className={td}>{fmtNum(g.ftNom, 0)}</td>
                                        <td className={td}>{g.fyk}</td>
                                        <td className={td}>{g.ftk}</td>
                                        <td className={td}>{g.ftfy}</td>
                                        <td className={td}>{g.fyfyNom}</td>
                                        <td className={td}>≥ {fmt(g.Agt, 1)}</td>
                                        <td className={td}>{fmt(g.Es, 0)}</td>
                                        <td className={td}>{fmt(g.fyd, 2)}</td>
                                        <td className={td}>{fmt(g.epsYd, 2)}</td>
                                        <td className={td}>{fmt(g.epsUd, 2)}</td>
                                        <td className={td}>{g.diameters}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                    <p className="mt-3 text-[11px] leading-snug text-slate-400">
                        {isConcrete
                            ? "Colonne nell'ordine dell'EC2 Tab. 3.1. fcm = fck + 8; fctm = 0,30·fck^(2/3) fino a C50/60, oltre 2,12·ln(1 + fcm/10); fctk,0,05 = 0,7·fctm; fctk,0,95 = 1,3·fctm; Ecm = 22000·(fcm/10)^0,3; εc1 = 0,7·fcm^0,31 ≤ 2,8‰. Lo strumento di progetto ammette le classi da C20/25 a C50/60."
                            : "Colonne da fy,nom ad Agt,k nell'ordine delle NTC 2018 Tab. 11.3.Ia/b; seguono i valori di progetto: fyd = fyk / γs con γs = 1,15; εyd = fyd / Es; εud = 0,9·εuk con εuk = Agt,k; diametri ammessi (§11.3.2.1)."}
                    </p>
                </div>
            </div>
        </div>
    ), document.getElementById("modal-root"));
}

// Anteprima del PDF: il documento di stampa in una finestra sopra la pagina.
function PdfPreview({ html, title, onClose }) {
    const frameRef = useRef(null);
    const { isVisible, close, finishClose } = useModalTransition(onClose);
    useEffect(() => {
        const onKey = (e) => { if (e.key === "Escape") close(); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [close]);
    return createPortal((
        <div role="dialog" aria-modal="true" aria-label="Anteprima PDF" className={`fixed inset-0 z-50 flex flex-col bg-slate-900/60 p-2 transition-opacity duration-300 ease-in-out motion-reduce:transition-none ${isVisible ? "opacity-100" : "opacity-0"} sm:p-6`} onClick={close} onTransitionEnd={finishClose}>
            <div className={`mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col overflow-hidden rounded-2xl bg-white shadow-2xl transition-transform duration-300 ease-in-out motion-reduce:transition-none ${isVisible ? "translate-y-0 scale-100" : "translate-y-2 scale-[0.98]"}`} onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
                    <p className="min-w-0 truncate text-sm font-bold text-slate-800">Anteprima PDF</p>
                    <div className="flex shrink-0 items-center gap-2">
                        <button type="button" onClick={() => printFrame(frameRef.current, title)} className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-700">
                            <FileDown size={14} />
                            Salva PDF
                        </button>
                        <button type="button" onClick={close} aria-label="Chiudi anteprima" className="rounded-full p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800">
                            <XIcon size={18} />
                        </button>
                    </div>
                </div>
                <iframe ref={frameRef} title="Anteprima PDF dei passaggi di calcolo" srcDoc={html} className="min-h-0 w-full flex-1 bg-slate-200" />
            </div>
        </div>
    ), document.getElementById("modal-root"));
}

// -------- Foglio dei passaggi di calcolo (formule in LaTeX) --------
function CalcReport({ result, input, commercial, sectionDrawing, forcesDrawing }) {
    const r = result;
    const { fck, fyk, alphaCc, gammaC, gammaS, beta, phiStirrup } = input;
    const mm = "\\ \\text{mm}";
    const mm2 = "\\ \\text{mm}^2";
    const MPa = "\\ \\text{MPa}";
    // righe di formule allineate sull'"=", con la stessa spaziatura verticale
    const matRows = (rows) => `\\begin{aligned}${rows.join("\\\\[10pt]")}\\end{aligned}`;
    // deformazione a cui il cls raggiunge f_cd, secondo il legame adottato
    const epsKnee = {
        rectangular: "\\varepsilon_{c4}=0{,}70\\text{‰}",
        parabola: "\\varepsilon_{c2}=2\\text{‰}",
        bilinear: "\\varepsilon_{c3}=1{,}75\\text{‰}",
    }[input.concreteModel] ?? "\\varepsilon_{c2}=2\\text{‰}";
    const hasCompr = r.AsPrime > 0;
    const c = r.cT, cp = r.cC; // copriferri verticali lato teso / lato compresso [mm]
    // simboli: d' / d'' verticali inferiore / superiore, c / c' orizzontali
    // sinistro / destro; con M_Ed < 0 il lato teso è quello superiore
    const multiT = (r.layT?.rows.length || 0) > 1, multiC = (r.layC?.rows.length || 0) > 1;
    const baseT = r.tensionTop ? "d''" : "d'", baseC = r.tensionTop ? "d'" : "d''";
    const sT = multiT ? `${baseT}_{eff}` : baseT, sC = multiC ? `${baseC}_{eff}` : baseC;
    const sTtxt = multiT ? `${baseT}_eff` : baseT;      // per il testo semplice (sub)
    // tensione dell'acciaio teso: f_yd (elasto-plastico) oppure f_s (incrudente, a 10‰)
    const ts = Math.abs(r.fs - r.fyd) < 1e-9 ? "f_{yd}" : "f_s";
    const Ps = T(r.psi, 5), Lm = T(r.kG, 3), Xi = T(r.xi, 6), fcd = T(r.fcd, 2), fyd = T(r.fyd, 1), fsv = T(r.fs, 1);
    const Nnum = Math.abs(r.NEd) < 1 ? "0" : `${T(r.NEd / 1000, 1)}\\cdot 10^{3}`; // N
    const Mnum = `${T(r.MEd / 1e6, 1)}\\cdot 10^{6}`;                                // N·mm
    const h2 = T(r.h / 2, 1);

    // ---- risultanti, bracci e sistema di equilibrio ----
    // Prima si esprimono C_c, C's, T_s e i bracci con i valori sostituiti e
    // semplificati; il sistema si scrive poi in forma compatta con questi.
    const sgn = (v, dec = 1) => (v < 0 ? `-${T(-v, dec)}` : `+${T(v, dec)}`);
    const lin = (a, v, b, decA = 4) => `${T(a, decA)}\\,${v}${T(b, 1) === "0" ? "" : sgn(b, 1)}`;
    const G = !!r.givenTop;                                // A's assegnata (barre superiori nel calcolo)
    const hasCs = G || (r.mode === "fixBH" ? r.xFromXi : beta > 0); // armatura compressa presente nel sistema
    const kS = (r.mode === "fixBH" ? 1 : beta) * r.fyd;   // C's = kS·A_s (fixB/fixH) oppure kS·A's (fixBH)
    const kT = r.fs;                                      // T_s = kT·A_s
    const sameArm = Math.abs(c - cp) < 1e-9;              // c = c': C's e T_s hanno lo stesso braccio
    const X1 = T(r.X, 1);

    const symSystem = hasCs
        ? `\\begin{cases}C_c+C_s'-T_s=N_{Ed}\\\\[6pt]C_c\\Big(\\tfrac{h}{2}-\\lambda x\\Big)+C_s'\\Big(\\tfrac{h}{2}-${sC}\\Big)+T_s\\Big(\\tfrac{h}{2}-${sT}\\Big)=M_{Ed}\\end{cases}`
        : `\\begin{cases}C_c-T_s=N_{Ed}\\\\[6pt]C_c\\Big(\\tfrac{h}{2}-\\lambda x\\Big)+T_s\\Big(\\tfrac{h}{2}-${sT}\\Big)=M_{Ed}\\end{cases}`;
    const cases = (eqN, eqM) => `\\begin{cases}${eqN}\\\\[6pt]${eqM}\\end{cases}`;

    // righe delle forze: { lhs, sym, num?, val }
    const CsK = `${T(r.Cs / 1000, 1)}\\cdot 10^{3}`;               // C's noto (A's assegnata)
    const rowCs = G
        ? { lhs: "C_s'", sym: "A_s'\\,f_{yd}", num: `${T(r.AsPrime, 1)}\\cdot ${fyd}`, val: CsK }
        : r.mode === "fixBH"
        ? { lhs: "C_s'", sym: "A_s'\\,f_{yd}", val: `${fyd}\\,A_s'` }
        : { lhs: "C_s'", sym: "\\beta\\,A_s\\,f_{yd}", num: `${T(beta, 2)}\\cdot A_s\\cdot ${fyd}`, val: `${T(kS, 2)}\\,A_s` };
    const rowTs = { lhs: "T_s", sym: `A_s\\,${ts}`, val: `${fsv}\\,A_s` };

    let forceRows, armItems, numSystem, unknowns;
    if (G && r.mode === "fixB") {
        // A's assegnata, x = xi·d, h = d + d_T: incognite d e A_s
        const kCd = r.psi * r.B * r.xi * r.fcd;
        const armC = lin(0.5 - r.kG * r.xi, "d", c / 2);
        const armS = lin(0.5, "d", c / 2 - cp, 1);
        const armT = lin(0.5, "d", -c / 2, 1);
        forceRows = [
            { lhs: "C_c", sym: "\\Psi\\,B\\,x\\,f_{cd}", num: `${Ps}\\cdot ${T(r.B, 0)}\\cdot ${Xi}\\,d\\cdot ${fcd}`, val: `${T(kCd, 1)}\\,d` },
            rowCs,
            rowTs,
        ];
        armItems = [
            `\\tfrac{h}{2}-\\lambda x=\\tfrac{d+${T(c, 0)}}{2}-${Lm}\\cdot ${Xi}\\,d=${armC}`,
            `\\tfrac{h}{2}-${sC}=${armS}`,
            `\\tfrac{h}{2}-${sT}=${armT}`,
        ];
        numSystem = cases(
            `${T(kCd, 1)}\\,d+${CsK}-${fsv}\\,A_s=${Nnum}`,
            `${T(kCd, 1)}\\,d\\,(${armC})+${CsK}\\,(${armS})+${fsv}\\,A_s\\,(${armT})=${Mnum}`);
        unknowns = "incognite d e A_s";
    } else if (G && r.mode === "fixH") {
        // A's assegnata, h e x noti: incognite B e A_s
        const kCB = r.psi * r.X * r.fcd;
        forceRows = [
            { lhs: "C_c", sym: "\\Psi\\,B\\,x\\,f_{cd}", num: `${Ps}\\cdot B\\cdot ${X1}\\cdot ${fcd}`, val: `${T(kCB, 2)}\\,B` },
            rowCs,
            rowTs,
        ];
        armItems = [
            `\\tfrac{h}{2}-\\lambda x=${h2}-${Lm}\\cdot ${X1}=${T(r.aCc, 1)}`,
            `\\tfrac{h}{2}-${sC}=${T(r.aCs, 1)}`,
            `\\tfrac{h}{2}-${sT}=${T(r.aTs, 1)}`,
        ];
        numSystem = cases(
            `${T(kCB, 2)}\\,B+${CsK}-${fsv}\\,A_s=${Nnum}`,
            `${T(kCB * r.aCc, 1)}\\,B+${T(r.Cs * r.aCs / 1e6, 2)}\\cdot 10^{6}+${T(kT * r.aTs, 1)}\\,A_s=${Mnum}`);
        unknowns = "incognite B e A_s";
    } else if (G) {
        // A's assegnata, B e h note: incognite x e A_s
        const kCx = r.psi * r.B * r.fcd;
        forceRows = [
            { lhs: "C_c", sym: "\\Psi\\,B\\,x\\,f_{cd}", num: `${Ps}\\cdot ${T(r.B, 0)}\\cdot x\\cdot ${fcd}`, val: `${T(kCx, 1)}\\,x` },
            rowCs,
            rowTs,
        ];
        armItems = [
            `\\tfrac{h}{2}-\\lambda x=${h2}-${Lm}\\,x`,
            `\\tfrac{h}{2}-${sC}=${T(r.aCs, 1)}`,
            `\\tfrac{h}{2}-${sT}=${T(r.aTs, 1)}`,
        ];
        numSystem = cases(
            `${T(kCx, 1)}\\,x+${CsK}-${fsv}\\,A_s=${Nnum}`,
            `${T(kCx, 1)}\\,x\\,(${h2}-${Lm}\\,x)+${T(r.Cs * r.aCs / 1e6, 2)}\\cdot 10^{6}+${T(kT * r.aTs, 1)}\\,A_s=${Mnum}`);
        unknowns = "incognite x e A_s";
    } else if (r.mode === "fixB") {
        // x = xi·d e h = d + d_T: forze e bracci lineari in d
        const kCd = r.psi * r.B * r.xi * r.fcd;
        const armC = lin(0.5 - r.kG * r.xi, "d", c / 2);
        const armS = lin(0.5, "d", c / 2 - cp, 1);
        const armT = lin(0.5, "d", -c / 2, 1);
        forceRows = [
            { lhs: "C_c", sym: "\\Psi\\,B\\,x\\,f_{cd}", num: `${Ps}\\cdot ${T(r.B, 0)}\\cdot ${Xi}\\,d\\cdot ${fcd}`, val: `${T(kCd, 1)}\\,d` },
            hasCs ? rowCs : null,
            rowTs,
        ];
        armItems = [
            `\\tfrac{h}{2}-\\lambda x=\\tfrac{d+${T(c, 0)}}{2}-${Lm}\\cdot ${Xi}\\,d=${armC}`,
            hasCs ? `\\tfrac{h}{2}-${sC}=${armS}` : null,
            `\\tfrac{h}{2}-${sT}=${armT}`,
        ];
        const steel = !hasCs ? [`${fsv}\\,A_s\\,(${armT})`]
            : sameArm ? [`${T(kS + kT, 2)}\\,A_s\\,(${armT})`]
                : [`${T(kS, 2)}\\,A_s\\,(${armS})`, `${fsv}\\,A_s\\,(${armT})`];
        numSystem = cases(
            `${T(kCd, 1)}\\,d-${T(hasCs ? kT - kS : kT, 2)}\\,A_s=${Nnum}`,
            `${T(kCd, 1)}\\,d\\,(${armC})+${steel.join("+")}=${Mnum}`);
        unknowns = "incognite d e A_s";
    } else if (r.mode === "fixH") {
        // h e x noti: forze lineari in B e A_s, bracci numerici
        const kCB = r.psi * r.X * r.fcd;
        forceRows = [
            { lhs: "C_c", sym: "\\Psi\\,B\\,x\\,f_{cd}", num: `${Ps}\\cdot B\\cdot ${X1}\\cdot ${fcd}`, val: `${T(kCB, 2)}\\,B` },
            hasCs ? rowCs : null,
            rowTs,
        ];
        armItems = [
            `\\tfrac{h}{2}-\\lambda x=${h2}-${Lm}\\cdot ${X1}=${T(r.aCc, 1)}`,
            hasCs ? `\\tfrac{h}{2}-${sC}=${T(r.aCs, 1)}` : null,
            `\\tfrac{h}{2}-${sT}=${T(r.aTs, 1)}`,
        ];
        numSystem = cases(
            `${T(kCB, 2)}\\,B-${T(hasCs ? kT - kS : kT, 2)}\\,A_s=${Nnum}`,
            `${T(kCB * r.aCc, 1)}\\,B+${T((hasCs ? kS * r.aCs : 0) + kT * r.aTs, 1)}\\,A_s=${Mnum}`);
        unknowns = "incognite B e A_s";
    } else if (r.xFromXi) {
        // B e h note, x = xi·d: C_c noto, incognite A_s e A's
        forceRows = [
            { lhs: "C_c", sym: "\\Psi\\,B\\,x\\,f_{cd}", num: `${Ps}\\cdot ${T(r.B, 0)}\\cdot ${X1}\\cdot ${fcd}`, val: `${T(r.Cc / 1000, 1)}\\cdot 10^{3}` },
            rowCs,
            rowTs,
        ];
        armItems = [
            `\\tfrac{h}{2}-\\lambda x=${h2}-${Lm}\\cdot ${X1}=${T(r.aCc, 1)}`,
            `\\tfrac{h}{2}-${sC}=${T(r.aCs, 1)}`,
            `\\tfrac{h}{2}-${sT}=${T(r.aTs, 1)}`,
        ];
        numSystem = cases(
            `${T(r.Cc / 1000, 1)}\\cdot 10^{3}+${fyd}\\,A_s'-${fsv}\\,A_s=${Nnum}`,
            `${T(r.Cc * r.aCc / 1e6, 2)}\\cdot 10^{6}+${T(r.fyd * r.aCs, 1)}\\,A_s'+${T(kT * r.aTs, 1)}\\,A_s=${Mnum}`);
        unknowns = "incognite A_s e A's";
    } else {
        // B e h note, A's = 0: incognite x e A_s
        const kCx = r.psi * r.B * r.fcd;
        forceRows = [
            { lhs: "C_c", sym: "\\Psi\\,B\\,x\\,f_{cd}", num: `${Ps}\\cdot ${T(r.B, 0)}\\cdot x\\cdot ${fcd}`, val: `${T(kCx, 1)}\\,x` },
            rowTs,
        ];
        armItems = [
            `\\tfrac{h}{2}-\\lambda x=${h2}-${Lm}\\,x`,
            `\\tfrac{h}{2}-${sT}=${T(r.aTs, 1)}`,
        ];
        numSystem = cases(
            `${T(kCx, 1)}\\,x-${fsv}\\,A_s=${Nnum}`,
            `${T(kCx, 1)}\\,x\\,(${h2}-${Lm}\\,x)+${T(kT * r.aTs, 1)}\\,A_s=${Mnum}`);
        unknowns = "incognite x e A_s";
    }

    // ---- "Ottengo": risultati in colonna ----
    // Le incognite del sistema si riportano con il solo risultato; le grandezze
    // che ne dipendono (h = d + d_T, A's = β A_s) con formula, numeri e risultato.
    const res = (lhs, v, unit) => ({ tex: `${lhs}=${T(v, 1)}${unit}` });
    // fissa B o h: A's = β·A_s sempre esplicitato (anche con β = 0)
    const asPrimeRow = { lhs: "A_s'", sym: "\\beta\\,A_s", num: `${T(beta, 2)}\\cdot ${T(r.As, 1)}`, val: `${T(r.AsPrime, 1)}${mm2}` };
    const solve = [];
    // A's assegnata: n φ = area
    const asGiven = { tex: `A_s'=${r.nBarsPrime}\\,\\phi${T(r.phiPrime, 0)}=${T(r.AsPrime, 1)}${mm2}` };
    if (G) {
        if (r.mode === "fixB") solve.push(res("d", r.dReq, mm), { lhs: "h", sym: `d+${sT}`, num: `${T(r.dReq, 1)}+${T(c, 0)}`, val: `${T(r.h, 1)}${mm}` }, res("A_s", r.As, mm2), asGiven);
        else if (r.mode === "fixH") solve.push(res("B", r.Breq, mm), res("A_s", r.As, mm2), asGiven);
        else solve.push(res("x", r.X, mm), res("A_s", r.As, mm2), asGiven);
    } else if (r.mode === "fixB") {
        solve.push(
            res("d", r.dReq, mm),
            { lhs: "h", sym: `d+${sT}`, num: `${T(r.dReq, 1)}+${T(c, 0)}`, val: `${T(r.h, 1)}${mm}` },
            res("A_s", r.As, mm2),
            asPrimeRow,
        );
    } else if (r.mode === "fixH") {
        solve.push(res("B", r.Breq, mm), res("A_s", r.As, mm2), asPrimeRow);
    } else if (r.xFromXi) {
        solve.push(res("A_s", r.As, mm2), res("A_s'", r.AsPrime, mm2));
    } else {
        solve.push(res("x", r.X, mm), res("A_s", r.As, mm2), { tex: "A_s'=0" });
    }

    // ---- sezione a T: formule simboliche, risultati e valori all'equilibrio ----
    let tBlk = null;
    if (r.isT) {
        const flip = r.tensionTop, exact = r.flangeMethod === "exact";
        const kN3 = (v) => `${T(v / 1000, 1)}\\cdot 10^{3}`;   // N → "…·10^3"
        const kNm6 = (v) => `${T(v / 1e6, 2)}\\cdot 10^{6}`;  // N·mm → "…·10^6"
        const Bv = T(r.B, 1), bwv = T(r.bw, 0), sv = T(r.hf, 0), hv = T(r.h, 1), dv = T(r.d, 1), xv = T(r.X, 2);
        const caseNote = exact
            ? "Ala: integrazione del diagramma σ-ε sull'area compressa reale della T (b = B nell'ala, b = b_w nell'anima)."
            : flip
                ? (r.inFlange ? "M_Ed < 0: è compressa l'anima (Ψ·x ≤ h − s), rettangolo di larghezza b_w." : "M_Ed < 0: la zona compressa raggiunge l'ala, risultante per integrazione.")
                : (r.inFlange ? `Ψ·x = ${fmtNum(r.psi * r.X, 1)} mm ≤ s = ${fmtNum(r.hf, 0)} mm: asse neutro nell'ala, sezione rettangolare di larghezza B.`
                    : `Ψ·x = ${fmtNum(r.psi * r.X, 1)} mm > s = ${fmtNum(r.hf, 0)} mm: è compressa anche l'anima; gli sbalzi dell'ala (B − b_w) lavorano uniformemente a f_cd.`);
        const ccSym = exact ? "\\int_0^{x}\\sigma_c(y)\\,b(y)\\,dy"
            : flip ? "\\Psi\\,b_w\\,x\\,f_{cd}"
                : r.inFlange ? "\\Psi\\,B\\,x\\,f_{cd}" : "\\Psi\\,b_w\\,x\\,f_{cd}+(B-b_w)\\,s\\,f_{cd}";
        const ycSym = exact ? "\\dfrac{\\int_0^{x}\\sigma_c\\,b\\,y\\,dy}{C_c}"
            : flip || r.inFlange ? "\\lambda\\,x" : "\\dfrac{C_{c,w}\\,\\lambda x+C_{c,f}\\,s/2}{C_c}";
        const yGfrac = "\\dfrac{B\\,s^2/2+b_w\\,(h-s)(h+s)/2}{B\\,s+b_w\\,(h-s)}";
        const yGnum = `\\dfrac{${Bv}\\cdot ${sv}^2/2+${bwv}\\cdot(${hv}-${sv})(${hv}+${sv})/2}{${Bv}\\cdot ${sv}+${bwv}\\cdot(${hv}-${sv})}`;
        const csSymOnly = hasCs ? { lhs: "C_s'", sym: rowCs.sym } : null;
        const ccNum = exact ? null
            : flip || r.inFlange ? `${Ps}\\cdot ${flip ? bwv : Bv}\\cdot ${xv}\\cdot ${fcd}`
                : `${Ps}\\cdot ${bwv}\\cdot ${xv}\\cdot ${fcd}+(${Bv}-${bwv})\\cdot ${sv}\\cdot ${fcd}`;
        const Ts = r.As * r.fs, Cs = r.Cs || 0;
        tBlk = {
            caseNote,
            forces: eqBlock([{ lhs: "C_c", sym: ccSym }, csSymOnly, { lhs: "T_s", sym: `A_s\\,${ts}` }].filter(Boolean)),
            geom: eqBlock([
                { lhs: "y_G", sym: flip ? `h-${yGfrac}` : yGfrac },
                { lhs: "y_c", sym: ycSym },
            ]),
            system: hasCs
                ? `\\begin{cases}C_c+C_s'-T_s=N_{Ed}\\\\[6pt]C_c\\,(y_G-y_c)+C_s'\\,(y_G-${sC})+T_s\\,(d-y_G)=M_{Ed}\\end{cases}`
                : `\\begin{cases}C_c-T_s=N_{Ed}\\\\[6pt]C_c\\,(y_G-y_c)+T_s\\,(d-y_G)=M_{Ed}\\end{cases}`,
            values: eqBlock([
                r.xFromXi ? { lhs: "x", sym: `${Xi}\\cdot d`, num: `${Xi}\\cdot ${dv}`, val: `${xv}${mm}` } : { lhs: "x", sym: `${xv}${mm}` },
                { lhs: "y_G", sym: flip ? `${hv}-${yGnum}` : yGnum, val: `${T(r.yG, 1)}${mm}` },
                { lhs: "C_c", sym: ccNum ?? `${kN3(r.Cc)}\\ \\text{N}`, val: ccNum ? `${kN3(r.Cc)}\\ \\text{N}` : null },
                { lhs: "y_c", sym: `${T(r.yc, 1)}${mm}` },
                hasCs ? { lhs: "C_s'", sym: `${T(r.AsPrime, 1)}\\cdot ${fyd}`, val: `${kN3(Cs)}\\ \\text{N}` } : null,
                { lhs: "T_s", sym: `${T(r.As, 1)}\\cdot ${fsv}`, val: `${kN3(Ts)}\\ \\text{N}` },
                { lhs: "y_G-y_c", sym: `${T(r.aCc, 1)}${mm}` },
                hasCs ? { lhs: `y_G-${sC}`, sym: `${T(r.aCs, 1)}${mm}` } : null,
                { lhs: "d-y_G", sym: `${T(r.aTs, 1)}${mm}` },
            ].filter(Boolean)),
            check: `\\begin{cases}${kN3(r.Cc)}${hasCs ? `+${kN3(Cs)}` : ""}-${kN3(Ts)}=${Math.abs(r.eqN) < 500 ? "0" : kN3(r.eqN)}\\;\\approx\\;N_{Ed}=${Nnum}\\\\[6pt]${kNm6(r.Cc * r.aCc)}${hasCs ? `+${kNm6(Cs * r.aCs)}` : ""}+${kNm6(Ts * r.aTs)}=${kNm6(r.eqM)}\\;\\approx\\;M_{Ed}=${Mnum}\\end{cases}`,
        };
    }

    // riga di più grandezze che va a capo da sola quando lo spazio non basta
    const Row = ({ items }) => (
        <div className="flex flex-wrap items-baseline justify-center gap-x-6 gap-y-1 py-1">
            {items.filter(Boolean).map((t, i) => <Tex key={i}>{t}</Tex>)}
        </div>
    );

    const cm = commercial;
    const areaT = cm ? cm.AsT : r.AsProvided;
    const minOk = areaT >= r.AsMin, maxOk = areaT <= r.AsMax;

    return (
        <div className="mt-4 space-y-5 text-sm text-slate-700">
            <Step n="1" title="Dati di progetto">
                <p className="text-xs font-semibold text-slate-500">Azioni agenti:</p>
                <Row items={[`M_{Ed}=${T(r.MEdSigned / 1e6, 1)}\\ \\text{kNm}`, `N_{Ed}=${T(r.NEd / 1000, 1)}\\ \\text{kN}`]} />
                {/* tipo di sollecitazione: dal segno di N_Ed (M_Ed è sempre diverso da zero) */}
                {Math.abs(r.NEd) < 0.5 ? (
                    <Tex display>{`\\text{Flessione semplice}\\quad (N_{Ed}=0)`}</Tex>
                ) : (
                    <Tex display>{`\\text{${r.NEd > 0 ? "Pressoflessione" : "Tensoflessione"} retta}\\quad e=\\dfrac{|M_{Ed}|}{|N_{Ed}|}=\\dfrac{${T(r.MEd / 1e6, 1)}\\cdot 10^{6}}{${T(Math.abs(r.NEd) / 1000, 1)}\\cdot 10^{3}}=${T(r.MEd / Math.abs(r.NEd), 1)}${mm}`}</Tex>
                )}
                <p className="text-xs text-slate-400"><Sym>
                    Convenzioni: M_Ed &gt; 0 tende le fibre inferiori; N_Ed &gt; 0 compressione..
                    {r.tensionTop ? " M_Ed < 0 → sezione ribaltata (lato teso in alto), si usa |M_Ed|." : ""}
                </Sym></p>
                {r.isT && <p className="text-xs text-slate-400"><Sym>{`Sezione a T: ala di larghezza B e spessore s sul lembo superiore, anima b_w; compressione dell'ala con il metodo ${r.flangeMethod === "exact" ? "esatto (integrazione del diagramma σ-ε)" : "semplificato (sbalzi dell'ala a f_cd)"}.`}</Sym></p>}
                <p className="text-xs font-semibold text-slate-500">Fisso:</p>
                <Row items={[
                    r.mode !== "fixH" ? `B=${T(r.B, 0)}${mm}` : null,
                    r.isT ? `b_w=${T(r.bw, 0)}${mm}` : null,
                    r.isT ? `s=${T(r.hf, 0)}${mm}` : null,
                    r.mode !== "fixB" ? `h=${T(r.h, 0)}${mm}` : null,
                    `d'=${T(input.dInf, 0)}${mm}`,
                    `d''=${T(input.dSup, 0)}${mm}`,
                    `c=${T(input.cLeft, 0)}${mm}`,
                    `c'=${T(input.cRight, 0)}${mm}`,
                    r.mode !== "fixBH" && !G ? `\\beta=${T(beta, 2)}` : null,
                    G ? `A_s'=${r.nBarsPrime}\\,\\phi${T(r.phiPrime, 0)}=${T(r.AsPrime, 1)}${mm2}` : null,
                ]} />
                {(multiT || multiC) && <>
                    <p className="text-xs font-semibold text-slate-500">Armature su più file (copriferro al baricentro delle barre) [mm]:</p>
                    <p className="text-xs text-slate-400">
                        {[multiT && `tese: ${r.layT.rows.join(" + ")} φ${r.phi}`, multiC && `compresse: ${r.layC.rows.join(" + ")} φ${r.phi}`].filter(Boolean).join("; ")}
                        {" "}(file dall'esterno; passo verticale tra gli assi φ + max(φ, 20 mm) = {T(r.layT?.sV || r.layC?.sV, 0)} mm).
                    </p>
                    <Tex display>{eqBlock([
                        multiT ? { lhs: sT, sym: `${baseT}+\\dfrac{\\sum n_i\\,y_i}{n}`, num: layerNum(r.dTNom, r.layT), val: `${T(r.cT, 1)}${mm}` } : null,
                        multiC ? { lhs: sC, sym: `${baseC}+\\dfrac{\\sum n_i\\,y_i}{n}`, num: layerNum(r.dCNom, r.layC), val: `${T(r.cC, 1)}${mm}` } : null,
                    ].filter(Boolean))}</Tex>
                </>}
                <p className="text-xs font-semibold text-slate-500">Materiali:</p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3">
                        <p className="text-xs font-semibold text-slate-600">Calcestruzzo {CONCRETE_CLASSES.find((m) => m.fck === fck)?.id}</p>
                        {/* formule in un unico blocco allineato: stessa spaziatura nei due box */}
                        <div className="tex-left text-[0.8em]"><Tex display>{matRows([
                            `f_{ck}&=${T(fck, 0)}${MPa}`,
                            `f_{cd}&=\\dfrac{\\alpha_{cc}\\,f_{ck}}{\\gamma_c}=\\dfrac{${T(alphaCc, 2)}\\cdot ${T(fck, 0)}}{${T(gammaC, 2)}}=${T(r.fcd, 2)}${MPa}`,
                            epsKnee.replace("=", "&="),
                            `\\varepsilon_{cu}&=3{,}5\\text{‰}`,
                        ])}</Tex></div>
                    </div>
                    <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3">
                        <p className="text-xs font-semibold text-slate-600">Acciaio {input.steelGrade ?? STEEL_GRADES.find((m) => m.fyk === fyk)?.id}</p>
                        <div className="tex-left text-[0.8em]"><Tex display>{matRows([
                            `f_{yk}&=${T(fyk, 0)}${MPa}`,
                            `f_{yd}&=\\dfrac{f_{yk}}{\\gamma_s}=\\dfrac{${T(fyk, 0)}}{${T(gammaS, 2)}}=${T(r.fyd, 2)}${MPa}`,
                            `\\varepsilon_{yd}&=\\dfrac{f_{yd}}{E_s}=\\dfrac{${T(r.fyd, 2)}}{200\\,000}=${T(r.epsYd * 1000, 2)}\\text{‰}`,
                            `\\varepsilon_{ud}&=67{,}5\\text{‰}`,
                        ])}</Tex></div>
                    </div>
                </div>
                <p className="text-xs font-semibold text-slate-500">Legami costitutivi adottati:</p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3">
                        <p className="text-xs font-semibold text-slate-600">Calcestruzzo: {CONCRETE_MODELS.find((m) => m.id === input.concreteModel)?.label}</p>
                        <div className="mx-auto max-w-[264px]"><ConcreteDiagram fcd={r.fcd} model={input.concreteModel} /></div>
                    </div>
                    <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3">
                        <p className="text-xs font-semibold text-slate-600">Acciaio: {STEEL_MODELS.find((m) => m.id === input.steelModel)?.label}</p>
                        <div className="mx-auto max-w-[264px]"><SteelDiagram fyd={r.fyd} model={input.steelModel} ks={input.ks} /></div>
                    </div>
                </div>
            </Step>

            <Step n="2" title="Ipotesi di progetto">
                <p className="text-xs text-slate-600"><Sym>
                    Si ipotizza uno stato deformativo al limite tra CAMPO 2 e CAMPO 3 per sfruttare al massimo i materiali
                    (ε_c = 3,5‰, ε_s = 10‰). Si ipotizza inoltre che le armature al lembo compresso siano snervate (σ'_s = f_yd).
                </Sym></p>
                <p className="text-xs font-semibold text-slate-500">In questo modo si ha:</p>
                <Row items={[`\\Psi=${Ps}`, `\\lambda=${Lm}`, G && r.mode === "fixBH"
                    ? `x\\ \\text{incognita (dall'equilibrio, A}_s'\\text{ assegnata)}`
                    : `x=${Xi}\\cdot d${r.mode === "fixB" ? "" : `=${Xi}\\cdot ${T(r.d, 1)}=${T(xiX(r), 1)}${mm}`}`]} />
            </Step>

            <Step n="3" title="Equazioni di equilibrio">
                {r.mode === "fixBH" && !r.xFromXi && !G && (
                    <p className="text-xs text-amber-600">
                        <Sym>Con x = 0,259259·d risulterebbe A's &lt; 0: l'armatura compressa non è necessaria. Si pone A's = 0 e si ricava x dall'equilibrio.</Sym>
                    </p>
                )}
                {/* sezione a T: formule simboliche (i valori dopo "Ottengo") */}
                {tBlk && (
                    <div className="tex-left space-y-1.5">
                        <p className="text-xs text-slate-400">{sub(tBlk.caseNote)}</p>
                        <p className="text-xs font-semibold text-slate-500">Risultanti delle forze [N]:</p>
                        <Tex display>{tBlk.forces}</Tex>
                        <p className="text-xs font-semibold text-slate-500">Baricentro della sezione e punto di applicazione di C<sub>c</sub> (profondità dal lembo compresso) [mm]:</p>
                        <Tex display>{tBlk.geom}</Tex>
                        <p className="text-xs font-semibold text-slate-500">Equilibrio alla traslazione e alla rotazione (rispetto al baricentro G):</p>
                        <Tex display>{tBlk.system}</Tex>
                    </div>
                )}
                {/* risultanti, bracci e sistemi allineati a sinistra */}
                {!tBlk && <div className="tex-left space-y-1.5">
                    <p className="text-xs font-semibold text-slate-500">Risultanti delle forze [N]:</p>
                    <Tex display>{eqBlock(forceRows.filter(Boolean))}</Tex>
                    <p className="text-xs font-semibold text-slate-500">Bracci rispetto al baricentro (h/2){r.mode === "fixB" ? sub(`, con h = d + ${sTtxt}`) : ""} [mm]:</p>
                    {/* bracci in colonna, "=" allineati, primo membro tra parentesi */}
                    <Tex display>{`\\begin{aligned}${armItems.filter(Boolean).map((s) => {
                        const i = s.indexOf("=");
                        return `\\Big(${s.slice(0, i)}\\Big)&=${s.slice(i + 1)}`;
                    }).join("\\\\[4pt]")}\\end{aligned}`}</Tex>
                    <p className="text-xs font-semibold text-slate-500">Equilibrio alla traslazione e alla rotazione:</p>
                    <Tex display>{symSystem}</Tex>
                    <p className="text-xs font-semibold text-slate-500">Sostituendo ({sub(unknowns)}; forze in [N], momenti in [N·mm]):</p>
                    <Tex display>{numSystem}</Tex>
                </div>}
                <p className="text-xs font-semibold text-slate-500">Ottengo:</p>
                {/* risultati in colonna, in un unico blocco allineato sull'"=" */}
                <div className="tex-left">
                    <Tex display>{`\\begin{aligned}${solve.map((it) => (it.tex
                        ? it.tex.replace("=", "&=")
                        : `${it.lhs}&=${it.sym}=${it.num}=${it.val}`)).join("\\\\[4pt]")}\\end{aligned}`}</Tex>
                </div>
                {tBlk && (
                    <div className="tex-left space-y-1.5">
                        <p className="text-xs font-semibold text-slate-500">Valori all'equilibrio [N, mm]:</p>
                        <Tex display>{tBlk.values}</Tex>
                        <p className="text-xs font-semibold text-slate-500">Verifica delle equazioni con i valori ottenuti [N, N·mm]:</p>
                        <Tex display>{tBlk.check}</Tex>
                    </div>
                )}
            </Step>

            {cm && (
                <Step n="4" title="Valori commerciali adottati">
                    <p className="text-xs text-slate-400">In base ai risultati ottenuti scelgo i valori commerciali per la sezione:</p>
                    {r.mode === "fixB" && <Row items={[`d=${T(cm.d, 0)}${mm}`, `h=${T(cm.h, 0)}${mm}`]} />}
                    {r.mode === "fixH" && <Tex display>{`B=${T(cm.B, 0)}${mm}`}</Tex>}
                    <Tex display>{`A_s=${cm.nT}\\,\\phi${T(cm.phiT, 0)}=${T(cm.AsT, 0)}${mm2}\\;\\ge\\;${T(r.As, 0)}${mm2}`}</Tex>
                    {cm.nC > 0 && <Tex display>{`A_s'=${cm.nC}\\,\\phi${T(cm.phiC, 0)}=${T(cm.AsC, 0)}${mm2}\\;\\ge\\;${T(r.AsPrime, 0)}${mm2}`}</Tex>}
                    {cm.hanger && <>
                        <Tex display>{`A_{s,costr}'=${cm.hanger.n}\\,\\phi${T(cm.hanger.phi, 0)}=${T(cm.hanger.n * Math.PI * cm.hanger.phi ** 2 / 4, 0)}${mm2}`}</Tex>
                        <p className="text-center text-xs text-slate-400">Barre superiori costruttive (reggistaffa) per l'ancoraggio della staffa: non considerate nel calcolo.</p>
                    </>}
                </Step>
            )}

            {cm && (
                <Step n="5" title="Sezione progettata e forze interne">
                    <div className="space-y-4">
                        <div className="rounded-xl border border-slate-200 bg-white p-3">
                            <p className="mb-2 text-xs font-semibold text-slate-600">Sezione progettata</p>
                            <div className="mx-auto max-w-[560px]">{sectionDrawing}</div>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white p-3">
                            <p className="mb-2 text-xs font-semibold text-slate-600">Forze interne (sezione di lato)</p>
                            <div className="mx-auto max-w-[480px]">{forcesDrawing}</div>
                        </div>
                    </div>
                </Step>
            )}

            {cm && (
                <Step n="6" title="Verifica distanza barre">
                    {[
                        { key: "t", title: "Armatura tesa A_s:", lhs: "L", rows: cm.rowsT?.length ? cm.rowsT : [cm.nT], phi: cm.phiT },
                        cm.nC > 0 ? { key: "c", title: "Armatura compressa A's:", lhs: "L'", rows: cm.rowsC?.length ? cm.rowsC : [cm.nC], phi: cm.phiC } : null,
                    ].filter(Boolean).map((b0) => {
                        // su più file si verifica la fila più numerosa
                        const b = { ...b0, n: Math.max(...b0.rows) };
                        // interferro minimo: max(φ, 20 mm); ingombro con i copriferri laterali c, c'
                        const gap = Math.max(b.phi, 20);
                        const width = b.n * b.phi + (b.n - 1) * gap + 2 * phiStirrup + input.cLeft + input.cRight;
                        const ok = width <= cm.widthLimit;
                        return (
                            <div key={b.key} className="space-y-1.5">
                                <p className="text-xs font-semibold text-slate-500">{sub(b.title)}</p>
                                {b.rows.length > 1 && <p className="text-xs text-slate-400">Barre su {b.rows.length} file ({b.rows.join(" + ")}): si verifica la fila più numerosa, n<sub>barre</sub> = {b.n}.</p>}
                                <p className="text-xs text-slate-400">Le barre devono essere distanziate di almeno {T(gap, 0)} mm:</p>
                                <Eq
                                    lhs={b.lhs}
                                    sym={`n_{barre}\\,\\Phi_{barre}+(n_{barre}-1)\\cdot ${T(gap, 0)}+2\\,\\Phi_{staffa}+c+c'`}
                                    num={`${b.n}\\cdot ${T(b.phi, 0)}+${b.n - 1}\\cdot ${T(gap, 0)}+2\\cdot ${T(phiStirrup, 0)}+${T(input.cLeft, 0)}+${T(input.cRight, 0)}`}
                                    val={`${T(width, 0)}${mm}\\;${ok ? "\\le" : ">"}\\;${r.isT ? "b_w" : "B"}=${T(cm.widthLimit, 0)}${mm}`} />
                                <Outcome ok={ok}>{ok ? "Verificato." : "Non verificato: aumentare B o ridurre il numero di barre."}</Outcome>
                            </div>
                        );
                    })}
                </Step>
            )}

            <Step n={cm ? "7" : "4"} title="Verifica armature">
                {r.isT
                    ? <Eq lhs="A_{s,min}" sym="\max\!\Big(0{,}26\tfrac{f_{ctm}}{f_{yk}}b_t\,d,\;0{,}0013\,b_t\,d\Big)" num={`b_t=${r.tensionTop ? "B" : "b_w"}=${T(r.bt, 0)}${mm}`} val={`${T(r.AsMin, 0)}${mm2}`} />
                    : <Eq lhs="A_{s,min}" sym="\max\!\Big(0{,}26\tfrac{f_{ctm}}{f_{yk}}Bd,\;0{,}0013\,Bd\Big)" val={`${T(r.AsMin, 0)}${mm2}`} />}
                {r.isT
                    ? <Eq lhs="A_{s,max}" sym="0{,}04\,A_c=0{,}04\,[B\,s+b_w\,(h-s)]" val={`${T(r.AsMax, 0)}${mm2}`} />
                    : <Eq lhs="A_{s,max}" sym="0{,}04\,B\,h" val={`${T(r.AsMax, 0)}${mm2}`} />}
                <Tex display>{`A_{s,min}=${T(r.AsMin, 0)}\\;${minOk ? "\\le" : ">"}\\;A_s=${T(areaT, 0)}\\;${maxOk ? "\\le" : ">"}\\;A_{s,max}=${T(r.AsMax, 0)}${mm2}`}</Tex>
                <Outcome ok={minOk && maxOk}>
                    {sub(minOk && maxOk ? "Verificato."
                        : !minOk ? "Non verificato: A_s < A_s,min, aumentare l'armatura tesa."
                            : "Non verificato: A_s > A_s,max, aumentare la sezione.")}
                </Outcome>
                {hasCompr && (
                    <>
                        <p className="mt-1 text-xs font-semibold text-slate-500">Ipotesi di snervamento dell'armatura compressa:</p>
                        <Eq breakLine={false} lhs="\varepsilon_s'" sym={`\\varepsilon_{cu}\\Big(1-\\dfrac{${sC}}{x}\\Big)`} num={`3{,}5\\big(1-${T(cp, 0)}/${T(r.X, 1)}\\big)`} val={`${T(r.epsSc * 1000, 2)}\\text{‰}\\;${r.comprYield ? "\\ge" : "<"}\\;\\varepsilon_{yd}=${T(r.epsYd * 1000, 2)}\\text{‰}`} />
                        <Outcome ok={r.comprYield} warn>
                            {sub(r.comprYield ? "Ipotesi verificata: l'armatura compressa è snervata." : "Ipotesi NON verificata: A's non snervata (σ's < f_yd), risultato approssimato.")}
                        </Outcome>
                    </>
                )}
            </Step>
        </div>
    );
}

// Numeri del copriferro efficace: d + (Σ n_i·y_i)/n, con y_i = i·passo verticale.
function layerNum(dNom, lay) {
    const n = lay.rows.reduce((a, b) => a + b, 0);
    const terms = lay.rows.map((ni, i) => (i > 0 ? `${ni}\\cdot ${texNumInt(i * lay.sV)}` : null)).filter(Boolean).join("+");
    return `${texNumInt(dNom)}+\\dfrac{${terms}}{${n}}`;
}
const texNumInt = (v) => T(v, 0);

// Più equazioni { lhs, sym, num?, val } in un unico blocco allineato sull'"=",
// così le righe restano vicine.
function eqBlock(rows) {
    const line = (r) => [`${r.lhs}&=${r.sym}`, r.num, r.val].filter((x) => x != null && x !== "").join("=");
    return `\\begin{aligned}${rows.map(line).join("\\\\[4pt]")}\\end{aligned}`;
}

// Esito di una verifica nel foglio: icona (check / avviso) + testo colorato.
function Outcome({ ok, warn = false, children }) {
    const Icon = ok ? CheckCircle2 : AlertTriangle;
    const color = ok ? "text-emerald-600" : warn ? "text-amber-600" : "text-red-600";
    return (
        <p className={`flex items-start gap-1.5 text-xs ${color}`}>
            <Icon size={14} aria-hidden="true" className="mt-px shrink-0" />
            <span>{children}</span>
        </p>
    );
}

// x dall'ipotesi di campo 2-3 (anche quando la soluzione finale ha x dall'equilibrio)
function xiX(r) {
    return r.xi * r.d;
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
// Controllo segmentato generico (opzioni { id, label, title? }).
function SegmentedToggle({ value, onChange, options }) {
    const n = options.length;
    const idx = Math.max(0, options.findIndex((o) => o.id === value));
    return (
        <div className="relative flex rounded-xl border border-slate-200 bg-slate-50 p-1">
            <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-1 left-1 rounded-lg bg-sky-600 shadow-sm transition-transform duration-300 ease-out"
                style={{ width: `calc((100% - 0.5rem) / ${n})`, transform: `translateX(${idx * 100}%)` }}
            />
            {options.map((o) => {
                const active = value === o.id;
                return (
                    <button key={o.id} type="button" onClick={() => onChange(o.id)} title={o.title ?? o.label} aria-pressed={active}
                        className={`relative z-10 flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors duration-300 ${active ? "text-white" : "text-slate-600"}`}>
                        {o.label}
                    </button>
                );
            })}
        </div>
    );
}

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
function HDim({ dimY, xA, xB, edgeY, label, color = "#64748b", fontSize = 11, bold = true, labelAbove = false }) {
    const mid = (xA + xB) / 2;
    // quota corta: frecce all'esterno, rivolte verso l'interno
    const tight = xB - xA < 20;
    const a = tight ? -6 : 6;
    return (
        <g stroke={color} fill={color}>
            {/* linee di estensione dal bordo della sezione alla linea di quota */}
            <line x1={xA} y1={edgeY} x2={xA} y2={dimY} strokeWidth="0.5" strokeDasharray="2 2" />
            <line x1={xB} y1={edgeY} x2={xB} y2={dimY} strokeWidth="0.5" strokeDasharray="2 2" />
            {/* linea di quota */}
            <line x1={tight ? xA - 9 : xA} y1={dimY} x2={tight ? xB + 9 : xB} y2={dimY} strokeWidth="1" />
            {/* frecce */}
            <polygon points={`${xA},${dimY} ${xA + a},${dimY - 2.5} ${xA + a},${dimY + 2.5}`} stroke="none" />
            <polygon points={`${xB},${dimY} ${xB - a},${dimY - 2.5} ${xB - a},${dimY + 2.5}`} stroke="none" />
            {/* etichetta */}
            <text x={mid} y={labelAbove ? dimY - 4 : dimY + fontSize + 1} fontSize={fontSize} fontWeight={bold ? "bold" : "normal"} textAnchor="middle" stroke="none">{label}</text>
        </g>
    );
}

function VDim({ dimX, yA, yB, edgeX, label, color = "#475569" }) {
    const mid = (yA + yB) / 2;
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
            {/* etichetta sempre verticale, lungo la linea di quota (anche se la quota è corta) */}
            <text x={dimX - 4} y={mid} fontSize="11" fontWeight="bold" textAnchor="middle" stroke="none" transform={`rotate(-90 ${dimX - 4} ${mid})`}>{label}</text>
        </g>
    );
}

// -------- Disegno della sezione progettata con quote --------
// Il box (viewBox) ha dimensioni FISSE: la sezione viene scalata per entrare
// nell'area di disegno mantenendo le proporzioni, e centrata.
const BOX_W = 520;
const BOX_H = 360;
const SIDE_BOX_W = 520;
const SIDE_BOX_H = 300;

const STIRRUP_COL = "#9333ea"; // staffa (viola)
const OVER_COL = "#dc2626"; // barre fuori ingombro (rosse, distinte dalla staffa viola)

function DesignDrawing({ result, B, layT, layC, hanger = null, dTNom = 40, dCNom = 40, phiStirrup = 8, cLeft = 30, cRight = 30, moment = 0, mode = "fixB", unit = "mm", svgRef, bare = false }) {
    const { h, d, X, phi, nBars, nBarsPrime, beta } = result;
    // barre superiori: compresse di calcolo oppure, se assenti, 2 reggistaffa costruttivi
    const hangerOnly = !!hanger && !(nBarsPrime > 0);
    const phiPrime = hangerOnly ? hanger.phi : (result.phiPrime ?? phi);
    // barre su una o più file: d al baricentro delle barre tese, cP al baricentro
    // di quelle compresse; le file esterne sono a d' / d'' (nominali) dai lembi
    const rowsT = layT?.rows?.length ? layT.rows : [nBars];
    const rowsC = hangerOnly ? [hanger.n] : layC?.rows?.length && nBarsPrime > 0 ? layC.rows : nBarsPrime > 0 ? [nBarsPrime] : [];
    const hasTop = rowsC.length > 0;
    const multiT = rowsT.length > 1, multiC = rowsC.length > 1;
    // Le profondità sono misurate dal lembo COMPRESSO (riferimento di progetto).
    // Con M_Ed < 0 il lembo compresso è quello inferiore: il disegno si ribalta
    // (barre tese in alto) e i copriferri cambiano nome (d'' lato teso, d' lato compresso).
    const flip = !!result.tensionTop;
    const symT = flip ? "d''" : "d'", symC = flip ? "d'" : "d''";
    const cP = dCNom + (layC?.delta || 0); // copriferro efficace lato compresso (al baricentro delle barre compresse)
    const c = h - d; // copriferro efficace lato teso (al baricentro delle barre tese)

    // Colore delle quote B/h: grigio = dato di input, nero = valore calcolato.
    // fixB → B input, h calcolata; fixH → h input, B calcolata; fixBH → entrambe input.
    const INPUT_COLOR = "#0f172a"; // nero
    const CALC_COLOR = "#94a3b8"; // grigino
    const bColor = mode === "fixH" ? CALC_COLOR : INPUT_COLOR;
    const hColor = mode === "fixB" ? CALC_COLOR : INPUT_COLOR;

    // Comandi di visibilità (staffa / armature / quote)
    const [show, setShow] = useState({ stirrup: true, bars: true, axes: true, moment: true, dims: true });
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
    const mL = 160; // spazio per le quote e per le azioni M_Ed / N_Ed
    const mR = mL; // margini uguali: la sezione resta sempre centrata nel disegno
    // sezione a T: ala (larghezza B, spessore s) sul lembo superiore, anima b_w
    const isT = !!result.isT;
    const bwT = isT ? Math.min(result.bw, B) : B, hfT = isT ? result.hf : 0;
    const mT = isT ? 40 : 24; // spazio per la quota B dell'ala
    const mB = 104;
    const availW = BOX_W - mL - mR;
    const availH = BOX_H - mT - mB;

    // Scala che fa entrare la sezione (B x h) nell'area mantenendo le proporzioni
    const scale = Math.min(availW / B, availH / h);
    const w = B * scale;
    const ht = h * scale;
    const secLeft = mL + (availW - w) / 2;
    const secTop = mT + (availH - ht) / 2;
    const secRight = secLeft + w;
    // anima (coincide con la sezione se rettangolare)
    const webOff = (B - bwT) / 2;
    const webLeft = secLeft + webOff * scale, webRight = webLeft + bwT * scale;
    const yFl = secTop + hfT * scale; // attacco ala-anima (in y)
    // azioni M_Ed / N_Ed a sinistra delle quote (x, d), alla quota h/2
    const ACT_COL = "#2563eb";
    const actHasN = Math.abs(result.NEd || 0) > 0.5; // N_Ed diverso da zero
    // quota del baricentro G della sezione (h/2 per il rettangolo), dal lembo superiore
    const yGtop = isT ? (B * hfT * hfT / 2 + bwT * (h - hfT) * (h + hfT) / 2) / (B * hfT + bwT * (h - hfT)) : h / 2;
    const actY = secTop + yGtop * scale;
    const actHead = secLeft - 56, actTail = actHead - 50;  // freccia di N_Ed
    const actCross = actTail + 16, actBw = 24, actMr = 26; // arco di M_Ed (come nel disegno delle forze)
    const actXa = actCross + actBw;
    const actMomPath = result.tensionTop
        ? `M${actXa},${actY - actMr} C${actCross},${actY - actMr * 0.5} ${actCross},${actY + actMr * 0.5} ${actXa},${actY + actMr}`
        : `M${actXa},${actY + actMr} C${actCross},${actY + actMr * 0.5} ${actCross},${actY - actMr * 0.5} ${actXa},${actY - actMr}`;
    const actMlabY = result.tensionTop ? actY + actMr + 14 : actY - actMr - 8;
    const yOf = (depth) => (flip ? secTop + (h - depth) * scale : secTop + depth * scale);

    // Posizione orizzontale delle barre: l'asse delle barre d'angolo è a
    // (c + phi_st + phi/2) dal bordo sinistro e (c' + phi_st + phi/2) dal bordo
    // destro, così poggiano dentro la staffa; le barre intermedie sono
    // distribuite uniformemente. Se non ci stanno con l'interferro minimo
    // max(phi, 20 mm) (ingombro non verificato) si dispongono con l'interferro
    // minimo, simmetriche rispetto all'asse della sezione: quelle oltre le
    // posizioni d'angolo escono dalla staffa / sezione (over).
    // (nella T le barre e la staffa stanno nell'anima: larghezza b_w, bordi dell'anima)
    const latL = (p) => Math.min(cLeft + phiStirrup + p / 2, bwT / 2 - p / 2);  // asse barra d'angolo sx dal bordo [mm]
    const latR = (p) => Math.min(cRight + phiStirrup + p / 2, bwT / 2 - p / 2); // asse barra d'angolo dx dal bordo [mm]
    const barsAt = (n, depthY, p) => {
        const arr = [];
        const xL = latL(p), xR = bwT - latR(p);
        const pitch = p + Math.max(p, 20);                 // passo minimo tra gli assi
        const fits = n <= 1 || (n - 1) * pitch <= xR - xL + 1e-6;
        for (let i = 0; i < n; i++) {
            const pos = n === 1 ? bwT / 2 : fits ? xL + ((xR - xL) * i) / (n - 1) : bwT / 2 + (i - (n - 1) / 2) * pitch;
            arr.push({ x: webLeft + pos * scale, y: yOf(depthY), over: !fits && (pos < xL - 1e-6 || pos > xR + 1e-6) });
        }
        return arr;
    };
    const barR = Math.max(2.5, (phi * scale) / 2);
    const barRPrime = Math.max(2.5, (phiPrime * scale) / 2);
    const yRowT = (i) => h - dTNom - i * (layT?.sV || 0);      // profondità della fila i (0 = esterna)
    const yRowC = (i) => dCNom + i * (layC?.sV || 0);
    const tensionBars = rowsT.flatMap((ni, i) => barsAt(ni, yRowT(i), phi));
    const comprBars = rowsC.flatMap((ni, i) => barsAt(ni, yRowC(i), phiPrime));

    // Staffa sempre TANGENTE alle barre, senza che le barre la sovrastino:
    // l'asse della staffa dista (phi/2 + phi_st/2) dal centro delle barre
    // d'angolo, calcolato in pixel e mai meno di raggio disegnato della barra +
    // metà spessore disegnato della staffa (raggi e spessori hanno un minimo
    // visivo). Lato inferiore tangente alle barre tese, superiore alle barre
    // compresse (se assenti, a quota d'' come per i reggistaffa); gli angoli
    // della staffa avvolgono le barre d'angolo.
    const stWidth = Math.max(1.4, phiStirrup * scale * 0.8); // spessore visivo staffa
    const offPx = Math.max((phi / 2 + phiStirrup / 2) * scale, barR + stWidth / 2);
    const offPxPrime = Math.max((phiPrime / 2 + phiStirrup / 2) * scale, barRPrime + stWidth / 2);
    // la staffa resta fissa: lati verticali sulle posizioni d'angolo nominali
    // (anche se le barre non ci stanno ed escono)
    const cornerL = (p) => webLeft + latL(p) * scale, cornerR = (p) => webLeft + (bwT - latR(p)) * scale;
    const stLeft = Math.min(cornerL(phi) - offPx, hasTop ? cornerL(phiPrime) - offPxPrime : Infinity);
    const stRight = Math.max(cornerR(phi) + offPx, hasTop ? cornerR(phiPrime) + offPxPrime : -Infinity);
    const sgnT = flip ? -1 : 1; // verso (in y) dal centro della sezione al lato teso
    const stEdgeT = yOf(yRowT(0)) + sgnT * offPx;
    const stEdgeC = yOf(dCNom) - sgnT * (hasTop ? offPxPrime : offPx);
    const stBottom = Math.max(stEdgeT, stEdgeC);
    const stTop = Math.min(stEdgeT, stEdgeC);
    const stX = stLeft;
    const stY = stTop;
    const stW = stRight - stLeft;
    const stH = stBottom - stTop;
    const stR = Math.min(offPx, hasTop ? offPxPrime : offPx);
    const stirrupFits = stW > 8 && stH > 8;
    const showStirrup = show.stirrup && stirrupFits;
    // Scritte sotto il disegno (staffa, armature): poco sotto la quota di B; il
    // viewBox viene poi ritagliato sopra e sotto il contenuto, così la legenda
    // input / calcolato resta subito sotto senza spazio vuoto.
    const labelY = show.dims ? [74, 85, 96] : [48, 59, 70];
    const lastY = show.bars && hasTop ? labelY[2]
        : show.bars && nBars > 0 ? labelY[1]
            : showStirrup ? labelY[0] : show.dims ? 47 : 24;
    const vbY = Math.max(0, secTop - mT);
    const vbH = secTop + ht + lastY + 3 - vbY;

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
            {/* comandi di visibilità dentro il box (non nel foglio dei passaggi) */}
            {!bare && <div className="mb-2 flex flex-wrap items-center justify-center gap-2">
                <Toggle k="stirrup" label="Staffa" color={STIRRUP_COL} />
                <Toggle k="bars" label="Armature" color="#0f172a" />
                <Toggle k="axes" label="Linea media barre" color="#d97706" />
                <Toggle k="moment" label="Azioni" color="#2563eb" />
                <Toggle k="dims" label="Quote" color="#64748b" />
            </div>}

            <svg ref={svgRef} width="100%" viewBox={`0 ${vbY} ${BOX_W} ${vbH}`} role="img" aria-label="Sezione progettata quotata">
                {/* zona compressa + contorno */}
                {isT ? (
                    <>
                        {/* zona compressa: ala e/o anima fino alla profondità x dal lembo compresso */}
                        {!flip ? <>
                            <rect x={secLeft} y={secTop} width={w} height={Math.min(X, hfT) * scale} fill="#e0f2fe" />
                            {X > hfT && <rect x={webLeft} y={yFl} width={webRight - webLeft} height={(Math.min(X, h) - hfT) * scale} fill="#e0f2fe" />}
                        </> : <>
                            <rect x={webLeft} y={secTop + ht - Math.min(X, h - hfT) * scale} width={webRight - webLeft} height={Math.min(X, h - hfT) * scale} fill="#e0f2fe" />
                            {X > h - hfT && <rect x={secLeft} y={secTop + ht - Math.min(X, h) * scale} width={w} height={(Math.min(X, h) - (h - hfT)) * scale} fill="#e0f2fe" />}
                        </>}
                        <path d={`M${secLeft},${secTop} H${secRight} V${yFl} H${webRight} V${secTop + ht} H${webLeft} V${yFl} H${secLeft} Z`} fill="none" stroke="#334155" strokeWidth="2" strokeLinejoin="round" />
                    </>
                ) : (
                    <>
                        <rect x={secLeft} y={flip ? secTop + ht - Math.min(X * scale, ht) : secTop} width={w} height={Math.min(X * scale, ht)} fill="#e0f2fe" />
                        <rect x={secLeft} y={secTop} width={w} height={ht} fill="none" stroke="#334155" strokeWidth="2" />
                    </>
                )}

                {/* staffa (tangente alle armature) */}
                {showStirrup && (
                    <>
                        <rect
                            x={stX} y={stY} width={stW} height={stH} rx={stR} ry={stR}
                            fill="none" stroke={STIRRUP_COL} strokeWidth={stWidth} strokeLinejoin="round"
                        />
                        {/* ganci di chiusura 135° (angolo in alto a sinistra) */}
                        <line x1={stX + stR} y1={stY} x2={stX + stR + 7} y2={stY + 7} stroke={STIRRUP_COL} strokeWidth={stWidth} strokeLinecap="round" />
                        <line x1={stX} y1={stY + stR} x2={stX + 7} y2={stY + stR + 7} stroke={STIRRUP_COL} strokeWidth={stWidth} strokeLinecap="round" />
                    </>
                )}

                {/* asse neutro */}
                {show.dims && X > 0 && X * scale < ht && (
                    <line x1={secLeft} y1={yOf(X)} x2={secRight} y2={yOf(X)} stroke="#0284c7" strokeWidth="1.5" strokeDasharray="6 4" />
                )}

                {/* azioni applicate (come nel disegno delle forze interne): M_Ed arco che
                    incrocia la freccia di N_Ed a h/2, a sinistra delle quote; i valori sono
                    in modulo, il segno è dato dal verso delle frecce */}
                {show.moment && (
                    <g>
                        <defs>
                            <marker id="dd-ind" markerUnits="userSpaceOnUse" markerWidth="9" markerHeight="9" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill={ACT_COL} /></marker>
                        </defs>
                        <path d={actMomPath} fill="none" stroke={ACT_COL} strokeWidth="2.2" markerEnd="url(#dd-ind)" />
                        <text x={actHead - 2} y={actMlabY} textAnchor="end" fontSize="11" fill={ACT_COL}>M<tspan fontSize="8" dy="2">Ed</tspan><tspan dy="-2"> = {fmtNum(Math.abs(result.MEdSigned ?? moment * 1e6) / 1e6, 1)} kNm</tspan></text>
                        {actHasN && (result.NEd > 0
                            ? <line x1={actTail} y1={actY} x2={actHead} y2={actY} stroke={ACT_COL} strokeWidth="2.2" markerEnd="url(#dd-ind)" />
                            : <line x1={actHead} y1={actY} x2={actTail} y2={actY} stroke={ACT_COL} strokeWidth="2.2" markerEnd="url(#dd-ind)" />)}
                        {actHasN && <text x={actCross - 6} y={actY + 16} textAnchor="end" fontSize="11" fill={ACT_COL}>N<tspan fontSize="8" dy="2">Ed</tspan><tspan dy="-2"> = {fmtNum(Math.abs(result.NEd) / 1000, 1)} kN</tspan></text>}
                    </g>
                )}

                {/* barre: in rosso quelle che escono dalla staffa (ingombro non verificato), distinte dalla staffa viola */}
                {show.bars && tensionBars.map((b, i) => <circle key={`t${i}`} cx={b.x} cy={b.y} r={barR} fill={b.over ? OVER_COL : "#0f172a"} />)}
                {show.bars && comprBars.map((b, i) => <circle key={`c${i}`} cx={b.x} cy={b.y} r={barRPrime} fill={b.over ? OVER_COL : hangerOnly ? "#94a3b8" : "#64748b"} />)}

                {/* linea media delle barre: punto geometrico di calcolo delle armature (a d e a d'') */}
                {show.axes && nBars > 0 && <line x1={secLeft} y1={yOf(d)} x2={secRight} y2={yOf(d)} stroke="#d97706" strokeWidth="1" strokeDasharray="8 3 2 3" />}
                {show.axes && nBarsPrime > 0 && <line x1={secLeft} y1={yOf(cP)} x2={secRight} y2={yOf(cP)} stroke="#d97706" strokeWidth="1" strokeDasharray="8 3 2 3" />}

                {/* quote */}
                {show.dims && (
                    <>
                        {/* a sinistra: x (asse neutro) e la colonna d + copriferro lato teso (= h), dal lembo compresso */}
                        <VDim dimX={secLeft - 16} yA={yOf(0)} yB={yOf(X)} edgeX={secLeft} label="x" color="#0284c7" />
                        <VDim dimX={secLeft - 38} yA={yOf(0)} yB={yOf(d)} edgeX={secLeft} label={`d=${fmtU(d)}`} color="#334155" />
                        <VDim dimX={secLeft - 38} yA={yOf(d)} yB={yOf(h)} edgeX={secLeft} label={multiT ? svgSubText([[symT], ["eff", true], [`=${fmtU(c)}`]]) : `${symT}=${fmtU(c)}`} color="#64748b" />
                        {/* a destra: copriferro lato compresso (-> As') e h */}
                        <VDim dimX={secRight + 16} yA={yOf(0)} yB={yOf(cP)} edgeX={secRight} label={multiC ? svgSubText([[symC], ["eff", true], [`=${fmtU(cP)}`]]) : `${symC}=${fmtU(cP)}`} color="#64748b" />
                        <VDim dimX={secRight + 38} yA={yOf(0)} yB={yOf(h)} edgeX={secRight} label={`h=${fmtU(h)}`} color={hColor} />
                    </>
                )}

                {/* copriferri orizzontali c (sinistro) e c' (destro): bordo - faccia esterna della staffa, tra il disegno e B */}
                {show.dims && <>
                    <HDim dimY={secTop + ht + 12} xA={webLeft} xB={webLeft + cLeft * scale} edgeY={secTop + ht} label={`c=${fmtU(cLeft)}`} fontSize={9} bold={false} />
                    <HDim dimY={secTop + ht + 12} xA={webRight - cRight * scale} xB={webRight} edgeY={secTop + ht} label={`c'=${fmtU(cRight)}`} fontSize={9} bold={false} />
                </>}

                {/* sezione a T: larghezza dell'ala B (sopra) e spessore s (a destra) */}
                {isT && show.dims && <HDim dimY={secTop - 14} xA={secLeft} xB={secRight} edgeY={secTop} label={`B = ${fmtU(B)}`} color={bColor} labelAbove />}
                {isT && show.dims && <VDim dimX={secRight + 62} yA={secTop} yB={yFl} edgeX={secRight} label={`s=${fmtU(hfT)}`} color="#64748b" />}

                {/* base: quota con frecce (se le quote sono attive) altrimenti etichetta */}
                {show.dims ? (
                    isT
                        ? <HDim dimY={secTop + ht + 34} xA={webLeft} xB={webRight} edgeY={secTop + ht} label={svgSubText([["b"], ["w", true], [` = ${fmtU(bwT)}`]])} />
                        : <HDim dimY={secTop + ht + 34} xA={secLeft} xB={secRight} edgeY={secTop + ht} label={`B = ${fmtU(B)}`} color={bColor} />
                ) : (
                    <text x={secLeft + w / 2} y={secTop + ht + 20} textAnchor="middle" fontSize="11" fill={isT ? INPUT_COLOR : bColor}>{isT ? svgSubText([["b"], ["w", true], [` = ${fmtU(bwT)}`]]) : `B = ${fmtU(B)}`}</text>
                )}
                {showStirrup && <text x={secLeft + w / 2} y={secTop + ht + labelY[0]} textAnchor="middle" fontSize="10" fill={STIRRUP_COL}>staffa φ{fmt(phiStirrup, 0)}</text>}
                {show.bars && nBars > 0 && <text x={secLeft + w / 2} y={secTop + ht + labelY[1]} textAnchor="middle" fontSize="10" fill="#0f172a">armatura tesa φ{fmt(phi, 0)}</text>}
                {show.bars && nBarsPrime > 0 && <text x={secLeft + w / 2} y={secTop + ht + labelY[2]} textAnchor="middle" fontSize="10" fill="#64748b">armatura compressa φ{fmt(phiPrime, 0)}</text>}
                {show.bars && hangerOnly && <text x={secLeft + w / 2} y={secTop + ht + labelY[2]} textAnchor="middle" fontSize="10" fill="#94a3b8">reggistaffa {hanger.n}φ{fmt(phiPrime, 0)} (costruttivi)</text>}
            </svg>
            {show.dims && (
                <p className="flex items-center justify-center gap-3 text-[11px] text-slate-400">
                    <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: INPUT_COLOR }} />input</span>
                    <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: CALC_COLOR }} />calcolato</span>
                </p>
            )}
        </div>
    );
}

// -------- Sezione di profilo con le risultanti delle forze interne --------
// Mostra la sezione vista di lato (profondità verticale) con l'asse neutro a X,
// la zona compressa e le risultanti: C_c (cls, compressione), C's (acciaio
// compresso, solo doppia armatura) e T_s (acciaio teso). Flessione semplice.
// Testo SVG con pedici: parts = [["C"], ["c", true], [" = Ψ·B·x·f"], ["cd", true]]
// (true = pedice, abbassato con dy e poi riportato in linea).
function svgSubText(parts) {
    let low = false;
    return parts.map(([t, isSub], i) => {
        const dy = isSub && !low ? 2 : !isSub && low ? -2 : 0;
        low = !!isSub;
        return <tspan key={i} dy={dy || undefined} fontSize={isSub ? 8 : undefined}>{t}</tspan>;
    });
}

function SideForcesDiagram({ result, unit = "mm", svgRef, bare = false }) {
    const { h, d, X, kG, cC, cT, aCc, aCs, aTs, NEd: Ned, MEdSigned, tensionTop, concreteModel = "rectangular" } = result;
    const hasCompr = result.AsPrime > 0;
    // forze interne in forma simbolica (in fase di progetto x non è noto)
    const fSteel = Math.abs(result.fs - result.fyd) < 1e-9 ? "yd" : "s";
    // C_c: rettangolo Ψ·B·x·f_cd; T semplificato: anima + sbalzi dell'ala; T esatto: integrale
    const lblCcParts = !result.isT ? [["C"], ["c", true], [" = Ψ·B·x·f"], ["cd", true]]
        : result.flangeMethod === "exact" ? [["C"], ["c", true], [" = ∫σ"], ["c", true], ["·b dy"]]
            : result.inFlange ? (tensionTop
                ? [["C"], ["c", true], [" = Ψ·b"], ["w", true], ["·x·f"], ["cd", true]]
                : [["C"], ["c", true], [" = Ψ·B·x·f"], ["cd", true]])
                : [["C"], ["c", true], [" = Ψ·b"], ["w", true], ["·x·f"], ["cd", true], [" + (B − b"], ["w", true], [")·s·f"], ["cd", true]];
    const lblCsParts = result.mode === "fixBH" || result.givenTop
        ? [["C'"], ["s", true], [" = A'"], ["s", true], ["·f"], ["yd", true]]
        : [["C'"], ["s", true], [" = β·A"], ["s", true], ["·f"], ["yd", true]];
    const lblTsParts = [["T"], ["s", true], [" = A"], ["s", true], ["·f"], [fSteel, true]];
    const hasN = Math.abs(Ned) > 0.5; // N_Ed diverso da zero
    // In fase di progetto x e i bracci dipendono dalle incognite: le quote sono
    // simboliche (d' / d'' copriferri verticali inferiore / superiore).
    const symT = tensionTop ? "d''" : "d'", symC = tensionTop ? "d'" : "d''";
    const effT = (result.layT?.rows.length || 0) > 1, effC = (result.layC?.rows.length || 0) > 1;
    const [show, setShow] = useState({ law: true, forces: true, dims: true, moment: true });
    const toggle = (k) => setShow((s) => ({ ...s, [k]: !s[k] }));

    const U_FACTOR = { mm: 1, cm: 0.1, m: 0.001 };
    const U_DEC = { mm: 0, cm: 1, m: 3 };
    const fmtU = (mm) => {
        const v = mm * U_FACTOR[unit];
        if (!Number.isFinite(v)) return "-";
        return v.toLocaleString("it-IT", { minimumFractionDigits: 0, maximumFractionDigits: U_DEC[unit] });
    };
    const kN = (N) => fmtNum(N / 1000, 1);

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
    const yNA = yOf(X), yEdge0 = yOf(0), yN = yOf(result.yG ?? h / 2); // baricentro G (h/2 se rettangolare)
    // T: attacco ala-anima (l'ala è sul lembo superiore; profondità dal lembo compresso)
    const yFl = result.isT ? yOf(tensionTop ? h - result.hf : result.hf) : null;

    const yCc = yOf(result.yc ?? kG * X), yCs = yOf(cC), yTs = yOf(d);
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
            {!bare && <div className="mb-2 flex flex-wrap items-center justify-center gap-2">
                <Toggle k="law" label="Legame σc" color={col} />
                <Toggle k="forces" label="Forze" color={RED} />
                <Toggle k="dims" label="Quote" color="#64748b" />
                <Toggle k="moment" label="Momento" color={MCOL} />
            </div>}

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

                {/* sezione a T: attacco ala-anima (dove arriva l'ala), prolungato sul diagramma σ_c */}
                {yFl !== null && <>
                    {/* ombra sotto l'ala (sfumata verso il basso) */}
                    <defs>
                        <linearGradient id="sf-flange-shadow" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0" stopColor="#0f172a" stopOpacity="0.22" />
                            <stop offset="1" stopColor="#0f172a" stopOpacity="0" />
                        </linearGradient>
                    </defs>
                    <rect x={xCut} y={yFl} width={xRight - xCut} height={12} fill="url(#sf-flange-shadow)" />
                    <line x1={xCut} y1={yFl} x2={xRight} y2={yFl} stroke="#334155" strokeWidth="1.2" />
                    <line x1={xStressL} y1={yFl} x2={xCut} y2={yFl} stroke="#94a3b8" strokeWidth="0.8" strokeDasharray="3 3" />
                </>}

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
                    {show.dims && <text x={xCut - 3} y={yCc - 3} textAnchor="end" fontSize="8" fill="#64748b">{result.isT ? svgSubText([["G (y"], ["c", true], [")"]]) : "G (λ·x)"}</text>}

                    {/* C_c (compressione → verso la sezione, destra) */}
                    <line x1={xTail} y1={yCc} x2={xHead} y2={yCc} stroke={RED} strokeWidth="2.2" markerEnd="url(#sf-red)" />
                    {lblCc !== yCc && <line x1={labX + 3} y1={yCc} x2={labX + 3} y2={lblCc} stroke={RED} strokeWidth="0.6" />}
                    <text x={labX} y={lblCc + 3.5} textAnchor="end" fontSize="11" fill={RED}>{svgSubText(lblCcParts)}</text>

                    {hasCompr && <>
                        {show.dims && <line x1={xTail} y1={yCs} x2={qCs} y2={yCs} stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 3" />}
                        <line x1={xTail} y1={yCs} x2={xHead} y2={yCs} stroke={RED} strokeWidth="2.2" markerEnd="url(#sf-red)" />
                        {lblCs !== yCs && <line x1={labX + 3} y1={yCs} x2={labX + 3} y2={lblCs} stroke={RED} strokeWidth="0.6" />}
                        <text x={labX} y={lblCs + 3.5} textAnchor="end" fontSize="11" fill={RED}>{svgSubText(lblCsParts)}</text>
                    </>}

                    {/* N_Ed al baricentro: compressione → destra, trazione → sinistra */}
                    {hasN && show.dims && <line x1={xTail} y1={yN} x2={xCut} y2={yN} stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 3" />}
                    {hasN && (Ned > 0
                        ? <line x1={xTail} y1={yN} x2={xHead} y2={yN} stroke={NCOL} strokeWidth="2.2" markerEnd="url(#sf-ind)" />
                        : <line x1={xHead} y1={yN} x2={xTail} y2={yN} stroke={NCOL} strokeWidth="2.2" markerEnd="url(#sf-ind)" />)}
                    {/* valori in modulo: il segno è dato dal verso delle frecce */}
                    {hasN && <text x={xcross - 6} y={yN + 16} textAnchor="end" fontSize="11" fill={NCOL}>N<tspan fontSize="8" dy="2">Ed</tspan><tspan dy="-2"> = {kN(Math.abs(Ned))} kN</tspan></text>}

                    {/* T_s (trazione → via dalla sezione, sinistra) */}
                    {show.dims && <line x1={xTail} y1={yTs} x2={qTs} y2={yTs} stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 3" />}
                    <line x1={xHead} y1={yTs} x2={xTail} y2={yTs} stroke={GREEN} strokeWidth="2.2" markerEnd="url(#sf-green)" />
                    <text x={labX} y={yTs + 3.5} textAnchor="end" fontSize="11" fill={GREEN}>{svgSubText(lblTsParts)}</text>
                </>}

                {/* quote: x (asse neutro) e bracci rispetto al baricentro (h/2) */}
                {show.dims && <>
                    {/* asse baricentrico h/2 */}
                    <line x1={xCut} y1={yN} x2={xRight + 120} y2={yN} stroke="#94a3b8" strokeWidth="0.8" strokeDasharray="4 3" />
                    <text x={xCut + 4} y={yN - 3} textAnchor="start" fontSize="8" fill="#94a3b8">{result.isT ? "baricentro G" : "baricentro (h/2)"}</text>
                    <VDim dimX={qX} yA={yEdge0} yB={yNA} edgeX={xRight} label="x" color={NA_COL} />
                    <VDim dimX={qCc} yA={yN} yB={yCc} edgeX={xRight} label={result.isT ? svgSubText([["y"], ["G", true], [" − y"], ["c", true]]) : "h/2 − λx"} color="#475569" />
                    <text x={qCc + 11} y={(yN + yCc) / 2} textAnchor="middle" fontSize="10" fill="#94a3b8" transform={`rotate(-90 ${qCc + 11} ${(yN + yCc) / 2})`}>br. C<tspan fontSize="7" dy="2">c</tspan></text>
                    {hasCompr && <>
                        <VDim dimX={qCs} yA={yN} yB={yCs} edgeX={xRight} label={svgSubText([...(result.isT ? [["y"], ["G", true], [` − ${symC}`]] : [[`h/2 − ${symC}`]]), ...(effC ? [["eff", true]] : [])])} color="#475569" />
                        <text x={qCs + 11} y={(yN + yCs) / 2} textAnchor="middle" fontSize="10" fill="#94a3b8" transform={`rotate(-90 ${qCs + 11} ${(yN + yCs) / 2})`}>br. C'<tspan fontSize="7" dy="2">s</tspan></text>
                    </>}
                    <VDim dimX={qTs} yA={yN} yB={yTs} edgeX={xRight} label={result.isT ? svgSubText([["d − y"], ["G", true]]) : svgSubText([[`h/2 − ${symT}`], ...(effT ? [["eff", true]] : [])])} color="#475569" />
                    <text x={qTs + 11} y={(yN + yTs) / 2} textAnchor="middle" fontSize="10" fill="#94a3b8" transform={`rotate(-90 ${qTs + 11} ${(yN + yTs) / 2})`}>br. T<tspan fontSize="7" dy="2">s</tspan></text>
                </>}

                {/* azione applicata: M_Ed (blu) arco curvo che incrocia la freccia di N_Ed */}
                {show.moment && <>
                    <path d={momPath} fill="none" stroke={MCOL} strokeWidth="2.2" markerEnd="url(#sf-ind)" />
                    <text x={xMlab} y={yMlab} textAnchor="middle" fontSize="11" fill={MCOL}>M<tspan fontSize="8" dy="2">Ed</tspan><tspan dy="-2"> = {fmtNum(Math.abs(MEdSigned) / 1e6, 1)} kNm</tspan></text>
                </>}
            </svg>
            <div className="mt-1 text-center text-[11px] leading-tight text-slate-400">
                <p><Sym>C_c cade nel baricentro G del diagramma σ_c.</Sym></p>
                <p>I bracci sono misurati dall'asse baricentrico {result.isT ? "G della sezione a T" : "(h/2)"}.</p>
                {tensionTop && <p><Sym>M_Ed &lt; 0: lato teso in alto.</Sym></p>}
            </div>
        </div>
    );
}

function CheckRow({ ok, label, warn, reference }) {
    return (
        <div className="relative flex items-start gap-2 text-sm">
            {ok ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" /> : <AlertTriangle size={16} className={`mt-0.5 shrink-0 ${warn ? "text-amber-500" : "text-red-500"}`} />}
            <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
                <span className="text-slate-600">{sub(label)}</span>
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

// Sfruttamento = richiesto / adottato. Se l'adottato è inferiore al richiesto è un
// errore: la barra si ferma al 100% ed è rossa.
function AdoptionUtilization({ adopted, required, label = "Sfruttamento barre", errorText = "armatura insufficiente" }) {
    if (!(adopted > 0) || !(required > 0)) return null;
    const utilization = (required / adopted) * 100;
    const meetsRequirement = utilization <= 100 + 1e-9;
    const shown = Math.min(100, Math.max(0, utilization));
    return (
        <div className="mt-2">
            <p className="mb-1 text-[11px] font-medium normal-case tracking-normal text-slate-500">
                {label}
            </p>
            {/* se insufficiente il messaggio d'errore prende il posto della barra
                (stessa altezza: i box non cambiano dimensione) */}
            {meetsRequirement ? (
                <div className="flex h-4 items-center gap-3" aria-label={`${label} ${fmt(shown, 1)} per cento`}>
                    <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={shown} aria-valuetext={`${fmt(shown, 1)}%`}>
                        <div className="h-full rounded-full bg-emerald-500 transition-[width] duration-300" style={{ width: `${shown}%` }} />
                    </div>
                    <span className="shrink-0 text-xs font-semibold tabular-nums text-emerald-700">{fmt(shown, 1)}%</span>
                </div>
            ) : (
                <p role="alert" className="flex h-4 items-center gap-1 text-xs font-semibold normal-case tracking-normal text-red-600">
                    <AlertTriangle size={13} aria-hidden="true" className="shrink-0" />
                    {errorText.charAt(0).toUpperCase() + errorText.slice(1)}
                </p>
            )}
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
function BigResult({ title, titleSuffix, value, unit, note, children, onReset, resetLabel = "Ripristina valore adottato minimo" }) {
    return (
        <div className="min-w-0 rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 to-white p-4">
            <div className="relative min-h-4">
                <p className={`flex flex-wrap items-baseline gap-x-1.5 text-xs font-semibold uppercase tracking-wide text-sky-700 ${onReset ? "pr-7" : ""}`}>
                    {title}
                    {titleSuffix && <span className="text-[10px] font-medium normal-case tracking-normal text-slate-400">{titleSuffix}</span>}
                </p>
                {onReset && <button type="button" onClick={onReset} title={resetLabel} aria-label={resetLabel} className="absolute right-0 top-0 rounded-md p-1 text-slate-500 transition hover:bg-sky-100 hover:text-sky-700">
                    <RotateCcw size={15} />
                </button>}
            </div>
            <div className="mt-1 flex flex-wrap items-end gap-x-2">
                <span className="text-3xl font-bold text-slate-900">{value}</span>
                {unit && <span className="mb-1 text-base font-semibold text-slate-400">{unit}</span>}
            </div>
            {note && <p className="mt-1 text-sm text-slate-500">{note}</p>}
            {children && <div className="mt-3">{children}</div>}
        </div>
    );
}
function formatNumericFieldValue(value) {
    return value == null ? "" : String(value).replace(".", ",");
}

function NumberField({ label, hint, unit, value, onChange, onBlur, min, step = "any", disabled = false }) {
    const [displayValue, setDisplayValue] = useState(() => formatNumericFieldValue(value));
    const inputRef = useRef(null);
    const focusedRef = useRef(false);
    const lastValueRef = useRef(value);
    const wheelHandlerRef = useRef(null);

    useEffect(() => {
        if (Object.is(value, lastValueRef.current)) return;
        lastValueRef.current = value;
        if (!focusedRef.current) setDisplayValue(formatNumericFieldValue(value));
    }, [value]);

    const handleChange = (e) => {
        const rawValue = e.target.value;
        const normalizedValue = rawValue.replace(",", ".");
        if (!/^[+-]?\d*\.?\d*$/.test(normalizedValue)) {
            e.target.value = displayValue;
            return;
        }
        setDisplayValue(normalizedValue.replace(".", ","));
        onChange(normalizedValue);
    };

    const handleBlur = (e) => {
        focusedRef.current = false;
        let normalizedValue = e.target.value.replace(",", ".");
        if (step === "1" && normalizedValue !== "" && Number.isFinite(Number(normalizedValue))) {
            const wholeValue = Math.trunc(Number(normalizedValue));
            normalizedValue = String(min == null ? wholeValue : Math.max(Number(min), wholeValue));
            if (normalizedValue !== e.target.value.replace(",", ".")) onChange(normalizedValue);
        }
        onBlur?.(normalizedValue);
        setDisplayValue(formatNumericFieldValue(lastValueRef.current));
    };

    wheelHandlerRef.current = (e) => {
        if (disabled) return;
        e.preventDefault();
        if (!focusedRef.current || !e.deltaY) return;
        const current = Number(displayValue.replace(",", "."));
        if (!Number.isFinite(current)) return;

        const direction = e.deltaY < 0 ? 1 : -1;
        const fraction = step === "1" ? 0 : current - Math.trunc(current);
        let nextValue = Math.trunc(current) + direction + fraction;
        if (step === "1" && min != null) nextValue = Math.max(Number(min), nextValue);
        const nextText = String(+nextValue.toFixed(6));
        setDisplayValue(formatNumericFieldValue(nextText));
        onChange(nextText);
    };

    useEffect(() => {
        const input = inputRef.current;
        if (!input) return;
        const handleWheel = (event) => wheelHandlerRef.current?.(event);
        input.addEventListener("wheel", handleWheel, { passive: false });
        return () => input.removeEventListener("wheel", handleWheel);
    }, []);

    return (
        <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-500">
                {sub(label)}{unit && <span className="ml-1 text-slate-400">[{unit}]</span>}
                {/* sottotitolo sotto l'etichetta */}
                {hint && <span className="block text-[10px] font-normal text-slate-400">{hint}</span>}
            </span>
            <input ref={inputRef} type="text" inputMode="decimal" value={displayValue} disabled={disabled}
                onFocus={() => { focusedRef.current = true; }} onChange={handleChange} onBlur={handleBlur}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400" />
        </label>
    );
}
function SelectField({ label, value, onChange, options, labelExtra }) {
    const selectId = useId();
    return (
        <div className="block">
            <div className="mb-1 flex items-center gap-1 text-xs font-semibold text-slate-500">
                <label htmlFor={selectId}>{sub(label)}</label>{labelExtra}
            </div>
            <select id={selectId} value={value} onChange={(e) => onChange(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100">
                {options.map((opt) => <option key={String(opt.value) + opt.label} value={opt.value}>{opt.label}</option>)}
            </select>
        </div>
    );
}
