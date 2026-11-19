// src/components/concrete/BeamsTool.jsx
//
// Struttura: piani, travi e pilastri dell'edificio; ogni trave con il suo schema statico
// composto (campate, vincoli, continuità sugli appoggi) e i carichi; inviluppi
// del momento (anche traslato) e del taglio; sezioni scelte cliccando sullo
// schema o sui diagrammi; per ogni sezione la cascata progetto → verifica a
// flessione → taglio → fessurazione con i dati precompilati.
// Le travi sono salvate nel browser (localStorage).

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { createPortal } from "react-dom";
import { ArrowLeft, Building, Check, Copy, Info, ListChecks, Pencil, Plus, Trash2, ChevronRight, Search, X, Wand2, CheckCircle2, XCircle, AlertTriangle, Download, Upload } from "lucide-react";
import { sub } from "../Sym";
import { drawerPanelCls, modalBackdropCls, modalPanelCls, useModalTransition } from "../../ui/useModalTransition";
import Tex from "../Tex";
import { CONCRETE_CLASSES, STEEL_GRADES } from "../../lib/concrete/sectionDesign";
import { USE_CATEGORIES } from "../../lib/actions/loadData";
import { DEFL_DEFAULT, beamDeflection } from "../../lib/concrete/deflection";
import { COMBO_STATES, SUPPORT_TYPES, analyzeBeam, characteristicSections, diagramFor, influenceLine, influenceProcedure, influenceRange, itemValue, loadCombinations, newBeam, newId, spanVariable, valuesAt } from "../../lib/concrete/beamAnalysis";
import { verifySection } from "../../lib/concrete/verifySection";
import { crackCheck } from "../../lib/concrete/crackCheck";
import SectionDesignTool from "./SectionDesignTool";
import VerifySectionTool from "./VerifySectionTool";
import VerifyShearTool from "./VerifyShearTool";
import VerifyCrackTool from "./VerifyCrackTool";

const STORAGE_KEY = "ce-beams-v1";
const FLOORS_KEY = "ce-floors-v1";
const COLUMNS_KEY = "ce-columns-v1";
const C_POS = "#0284c7", C_NEG = "#dc2626", C_TRASL = "#7c3aed", C_SLE = "#16a34a", C_V = "#ca8a04", C_SEC = "#0f172a";

const fmt = (v, dec = 1) => (v === null || v === undefined || Number.isNaN(v) ? "–" : Number(v).toLocaleString("it-IT", { minimumFractionDigits: dec, maximumFractionDigits: dec }));
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

function loadBeams() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const arr = raw ? JSON.parse(raw) : null;
        return Array.isArray(arr) ? arr : null; // anche vuoto: si possono eliminare tutte le travi
    } catch { return null; }
}

function loadFloors() {
    try {
        const raw = localStorage.getItem(FLOORS_KEY);
        const arr = raw ? JSON.parse(raw) : null;
        return Array.isArray(arr) ? arr : null;   // anche vuoto: la struttura parte senza piani
    } catch { return null; }
}
const firstFloor = () => ({ id: newId("f"), name: "Piano terra" });
function loadColumns() {
    try {
        const raw = localStorage.getItem(COLUMNS_KEY);
        const arr = raw ? JSON.parse(raw) : null;
        return Array.isArray(arr) ? arr : null;
    } catch { return null; }
}

// valori di calcolo di una sezione: inviluppo (traslato o no) con le eventuali sovrascritture
// chiave dei dati che entrano nell'analisi (senza sezioni, frecce e nome)
const structKey = (b) => JSON.stringify({ ...b, sections: undefined, defl: undefined, name: undefined, floorId: undefined });

function sectionValues(beam, an, sec) {
    const v = an?.ok ? valuesAt(an, sec.x) : null;
    const useT = beam.useTranslated !== false;
    const o = sec.over ?? {};
    // valori arrotondati a 0,01 (kN, kNm): passano così negli strumenti della cascata
    const r2 = (x) => Math.round(x * 100) / 100 + 0;
    const pick = (k, auto) => (o[k] !== undefined && o[k] !== null && o[k] !== "" ? Number(o[k]) : r2(auto));
    const gov = (mx, mn) => (Math.abs(mn) > Math.abs(mx) ? mn : mx);
    return {
        Mpos: pick("Mpos", v ? Math.max(0, useT ? v.MmaxT : v.MmaxU) : 0),
        Mneg: pick("Mneg", v ? Math.min(0, useT ? v.MminT : v.MminU) : 0),
        V: pick("V", v ? v.VabsU : 0),
        Mrara: pick("Mrara", v ? gov(v.MmaxR, v.MminR) : 0),
        Mqp: pick("Mqp", v ? gov(v.MmaxQ, v.MminQ) : 0),
        raw: v,
    };
}

export default function BeamsTool() {
    // piani dell'edificio; ogni trave appartiene a un piano (floorId)
    // si parte senza piani, travi e pilastri; travi salvate prima dei piani → un piano «Piano terra»
    const [floors, setFloors] = useState(() => {
        const fl = loadFloors() ?? [];
        const anyOrphan = !fl.length && ((loadBeams() ?? []).length || (loadColumns() ?? []).length);
        return anyOrphan ? [firstFloor()] : fl;
    });
    const [beams, setBeams] = useState(() => loadBeams() ?? []);
    const [floorSel, setFloorSel] = useState(() => floors[0]?.id ?? null);
    const [selId, setSelId] = useState(() => beams[0]?.id ?? null);
    // pagine della trave, della sezione e del pilastro: nell'indirizzo, così funziona anche «indietro» del browser
    const [params, setParams] = useSearchParams();
    const beamParam = params.get("trave"), secId = params.get("sezione"), colParam = params.get("pilastro");
    // pilastri dell'edificio: { id, name, floorId, b, h [mm], H [m] }
    const [columns, setColumns] = useState(() => loadColumns() ?? []);
    const [colSel, setColSel] = useState(null);
    useEffect(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(beams)); } catch { /* memoria non disponibile */ } }, [beams]);
    useEffect(() => { try { localStorage.setItem(COLUMNS_KEY, JSON.stringify(columns)); } catch { /* memoria non disponibile */ } }, [columns]);
    useEffect(() => { try { localStorage.setItem(FLOORS_KEY, JSON.stringify(floors)); } catch { /* memoria non disponibile */ } }, [floors]);
    // piano effettivo: le travi senza un piano valido (create prima dei piani) stanno nel primo
    const floorOf = (b) => (floors.some((f) => f.id === b.floorId) ? b.floorId : floors[0]?.id ?? null);
    const visible = floorSel ? beams.filter((b) => floorOf(b) === floorSel) : [];
    const selected = visible.find((b) => b.id === selId) ?? visible[0] ?? null;        // evidenziata nell'elenco
    const beam = beamParam ? beams.find((b) => b.id === beamParam) ?? null : null;     // trave aperta
    const openedCol = colParam ? columns.find((c) => c.id === colParam) ?? null : null;
    const goHome = () => setParams({});
    const openBeam = (id) => { setSelId(id); setParams({ trave: id }); };
    const openCol = (id) => { setColSel(id); setParams({ pilastro: id }); };
    // step: verifica da mostrare all'apertura (design | bending | shear | crack | defl)
    const openSection = (sid, step = null) => { if (beam) setParams({ trave: beam.id, sezione: sid, ...(step ? { verifica: step } : {}) }); };
    const floorName = (id) => floors.find((f) => f.id === id)?.name ?? "—";
    const changeFloor = (id) => {
        setFloorSel(id);
        const first = beams.filter((b) => floorOf(b) === id)[0];
        if (first) setSelId(first.id);
    };
    // nuovi piani, travi e pilastri: si compilano in un modal prima di crearli
    const [form, setForm] = useState(null);         // "floor" | "beam" | "col"
    const createFloor = ({ name }) => {
        const f = { id: newId("f"), name: name.trim() || (floors.length ? `Piano ${floors.length}` : "Piano terra") };
        setFloors((fs) => [...fs, f]); setFloorSel(f.id);
    };
    const addFloor = () => setForm("floor");
    const renameFloor = (id, name) => setFloors((fs) => fs.map((f) => (f.id === id ? { ...f, name: name.trim() || f.name } : f)));
    const delFloor = (id) => {
        if (beams.some((b) => floorOf(b) === id) || columns.some((c) => floorOf(c) === id)) return;
        setAsk({
            title: `Eliminare il piano ${floorName(id)}?`,
            text: "Il piano non contiene travi né pilastri. L'operazione non si può annullare.",
            yes: "Elimina il piano",
            onYes: () => {
                const rest = floors.filter((f) => f.id !== id);
                setFloors(rest); setFloorSel(rest[0]?.id ?? null);
            },
        });
    };
    // l'analisi dipende solo dai dati strutturali: spostare o aggiungere sezioni non la ricalcola
    const anKey = beam ? structKey(beam) : "";
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const an = useMemo(() => (beam ? analyzeBeam(beam) : null), [anKey]);
    // aggiornamento di una trave: se fn restituisce la stessa trave lo stato non cambia
    // (niente nuovo render, quindi niente cicli con gli effetti che salvano dati)
    const updateBeam = useCallback((id, fn) => setBeams((bs) => {
        let changed = false;
        const next = bs.map((b) => {
            if (b.id !== id) return b;
            const nb = fn(b);
            if (nb !== b) changed = true;
            return nb;
        });
        return changed ? next : bs;
    }), []);
    // stabile finché resta aperta la stessa trave (le callback della cascata ne dipendono)
    // (id dall'URL: se non corrisponde a nessuna trave l'aggiornamento non cambia nulla)
    const upd = useCallback((fn) => { if (beamParam) updateBeam(beamParam, fn); }, [beamParam, updateBeam]);

    const addBeam = () => { if (floorSel) setForm("beam"); };
    // trave dal modal: campate uguali e schema di partenza (poi si modifica liberamente)
    const createBeam = (v) => {
        const n = Math.min(12, Math.max(1, Math.round(num(v.n)))), L = Math.max(0.1, num(v.L));
        const base = newBeam(v.name.trim() || `T${beams.length + 1}`);
        const span = { L, g1: base.spans[0].g1, g2: base.spans[0].g2, q: base.spans[0].q };
        const types = Array.from({ length: n + 1 }, (_, i) => (v.scheme === "fixed" && (i === 0 || i === n) ? "fixed"
            : v.scheme === "cantilever" ? (i === 0 ? "fixed" : i === n ? "free" : "pin") : "pin"));
        const nb = {
            ...base, floorId: v.floor,
            section: { ...base.section, b: Math.max(1, num(v.b)), h: Math.max(1, num(v.h)) },
            spans: Array.from({ length: n }, () => ({ ...span })),
            nodes: types.map((t) => ({ type: t, continuous: true })),
        };
        setBeams((bs) => [...bs, nb]); setSelId(nb.id); setFloorSel(v.floor);
    };
    const dupBeam = (b) => {
        const nb = { ...JSON.parse(JSON.stringify(b)), id: newId("b"), name: `${b.name} (copia)` };
        nb.sections = nb.sections.map((s) => ({ ...s, id: newId("s") }));
        setBeams((bs) => [...bs, nb]); setSelId(nb.id);
    };
    // conferma dentro la pagina: window.confirm in alcuni browser (es. quello integrato
    // nell'app) non compare e risponde sempre «annulla»
    const [ask, setAsk] = useState(null);           // { title, text, yes, onYes }
    const [notice, setNotice] = useState(null);     // avviso nell'intestazione (es. file non valido)
    const delBeam = (b) => {
        setAsk({
            title: `Eliminare la trave ${b.name}?`,
            text: `Si perdono lo schema statico, i carichi e ${b.sections.length ? `le ${b.sections.length} sezioni di calcolo con i risultati della cascata` : "le impostazioni della trave"}. L'operazione non si può annullare.`,
            yes: "Elimina la trave",
            onYes: () => {
                setBeams((bs) => bs.filter((x) => x.id !== b.id));
                if (b.id === selId) setSelId((beams.find((x) => x.id !== b.id && floorOf(x) === floorSel) ?? beams.find((x) => x.id !== b.id))?.id ?? null);
                if (b.id === beamParam) goHome();
            },
        });
    };
    const visibleCols = floorSel ? columns.filter((c) => floorOf(c) === floorSel) : [];
    const addColumn = () => { if (floorSel) setForm("col"); };
    const createColumn = (v) => {
        const nc = { id: newId("c"), name: v.name.trim() || `P${columns.length + 1}`, floorId: v.floor, b: Math.max(1, num(v.b)), h: Math.max(1, num(v.h)), H: Math.max(0.1, num(v.H)) };
        setColumns((cs) => [...cs, nc]); setColSel(nc.id); setFloorSel(v.floor);
    };
    const updColumn = (id, patch) => setColumns((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    const delColumn = (c) => {
        setAsk({
            title: `Eliminare il pilastro ${c.name}?`,
            text: "L'operazione non si può annullare.",
            yes: "Elimina il pilastro",
            onYes: () => {
                setColumns((cs) => cs.filter((x) => x.id !== c.id));
                if (c.id === colParam) goHome();
            },
        });
    };
    const exportJson = () => {
        const blob = new Blob([JSON.stringify({ version: 3, floors, beams, columns }, null, 2)], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob); a.download = "travi-edificio.json"; a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    };
    const fileRef = useRef(null);
    const importJson = (file) => {
        if (!file) return;
        file.text().then((t) => {
            try {
                const data = JSON.parse(t);
                // formato con i piani ({ floors, beams }) o vecchio formato (solo l'elenco delle travi)
                const bs = Array.isArray(data) ? data : data?.beams;
                const fs = !Array.isArray(data) && Array.isArray(data?.floors) && data.floors.length ? data.floors : [firstFloor()];
                if (Array.isArray(bs) && bs.length && bs[0].spans) {
                    const fixed = bs.map((b) => (fs.some((f) => f.id === b.floorId) ? b : { ...b, floorId: fs[0].id }));
                    const cols = !Array.isArray(data) && Array.isArray(data?.columns) ? data.columns : [];
                    setFloors(fs); setBeams(fixed); setColumns(cols); setFloorSel(fs[0].id); setSelId(fixed[0].id); goHome();
                    setNotice(null);
                } else setNotice("File non valido: nessuna trave trovata.");
            } catch { setNotice("File non valido: non è un JSON esportato da questa pagina."); }
        });
    };

    const addSection = (x, label) => {
        if (!an.ok) return null;
        const xr = Math.round(Math.min(an.Ltot, Math.max(0, x)) * 1000) / 1000;
        const id = newId("s");
        upd((b) => ({ ...b, sections: [...b.sections, { id, x: xr, label: label ?? `S${b.sections.length + 1}`, over: {} }].sort((p, q) => p.x - q.x) }));
        return id;
    };
    const addCharacteristic = () => {
        if (!an.ok) return;
        const cs = characteristicSections(beam, an).filter((c) => !beam.sections.some((s) => Math.abs(s.x - c.x) < 0.02));
        upd((b) => ({ ...b, sections: [...b.sections, ...cs.map((c) => ({ id: newId("s"), x: Math.round(c.x * 1000) / 1000, label: c.label, over: {} }))].sort((p, q) => p.x - q.x) }));
    };

    const section = secId && beam ? beam.sections.find((s) => s.id === secId) : null;
    const [fitRef, fitH] = useFitHeight();
    const floorOpts = floors.map((f) => ({ value: f.id, label: f.name }));
    const formModal = form === "floor" ? (
        <FormModal title="Nuovo piano" submit="Crea il piano" onClose={() => setForm(null)} onSubmit={(v) => { createFloor(v); setForm(null); }}
            fields={[{ key: "name", label: "Nome del piano", type: "text", value: floors.length ? `Piano ${floors.length}` : "Piano terra", required: true, span: 2 }]} />
    ) : form === "beam" ? (
        <FormModal title="Nuova trave" submit="Crea la trave" onClose={() => setForm(null)} onSubmit={(v) => { createBeam(v); setForm(null); }}
            fields={[
                { key: "name", label: "Nome", type: "text", value: `T${beams.length + 1}`, required: true },
                { key: "floor", label: "Piano", type: "select", value: floorSel, options: floorOpts },
                { key: "b", label: "Base b", unit: "mm", type: "number", value: 300, min: 1 },
                { key: "h", label: "Altezza h", unit: "mm", type: "number", value: 500, min: 1 },
                { key: "n", label: "Numero di campate", type: "number", value: 2, min: 1, step: 1 },
                { key: "L", label: "Luce di ogni campata", unit: "m", type: "number", value: 5, min: 0.1 },
                { key: "scheme", label: "Vincoli di partenza", type: "select", value: "pin", span: 2, options: [
                    { value: "pin", label: "Appoggi (trave continua)" },
                    { value: "fixed", label: "Incastri alle estremità, appoggi intermedi" },
                    { value: "cantilever", label: "Incastro a sinistra, estremo destro libero" },
                ] },
            ]} note="Campate, vincoli, continuità e carichi si modificano poi nella pagina della trave." />
    ) : form === "col" ? (
        <FormModal title="Nuovo pilastro" submit="Crea il pilastro" onClose={() => setForm(null)} onSubmit={(v) => { createColumn(v); setForm(null); }}
            fields={[
                { key: "name", label: "Nome", type: "text", value: `P${columns.length + 1}`, required: true },
                { key: "floor", label: "Piano", type: "select", value: floorSel, options: floorOpts },
                { key: "b", label: "Base b", unit: "mm", type: "number", value: 300, min: 1 },
                { key: "h", label: "Altezza h", unit: "mm", type: "number", value: 300, min: 1 },
                { key: "H", label: "Altezza di interpiano H", unit: "m", type: "number", value: 3, min: 0.1, span: 2 },
            ]} />
    ) : null;
    const dialog = <>{ask && <ConfirmModal {...ask} onClose={() => setAsk(null)} />}{formModal}</>;

    // pagina della trave: schema statico per primo, poi diagrammi, sezioni e cascata della sezione
    if (beam) {
        // pagine interne (trave, sezione): stessa animazione del cambio pagina
        return <>{section
            ? <div key={`s-${section.id}`} className="page-enter"><SectionWorkspace key={section.id} beam={beam} an={an} section={section} initialStep={params.get("verifica")} onBack={() => setParams({ trave: beam.id })} updateBeam={upd} /></div>
            : (
                <div key={`b-${beam.id}`} className="page-enter space-y-4">
                    <PageBar onBack={goHome} onDelete={() => delBeam(beam)} deleteLabel="Elimina trave" crumbs={[floorName(floorOf(beam)), beam.name]} sub={`Trave · ${beam.spans.length} ${beam.spans.length === 1 ? "campata" : "campate"} · sezione ${beam.section.b}×${beam.section.h} mm`} />
                    <BeamEditor beam={beam} an={an} upd={upd} addSection={addSection} addCharacteristic={addCharacteristic} openSection={openSection}
                        floors={floors} floorId={floorOf(beam)} onMoveFloor={(fid) => upd((b) => ({ ...b, floorId: fid }))} />
                </div>
            )}{dialog}</>;
    }
    // pagina del pilastro
    if (openedCol) {
        return (
            <div key={`c-${openedCol.id}`} className="page-enter space-y-4">
                <PageBar onBack={goHome} onDelete={() => delColumn(openedCol)} deleteLabel="Elimina pilastro" crumbs={[floorName(floorOf(openedCol)), openedCol.name]} sub={`Pilastro · ${openedCol.b}×${openedCol.h} mm · H = ${fmt(num(openedCol.H), 2)} m`} />
                <PillarPage col={openedCol} floors={floors} floorId={floorOf(openedCol)} onUpdate={(patch) => updColumn(openedCol.id, patch)} />
                {dialog}
            </div>
        );
    }
    // elenco dell'edificio: il box occupa tutta la finestra, a scorrere sono solo gli elenchi
    return (
        <section ref={fitRef} style={fitH ? { height: fitH } : undefined} className="page-enter flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h3 className="text-sm font-bold text-slate-800">Piani, travi e pilastri</h3>
                    <p className="text-xs text-slate-500">Scegli il piano; doppio clic (o «Apri») su una trave o un pilastro per aprirne la pagina con schema statico, sezioni, progetto e verifiche.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {notice && (
                        <span role="alert" className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-2 py-1 text-xs font-semibold text-red-700">
                            <AlertTriangle size={13} /> {notice}
                            <button type="button" onClick={() => setNotice(null)} aria-label="Chiudi l'avviso" className="rounded p-0.5 hover:bg-red-100"><X size={12} /></button>
                        </span>
                    )}
                    <IconBtn onClick={exportJson} title="Esporta l'edificio (JSON)"><Download size={14} /> Esporta</IconBtn>
                    <IconBtn onClick={() => fileRef.current?.click()} title="Importa l'edificio (JSON)"><Upload size={14} /> Importa</IconBtn>
                    <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(e) => { importJson(e.target.files?.[0]); e.target.value = ""; }} />
                </div>
            </div>
            <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.3fr)_minmax(0,1fr)]">
                <FloorsColumn floors={floors} value={floorSel} onChange={changeFloor} onAdd={addFloor} onRename={renameFloor} onDelete={delFloor}
                    counts={Object.fromEntries(floors.map((f) => [f.id, { b: beams.filter((b) => floorOf(b) === f.id).length, c: columns.filter((c) => floorOf(c) === f.id).length }]))}
 />
                <BeamsColumn beams={visible} activeId={selected?.id} onSelect={setSelId} onOpen={openBeam} onAdd={addBeam} onDup={dupBeam} onDel={delBeam}
                    noFloor={!floorSel} floorTitle={floorSel ? floorName(floorSel) : "nessun piano"} />
                <PillarsColumn columns={visibleCols} activeId={colSel} onSelect={setColSel} onOpen={openCol} onAdd={addColumn} onDel={delColumn}
                    noFloor={!floorSel} floorTitle={floorSel ? floorName(floorSel) : "nessun piano"} />
            </div>
            {dialog}
        </section>
    );
}

// altezza che porta il box fino al fondo della finestra, senza far scorrere la
// pagina: spazio dalla sua cima al fondo, meno i padding/margini inferiori dei
// contenitori. Sotto 1024 px (colonne impilate) altezza naturale.
function useFitHeight(minH = 420) {
    const ref = useRef(null);
    const [h, setH] = useState(null);
    useLayoutEffect(() => {
        const fit = () => {
            const el = ref.current;
            if (!el) return;
            if (window.innerWidth < 1024) { setH(null); return; }
            let below = 0;
            for (let n = el; n && n !== document.body; n = n.parentElement) {
                const cs = getComputedStyle(n);
                below += (n === el ? 0 : parseFloat(cs.paddingBottom) || 0) + (parseFloat(cs.marginBottom) || 0) + (n === el ? 0 : parseFloat(cs.borderBottomWidth) || 0);
            }
            const scroller = el.closest("main");            // area del contenuto che scorre (layout)
            const top = el.getBoundingClientRect().top + (scroller ? scroller.scrollTop : window.scrollY);
            setH(Math.max(minH, Math.floor(window.innerHeight - top - below)));
        };
        fit();
        window.addEventListener("resize", fit);
        // durante l'animazione di ingresso la pagina è traslata: si rimisura alla fine
        document.addEventListener("animationend", fit);
        return () => { window.removeEventListener("resize", fit); document.removeEventListener("animationend", fit); };
    }, [minH]);
    return [ref, h];
}

// tutti i modal e i pannelli sovrapposti si aprono su #modal-root (index.html),
// come gli altri modal dell'hub; in mancanza, su document.body
const toModalRoot = (node) => createPortal(node, document.getElementById("modal-root") ?? document.body);

// modal con un modulo (nuovo piano, trave, pilastro): Invio crea, Esc o clic fuori annulla
function FormModal({ title, fields, submit = "Crea", note = null, onSubmit, onClose }) {
    const { isVisible, close, finishClose } = useModalTransition(onClose);
    const [vals, setVals] = useState(() => Object.fromEntries(fields.map((f) => [f.key, f.value ?? ""])));
    const firstRef = useRef(null);
    useEffect(() => {
        firstRef.current?.focus();
        firstRef.current?.select?.();
        const onKey = (e) => { if (e.key === "Escape") close(); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [close]);
    const invalid = fields.some((f) => (f.required && !String(vals[f.key]).trim()) || (f.type === "number" && f.min !== undefined && !(num(vals[f.key]) >= f.min)));
    const field = "w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100";
    return toModalRoot(
        <div className={`fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/30 p-4 ${modalBackdropCls(isVisible)}`} onTransitionEnd={finishClose} role="dialog" aria-modal="true" aria-label={title}
            onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
            <form className={`w-full max-w-md rounded-2xl bg-white shadow-2xl ${modalPanelCls(isVisible)}`} onSubmit={(e) => { e.preventDefault(); if (!invalid) close(() => onSubmit(vals)); }}>
                <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
                    <p className="text-sm font-bold text-slate-800">{title}</p>
                    <button type="button" onClick={close} aria-label="Chiudi" className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100"><X size={16} /></button>
                </div>
                <div className="grid grid-cols-2 gap-3 px-5 py-4">
                    {fields.map((f, i) => (
                        <label key={f.key} className={`block ${f.span === 2 ? "col-span-2" : ""}`}>
                            <span className="mb-1 block text-xs font-semibold text-slate-500">{f.label}{f.unit && <span className="ml-1 font-normal text-slate-400">[{f.unit}]</span>}</span>
                            {f.type === "select" ? (
                                <select ref={i === 0 ? firstRef : undefined} value={vals[f.key]} onChange={(e) => setVals((v) => ({ ...v, [f.key]: e.target.value }))} className={`${field} cursor-pointer bg-white`}>
                                    {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </select>
                            ) : (
                                <input ref={i === 0 ? firstRef : undefined} type={f.type} step={f.step ?? "any"} value={vals[f.key]}
                                    onChange={(e) => setVals((v) => ({ ...v, [f.key]: e.target.value }))} className={`${field} ${f.type === "number" ? "tabular-nums" : ""}`} />
                            )}
                        </label>
                    ))}
                    {note && <p className="col-span-2 text-[11px] leading-4 text-slate-500">{note}</p>}
                </div>
                <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">
                    <button type="button" onClick={close} className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">Annulla</button>
                    <button type="submit" disabled={invalid} className="rounded-xl bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-40">{submit}</button>
                </div>
            </form>
        </div>
    );
}

// finestra di conferma (eliminazioni): Invio conferma, Esc o clic fuori annulla
function ConfirmModal({ title, text, yes = "Conferma", onYes, onClose }) {
    const { isVisible, close, finishClose } = useModalTransition(onClose);
    const yesRef = useRef(null);
    useEffect(() => {
        yesRef.current?.focus();
        const onKey = (e) => { if (e.key === "Escape") close(); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [close]);
    return toModalRoot(
        <div className={`fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/30 p-4 ${modalBackdropCls(isVisible)}`} onTransitionEnd={finishClose} role="alertdialog" aria-modal="true" aria-label={title}
            onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
            <div className={`w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl ${modalPanelCls(isVisible)}`}>
                <div className="flex items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600"><Trash2 size={17} /></span>
                    <div>
                        <p className="text-sm font-bold text-slate-800">{title}</p>
                        {text && <p className="mt-1 text-xs leading-5 text-slate-500">{text}</p>}
                    </div>
                </div>
                <div className="mt-5 flex justify-end gap-2">
                    <button type="button" onClick={close} className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50">Annulla</button>
                    <button ref={yesRef} type="button" onClick={() => close(() => { onYes(); onClose(); })} className="rounded-xl bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-red-700">{yes}</button>
                </div>
            </div>
        </div>
    );
}

// barra in cima alle pagine di trave e pilastro: torna all'elenco della struttura
function PageBar({ onBack, crumbs, sub: subtitle, onDelete = null, deleteLabel = "Elimina" }) {
    // sticky subito sotto l'intestazione fissa della pagina (titolo «Struttura»):
    // insieme restano in cima all'area che scorre
    return (
        <div className="sticky z-20 bg-slate-100 pb-1" style={{ top: "var(--tool-header-h, 0px)" }}>
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50">
                <ArrowLeft size={14} /> Struttura
            </button>
            <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-800">{crumbs.join(" › ")}</p>
                {subtitle && <p className="truncate text-xs text-slate-500">{subtitle}</p>}
            </div>
            {onDelete && (
                <button type="button" onClick={onDelete} className="ml-auto inline-flex items-center gap-1.5 rounded-xl border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50">
                    <Trash2 size={14} /> {deleteLabel}
                </button>
            )}
        </div>
        </div>
    );
}

// pagina del pilastro: dati e sezione (progetto e verifica a pressoflessione: prossimo passo)
function PillarPage({ col, floors, floorId, onUpdate }) {
    const set = (k) => (v) => onUpdate({ [k]: v });
    const b = num(col.b), h = num(col.h), c = num(col.c ?? 40);
    const S = 150 / Math.max(b, h, 1), W2 = 300, H2 = 260, x0 = W2 / 2 - (b * S) / 2, y0 = H2 / 2 - (h * S) / 2 - 10;
    return (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card title="Pilastro">
                <div className="grid grid-cols-2 gap-3">
                    <TextField label="Nome" value={col.name} onChange={set("name")} />
                    <SelField label="Piano" value={floorId} onChange={set("floorId")} options={floors.map((f) => ({ value: f.id, label: f.name }))} />
                    <NumField label="Base b" unit="mm" value={col.b} onChange={set("b")} />
                    <NumField label="Altezza h" unit="mm" value={col.h} onChange={set("h")} />
                    <NumField label="Altezza di interpiano H" unit="m" value={col.H} onChange={set("H")} />
                    <NumField label="Copriferro (asse barre)" unit="mm" value={col.c ?? 40} onChange={set("c")} />
                    <SelField label="Calcestruzzo" value={col.fck ?? 25} onChange={(v) => onUpdate({ fck: num(v) })} options={CONCRETE_CLASSES.map((k) => ({ value: k.fck, label: k.id }))} />
                    <SelField label="Acciaio" value={col.fyk ?? 450} onChange={(v) => onUpdate({ fyk: num(v) })} options={STEEL_GRADES.filter((g, i, a) => a.findIndex((t) => t.fyk === g.fyk) === i).map((g) => ({ value: g.fyk, label: g.id }))} />
                </div>
            </Card>
            <Card title="Sezione">
                <svg viewBox={`0 0 ${W2} ${H2}`} width="100%" className="mx-auto max-w-[360px]" role="img" aria-label={`Sezione del pilastro ${col.name}`}>
                    <rect x={x0} y={y0} width={b * S} height={h * S} fill="#f1f5f9" stroke="#334155" strokeWidth="1.6" />
                    <rect x={x0 + c * S} y={y0 + c * S} width={Math.max(0, (b - 2 * c) * S)} height={Math.max(0, (h - 2 * c) * S)} fill="none" stroke="#94a3b8" strokeDasharray="4 3" />
                    {[[x0 + c * S, y0 + c * S], [x0 + (b - c) * S, y0 + c * S], [x0 + c * S, y0 + (h - c) * S], [x0 + (b - c) * S, y0 + (h - c) * S]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="4" fill="#0f172a" />)}
                    <line x1={x0} x2={x0 + b * S} y1={y0 + h * S + 18} y2={y0 + h * S + 18} stroke="#64748b" />
                    <text x={W2 / 2} y={y0 + h * S + 32} fontSize="12" textAnchor="middle" fill="#334155" fontWeight="600">b = {fmt(b, 0)} mm</text>
                    <line x1={x0 + b * S + 18} x2={x0 + b * S + 18} y1={y0} y2={y0 + h * S} stroke="#64748b" />
                    <text x={x0 + b * S + 26} y={y0 + (h * S) / 2} fontSize="12" fill="#334155" fontWeight="600" transform={`rotate(90 ${x0 + b * S + 26} ${y0 + (h * S) / 2})`} textAnchor="middle">h = {fmt(h, 0)} mm</text>
                </svg>
                <p className="mt-2 text-center text-[11px] text-slate-400">Barre d'angolo indicative; l'armatura verrà dal progetto.</p>
            </Card>
            <div className="lg:col-span-2">
                <Card title="Progetto e verifica">
                    <p className="text-sm text-slate-600">Il progetto e la verifica a pressoflessione del pilastro (con il dominio M-N per campi della Verifica sezione) e i carichi dalle reazioni delle travi del piano superiore sono il prossimo passo.</p>
                </Card>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// EDIFICIO A TRE COLONNE: piani | travi | pilastri
// ---------------------------------------------------------------------------
// search: casella di ricerca nell'intestazione, fra il titolo e il pulsante di aggiunta
// (fuori dall'elenco che scorre, quindi sempre visibile)
function Column({ title, sub: subtitle, action, search = null, children }) {
    return (
        <div className="flex min-h-[280px] flex-col rounded-xl border border-slate-200 bg-slate-50/50 lg:min-h-0">
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-2">
                <div className={`min-w-0 ${search ? "shrink-0" : ""}`}>
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-600">{title}</p>
                    {subtitle && <p className="truncate text-[11px] text-slate-400">{subtitle}</p>}
                </div>
                {search && <div className="min-w-0 flex-1">{search}</div>}
                {action}
            </div>
            <div className="scroll-thin max-h-[420px] min-h-0 flex-1 space-y-1.5 py-2 pl-2 pr-1 lg:max-h-none">{children}</div>
        </div>
    );
}
function OpenBtn({ onClick, label }) {
    return (
        <button type="button" onClick={onClick} title={label} aria-label={label}
            className="inline-flex shrink-0 items-center gap-0.5 rounded-lg border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700 transition hover:bg-sky-100">
            Apri <ChevronRight size={12} />
        </button>
    );
}
function AddBtn({ onClick, label, disabled = false }) {
    return (
        <button type="button" onClick={onClick} disabled={disabled} title={disabled ? "Crea prima un piano" : undefined}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-sky-600 px-2 py-1 text-[11px] font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-sky-600">
            <Plus size={12} /> {label}
        </button>
    );
}
const itemCls = (active) => `group flex w-full cursor-pointer items-start gap-2 rounded-lg border px-2.5 py-2 text-left transition ${active ? "border-sky-400 bg-white ring-1 ring-sky-200" : "border-transparent bg-white/70 hover:border-slate-200 hover:bg-white"}`;

function FloorsColumn({ floors, value, onChange, onAdd, onRename, onDelete, counts }) {
    const [editing, setEditing] = useState(null);       // { id, name } durante la rinomina
    const commit = () => { if (editing) onRename(editing.id, editing.name); setEditing(null); };
    const desc = (k) => `${k.b} ${k.b === 1 ? "trave" : "travi"} · ${k.c} ${k.c === 1 ? "pilastro" : "pilastri"}`;
    return (
        <Column title="Piani" sub={`${floors.length} ${floors.length === 1 ? "piano" : "piani"}`}
            action={<AddBtn label="Piano" onClick={onAdd} />}>
            {floors.map((f) => {
                const k = counts[f.id] ?? { b: 0, c: 0 }, active = value === f.id;
                const canDelete = !k.b && !k.c;
                if (editing?.id === f.id) {
                    return (
                        <div key={f.id} className={itemCls(true)}>
                            <Building size={14} className="mt-1 shrink-0 text-sky-600" />
                            <input autoFocus value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                                onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(null); }} onBlur={commit}
                                aria-label="Nuovo nome del piano" className="min-w-0 flex-1 rounded-md border border-sky-300 px-2 py-0.5 text-sm outline-none ring-2 ring-sky-100" />
                            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={commit} aria-label="Conferma il nome" className="rounded-md p-1 text-emerald-600 hover:bg-emerald-50"><Check size={14} /></button>
                        </div>
                    );
                }
                return (
                    <div key={f.id} role="button" tabIndex={0} onClick={() => onChange(f.id)} onKeyDown={(e) => { if (e.key === "Enter") onChange(f.id); }}
                        onDoubleClick={() => setEditing({ id: f.id, name: f.name })} className={itemCls(active)}>
                        <Building size={14} className={`mt-0.5 shrink-0 ${active ? "text-sky-600" : "text-slate-400"}`} />
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-slate-800">{f.name}</p>
                            <p className="text-[11px] text-slate-500">{desc(k)}</p>
                        </div>
                        <div className="flex shrink-0 opacity-50 transition group-hover:opacity-100 group-focus-within:opacity-100">
                            <MiniBtn title="Rinomina il piano" onClick={(e) => { e.stopPropagation(); setEditing({ id: f.id, name: f.name }); }}><Pencil size={12} /></MiniBtn>
                            {(
                                <button type="button" disabled={!canDelete} onClick={(e) => { e.stopPropagation(); onDelete(f.id); }}
                                    title={canDelete ? "Elimina il piano" : "Si possono eliminare solo i piani senza travi né pilastri"} aria-label="Elimina il piano"
                                    className="ml-1 rounded-md p-1 text-slate-500 transition hover:bg-slate-100 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30"><Trash2 size={12} /></button>
                            )}
                        </div>
                    </div>
                );
            })}
            {floors.length === 0 && (
                <p className="rounded-lg border border-dashed border-slate-200 px-2 py-4 text-center text-xs text-slate-500">
                    Nessun piano. <button type="button" onClick={onAdd} className="font-semibold text-sky-700 hover:underline">Aggiungi il primo piano</button>
                </p>
            )}
        </Column>
    );
}

function SearchBox({ value, onChange, placeholder, label, onEnter }) {
    return (
        <label className="relative block">
            <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={label}
                onKeyDown={(e) => { if (e.key === "Enter") onEnter?.(); if (e.key === "Escape") onChange(""); }}
                className="w-full rounded-lg border border-slate-200 bg-white py-1 pl-7 pr-7 text-xs outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100" />
            {value && <button type="button" onClick={() => onChange("")} aria-label="Cancella la ricerca" className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-700"><X size={12} /></button>}
        </label>
    );
}

function BeamsColumn({ beams, activeId, onSelect, onOpen, onAdd, onDup, onDel, noFloor, floorTitle }) {
    const [query, setQuery] = useState("");
    const q = query.trim().toLowerCase();
    const shown = q ? beams.filter((b) => b.name.toLowerCase().includes(q)) : beams;
    const listRef = useRef(null);
    // la trave selezionata resta visibile nell'elenco
    useEffect(() => { listRef.current?.querySelector(`[data-beam="${activeId}"]`)?.scrollIntoView({ block: "nearest" }); }, [activeId]);
    return (
        <Column title="Travi" sub={`${floorTitle} · ${q ? `${shown.length} di ${beams.length}` : beams.length}`} action={<AddBtn label="Trave" onClick={onAdd} disabled={noFloor} />}
            search={<SearchBox value={query} onChange={setQuery} placeholder="Cerca una trave…" label="Cerca una trave per nome" onEnter={() => { if (shown.length) onOpen(shown[0].id); }} />}>
            <div ref={listRef} className="space-y-1.5">
                {shown.length === 0 && (
                    <p className="rounded-lg border border-dashed border-slate-200 px-2 py-4 text-center text-xs text-slate-500">
                        {noFloor ? <>Crea prima un piano nella colonna Piani.</> : q ? <>Nessuna trave trovata per «{query}».</> : <>Nessuna trave in questo piano. <button type="button" onClick={onAdd} className="font-semibold text-sky-700 hover:underline">Creane una</button></>}
                    </p>
                )}
                {shown.map((b) => {
                    const active = b.id === activeId;
                    const L = b.spans.reduce((t, sp) => t + num(sp.L), 0);
                    return (
                        <div key={b.id} data-beam={b.id} role="button" tabIndex={0} onClick={() => onSelect(b.id)} onDoubleClick={() => onOpen(b.id)}
                            onKeyDown={(e) => { if (e.key === "Enter") onOpen(b.id); }} title="Doppio clic per aprire la trave" className={`${itemCls(active)} flex-col`}>
                            <div className="flex w-full items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-slate-800">{b.name}
</p>
                                    <p className="text-[11px] text-slate-500">{b.spans.length} {b.spans.length === 1 ? "campata" : "campate"} · L = {fmt(L, 2)} m · {b.section.b}×{b.section.h} · {b.sections.length} sez.</p>
                                </div>
                                <div className="flex shrink-0 opacity-50 transition group-hover:opacity-100 group-focus-within:opacity-100">
                                    <MiniBtn title="Duplica" onClick={(e) => { e.stopPropagation(); onDup(b); }}><Copy size={12} /></MiniBtn>
                                    {onDel && <MiniBtn title="Elimina" onClick={(e) => { e.stopPropagation(); onDel(b); }}><Trash2 size={12} /></MiniBtn>}
                                </div>
                                <OpenBtn onClick={(e) => { e.stopPropagation(); onOpen(b.id); }} label={`Apri la trave ${b.name}`} />
                            </div>
                            <div className="w-full"><SchemeSVG beam={b} mini /></div>
                        </div>
                    );
                })}
            </div>
        </Column>
    );
}

function PillarsColumn({ columns, activeId, onSelect, onOpen, onAdd, onDel, noFloor, floorTitle }) {
    const [query, setQuery] = useState("");
    const norm = (t) => String(t).toLowerCase().replace(/×/g, "x").replace(/\s+/g, "");
    const q = norm(query.trim());
    const shown = q ? columns.filter((c) => norm(c.name).includes(q) || norm(`${c.b}x${c.h}`).includes(q) || norm(`${c.b / 10}x${c.h / 10}`).includes(q)) : columns;
    return (
        <Column title="Pilastri" sub={`${floorTitle} · ${q ? `${shown.length} di ${columns.length}` : columns.length}`} action={<AddBtn label="Pilastro" onClick={onAdd} disabled={noFloor} />}
            search={<SearchBox value={query} onChange={setQuery} placeholder="Cerca (nome o b×h)…" label="Cerca un pilastro per nome o sezione"
                onEnter={() => { if (shown.length) onOpen(shown[0].id); }} />}>
            {shown.length === 0 && (
                <p className="rounded-lg border border-dashed border-slate-200 px-2 py-4 text-center text-xs text-slate-500">
                    {noFloor ? <>Crea prima un piano nella colonna Piani.</> : q ? <>Nessun pilastro trovato per «{query}».</>
                        : <>Nessun pilastro in questo piano. <button type="button" onClick={onAdd} className="font-semibold text-sky-700 hover:underline">Aggiungine uno</button></>}
                </p>
            )}
            {shown.map((c) => {
                const active = c.id === activeId;
                const k = 18 / Math.max(c.b, c.h, 1);              // miniatura della sezione in scala
                return (
                    <div key={c.id} className={`${itemCls(active)} flex-col`} role="button" tabIndex={0} onClick={() => onSelect(c.id)} onDoubleClick={() => onOpen(c.id)}
                        onKeyDown={(e) => { if (e.key === "Enter") onOpen(c.id); }} title="Doppio clic per aprire il pilastro">
                        <div className="flex w-full items-center gap-2">
                            <svg viewBox="0 0 22 22" width="22" height="22" className="shrink-0" aria-hidden="true">
                                <rect x={11 - (c.b * k) / 2} y={11 - (c.h * k) / 2} width={c.b * k} height={c.h * k} fill="#e2e8f0" stroke="#334155" strokeWidth="1.2" />
                            </svg>
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-slate-800">{c.name}
</p>
                                <p className="text-[11px] text-slate-500">{c.b}×{c.h} mm · H = {fmt(num(c.H), 2)} m</p>
                            </div>
                            <div className="flex shrink-0 opacity-50 transition group-hover:opacity-100 group-focus-within:opacity-100">
                                <MiniBtn title="Elimina" onClick={(e) => { e.stopPropagation(); onDel(c); }}><Trash2 size={12} /></MiniBtn>
                            </div>
                            <OpenBtn onClick={(e) => { e.stopPropagation(); onOpen(c.id); }} label={`Apri il pilastro ${c.name}`} />
                        </div>
                    </div>
                );
            })}
        </Column>
    );
}

// ---------------------------------------------------------------------------
// EDITOR DELLA TRAVE
// ---------------------------------------------------------------------------
function BeamEditor({ beam, an, upd, addSection, addCharacteristic, openSection, floors, floorId, onMoveFloor }) {
    const setSec = (k, v) => upd((b) => ({ ...b, section: { ...b.section, [k]: v } }));
    const setSpan = (j, k, v) => upd((b) => ({ ...b, spans: b.spans.map((s, i) => (i === j ? { ...s, [k]: v, items: s.items ? { ...s.items, [k]: undefined } : s.items } : s)) }));
    const setNode = (i, k, v) => upd((b) => ({ ...b, nodes: b.nodes.map((n, q) => (q === i ? { ...n, [k]: v } : n)) }));
    const addSpan = () => upd((b) => {
        const last = b.spans[b.spans.length - 1];
        return { ...b, spans: [...b.spans, { ...last }], nodes: [...b.nodes.slice(0, -1), { ...b.nodes[b.nodes.length - 1], type: b.nodes[b.nodes.length - 1].type === "free" ? "pin" : b.nodes[b.nodes.length - 1].type, continuous: true }, { type: "pin", continuous: true }] };
    });
    const removeSpan = (j) => upd((b) => {
        if (b.spans.length < 2) return b;
        const spans = b.spans.filter((_, i) => i !== j);
        const nodes = b.nodes.filter((_, i) => i !== (j === b.spans.length - 1 ? j : j + 1)); // l'ultima campata conserva il vincolo di estremità
        const L = spans.reduce((t, s) => t + num(s.L), 0);
        return { ...b, spans, nodes, sections: b.sections.filter((s) => s.x <= L + 1e-9) };
    });
    const [show, setShow] = useState({ T: true, SLE: false });
    // cursore di sezione condiviso dai disegni: sezione esistente da spostare (id)
    // oppure posizione di una nuova sezione (x)
    const Ltot = beam.spans.reduce((t, sp) => t + num(sp.L), 0);
    const [cur, setCur] = useState({ id: null, x: null });
    const curSec = cur.id ? beam.sections.find((q) => q.id === cur.id) ?? null : null;
    const curX = curSec ? curSec.x : Math.min(Ltot, cur.x ?? Math.round((Ltot / 2) * 1000) / 1000);
    const clampX = (x) => Math.round(Math.min(Ltot, Math.max(0, x)) * 1000) / 1000;
    const moveTo = (x) => {
        if (!Number.isFinite(x)) return;
        const xr = clampX(x);
        if (curSec) upd((b) => ({ ...b, sections: b.sections.map((q) => (q.id === curSec.id ? { ...q, x: xr } : q)).sort((p, q) => p.x - q.x) }));
        else setCur({ id: null, x: xr });
    };
    // clic sui disegni: nuova sezione, che diventa quella attiva del cursore
    const pick = (x) => { const id = addSection(x); if (id) setCur({ id, x: null }); };
    const cursor = { x: curX, isNew: !curSec };
    // ogni box apre la sezione sulla propria verifica
    const openAt = (step) => (sid) => openSection(sid, step);
    const barFor = (step) => <SectionCursorBar beam={beam} L={Ltot} curSec={curSec} curX={curX} setCur={setCur} moveTo={moveTo}
        onAdd={() => { const id = addSection(curX); if (id) setCur({ id, x: null }); }} onOpen={openAt(step)} />;
    const [editOpen, setEditOpen] = useState(false);
    const [showReac, setShowReac] = useState(true);
    const editBtn = (
        <button type="button" onClick={() => setEditOpen(true)} className="inline-flex items-center gap-1.5 rounded-full bg-sky-600 px-3 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-sky-700">
            <Pencil size={13} /> Modifica trave
        </button>
    );

    return (
        <div className="space-y-4">
            {/* -------- DATI: pannello laterale, i disegni restano a tutta larghezza -------- */}
            {editOpen && <EditDrawer title={`Trave ${beam.name}`} onClose={() => setEditOpen(false)}>
                <Card title="Trave">
                    <div className="grid grid-cols-2 gap-3">
                        <TextField label="Nome" value={beam.name} onChange={(v) => upd((b) => ({ ...b, name: v }))} />
                        <SelField label="Piano" value={floorId} onChange={onMoveFloor} options={floors.map((f) => ({ value: f.id, label: f.name }))} />
                        <NumField label="Base b" unit="mm" value={beam.section.b} onChange={(v) => setSec("b", v)} />
                        <NumField label="Altezza h" unit="mm" value={beam.section.h} onChange={(v) => setSec("h", v)} />
                        <NumField label="Copriferro (asse barre)" unit="mm" value={beam.section.c} onChange={(v) => setSec("c", v)} />
                        <div />
                        <SelField label="Calcestruzzo" value={beam.section.fck} onChange={(v) => setSec("fck", num(v))} options={CONCRETE_CLASSES.map((c) => ({ value: c.fck, label: c.id }))} />
                        <SelField label="Acciaio" value={beam.section.fyk} onChange={(v) => setSec("fyk", num(v))} options={STEEL_GRADES.filter((s, i, a) => a.findIndex((t) => t.fyk === s.fyk) === i).map((s) => ({ value: s.fyk, label: s.id }))} />
                    </div>
                    <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-600">
                        <input type="checkbox" checked={beam.selfWeight} onChange={(e) => upd((b) => ({ ...b, selfWeight: e.target.checked }))} className="h-4 w-4 accent-sky-600" />
                        Peso proprio in g₁ (25 kN/m³ · b · h = {fmt((25 * beam.section.b * beam.section.h) / 1e6, 2)} kN/m)
                    </label>
                </Card>

                <Card title="Schema statico e carichi">
                    <p className="mb-2 text-[11px] leading-4 text-slate-500">Vincoli ai nodi e, sugli appoggi interni, continuità della trave (continua) o cerniera (sconnessa). Carichi distribuiti per campata, verso il basso.</p>
                    <div className="space-y-2">
                        {beam.nodes.map((nd, i) => {
                            const internal = i > 0 && i < beam.nodes.length - 1;
                            return (
                                <div key={i}>
                                    <div className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
                                        <span className="w-14 text-xs font-bold text-slate-600">Nodo {i + 1}</span>
                                        <select value={nd.type} onChange={(e) => setNode(i, "type", e.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs">
                                            {SUPPORT_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                                        </select>
                                        {internal && (
                                            <div className="inline-flex rounded-lg bg-white p-0.5 ring-1 ring-slate-200">
                                                {[{ v: true, l: "Continua" }, { v: false, l: "Sconnessa" }].map((o) => (
                                                    <button key={o.l} type="button" onClick={() => setNode(i, "continuous", o.v)}
                                                        className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${nd.continuous !== false === o.v ? "bg-sky-600 text-white" : "text-slate-500 hover:text-slate-700"}`}>{o.l}</button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    {i < beam.spans.length && (
                                        <div className="ml-4 mt-2 border-l-2 border-sky-100 pl-3">
                                            <div className="mb-1 flex items-center justify-between">
                                                <span className="text-xs font-semibold text-sky-700">Campata {i + 1}</span>
                                                {beam.spans.length > 1 && <MiniBtn title="Rimuovi campata" onClick={() => removeSpan(i)}><Trash2 size={12} /></MiniBtn>}
                                            </div>
                                            <div className="grid grid-cols-4 gap-2">
                                                <NumField small label="L" unit="m" value={beam.spans[i].L} onChange={(v) => setSpan(i, "L", v)} />
                                                <NumField small label="g₁" unit="kN/m" value={beam.spans[i].g1} onChange={(v) => setSpan(i, "g1", v)} />
                                                <NumField small label="g₂" unit="kN/m" value={beam.spans[i].g2} onChange={(v) => setSpan(i, "g2", v)} />
                                                <NumField small label="q" unit="kN/m" value={beam.spans[i].q} onChange={(v) => setSpan(i, "q", v)} />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    <button type="button" onClick={addSpan} className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-sky-300 px-3 py-1.5 text-xs font-semibold text-sky-700 transition hover:bg-sky-50">
                        <Plus size={13} /> Aggiungi campata
                    </button>
                </Card>

                <Card title="Carico variabile">
                    <SelField label="Categoria d'uso (ψ per le combinazioni SLE)" value={beam.category} onChange={(v) => upd((b) => ({ ...b, category: v }))}
                        options={USE_CATEGORIES.map((c) => ({ value: c.id, label: `${c.label} (ψ₁ ${c.psi1}, ψ₂ ${c.psi2})` }))} />
                </Card>

                <Card title="Traslazione del momento">
                    <div className="grid grid-cols-2 gap-2">
                        <NumField small label="cot θ (bielle)" value={beam.cotTheta} onChange={(v) => upd((b) => ({ ...b, cotTheta: Math.min(2.5, Math.max(1, v)) }))} />
                        <NumField small label="α staffe" unit="°" value={beam.alphaDeg} onChange={(v) => upd((b) => ({ ...b, alphaDeg: Math.min(90, Math.max(45, v)) }))} />
                    </div>
                    <p className="mt-2 text-xs text-slate-600">{sub("a_l = 0,9·d·(cot θ − cot α)/2")} = <b>{an.ok ? fmt(an.aL * 100, 1) : "–"} cm</b> (d = {an.ok ? fmt(an.d * 1000, 0) : "–"} mm)</p>
                    <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-600">
                        <input type="checkbox" checked={beam.useTranslated !== false} onChange={(e) => upd((b) => ({ ...b, useTranslated: e.target.checked }))} className="h-4 w-4 accent-sky-600" />
                        Usa il diagramma traslato per il progetto delle sezioni
                    </label>
                </Card>
            </EditDrawer>}

            {/* -------- SCHEMA, DIAGRAMMI, SEZIONI -------- */}
            <div className="space-y-4">
                <CombinationCard beam={beam} upd={upd} an={an} />
                {!an.ok ? (
                    <Card right={editBtn}><div className="flex items-start gap-2 text-sm text-red-600"><AlertTriangle size={18} className="mt-0.5 shrink-0" /><ul>{an.errors.map((e) => <li key={e}>{e}</li>)}</ul></div></Card>
                ) : (
                    <>
                        <Card title={`Schema statico — ${beam.name}`} right={
                            <div className="flex flex-wrap items-center gap-2">
                                <label className="flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-slate-600">
                                    <input type="checkbox" checked={showReac} onChange={(e) => setShowReac(e.target.checked)} className="accent-amber-600" /> Reazioni
                                </label>
                                <button type="button" onClick={addCharacteristic} className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50">
                                    <Wand2 size={13} /> Sezioni caratteristiche
                                </button>
                                {editBtn}
                            </div>}>
                            <p className="mb-1 text-[11px] text-slate-500">Clicca sullo schema o sui diagrammi per aggiungere una sezione; clicca un marcatore per aprirla.</p>
                            <SchemeSVG beam={beam} onPick={pick} onOpen={openAt("design")} reac={showReac ? an.reac : null} an={an} cursor={cursor} />
                            {barFor("design")}
                            {showReac && (
                                <p className="mt-1 text-[11px] leading-4 text-slate-500">
                                    {sub("Reazioni allo SLU con tutte le campate caricate: q = q_d = γ_G1·g_1 + γ_G2·g_2 + γ_Q·q")}
                                    {" "}({an.qd.map((q, k) => `${an.qd.length > 1 ? `campata ${k + 1}: ` : ""}${fmt(q, 2)} kN/m`).join(", ")}).
                                    {" "}Se l'alternanza dei variabili dà una reazione maggiore, sotto la freccia compare anche il massimo dell'inviluppo.
                                </p>
                            )}
                        </Card>
                        <Card title="Momento flettente M [kNm]" right={
                            <div className="flex flex-wrap gap-3 text-[11px] font-semibold text-slate-600">
                                <label className="flex cursor-pointer items-center gap-1"><input type="checkbox" checked={show.T} onChange={(e) => setShow((s) => ({ ...s, T: e.target.checked }))} className="accent-violet-600" />traslato</label>
                                <label className="flex cursor-pointer items-center gap-1"><input type="checkbox" checked={show.SLE} onChange={(e) => setShow((s) => ({ ...s, SLE: e.target.checked }))} className="accent-green-600" />SLE</label>
                            </div>}>
                            <DiagramSVG beam={beam} an={an} kind="M" show={show} onPick={pick} onOpen={openAt("bending")} cursor={cursor} />
                            <Legend items={[[C_POS, "inviluppo SLU M_max"], [C_NEG, "inviluppo SLU M_min"], ...(show.T ? [[C_TRASL, `traslato (a_l = ${fmt(an.aL * 100, 1)} cm)`, true]] : []), ...(show.SLE ? [[C_SLE, "SLE rara", true]] : [])]} />
                            {barFor("bending")}
                        </Card>
                        <Card title="Taglio V [kN]">
                            <DiagramSVG beam={beam} an={an} kind="V" show={show} onPick={pick} onOpen={openAt("shear")} cursor={cursor} />
                            <Legend items={[[C_V, "inviluppo SLU V_max / V_min"]]} />
                            {barFor("shear")}
                        </Card>
                        <InfluenceCard beam={beam} an={an} />
                        <CrackCard beam={beam} an={an} onPick={pick} onOpen={openAt("crack")} cursor={cursor} bar={barFor("crack")} />
                        <DeflectionCard beam={beam} an={an} upd={upd} onPick={pick} onOpen={openAt("defl")} cursor={cursor} bar={barFor("defl")} />
                        <SectionsTable beam={beam} an={an} upd={upd} openSection={openSection} />
                    </>
                )}
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// COMBINAZIONE DI CARICO (NTC 2018 §2.5.3): carichi caratteristici per campata,
// coefficienti γ e ψ, carichi di combinazione SLU e SLE
// ---------------------------------------------------------------------------
function CombinationCard({ beam, upd, an }) {
    const g = beam.gamma;
    const setG = (k) => (v) => upd((b) => ({ ...b, gamma: { ...b.gamma, [k]: v } }));
    const [edit, setEdit] = useState(null);         // { j, k } carico in composizione
    const [info, setInfo] = useState(false);        // modal con le formule delle combinazioni
    const [list, setList] = useState(false);        // modal con tutte le combinazioni eseguite
    // conferma della composizione: totale nel carico della campata (o di tutte) e voci salvate
    const saveItems = (j, k, items, all) => upd((b) => ({
        ...b,
        spans: b.spans.map((sp, i) => (all || i === j
            ? { ...sp, [k]: Math.round(items.reduce((t, it) => t + itemValue(it), 0) * 1e4) / 1e4, items: { ...(sp.items ?? {}), [k]: items.map((it) => ({ ...it })) } }
            : sp)),
    }));
    // carico di ogni stato per campata: il massimo sulle combinazioni dello stato
    const LC = loadCombinations(beam);
    const maxQ = (st, j) => Math.max(...LC.combos.filter((c) => c.state === st).map((c) => c.q[j]));
    const rows = beam.spans.map((_, j) => ({ slu: maxQ("U", j), rara: maxQ("R", j), freq: maxQ("F", j), qp: maxQ("Q", j) }));
    const nComb = LC.combos.length;
    const cell = "px-2 py-1.5 text-right tabular-nums";
    const unit = <span className="font-normal text-slate-400">[kN/m]</span>;   // unità nelle intestazioni
    const loadBtn = (sp, j, k) => {
        const n = sp.items?.[k]?.length ?? 0;
        const multi = k === "q" && spanVariable(sp, beam).multi;
        return (
            <button type="button" onClick={() => setEdit({ j, k })} title="Componi il carico con più voci"
                className="inline-flex min-w-[72px] items-center justify-end gap-1 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-xs tabular-nums text-slate-800 transition hover:border-sky-400 hover:bg-sky-50">
                {multi ? <span className="rounded bg-amber-50 px-1 text-[10px] font-semibold text-amber-700" title="Categorie diverse: combinate con un'azione principale">più categorie</span>
                    : n > 1 && <span className="rounded bg-slate-100 px-1 text-[10px] font-semibold text-slate-500">{n} voci</span>}
                {fmt(num(sp[k]), 2)}
            </button>
        );
    };
    return (
        <Card title={
            <span className="inline-flex items-center gap-1.5">
                Combinazioni di carico
                <button type="button" onClick={() => setInfo(true)} title="Formule delle combinazioni" aria-label="Formule delle combinazioni di carico"
                    className="rounded-full p-0.5 text-slate-400 transition hover:bg-sky-50 hover:text-sky-600"><Info size={15} /></button>
            </span>} subtitle={sub("Carichi distribuiti in kN/m: g_1 strutturali (più il peso proprio, se attivo), g_2 permanenti non strutturali, q_k variabile.")} right={
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-500">
                <button type="button" onClick={() => setList(true)} title="Elenco delle combinazioni eseguite, con la più gravosa"
                    className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50">
                    <ListChecks size={13} /> Tutte le combinazioni <span className="rounded-full bg-slate-100 px-1.5 text-[10px] text-slate-500">{nComb}</span>
                </button>
                {/* coefficienti parziali compatti nell'intestazione */}
                {[["g1", "γ_G1"], ["g2", "γ_G2"], ["q", "γ_Q"]].map(([k, l]) => (
                    <label key={k} className="inline-flex items-center gap-1">
                        {sub(l)}
                        <input type="number" step="0.05" value={g[k]} onChange={(e) => setG(k)(num(e.target.value))} aria-label={l}
                            className="w-14 rounded-md border border-slate-200 px-1.5 py-0.5 text-right text-xs tabular-nums text-slate-700 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100" />
                    </label>
                ))}
            </div>}>
            <div>
                {/* carichi per campata */}
                <div className="scroll-thin-x pb-1">
                    <table className="w-full min-w-[640px] text-xs">
                        <thead>
                            <tr className="border-b border-slate-200 text-[11px] text-slate-500">
                                <th className="px-2 py-1.5 text-left font-semibold">Campata</th>
                                <th className={cell}>{sub("g_1")} {unit}</th>
                                <th className={cell}>{sub("g_2")} {unit}</th>
                                <th className={cell}>{sub("q_k")} {unit}</th>
                                <th className={`${cell} bg-sky-50 text-sky-800`} title="Massimo sulle combinazioni SLU">{sub("SLU q_d")} {unit}</th>
                                <th className={cell}>SLE rara {unit}</th>
                                <th className={cell}>SLE frequente {unit}</th>
                                <th className={cell}>SLE quasi perm. {unit}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {beam.spans.map((sp, j) => (
                                <tr key={j} className="border-b border-slate-100">
                                    <td className="px-2 py-1.5 font-semibold text-slate-700">{j + 1} <span className="font-normal text-slate-400">· L = {fmt(num(sp.L), 2)} m</span></td>
                                    <td className={cell}>{loadBtn(sp, j, "g1")}</td>
                                    <td className={cell}>{loadBtn(sp, j, "g2")}</td>
                                    <td className={cell}>{loadBtn(sp, j, "q")}</td>
                                    <td className={`${cell} bg-sky-50 font-bold text-sky-800`}>{fmt(rows[j].slu, 2)}</td>
                                    <td className={cell}>{fmt(rows[j].rara, 2)}</td>
                                    <td className={cell}>{fmt(rows[j].freq, 2)}</td>
                                    <td className={cell}>{fmt(rows[j].qp, 2)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {/* combinazioni più gravose: il dettaglio nel modal */}
                {an.ok && (
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                        <span className="font-semibold text-slate-600">Più gravose:</span>
                        {COMBO_STATES.map((st) => {
                            const c = an.combos.find((x) => x.id === an.governing[st.id].id);
                            return (
                                <button key={st.id} type="button" onClick={() => setList(true)} className="rounded-md px-1 text-left transition hover:bg-sky-50 hover:text-sky-700">
                                    {comboName(c, an.combos)}{c.lead !== null && an.acts.length > 1 && <> ({sub(`Q_${c.lead + 1}`)} principale)</>}
                                </button>
                            );
                        })}
                        <span className="text-slate-400">I valori in tabella sono i massimi per campata fra le combinazioni di ciascuno stato.</span>
                    </div>
                )}
            </div>
            {info && <CombinationInfoModal onClose={() => setInfo(false)} />}
            {list && <AllCombinationsModal beam={beam} an={an} lc={LC} onClose={() => setList(false)} />}
            {edit && <LoadModal beam={beam} j={edit.j} k={edit.k} onClose={() => setEdit(null)} onSave={(items, all) => { saveItems(edit.j, edit.k, items, all); setEdit(null); }} />}
        </Card>
    );
}

// ---------------------------------------------------------------------------
// FORMULE DELLE COMBINAZIONI (NTC 2018 §2.5.3): solo la teoria della norma
// ---------------------------------------------------------------------------
function CombinationInfoModal({ onClose }) {
    const { isVisible, close, finishClose } = useModalTransition(onClose);
    useEffect(() => {
        const onKey = (e) => { if (e.key === "Escape") close(); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [close]);
    const item = (n, title, tex) => (
        <li className="space-y-1">
            <p className="text-sm font-semibold text-slate-700">{n}. {title}</p>
            <div className="text-base"><Tex display>{tex}</Tex></div>
        </li>
    );
    return toModalRoot(
        <div className={`fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/30 p-4 ${modalBackdropCls(isVisible)}`} onTransitionEnd={finishClose} role="dialog" aria-modal="true" aria-label="Combinazioni di carico"
            onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
            <div className={`flex max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl ${modalPanelCls(isVisible)}`}>
                <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
                    <p className="text-sm font-bold text-slate-800">Combinazioni di carico <span className="font-normal text-slate-400">· NTC 2018 §2.5.3</span></p>
                    <button type="button" onClick={close} aria-label="Chiudi" className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100"><X size={16} /></button>
                </div>
                <div className="scroll-thin min-h-0 flex-1 space-y-5 py-5 pl-6 pr-5">
                    <section>
                        <p className="text-sm font-bold text-slate-800">Ciclo sull'azione variabile dominante (<Tex>{String.raw`k=1\ldots n`}</Tex>):</p>
                        <ol className="mt-2 space-y-3 pl-4">
                            {item(1, "SLU (EQU / STR / GEO):", String.raw`\gamma_{G1}G_1+\gamma_{G2}G_2+\gamma_{Qk}Q_k+\sum_{j\neq k}\gamma_{Qj}\,\psi_{0j}\,Q_j`)}
                            {item(2, "SLE Rara:", String.raw`G_1+G_2+Q_k+\sum_{j\neq k}\psi_{0j}\,Q_j`)}
                        </ol>
                    </section>
                    <section>
                        <p className="text-sm font-bold text-slate-800">Combinazioni SLE senza variabile dominante:</p>
                        <ol className="mt-2 space-y-3 pl-4">
                            {item(1, "SLE Frequente:", String.raw`G_1+G_2+\psi_{11}\,Q_1+\sum_{j>1}\psi_{2j}\,Q_j`)}
                            {item(2, "SLE Quasi permanente:", String.raw`G_1+G_2+\sum_{j\geq 1}\psi_{2j}\,Q_j`)}
                        </ol>
                    </section>
                </div>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// TUTTE LE COMBINAZIONI ESEGUITE: per ogni stato limite il ciclo sull'azione
// variabile dominante, i carichi per campata e gli effetti massimi; evidenziata
// la combinazione più gravosa (massimo |M|) e, colonna per colonna, quella che
// dà il massimo di ciascun effetto
// ---------------------------------------------------------------------------
const stateOf = (id) => COMBO_STATES.find((s) => s.id === id);
function comboName(c, combos) {
    const st = stateOf(c.state);
    return combos.filter((x) => x.state === c.state).length > 1 ? `${st.label} ${c.index}` : st.label;
}
// numero per TeX con la virgola decimale
const texN = (v) => String(Math.round(v * 1000) / 1000).replace(".", "{,}");
// espressione della combinazione con i coefficienti numerici della norma
function comboTex(c, acts, gm) {
    const g = c.state === "U" ? String.raw`${texN(gm.g1)}\,G_1+${texN(gm.g2)}\,G_2` : "G_1+G_2";
    const terms = acts.map((a, i) => {
        const lead = i === c.lead, Q = `Q_{${i + 1}}`;
        if (c.state === "U") return lead ? String.raw`${texN(gm.q)}\,${Q}` : a.c.psi0 ? String.raw`${texN(gm.q)}\cdot${texN(a.c.psi0)}\,${Q}` : null;
        if (c.state === "R") return lead ? Q : a.c.psi0 ? String.raw`${texN(a.c.psi0)}\,${Q}` : null;
        if (c.state === "F") return lead ? (a.c.psi1 ? String.raw`${texN(a.c.psi1)}\,${Q}` : null) : a.c.psi2 ? String.raw`${texN(a.c.psi2)}\,${Q}` : null;
        return a.c.psi2 ? String.raw`${texN(a.c.psi2)}\,${Q}` : null;
    }).filter(Boolean);
    return [g, ...terms].join("+");
}
function AllCombinationsModal({ beam, an, lc, onClose }) {
    const { isVisible, close, finishClose } = useModalTransition(onClose);
    useEffect(() => {
        const onKey = (e) => { if (e.key === "Escape") close(); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [close]);
    const acts = lc.acts, nS = beam.spans.length;
    const combos = an.ok ? an.combos : lc.combos;
    const spansTxt = (sp) => (!sp?.length ? "variabili scaricati" : sp.length === nS && nS > 1 ? "Q su tutte le campate" : `Q su ${sp.length > 1 ? "campate" : "campata"} ${sp.map((k) => k + 1).join(", ")}`);
    const th = "px-2 py-1.5 font-semibold";
    const effect = (c, key, gov) => {
        const e = c[key];
        if (!an.ok || !e) return <td className="px-2 py-1.5 text-right text-slate-400">–</td>;
        const isGov = gov[key] === c.id;
        return (
            <td className={`px-2 py-1.5 text-right align-top tabular-nums ${isGov ? "font-bold text-slate-900" : "text-slate-600"}`}>
                <span className={isGov ? "rounded bg-amber-100 px-1" : ""}>{fmt(e.v, 1)}</span>
                <span className="block whitespace-nowrap text-[10px] font-normal leading-3 text-slate-400">x = {fmt(e.x, 2)} m · {spansTxt(e.spans)}</span>
            </td>
        );
    };
    return toModalRoot(
        <div className={`fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/30 p-4 ${modalBackdropCls(isVisible)}`} onTransitionEnd={finishClose} role="dialog" aria-modal="true" aria-label="Combinazioni eseguite"
            onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
            <div className={`flex h-[min(44rem,calc(100vh-2rem))] w-full max-w-6xl flex-col rounded-2xl bg-white shadow-2xl ${modalPanelCls(isVisible)}`}>
                <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-3">
                    <div>
                        <p className="text-sm font-bold text-slate-800">Combinazioni eseguite — {beam.name} <span className="font-normal text-slate-400">· NTC 2018 §2.5.3</span></p>
                        <p className="text-[11px] text-slate-500">Per ogni combinazione i variabili si dispongono solo sulle campate dove aggravano l'effetto (alternanza dei carichi); evidenziata la più gravosa di ogni stato (massimo |M|) e, per colonna, il valore massimo.</p>
                    </div>
                    <button type="button" onClick={close} aria-label="Chiudi" className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100"><X size={16} /></button>
                </div>
                <div className="scroll-thin min-h-0 flex-1 space-y-5 py-4 pl-5 pr-4">
                    {/* azioni */}
                    <section>
                        <p className="mb-1.5 text-xs font-bold text-slate-700">Azioni [kN/m]</p>
                        <div className="scroll-thin-x pb-1">
                            <table className="w-full min-w-[560px] text-xs">
                                <thead>
                                    <tr className="border-b border-slate-200 text-[11px] text-slate-500">
                                        <th className={`${th} text-left`}>Azione</th>
                                        <th className={`${th} text-left`}>Categoria</th>
                                        <th className={`${th} text-right`}>{sub("ψ_0")}</th>
                                        <th className={`${th} text-right`}>{sub("ψ_1")}</th>
                                        <th className={`${th} text-right`}>{sub("ψ_2")}</th>
                                        {beam.spans.map((_, j) => <th key={j} className={`${th} text-right`}>Campata {j + 1}</th>)}
                                    </tr>
                                </thead>
                                <tbody>
                                    {[["G_1", "permanenti strutturali" + (beam.selfWeight ? " (con peso proprio)" : ""), lc.G1], ["G_2", "permanenti non strutturali", lc.G2]].map(([n, d, v]) => (
                                        <tr key={n} className="border-b border-slate-100">
                                            <td className="px-2 py-1.5 font-semibold text-slate-700">{sub(n)}</td>
                                            <td className="px-2 py-1.5 text-slate-500" colSpan={4}>{d}</td>
                                            {v.map((x, j) => <td key={j} className="px-2 py-1.5 text-right tabular-nums">{fmt(x, 2)}</td>)}
                                        </tr>
                                    ))}
                                    {acts.map((a, i) => (
                                        <tr key={a.c.id} className="border-b border-slate-100">
                                            <td className="px-2 py-1.5 font-semibold text-slate-700">{sub(`Q_${i + 1}`)}</td>
                                            <td className="px-2 py-1.5 text-slate-600">{a.c.label}</td>
                                            <td className="px-2 py-1.5 text-right tabular-nums">{fmt(a.c.psi0, 1)}</td>
                                            <td className="px-2 py-1.5 text-right tabular-nums">{fmt(a.c.psi1, 1)}</td>
                                            <td className="px-2 py-1.5 text-right tabular-nums">{fmt(a.c.psi2, 1)}</td>
                                            {a.Q.map((x, j) => <td key={j} className="px-2 py-1.5 text-right tabular-nums">{fmt(x, 2)}</td>)}
                                        </tr>
                                    ))}
                                    {!acts.length && <tr><td colSpan={5 + nS} className="px-2 py-1.5 text-slate-400">Nessun carico variabile.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </section>
                    {/* combinazioni per stato limite */}
                    {COMBO_STATES.map((st) => {
                        const list = combos.filter((c) => c.state === st.id);
                        const gov = an.ok ? an.governing[st.id] : {};
                        return (
                            <section key={st.id}>
                                <p className="mb-1.5 text-xs font-bold text-slate-700">{st.long}
                                    <span className="ml-2 font-normal text-slate-400">{st.id === "Q" ? "senza variabile dominante"
                                        : st.id === "F" ? `ψ₁ a rotazione su ciascuna azione, le altre con ψ₂ · ${list.length} ${list.length === 1 ? "combinazione" : "combinazioni"}`
                                            : `ciclo sull'azione dominante k = 1…n · ${list.length} ${list.length === 1 ? "combinazione" : "combinazioni"}`}</span>
                                </p>
                                <div className="scroll-thin-x pb-1">
                                    <table className="w-full min-w-[900px] text-xs">
                                        <thead>
                                            <tr className="border-b border-slate-200 text-[11px] text-slate-500">
                                                <th className={`${th} w-36 text-left`}>Combinazione</th>
                                                <th className={`${th} text-left`}>Espressione</th>
                                                {beam.spans.map((_, j) => <th key={j} className={`${th} text-right`}>q camp. {j + 1} <span className="font-normal text-slate-400">[kN/m]</span></th>)}
                                                <th className={`${th} text-right`}>{sub("M_max")} <span className="font-normal text-slate-400">[kNm]</span></th>
                                                <th className={`${th} text-right`}>{sub("M_min")} <span className="font-normal text-slate-400">[kNm]</span></th>
                                                <th className={`${th} text-right`}>|V|<sub>max</sub> <span className="font-normal text-slate-400">[kN]</span></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {list.map((c) => {
                                                const isGov = an.ok && gov.id === c.id;
                                                return (
                                                    <tr key={c.id} className={`border-b border-slate-100 ${isGov ? "bg-amber-50/70" : ""}`}>
                                                        <td className="px-2 py-1.5 align-top">
                                                            <p className="font-semibold text-slate-700">{comboName(c, combos)}</p>
                                                            {c.lead !== null && acts.length > 1 && <p className="text-[10px] text-slate-500">{sub(`Q_${c.lead + 1}`)} principale</p>}
                                                            {isGov && <span className="mt-0.5 inline-block rounded-full bg-amber-500 px-1.5 py-px text-[10px] font-bold text-white">più gravosa</span>}
                                                        </td>
                                                        <td className="whitespace-nowrap px-2 py-1.5 align-top text-[13px]"><Tex>{comboTex(c, acts, lc.gamma)}</Tex></td>
                                                        {c.q.map((q, j) => <td key={j} className="px-2 py-1.5 text-right align-top tabular-nums text-slate-700">{fmt(q, 2)}</td>)}
                                                        {effect(c, "Mmax", gov)}
                                                        {effect(c, "Mmin", gov)}
                                                        {effect(c, "Vabs", gov)}
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </section>
                        );
                    })}
                    {!an.ok && <p className="text-xs text-red-600">Schema non risolvibile: gli effetti delle combinazioni non sono disponibili.</p>}
                </div>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// COMPOSIZIONE DI UN CARICO (g1, g2 o qk di una campata): più voci sommate.
// Ogni voce è un carico per unità di superficie per la larghezza d'influenza
// [kN/m² × m] oppure direttamente un carico lineare [kN/m].
// ---------------------------------------------------------------------------
const LOAD_NAMES = { g1: ["g_1", "permanenti strutturali"], g2: ["g_2", "permanenti non strutturali"], q: ["q_k", "variabile"] };
function LoadModal({ beam, j, k, onClose, onSave }) {
    const sp = beam.spans[j];
    const { isVisible, close, finishClose } = useModalTransition(onClose);
    const [items, setItems] = useState(() => (sp.items?.[k]?.length
        ? sp.items[k].map((it) => ({ ...it }))
        : [{ id: newId("v"), label: "", mode: "line", value: num(sp[k]), width: 1, ...(k === "q" ? { cat: beam.category } : {}) }]));
    const [all, setAll] = useState(false);
    const set = (id, patch) => setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    const total = items.reduce((t, it) => t + itemValue(it), 0);
    const [sym, desc] = LOAD_NAMES[k];
    useEffect(() => {
        const onKey = (e) => { if (e.key === "Escape") close(); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [close]);
    const field = "rounded-md border border-slate-200 px-2 py-1 text-xs outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100";
    return toModalRoot(
        <div className={`fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/30 p-4 ${modalBackdropCls(isVisible)}`} onTransitionEnd={finishClose} role="dialog" aria-modal="true" aria-label={`Carico ${sym} campata ${j + 1}`}
            onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
            {/* dimensioni fisse: aggiungendo voci il modal non cresce, scorre l'elenco */}
            <div className={`flex h-[min(32rem,calc(100vh-2rem))] w-full flex-col rounded-2xl bg-white shadow-2xl ${k === "q" ? "max-w-4xl" : "max-w-3xl"} ${modalPanelCls(isVisible)}`}>
                <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-3">
                    <div>
                        <p className="text-sm font-bold text-slate-800">{sub(sym)} – {desc} · campata {j + 1} ({fmt(num(sp.L), 2)} m)</p>
                        <p className="text-[11px] text-slate-500">Voci sommate in un unico carico distribuito sulla trave{k === "g1" && beam.selfWeight ? " (il peso proprio della trave si aggiunge a parte)" : ""}.</p>
                    </div>
                    <button type="button" onClick={close} aria-label="Chiudi" className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100"><X size={16} /></button>
                </div>
                <div className="scroll-thin min-h-0 flex-1 space-y-2 py-4 pl-5 pr-4">
                    {items.map((it, i) => (
                        <div key={it.id} className={`grid items-center gap-2 ${k === "q" ? "grid-cols-[1.5rem_minmax(0,1fr)_9.5rem_8rem_15rem_6rem_auto]" : "grid-cols-[1.5rem_minmax(0,1fr)_8rem_17rem_6.5rem_auto]"}`}>
                            {/* numero progressivo del carico */}
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-600">{i + 1}</span>
                            <input value={it.label} onChange={(e) => set(it.id, { label: e.target.value })} placeholder={`Voce ${i + 1} (es. ${k === "q" ? "uso residenziale" : k === "g1" ? "solaio" : "massetto + pavimento"})`}
                                aria-label={`Descrizione voce ${i + 1}`} className={`${field} min-w-0`} />
                            {k === "q" && (
                                <select value={it.cat ?? beam.category} onChange={(e) => set(it.id, { cat: e.target.value })} aria-label={`Categoria voce ${i + 1}`}
                                    title={(() => { const c = USE_CATEGORIES.find((u) => u.id === (it.cat ?? beam.category)); return c ? `ψ0 = ${c.psi0}, ψ1 = ${c.psi1}, ψ2 = ${c.psi2}` : undefined; })()}
                                    className={`${field} w-full cursor-pointer bg-white`}>
                                    {USE_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                                </select>
                            )}
                            <select value={it.mode} onChange={(e) => set(it.id, { mode: e.target.value })} aria-label={`Tipo voce ${i + 1}`} className={`${field} w-full cursor-pointer bg-white`}>
                                <option value="line">kN/m</option>
                                <option value="area">kN/m² × b</option>
                                <option value="volume">kN/m³ × b × h</option>
                            </select>
                            {/* valori con le unità: gli input si dividono sempre tutta la larghezza della colonna */}
                            <div className="flex items-center gap-1">
                                {[
                                    { key: "value", unit: it.mode === "area" ? "kN/m²" : it.mode === "volume" ? "kN/m³" : "kN/m", label: "Valore", title: it.mode === "volume" ? "Peso dell'unità di volume γ" : undefined },
                                    ...(it.mode !== "line" ? [{ key: "width", unit: "m", label: "Larghezza", title: it.mode === "area" ? "Larghezza d'influenza b" : "Larghezza b" }] : []),
                                    ...(it.mode === "volume" ? [{ key: "height", unit: "m", label: "Altezza", title: "Altezza (spessore) h" }] : []),
                                ].map((c, n) => (
                                    <div key={c.key} className="flex min-w-0 flex-1 items-center gap-1">
                                        {n > 0 && <span className="text-xs text-slate-400">×</span>}
                                        <input type="number" step="any" value={it[c.key] ?? 1} onChange={(e) => set(it.id, { [c.key]: e.target.value })} title={c.title}
                                            aria-label={`${c.label} voce ${i + 1}`} className={`${field} w-full min-w-0 text-right tabular-nums`} />
                                        <span className="shrink-0 text-[11px] text-slate-400">{c.unit}</span>
                                    </div>
                                ))}
                            </div>
                            <span className="text-right text-xs font-semibold tabular-nums text-slate-700">= {fmt(itemValue(it), 2)} kN/m</span>
                            <button type="button" onClick={() => setItems((xs) => xs.filter((x) => x.id !== it.id))} disabled={items.length < 2} aria-label={`Elimina voce ${i + 1}`}
                                className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-red-600 disabled:opacity-30"><Trash2 size={13} /></button>
                        </div>
                    ))}
                    <button type="button" onClick={() => setItems((xs) => [...xs, { id: newId("v"), label: "", mode: "area", value: 0, width: xs.find((x) => x.mode === "area")?.width ?? 1, ...(k === "q" ? { cat: xs[xs.length - 1]?.cat ?? beam.category } : {}) }])}
                        className="inline-flex items-center gap-1 rounded-lg border border-dashed border-sky-300 px-2.5 py-1 text-xs font-semibold text-sky-700 hover:bg-sky-50"><Plus size={13} /> Aggiungi voce</button>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-3">
                    <div>
                        <p className="text-sm font-bold text-slate-800">{sub(sym)} = {fmt(total, 2)} kN/m</p>
                        {k === "q" && (() => {
                            const v = spanVariable({ ...sp, items: { ...(sp.items ?? {}), q: items } }, beam);
                            return v.multi && (
                                <p className="mt-0.5 text-[11px] text-amber-700">
                                    {sub(`Categorie diverse, combinate con un'azione principale: SLU/rara ${fmt(v.u, 2)} · frequente ${fmt(v.f, 2)} · quasi perm. ${fmt(v.qp, 2)} kN/m`)}
                                </p>
                            );
                        })()}
                        {beam.spans.length > 1 && (
                            <label className="mt-1 flex cursor-pointer items-center gap-1.5 text-xs text-slate-600">
                                <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} className="accent-sky-600" /> Applica a tutte le campate
                            </label>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <button type="button" onClick={close} className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">Annulla</button>
                        <button type="button" onClick={() => close(() => onSave(items, all))} className="rounded-xl bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-sky-700">Conferma</button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// SCHEMA STATICO (anche in miniatura) E DIAGRAMMI
// ---------------------------------------------------------------------------
const W = 1100, ML = 56, MR = 40;
const useX = (L) => (x) => ML + (x / (L || 1)) * (W - ML - MR);
// ascissa del puntatore → x [m]
function pickX(e, svg, L) {
    const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    const loc = pt.matrixTransform(svg.getScreenCTM().inverse());
    return { x: ((loc.x - ML) / (W - ML - MR)) * L, sx: loc.x, sy: loc.y };
}

function SchemeSVG({ beam, mini = false, onPick = null, onOpen = null, reac = null, an = null, cursor = null }) {
    const L = beam.spans.reduce((t, s) => t + num(s.L), 0);
    const X = useX(L);
    const ref = useRef(null);
    // miniatura: stesse proporzioni a larghezza ridotta; con le reazioni serve spazio sotto i vincoli
    const H = mini ? 94 : reac ? 250 : 190, yB = mini ? 48 : 112;
    const nodesX = []; let acc = 0;
    nodesX.push(0); beam.spans.forEach((s) => { acc += num(s.L); nodesX.push(acc); });
    const gS = beam.selfWeight ? (25 * beam.section.b * beam.section.h) / 1e6 : 0;
    const maxLoad = Math.max(1, ...beam.spans.map((s) => num(s.g1) + num(s.g2) + gS + num(s.q)));
    const lk = (mini ? 0 : 46) / maxLoad;
    const support = (nd, i) => {
        const x = X(nodesX[i]), s = mini ? 0.95 : 1;
        if (nd.type === "pin") return <g key={i}><path d={`M${x},${yB + 2} l${-9 * s},${15 * s} h${18 * s} z`} fill="#fff" stroke="#334155" strokeWidth="1.4" /><line x1={x - 13 * s} x2={x + 13 * s} y1={yB + 2 + 18 * s} y2={yB + 2 + 18 * s} stroke="#334155" strokeWidth="1.2" /></g>;
        if (nd.type === "fixed") {
            const dir = i === 0 ? -1 : i === beam.nodes.length - 1 ? 1 : 0;
            if (dir === 0) return <rect key={i} x={x - 8 * s} y={yB - 8 * s} width={16 * s} height={22 * s} fill="#e2e8f0" stroke="#334155" strokeWidth="1.3" />;
            const xw = x + dir * 3;
            return <g key={i}><line x1={xw} x2={xw} y1={yB - 18 * s} y2={yB + 18 * s} stroke="#334155" strokeWidth="2" />{Array.from({ length: 6 }, (_, k) => <line key={k} x1={xw} x2={xw + dir * 7 * s} y1={yB - 16 * s + k * 6.5 * s} y2={yB - 10 * s + k * 6.5 * s} stroke="#64748b" strokeWidth="1" />)}</g>;
        }
        return null;
    };
    const click = (e) => { if (!onPick || !ref.current) return; const p = pickX(e, ref.current, L); if (p.x >= -0.05 && p.x <= L + 0.05) onPick(p.x); };
    return (
        <svg ref={ref} viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Schema statico ${beam.name}`} onClick={click} style={onPick ? { cursor: "crosshair" } : undefined}>
            {/* carichi: permanenti (grigio) e variabile (azzurro tratteggiato) */}
            {!mini && beam.spans.map((s, j) => {
                const x0 = X(nodesX[j]), x1 = X(nodesX[j + 1]), g = num(s.g1) + num(s.g2) + gS, q = num(s.q);
                const hg = g * lk, hq = q * lk;
                return (
                    <g key={j}>
                        <rect x={x0} y={yB - 6 - hg} width={x1 - x0} height={hg} fill="#94a3b8" fillOpacity="0.25" stroke="#94a3b8" strokeWidth="0.8" />
                        {q > 0 && <rect x={x0} y={yB - 6 - hg - hq} width={x1 - x0} height={hq} fill={C_POS} fillOpacity="0.12" stroke={C_POS} strokeWidth="0.8" strokeDasharray="3 2" />}
                        <text x={(x0 + x1) / 2} y={yB - 10 - hg / 2 + 3} fontSize="10" textAnchor="middle" fill="#475569">g = {fmt(g, 1)}</text>
                        {q > 0 && <text x={(x0 + x1) / 2} y={yB - 10 - hg - hq / 2 + 3} fontSize="10" textAnchor="middle" fill={C_POS}>q = {fmt(q, 1)}</text>}
                        {/* quota della campata */}
                        <line x1={x0} x2={x1} y1={H - 18} y2={H - 18} stroke="#94a3b8" strokeWidth="0.8" />
                        <line x1={x0} x2={x0} y1={H - 23} y2={H - 13} stroke="#94a3b8" strokeWidth="0.8" />
                        <line x1={x1} x2={x1} y1={H - 23} y2={H - 13} stroke="#94a3b8" strokeWidth="0.8" />
                        <text x={(x0 + x1) / 2} y={H - 22} fontSize="10.5" textAnchor="middle" fill="#334155" fontWeight="600">L = {fmt(num(s.L), 2)} m</text>
                    </g>
                );
            })}
            <line x1={X(0)} x2={X(L)} y1={yB} y2={yB} stroke="#0f172a" strokeWidth={mini ? 2.5 : 3.5} strokeLinecap="round" />
            {beam.nodes.map(support)}
            {/* cerniere interne (trave sconnessa) */}
            {beam.nodes.map((nd, i) => (i > 0 && i < beam.nodes.length - 1 && nd.continuous === false
                ? <circle key={`h${i}`} cx={X(nodesX[i])} cy={yB} r={mini ? 3.5 : 5} fill="#fff" stroke="#0f172a" strokeWidth="1.6" />
                : null))}
            {/* reazioni vincolari (SLU, inviluppo): freccia verso l'alto sotto il vincolo, momento all'incastro */}
            {reac && reac.map((r) => {
                if (r.type === "free") return null;
                const x = X(nodesX[r.node]), y1 = yB + 70, y2 = yB + 30, up = r.Rfull >= 0;
                const envMax = Math.abs(r.Rmax - r.Rfull) > 0.005 * Math.max(1, Math.abs(r.Rfull));
                const lab = String.fromCharCode(65 + r.node);
                const right = r.node < beam.nodes.length - 1;           // etichetta verso l'interno della trave
                return (
                    <g key={`r${r.node}`} pointerEvents="none">
                        <defs><marker id={`rx${r.node}`} markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0,0 L7,4 L0,8 Z" fill="#b45309" /></marker></defs>
                        <line x1={x} x2={x} y1={up ? y1 : y2} y2={up ? y2 : y1} stroke="#b45309" strokeWidth="2" markerEnd={`url(#rx${r.node})`} />
                        {/* formuletta accanto alla freccia: R_A = 3/8·qL = 78,4 kN */}
                        <text x={x + (right ? 7 : -7)} y={y1 - 18} fontSize="11" fontWeight="bold" textAnchor={right ? "start" : "end"} fill="#b45309">
                            R<SubT>{lab}</SubT> = {an ? formulaNodes(r.cR, beam, an, 1) : null}
                        </text>
                        <text x={x + (right ? 7 : -7)} y={y1 - 4} fontSize="10.5" textAnchor={right ? "start" : "end"} fill="#b45309">= {fmt(r.Rfull, 1)} kN</text>
                        {envMax && <text x={x + (right ? 7 : -7)} y={y1 + 9} fontSize="9" textAnchor={right ? "start" : "end"} fill="#92400e">max inviluppo {fmt(r.Rmax, 1)} kN</text>}
                        {r.Rmin < -1e-6 && <text x={x + (right ? 7 : -7)} y={y1 + (envMax ? 21 : 9)} fontSize="9" textAnchor={right ? "start" : "end"} fill="#dc2626">min {fmt(r.Rmin, 1)} kN (sollevamento)</text>}
                        {r.type === "fixed" && (() => {
                            const M = r.Mfull, ccw = M >= 0, rr = 16, cx = x + (right ? -22 : 22);
                            const d = ccw ? `M${cx + rr},${yB} A${rr},${rr} 0 1 1 ${cx},${yB + rr}` : `M${cx - rr},${yB} A${rr},${rr} 0 1 0 ${cx},${yB + rr}`;
                            return (
                                <g>
                                    <path d={d} fill="none" stroke="#b45309" strokeWidth="1.6" markerEnd={`url(#rx${r.node})`} />
                                    <text x={right ? cx - rr - 4 : cx + rr + 4} y={yB - rr - 6} fontSize="10" fontWeight="bold" textAnchor={right ? "start" : "end"} fill="#b45309">M<SubT>{lab}</SubT> = {an ? formulaNodes(r.cM.map((c) => c * (M < 0 ? -1 : 1)), beam, an, 2) : null} = {fmt(Math.abs(M), 1)} kNm</text>
                                </g>
                            );
                        })()}
                    </g>
                );
            })}
            {/* sezioni */}
            {beam.sections.map((s) => (
                <g key={s.id} onClick={(e) => { e.stopPropagation(); onOpen?.(s.id); }} style={onOpen ? { cursor: "pointer" } : undefined}>
                    <line x1={X(s.x)} x2={X(s.x)} y1={yB - (mini ? 10 : 18)} y2={yB + (mini ? 10 : 18)} stroke={C_SEC} strokeWidth="1.4" strokeDasharray="3 2" />
                    {!mini && <>
                        <rect x={X(s.x) - 14} y={yB + 22} width="28" height="15" rx="7" fill={C_SEC} />
                        <text x={X(s.x)} y={yB + 33} fontSize="9.5" textAnchor="middle" fill="#fff" fontWeight="bold">{s.label.length > 4 ? s.label.slice(0, 4) : s.label}</text>
                        <title>{`${s.label} — x = ${fmt(s.x, 3)} m (apri)`}</title>
                    </>}
                </g>
            ))}
            {cursor && !mini && <CursorMark X={X} {...cursor} y1={yB - 42} y2={yB + 40} />}
        </svg>
    );
}

// ---------------------------------------------------------------------------
// FESSURAZIONE: momento SLE lungo la trave, momento di prima fessurazione,
// zone fessurate e w_k nelle sezioni già progettate
// ---------------------------------------------------------------------------
const CRACK_COMBOS = [
    { id: "Q", label: "Quasi permanente", long: true },
    { id: "F", label: "Frequente", long: false },
    { id: "R", label: "Rara", long: false },
];
const C_CR = "#64748b", C_CRZONE = "#f97316";

function CrackCard({ beam, an, onPick, onOpen, cursor = null, bar = null }) {
    const [combo, setCombo] = useState("Q");
    const [wLim, setWLim] = useState(0.3);
    const { b, h, c, fck } = beam.section;
    const fctm = 0.3 * fck ** (2 / 3);                         // fck ≤ 50
    const Mcr = ((fctm / 1.2) * b * h * h) / 6 / 1e6;          // σ_t = f_ctm/1,2 sulla sezione interamente reagente [kNm]
    const cb = CRACK_COMBOS.find((q) => q.id === combo);
    // w_k nelle sezioni con armatura adottata (dalla cascata)
    const marks = beam.sections.map((sec) => {
        const v = valuesAt(an, sec.x);
        if (!v) return null;
        const mx = v[`Mmax${combo}`], mn = v[`Mmin${combo}`];
        const M = Math.abs(mn) > Math.abs(mx) ? mn : mx;
        if (Math.abs(M) <= Mcr) return { sec, M, state: "uncracked" };
        const ad = sec.adopted?.[M >= 0 ? "pos" : "neg"] ?? sec.adopted?.pos ?? sec.adopted?.neg;
        if (!ad) return { sec, M, state: "todo" };
        const bot = ad.tensionTop ? ad.AC : ad.AT, top = ad.tensionTop ? ad.AT : ad.AC;
        const r = crackCheck({ b, h: ad.h ?? h, c, cPrime: c, As: M >= 0 ? bot : top, AsPrime: M >= 0 ? top : bot, phi: ad.phiT, MSer: Math.abs(M), fck, longTerm: cb.long, wLim });
        return r.ok ? { sec, M, state: r.verified ? "ok" : "ko", wk: r.wk } : { sec, M, state: "todo" };
    }).filter(Boolean);
    return (
        <Card title="Fessurazione (SLE) – momento e zone fessurate [kNm]" right={
            <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-lg bg-slate-100 p-0.5">
                    {CRACK_COMBOS.map((q) => (
                        <button key={q.id} type="button" onClick={() => setCombo(q.id)}
                            className={`rounded-md px-2 py-1 text-[11px] font-semibold ${combo === q.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>{q.label}</button>
                    ))}
                </div>
                <select value={wLim} onChange={(e) => setWLim(num(e.target.value))} aria-label="Ampiezza limite delle fessure"
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600">
                    {[0.2, 0.3, 0.4].map((w) => <option key={w} value={w}>w_lim = {fmt(w, 1)} mm</option>)}
                </select>
            </div>}>
            <CrackSVG an={an} combo={combo} Mcr={Mcr} marks={marks} onPick={onPick} onOpen={onOpen} cursor={cursor} />
            <Legend items={[[C_SLE, `M ${cb.label.toLowerCase()} (max / min)`], [C_CR, `±M_cr = ${fmt(Mcr, 1)} kNm (f_ctm/1,2 su b·h²/6)`, true], [C_CRZONE, "zona fessurata (|M| > M_cr)"]]} />
            {bar}
            <p className="mt-2 text-[11px] leading-4 text-slate-500">
                {sub("Nelle sezioni progettate (cascata) w_k è calcolato con l'armatura adottata e la combinazione scelta (quasi permanente: carichi di lunga durata, k_t = 0,4); nelle sezioni non ancora progettate e fessurate compare «da progettare».")}
            </p>
        </Card>
    );
}

function CrackSVG({ an, combo, Mcr, marks, onPick, onOpen, cursor = null }) {
    const ref = useRef(null);
    const [hov, setHov] = useState(null);
    const [hovPt, setHovPt] = useState(null);           // estremo di zona fessurata sotto il mouse
    const L = an.Ltot, X = useX(L), H = 230, top = 22, bot = H - 30;
    const kMax = `Mmax${combo}`, kMin = `Mmin${combo}`;
    const all = an.pts.flatMap((p) => [p[kMax], p[kMin]]);
    const hi = Math.max(Mcr * 1.15, ...all), lo = Math.min(-Mcr * 1.15, ...all);
    const k = (bot - top) / (hi - lo || 1);
    const Y = (v) => top + (v - lo) * k;                       // M positivo verso il basso
    const y0 = Y(0);
    const path = (key) => an.pts.map((p, i) => `${i ? "L" : "M"}${X(p.x).toFixed(1)},${Y(p[key]).toFixed(1)}`).join(" ");
    // zone fessurate: tratti dove la curva supera ±M_cr, riempiti fino alla retta di M_cr
    const zones = [];
    // estremi di ogni zona: dove |M| = M_cr, interpolando fra i due punti a cavallo
    const cross = (a, b, key, sgn) => {
        const va = sgn * a[key], vb = sgn * b[key];
        const t = vb !== va ? (Mcr - va) / (vb - va) : 0;
        return a.x + Math.min(1, Math.max(0, t)) * (b.x - a.x);
    };
    const collect = (key, sgn) => {
        let run = [], xa = null;
        const flush = (xb = null) => {
            // basta un solo punto oltre M_cr: gli estremi interpolati danno la larghezza reale
            // (es. picco sull'appoggio che supera M_cr di poco: un punto per campata)
            if (run.length) {
                const za = xa ?? run[0].x, zb = xb ?? run[run.length - 1].x;
                if (zb - za > 1e-9) zones.push({ run, sgn, xa: za, xb: zb });
            }
            run = []; xa = null;
        };
        an.pts.forEach((p, i) => {
            const m = p[key];
            const prev = i > 0 && an.pts[i - 1].span === p.span ? an.pts[i - 1] : null;
            if (sgn * m > Mcr) {
                if (!run.length) xa = prev ? cross(prev, p, key, sgn) : p.x;
                run.push(p);
            } else if (run.length) flush(prev ? cross(prev, p, key, sgn) : null);
            if (i < an.pts.length - 1 && an.pts[i + 1].span !== p.span) flush();
        });
        flush();
    };
    collect(kMax, 1); collect(kMin, -1);
    // barre arancioni: zone contigue (a cavallo di un appoggio) unite in una sola barra
    const bars = [];
    [1, -1].forEach((sgn) => {
        zones.filter((z) => z.sgn === sgn).sort((a, b) => a.xa - b.xa).forEach((z) => {
            const last = bars[bars.length - 1];
            if (last && last.sgn === sgn && Math.abs(z.xa - last.xb) < 1e-6) last.xb = z.xb;
            else bars.push({ sgn, xa: z.xa, xb: z.xb });
        });
    });
    const key = (sgn) => (sgn > 0 ? kMax : kMin);
    const move = (e) => { const p = pickX(e, ref.current, L); if (p.x < 0 || p.x > L) { setHov(null); return; } setHov({ x: p.x, v: valuesAt(an, p.x) }); };
    const click = (e) => { const p = pickX(e, ref.current, L); if (p.x >= -0.02 && p.x <= L + 0.02) onPick(p.x); };
    return (
        <svg ref={ref} viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Diagramma per la fessurazione"
            onMouseMove={move} onMouseLeave={() => setHov(null)} onClick={click} style={{ cursor: "crosshair" }}>
            {[0, ...an.xs0.slice(1), L].map((x, i) => <line key={i} x1={X(x)} x2={X(x)} y1={top - 8} y2={bot + 8} stroke="#e2e8f0" />)}
            {/* zone fessurate */}
            {zones.map((z, i) => {
                const yc = Y(z.sgn * Mcr), kk = key(z.sgn);
                const d = `M${X(z.xa).toFixed(1)},${yc} ${z.run.map((p) => `L${X(p.x).toFixed(1)},${Y(p[kk]).toFixed(1)}`).join(" ")} L${X(z.xb).toFixed(1)},${yc} Z`;
                return <path key={i} d={d} fill={C_CRZONE} fillOpacity="0.22" />;
            })}
            {bars.map((z, i) => {
                const y = z.sgn > 0 ? bot + 6 : top - 6, x1 = X(z.xa), x2 = X(z.xb);
                // posizione degli estremi: punto sulla barra ed etichetta all'esterno (all'interno se vicina al bordo)
                return (
                    <g key={`b${i}`}>
                        <line x1={x1} x2={x2} y1={y} y2={y} stroke={C_CRZONE} strokeWidth="3" strokeLinecap="round" />
                        {[[x1, z.xa, true], [x2, z.xb, false]].map(([xp, xv, left]) => {
                            const id = `${i}${left ? "a" : "b"}`, on = hovPt?.id === id;
                            return (
                                // la posizione compare in un box passando il mouse sul punto (il clic non aggiunge sezioni)
                                <g key={id} style={{ cursor: "default" }} onMouseEnter={() => setHovPt({ id, xp, y, xv, sgn: z.sgn })} onMouseLeave={() => setHovPt(null)} onClick={(e) => e.stopPropagation()}>
                                    <circle cx={xp} cy={y} r="10" fill="transparent" />
                                    <circle className={`svg-dot ${on ? "is-on" : ""}`} cx={xp} cy={y} r="4" fill={on ? C_CRZONE : "#fff"} stroke={C_CRZONE} strokeWidth="2" />
                                </g>
                            );
                        })}
                    </g>
                );
            })}
            <line x1={X(0)} x2={X(L)} y1={y0} y2={y0} stroke="#334155" strokeWidth="1.2" />
            {[Mcr, -Mcr].map((m) => <line key={m} x1={X(0)} x2={X(L)} y1={Y(m)} y2={Y(m)} stroke={C_CR} strokeWidth="1" strokeDasharray="6 4" />)}
            {/* ±M_cr a sinistra: simbolo e, sotto, il valore [kNm] */}
            {[[Mcr, "+"], [-Mcr, "−"]].map(([m, sg]) => (
                <g key={sg}>
                    <text x={X(0) - 4} y={Y(m) - 1} fontSize="9.5" textAnchor="end" fill={C_CR}>{`${sg}M`}<tspan baselineShift="-0.12em" fontSize="70%">cr</tspan></text>
                    <text x={X(0) - 4} y={Y(m) + 10} fontSize="9" textAnchor="end" fill={C_CR} fontWeight="bold">{sg}{fmt(Mcr, 1)}</text>
                </g>
            ))}
            <path d={path(kMax)} fill="none" stroke={C_SLE} strokeWidth="1.8" />
            <path d={path(kMin)} fill="none" stroke={C_SLE} strokeWidth="1.8" strokeDasharray="5 3" />
            {/* sezioni con w_k */}
            {marks.map(({ sec, M, state, wk }) => {
                const xs = X(sec.x), col = state === "ok" ? "#059669" : state === "ko" ? "#dc2626" : "#94a3b8";
                const txt = state === "uncracked" ? "non fessurata" : state === "todo" ? "da progettare"
                    : <>w<tspan baselineShift="-0.12em" fontSize="70%">k</tspan> = {fmt(wk, 3)} mm</>;
                const below = M < 0;                            // etichetta verso l'asse, lontana dalle barre delle zone
                return (
                    <g key={sec.id} onClick={(e) => { e.stopPropagation(); onOpen(sec.id); }} style={{ cursor: "pointer" }}>
                        <line x1={xs} x2={xs} y1={top - 10} y2={bot + 10} stroke={C_SEC} strokeWidth="1.1" strokeDasharray="3 2" />
                        <circle cx={xs} cy={Y(M)} r="4" fill={col} stroke="#fff" strokeWidth="1.5" />
                        <text x={xs} y={top - 12} fontSize="9" textAnchor="middle" fill={C_SEC} fontWeight="bold">{sec.label.length > 6 ? sec.label.slice(0, 6) : sec.label}</text>
                        <text x={xs + 6} y={below ? Y(M) + 14 : Y(M) - 8} fontSize="9.5" fill={col} fontWeight="bold" stroke="#fff" strokeWidth="3" paintOrder="stroke">{txt}</text>
                        <rect x={xs - 6} y={top - 12} width="12" height={bot - top + 24} fill="transparent" />
                    </g>
                );
            })}
            {cursor && <CursorMark X={X} {...cursor} y1={top - 6} y2={bot + 10} />}
            {hovPt && (() => {
                // box piccolo come quello della posizione nei diagrammi, verso l'interno del grafico
                const val = `${fmt(hovPt.xv, 3)} m`, w = (val.length + 4) * 5.8 + 14, h = 19;
                const bx = Math.min(W - MR - w, Math.max(ML, hovPt.xp - w / 2));
                const below = hovPt.sgn < 0;                 // barra in alto: box sotto; barra in basso: box sopra
                const by = below ? hovPt.y + 10 : hovPt.y - 10 - h;
                return (
                    <g key={hovPt.id} className="svg-pop" style={{ transformOrigin: below ? "center top" : "center bottom" }} pointerEvents="none">
                        <rect x={bx} y={by} width={w} height={h} rx="6" fill="#fff" fillOpacity="0.97" stroke="#cbd5e1" />
                        <text x={bx + w / 2} y={by + 13} fontSize="10" textAnchor="middle">
                            <tspan fill="#64748b">x = </tspan><tspan fill="#c2410c" fontWeight="bold">{val}</tspan>
                        </text>
                    </g>
                );
            })()}
            {hov && hov.v && !hovPt && (() => {
                const xs = X(hov.x), right = xs > W - 190, bx = right ? xs - 150 : xs + 10;
                const rows = [["x", `${fmt(hov.x, 2)} m`, "#334155"], ["M max", fmt(hov.v[kMax], 1), C_SLE], ["M min", fmt(hov.v[kMin], 1), C_SLE]];
                return (
                    <g pointerEvents="none">
                        <line x1={xs} x2={xs} y1={top - 6} y2={bot + 6} stroke="#64748b" strokeWidth="0.8" />
                        <rect x={bx} y={top} width="140" height={rows.length * 14 + 8} rx="6" fill="#fff" fillOpacity="0.95" stroke="#cbd5e1" />
                        {rows.map(([a, b2, c2], i) => <g key={a}><text x={bx + 8} y={top + 15 + i * 14} fontSize="10" fill="#64748b">{a}</text><text x={bx + 132} y={top + 15 + i * 14} fontSize="10" textAnchor="end" fill={c2} fontWeight="600">{b2}</text></g>)}
                    </g>
                );
            })()}
        </svg>
    );
}

// ---------------------------------------------------------------------------
// LINEE DI INFLUENZA E PROCEDIMENTO: come si arriva al valore dell'inviluppo in
// una sezione. 1) linea di influenza di M o V in x₀ (forza unitaria viaggiante) e
// sue aree per campata; 2) disposizione dei carichi per il massimo e il minimo
// (permanenti ovunque, variabili dove l'area ha il segno che aggrava);
// 3) calcolo S = Σ q_G·A + Σ q_Q·A; 4) diagrammi delle due disposizioni a
// confronto con l'inviluppo
// ---------------------------------------------------------------------------
const C_IP = "#0284c7", C_IN = "#dc2626", C_GBAND = "#94a3b8", C_QBAND = "#0ea5e9";
const STATE_SHORT = { U: "SLU", R: "Rara", F: "Frequente", Q: "Quasi perm." };

function InfluenceCard({ beam, an }) {
    const L = an.Ltot;
    const [x0, setX0] = useState(() => beam.sections[0]?.x ?? an.pts.reduce((m, p) => (p.MmaxU > m.MmaxU ? p : m), an.pts[0]).x);
    const [kind, setKind] = useState("M");
    const [state, setState] = useState("U");
    const [side, setSide] = useState("sx");
    const xc = Math.min(L, Math.max(0, Math.round(num(x0) * 1000) / 1000));
    const onNode = an.xs0.slice(1).some((x) => Math.abs(x - xc) < 1e-9);
    const sideEff = kind === "V" && onNode ? side : "dx";
    const sk = structKey(beam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const il = useMemo(() => influenceLine(beam, xc, kind, sideEff), [sk, xc, kind, sideEff]);
    // scala del disegno fissa per la trave (non dipende dalla sezione scelta)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const range = useMemo(() => influenceRange(beam, kind), [sk, kind]);
    if (!il.ok) return null;
    const isM = kind === "M";
    const list = an.combos.filter((c) => c.state === state);
    const procs = list.map((c) => ({ c, p: influenceProcedure(il, c) }));
    const bMax = procs.reduce((b, r) => (r.p.Smax > b.p.Smax + 1e-9 ? r : b), procs[0]);
    const bMin = procs.reduce((b, r) => (r.p.Smin < b.p.Smin - 1e-9 ? r : b), procs[0]);
    const qsMax = bMax.c.qG.map((g, k) => g + (bMax.p.rows[k].max ? bMax.c.qQ[k] : 0));
    const qsMin = bMin.c.qG.map((g, k) => g + (bMin.p.rows[k].min ? bMin.c.qQ[k] : 0));
    const dMax = diagramFor(beam, qsMax, kind), dMin = diagramFor(beam, qsMin, kind);
    const env = valuesAt(an, xc);
    const envMax = env?.[`${kind}max${state}`], envMin = env?.[`${kind}min${state}`];
    const cmpEnv = !(kind === "V" && onNode) && env;
    const S = isM ? "M" : "V", uS = isM ? "kNm" : "kN", uA = isM ? "m²" : "m", uEta = isM ? "m" : "–";
    const name = (c) => `${comboName(c, an.combos)}${c.lead !== null && an.acts.length > 1 ? ` (Q${c.lead + 1} principale)` : ""}`;
    const seg = (opts, val, set) => (
        <div className="inline-flex rounded-lg bg-slate-100 p-0.5">
            {opts.map(([v, l]) => (
                <button key={v} type="button" onClick={() => set(v)} className={`rounded-md px-2 py-1 text-[11px] font-semibold ${val === v ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>{l}</button>
            ))}
        </div>
    );
    const stepT = (n, t) => <p className="mb-1.5 mt-4 flex items-center gap-2 text-xs font-bold text-slate-700 first:mt-0"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-sky-600 text-[10px] text-white">{n}</span>{t}</p>;
    const cell = "px-2 py-1.5 text-right tabular-nums";
    const secSel = beam.sections.find((q) => Math.abs(q.x - xc) < 1e-6);
    return (
        <Card title="Linee di influenza e procedimento" subtitle={sub("Come si arriva al valore dell'inviluppo in una sezione: clicca sulla linea di influenza per spostare la sezione x₀.")} right={
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-600">
                {seg([["M", "M"], ["V", "V"]], kind, setKind)}
                <select value={secSel?.id ?? ""} onChange={(e) => { const q = beam.sections.find((z) => z.id === e.target.value); if (q) setX0(q.x); }} aria-label="Sezione"
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600">
                    <option value="">{secSel ? "" : "x libera"}</option>
                    {beam.sections.map((q) => <option key={q.id} value={q.id}>{q.label} · {fmt(q.x, 3)} m</option>)}
                </select>
                <input type="range" min="0" max={L} step="0.001" value={xc} onChange={(e) => setX0(Number(e.target.value))} aria-label="Posizione della sezione x₀"
                    className="h-1.5 w-36 cursor-pointer accent-sky-500" />
                <label className="inline-flex items-center gap-1">x₀
                    <input type="number" step="0.001" min="0" max={L} value={x0} onChange={(e) => setX0(e.target.value)} aria-label="Ascissa della sezione"
                        className="w-16 rounded-md border border-slate-200 px-1.5 py-0.5 text-right text-xs tabular-nums outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100" /> m
                </label>
                {kind === "V" && onNode && seg([["sx", "a sinistra"], ["dx", "a destra"]], side, setSide)}
                {seg(COMBO_STATES.map((st) => [st.id, STATE_SHORT[st.id]]), state, setState)}
            </div>}>
            {stepT(1, <>Linea di influenza di {sub(`${S}`)} in x₀ = {fmt(xc, 2)} m{kind === "V" && onNode ? ` (${sideEff === "sx" ? "a sinistra" : "a destra"} dell'appoggio)` : ""} – forza unitaria viaggiante, η [{uEta}]</>)}
            <InfluenceSVG beam={beam} an={an} il={il} range={range} isM={isM} uA={uA} onPick={(x) => setX0(Math.round(x * 1000) / 1000)} />
            {il.isNull && (
                <p className="mt-1 rounded-lg bg-amber-50 px-2 py-1 text-[11px] leading-4 text-amber-800">
                    {sub(`In x₀ = ${fmt(xc, 3)} m ${S} è identicamente nullo${isM ? " (momento su un appoggio di estremità o all'estremo libero di una mensola)" : " (taglio all'estremo libero di una mensola o all'esterno dell'ultimo appoggio)"}: nessuna disposizione dei carichi lo fa variare, quindi massimo e minimo valgono zero.`)}
                </p>
            )}
            <p className="mt-1 text-[11px] leading-4 text-slate-500">
                {sub(`L'area A_k della linea sulla campata k è il valore di ${S} in x₀ per un carico unitario distribuito sulla sola campata k: un carico q_k su quella campata dà q_k·A_k. Per il massimo si caricano coi variabili le campate con area positiva, per il minimo quelle con area negativa; i permanenti stanno sempre ovunque.`)}
            </p>

            {stepT(2, "Disposizione dei carichi [kN/m]")}
            <div className="space-y-2">
                {[["max", bMax, qsMax, C_POS], ["min", bMin, qsMin, C_NEG]].map(([w, r, qs, col]) => (
                    <div key={w} className="rounded-xl border border-slate-200 p-2">
                        <p className="text-[11px] font-semibold" style={{ color: col }}>{sub(`Per ${S}_${w}`)} · <span className="text-slate-600">{name(r.c)}</span></p>
                        <LoadPatternSVG beam={beam} an={an} combo={r.c} loaded={r.p.rows.map((row) => row[w])} xc={xc} />
                        <p className="text-[10px] text-slate-500">{sub(`Variabili su: ${r.p.rows.filter((row) => row[w]).map((row) => `campata ${row.k + 1}`).join(", ") || "nessuna campata"} · totale per campata: ${qs.map((q) => fmt(q, 2)).join(" / ")}`)}</p>
                    </div>
                ))}
            </div>

            {stepT(3, `Calcolo (${COMBO_STATES.find((q) => q.id === state).long})`)}
            <div className="scroll-thin-x pb-1">
                <table className="w-full min-w-[760px] text-xs">
                    <thead>
                        <tr className="border-b border-slate-200 text-[11px] text-slate-500">
                            <th className="px-2 py-1.5 text-left font-semibold">Campata</th>
                            <th className={cell}>{sub("A_k")} [{uA}]</th>
                            <th className={cell}>{sub("q_G,k")} [kN/m]</th>
                            <th className={cell}>{sub("q_G,k·A_k")} [{uS}]</th>
                            <th className={cell}>{sub("q_Q,k")} [kN/m]</th>
                            <th className={cell}>{sub("q_Q,k·A_k")} [{uS}]</th>
                            <th className={cell} style={{ color: C_POS }}>{sub(`per ${S}_max`)}</th>
                            <th className={cell} style={{ color: C_NEG }}>{sub(`per ${S}_min`)}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {il.areas.map((A, k) => {
                            const rM = bMax.p.rows[k], rm = bMin.p.rows[k];
                            const same = bMax.c.id === bMin.c.id;
                            return (
                                <tr key={k} className="border-b border-slate-100">
                                    <td className="px-2 py-1.5 font-semibold text-slate-700">{k + 1}</td>
                                    <td className={`${cell} font-semibold`} style={{ color: A >= 0 ? C_IP : C_IN }}>{A >= 0 ? "+" : ""}{fmt(A, 3)}</td>
                                    <td className={cell}>{fmt(rM.qG, 2)}</td>
                                    <td className={cell}>{fmt(rM.g, 2)}</td>
                                    <td className={cell}>{same ? fmt(rM.qQ, 2) : `${fmt(rM.qQ, 2)} / ${fmt(rm.qQ, 2)}`}</td>
                                    <td className={cell}>{same ? fmt(rM.qv, 2) : `${fmt(rM.qv, 2)} / ${fmt(rm.qv, 2)}`}</td>
                                    <td className={cell}>{rM.max ? <span className="font-bold" style={{ color: C_POS }}>{"+" + fmt(rM.qv, 2)}</span> : <span className="text-slate-300">—</span>}</td>
                                    <td className={cell}>{rm.min ? <span className="font-bold" style={{ color: C_NEG }}>{fmt(rm.qv, 2)}</span> : <span className="text-slate-300">—</span>}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            <div className="mt-2 grid gap-2 lg:grid-cols-2">
                {[["max", bMax, bMax.p.Smax, envMax, C_POS, (row) => row.max], ["min", bMin, bMin.p.Smin, envMin, C_NEG, (row) => row.min]].map(([w, r, val, ev, col, f]) => (
                    <div key={w} className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-700">
                        <Tex>{String.raw`${S}_{${w}}=\sum_k q_{G,k}A_k+\sum_{k\,:\,q_{Q,k}A_k ${w === "max" ? ">" : "<"} 0} q_{Q,k}A_k`}</Tex>
                        <p className="mt-1 tabular-nums">
                            = {fmt(r.p.G, 2)} {r.p.rows.filter(f).map((row) => <span key={row.k}>{row.qv >= 0 ? " + " : " − "}{fmt(Math.abs(row.qv), 2)}</span>)}
                            {" "}= <b style={{ color: col }}>{fmt(val, 2)} {uS}</b>
                            <span className="text-slate-500"> ({name(r.c)})</span>
                        </p>
                        {cmpEnv && ev !== undefined && (
                            <p className={`mt-0.5 text-[11px] ${Math.abs(ev - val) < 1e-3 * Math.max(1, Math.abs(ev)) ? "text-emerald-700" : "text-amber-700"}`}>
                                {Math.abs(ev - val) < 1e-3 * Math.max(1, Math.abs(ev)) ? "✓ coincide con l'inviluppo" : `inviluppo: ${fmt(ev, 2)} ${uS}`}
                            </p>
                        )}
                    </div>
                ))}
            </div>
            {procs.length > 1 && (
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
                    <span className="font-semibold text-slate-600">Tutte le combinazioni dello stato:</span>
                    {procs.map(({ c, p: pr }) => (
                        <span key={c.id} className="tabular-nums">{comboName(c, an.combos)}: <span className={c.id === bMax.c.id ? "font-bold" : ""} style={{ color: C_POS }}>{fmt(pr.Smax, 1)}</span> / <span className={c.id === bMin.c.id ? "font-bold" : ""} style={{ color: C_NEG }}>{fmt(pr.Smin, 1)}</span></span>
                    ))}
                </div>
            )}

            {stepT(4, `Diagrammi di ${S} delle due disposizioni e inviluppo [${uS}]`)}
            <ResultPatternSVG an={an} isM={isM} state={state} kind={kind} dMax={dMax} dMin={dMin} xc={xc} vMax={bMax.p.Smax} vMin={bMin.p.Smin} />
            <Legend items={[["#cbd5e1", `inviluppo ${STATE_SHORT[state]}`], [C_POS, `disposizione per ${S}max`], [C_NEG, `disposizione per ${S}min`]]} />
            {isM && state === "U" && <p className="mt-1 text-[11px] text-slate-500">{sub(`Il progetto usa l'inviluppo traslato di a_l = ${fmt(an.aL * 100, 1)} cm: in x₀ è il massimo di questi valori nell'intorno ±a_l.`)}</p>}
        </Card>
    );
}

// sostegni in piccolo per i disegni del procedimento
function MiniSupports({ beam, an, X, y }) {
    return beam.nodes.map((nd, i) => {
        const x = X(an.xs0[i] ?? an.Ltot);
        if (nd.type === "free") return null;
        if (nd.type === "fixed") return <rect key={i} x={x - 2} y={y - 9} width="4" height="18" fill="#334155" />;
        return <path key={i} d={`M${x},${y} l-6,10 h12 Z`} fill="#fff" stroke="#334155" strokeWidth="1.1" />;
    });
}

function InfluenceSVG({ beam, an, il, range, isM, uA, onPick }) {
    const ref = useRef(null);
    const L = an.Ltot, X = useX(L), top = 30;
    // scala fissa per la trave: ordinate massime possibili al variare della sezione
    // (in più quelle correnti, per sicurezza); l'asse della trave resta fermo
    const etas = il.pts.map((p) => p.eta);
    const pos = Math.max(range?.pos ?? 0, ...etas, 0), neg = Math.max(range?.neg ?? 0, ...etas.map((e) => -e), 0);
    const span = pos + neg || 1;
    // M: η in metri, stessa scala delle lunghezze se l'altezza resta leggibile;
    // V: η adimensionale, altezza fissa
    const pxPerM = (W - ML - MR) / (L || 1);
    const iso = isM && span * pxPerM >= 90 && span * pxPerM <= 260;
    const k = iso ? pxPerM : (isM ? Math.min(260, Math.max(90, span * pxPerM)) : 160) / span;
    const plotH = span * k, bot = top + plotH, H = bot + 48;
    // stessa convenzione dei diagrammi: M positivo verso il basso, V positivo verso l'alto
    const lo = isM ? -neg : -pos;
    const Y = isM ? (v) => top + (v - lo) * k : (v) => top + (pos - v) * k;
    const y0 = Y(0);
    const bySpan = beam.spans.map((_, j) => il.pts.filter((p) => p.span === j));
    const fillPath = (pts, sgn) => `M${X(pts[0].x)},${y0} ${pts.map((p) => `L${X(p.x).toFixed(1)},${Y(sgn > 0 ? Math.max(0, p.eta) : Math.min(0, p.eta)).toFixed(1)}`).join(" ")} L${X(pts[pts.length - 1].x)},${y0} Z`;
    const line = il.pts.map((p, i) => `${i && il.pts[i - 1].span === p.span ? "L" : "M"}${X(p.x).toFixed(1)},${Y(p.eta).toFixed(1)}`).join(" ");
    const pk = il.pts.filter((p) => Math.abs(p.x - il.x0) < 1e-6 * Math.max(1, L));
    const click = (e) => { const p = pickX(e, ref.current, L); if (p.x >= 0 && p.x <= L) onPick(p.x); };
    return (
        <svg ref={ref} viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Linea di influenza" onClick={click} style={{ cursor: "crosshair" }}>
            {[0, ...an.xs0.slice(1), L].map((x, i) => <line key={i} x1={X(x)} x2={X(x)} y1={top - 14} y2={bot + 14} stroke="#e2e8f0" />)}
            {bySpan.map((pts, j) => (
                <g key={j}>
                    <path d={fillPath(pts, 1)} fill={C_IP} fillOpacity="0.16" />
                    <path d={fillPath(pts, -1)} fill={C_IN} fillOpacity="0.16" />
                </g>
            ))}
            <line x1={X(0)} x2={X(L)} y1={y0} y2={y0} stroke="#334155" strokeWidth="1.3" />
            <MiniSupports beam={beam} an={an} X={X} y={y0} />
            <path d={line} fill="none" stroke="#0f172a" strokeWidth="1.8" />
            {il.isNull && (
                <text x={W / 2} y={y0 - 16} fontSize="12" textAnchor="middle" fill="#64748b" stroke="#fff" strokeWidth="4" paintOrder="stroke">
                    Linea di influenza nulla: in x₀ la grandezza vale zero per qualunque posizione del carico
                </text>
            )}
            {/* aree per campata */}
            {il.areas.map((A, j) => {
                const xm = X(an.xs0[j] + beam.spans[j].L / 2);
                const pos = A >= 0, yl = pos === isM ? bot + 26 : top - 16;
                return (
                    <text key={j} x={xm} y={yl} fontSize="11" textAnchor="middle" fontWeight="bold" fill={pos ? C_IP : C_IN}>
                        A<tspan baselineShift="-0.12em" fontSize="70%">{j + 1}</tspan> = {pos ? "+" : ""}{fmt(A, 3)} {uA}
                    </text>
                );
            })}
            <text x={W - MR} y={H - 6} fontSize="9" textAnchor="end" fill="#94a3b8">
                {iso ? "scala verticale = scala delle lunghezze" : isM ? `scala verticale ×${fmt(k / pxPerM, 2)} rispetto alle lunghezze` : "scala verticale fissa per la trave"}
            </text>
            {/* sezione x₀ e ordinata */}
            <line x1={X(il.x0)} x2={X(il.x0)} y1={top - 14} y2={bot + 10} stroke={C_SEC} strokeWidth="1.1" strokeDasharray="3 2" />
            <text x={X(il.x0)} y={top - 18} fontSize="10" textAnchor="middle" fill={C_SEC} fontWeight="bold">x₀</text>
            {pk.map((p, i) => (
                <g key={i}>
                    <circle cx={X(p.x)} cy={Y(p.eta)} r="3.5" fill="#0f172a" stroke="#fff" strokeWidth="1.2" />
                    <text x={X(p.x) + 6 + i * 0} y={Y(p.eta) + (i ? 14 : -6)} fontSize="10" fill="#0f172a" stroke="#fff" strokeWidth="3" paintOrder="stroke">η = {fmt(p.eta, 3)}</text>
                </g>
            ))}
        </svg>
    );
}

function LoadPatternSVG({ beam, an, combo, loaded, xc }) {
    const L = an.Ltot, X = useX(L), H = 96, yB = 70;
    const qmax = Math.max(1e-9, ...combo.qG, ...combo.qQ.map((q, k) => (loaded[k] ? q : 0)));
    const hG = (q) => 6 + 18 * (q / qmax), hQ = (q) => 6 + 18 * (q / qmax);
    return (
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Disposizione dei carichi">
            {beam.spans.map((sp, j) => {
                const x0 = X(an.xs0[j]), x1 = X(an.xs0[j] + sp.L), g = combo.qG[j], q = combo.qQ[j];
                const yg = yB - 2 - hG(g), yq = yg - (loaded[j] ? hQ(q) : 0);
                return (
                    <g key={j}>
                        <rect x={x0} y={yg} width={x1 - x0} height={hG(g)} fill={C_GBAND} fillOpacity="0.35" stroke={C_GBAND} />
                        <text x={(x0 + x1) / 2} y={yg + hG(g) / 2 + 4} fontSize="11" textAnchor="middle" fill="#334155">q<tspan baselineShift="-0.12em" fontSize="70%">G</tspan> = {fmt(g, 2)}</text>
                        {loaded[j] ? (
                            <>
                                <rect x={x0} y={yq} width={x1 - x0} height={hQ(q)} fill={C_QBAND} fillOpacity="0.35" stroke={C_QBAND} />
                                <text x={(x0 + x1) / 2} y={yq + hQ(q) / 2 + 4} fontSize="11" textAnchor="middle" fill="#0369a1" fontWeight="bold">q<tspan baselineShift="-0.12em" fontSize="70%">Q</tspan> = {fmt(q, 2)}</text>
                            </>
                        ) : Math.abs(q) > 1e-9 && (
                            <text x={(x0 + x1) / 2} y={yg - 5} fontSize="10" textAnchor="middle" fill="#94a3b8">variabile assente</text>
                        )}
                    </g>
                );
            })}
            <line x1={X(0)} x2={X(L)} y1={yB} y2={yB} stroke="#334155" strokeWidth="2.5" />
            <MiniSupports beam={beam} an={an} X={X} y={yB} />
            <line x1={X(xc)} x2={X(xc)} y1={8} y2={yB + 14} stroke={C_SEC} strokeWidth="1" strokeDasharray="3 2" />
        </svg>
    );
}

function ResultPatternSVG({ an, isM, state, kind, dMax, dMin, xc, vMax, vMin }) {
    const L = an.Ltot, X = useX(L), H = 220, top = 22, bot = H - 22;
    const kMax = `${kind}max${state}`, kMin = `${kind}min${state}`;
    const all = [...an.pts.flatMap((p) => [p[kMax], p[kMin]]), ...dMax.map((p) => p.v), ...dMin.map((p) => p.v)];
    const hi = Math.max(0, ...all), lo = Math.min(0, ...all), k = (bot - top) / (hi - lo || 1);
    const Y = isM ? (v) => top + (v - lo) * k : (v) => top + (hi - v) * k;
    const y0 = Y(0);
    const pathOf = (pts, get) => pts.map((p, i) => `${i && pts[i - 1].span === p.span ? "L" : "M"}${X(p.x).toFixed(1)},${Y(get(p)).toFixed(1)}`).join(" ");
    const envArea = `M${X(0)},${Y(an.pts[0][kMax])} ${an.pts.map((p) => `L${X(p.x).toFixed(1)},${Y(p[kMax]).toFixed(1)}`).join(" ")} ${[...an.pts].reverse().map((p) => `L${X(p.x).toFixed(1)},${Y(p[kMin]).toFixed(1)}`).join(" ")} Z`;
    return (
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Diagrammi delle disposizioni">
            {[0, ...an.xs0.slice(1), L].map((x, i) => <line key={i} x1={X(x)} x2={X(x)} y1={top - 8} y2={bot + 8} stroke="#e2e8f0" />)}
            <path d={envArea} fill="#e2e8f0" fillOpacity="0.7" stroke="#cbd5e1" />
            <line x1={X(0)} x2={X(L)} y1={y0} y2={y0} stroke="#334155" strokeWidth="1.2" />
            <path d={pathOf(dMax, (p) => p.v)} fill="none" stroke={C_POS} strokeWidth="1.8" />
            <path d={pathOf(dMin, (p) => p.v)} fill="none" stroke={C_NEG} strokeWidth="1.8" strokeDasharray="6 3" />
            <line x1={X(xc)} x2={X(xc)} y1={top - 10} y2={bot + 10} stroke={C_SEC} strokeWidth="1.1" strokeDasharray="3 2" />
            {/* etichetta dal lato esterno: M positivo in basso, V positivo in alto */}
            {[[vMax, C_POS, isM ? 18 : -9], [vMin, C_NEG, isM ? -9 : 18]].map(([v, col, dy]) => (
                <g key={col}>
                    <circle cx={X(xc)} cy={Y(v)} r="4" fill={col} stroke="#fff" strokeWidth="1.5" />
                    <text x={X(xc) + (X(xc) > W - 160 ? -8 : 8)} y={Y(v) + dy} fontSize="10.5" fontWeight="bold" textAnchor={X(xc) > W - 160 ? "end" : "start"} fill={col} stroke="#fff" strokeWidth="3" paintOrder="stroke">{fmt(v, 2)}</text>
                </g>
            ))}
        </svg>
    );
}

// ---------------------------------------------------------------------------
// DEFORMABILITÀ (SLE): frecce per integrazione delle curvature (lib/concrete/deflection)
// ---------------------------------------------------------------------------
const C_DEF = "#0891b2", C_DINC = "#a855f7", C_DLIM = "#dc2626";

// armatura per le frecce: dalla cascata (sezioni progettate) o inserita a mano.
// pos[j]: tesa inferiore della campata j (+ compressa superiore); neg[i]: tesa
// superiore sull'appoggio i (+ compressa inferiore)
function deflReinf(beam, an) {
    const o = beam.defl ?? {};
    const near = (x, x0, tol) => Math.abs(x - x0) <= tol;
    const pos = beam.spans.map((sp, j) => {
        const x0 = an.xs0[j], x1 = x0 + sp.L;
        const cands = beam.sections.filter((s) => s.x > x0 + 1e-6 && s.x < x1 - 1e-6 && s.adopted?.pos)
            .map((s) => ({ s, M: valuesAt(an, s.x)?.MmaxU ?? 0 })).sort((a, b) => b.M - a.M);
        const ad = cands[0]?.s.adopted.pos;
        const auto = ad ? { As: ad.tensionTop ? ad.AC : ad.AT, As2: ad.tensionTop ? ad.AT : ad.AC } : null;
        const man = o.pos?.[j];
        return { auto, val: man !== undefined && man !== null && man !== "" ? { As: num(man), As2: auto?.As2 ?? 0 } : auto, manual: man !== undefined && man !== null && man !== "" };
    });
    const neg = beam.nodes.map((nd, i) => {
        const x0 = an.xs0[i] ?? an.Ltot;
        const Lmin = Math.min(beam.spans[i - 1]?.L ?? Infinity, beam.spans[i]?.L ?? Infinity);
        const s = beam.sections.find((q) => near(q.x, x0, 0.1 * Lmin) && q.adopted?.neg);
        const ad = s?.adopted.neg;
        const auto = ad ? { As: ad.tensionTop ? ad.AT : ad.AC, As2: ad.tensionTop ? ad.AC : ad.AT } : null;
        const man = o.neg?.[i];
        return { auto, val: man !== undefined && man !== null && man !== "" ? { As: num(man), As2: auto?.As2 ?? 0 } : auto, manual: man !== undefined && man !== null && man !== "" };
    });
    return { pos, neg, reinf: { pos: pos.map((r) => r.val), neg: neg.map((r) => r.val) } };
}

function useDeflection(beam, an) {
    const opts = { ...DEFL_DEFAULT, ...(beam.defl ?? {}) };
    const R = an.ok ? deflReinf(beam, an) : null;
    const res = R ? beamDeflection(beam, an, R.reinf, { phi: num(opts.phi), partitions: !!opts.partitions }) : { ok: false };
    return { opts, R, res };
}

function DeflectionCard({ beam, an, upd, focusX = null, onPick = null, onOpen = null, cursor = null, bar = null }) {
    const { opts, R, res } = useDeflection(beam, an);
    // amplificazione della deformata disegnata (solo visualizzazione, non entra nei calcoli)
    const [amp, setAmp] = useState(60);
    if (!res.ok) return null;
    const setD = (patch) => upd((b) => ({ ...b, defl: { ...DEFL_DEFAULT, ...(b.defl ?? {}), ...patch } }));
    const setAs = (kind, i, v) => upd((b) => {
        const d = { ...DEFL_DEFAULT, ...(b.defl ?? {}) };
        return { ...b, defl: { ...d, [kind]: { ...(d[kind] ?? {}), [i]: v === "" ? undefined : v } } };
    });
    const cell = "px-2 py-1.5 text-right tabular-nums";
    const unit = (u) => <span className="font-normal text-slate-400">[{u}]</span>;
    const asInput = (kind, i, r) => (
        <input type="number" min="0" step="any" value={r.manual ? (beam.defl?.[kind]?.[i] ?? "") : ""} placeholder={r.auto ? fmt(r.auto.As, 0) : "–"}
            onChange={(e) => setAs(kind, i, e.target.value)} title={r.auto ? `Dalla cascata: ${fmt(r.auto.As, 0)} mm² (lascia vuoto per usarla)` : "Nessuna sezione progettata: inserisci l'armatura tesa"}
            aria-label={`${kind === "pos" ? "Armatura inferiore campata" : "Armatura superiore appoggio"} ${i + 1}`}
            className={`w-20 rounded-md border px-1.5 py-0.5 text-right text-xs tabular-nums outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 ${r.manual ? "border-sky-300 bg-sky-50" : r.auto ? "border-slate-200" : "border-amber-300 bg-amber-50"}`} />
    );
    const status = (ok, missing) => (missing ? <span className="rounded bg-amber-50 px-1.5 text-[10px] font-semibold text-amber-700">armatura mancante</span>
        : ok ? <CheckCircle2 size={15} className="ml-auto text-emerald-600" /> : <XCircle size={15} className="ml-auto text-red-600" />);
    return (
        <Card title="Deformabilità (SLE) – frecce [mm]" subtitle={sub("Combinazione quasi permanente, lungo termine: integrazione delle curvature con ζ fra stato non fessurato e fessurato (NTC 2018 §4.1.2.2.2, EC2 §7.4.3).")} right={
            <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold text-slate-600">
                <label className="inline-flex items-center gap-1" title="Coefficiente di viscosità φ(∞, t0)">
                    φ(∞,t₀)
                    <input type="number" step="0.1" min="0" value={opts.phi} onChange={(e) => setD({ phi: e.target.value })} aria-label="Coefficiente di viscosità"
                        className="w-14 rounded-md border border-slate-200 px-1.5 py-0.5 text-right text-xs tabular-nums outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100" />
                </label>
                <label className="inline-flex cursor-pointer items-center gap-1.5" title="Verifica anche l'incremento di freccia dopo la costruzione dei tramezzi (L/500)">
                    <input type="checkbox" checked={!!opts.partitions} onChange={(e) => setD({ partitions: e.target.checked })} className="accent-violet-600" /> Tramezzi fragili
                </label>
            </div>}>
            {/* deformata amplificata: lo slider cambia solo il disegno */}
            <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50/60 px-3 pb-1 pt-2">
                <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold text-slate-600">
                    <span>Deformata della trave</span>
                    <input type="range" min="0" max="100" step="1" value={amp} onChange={(e) => setAmp(Number(e.target.value))} aria-label="Amplificazione della deformata"
                        className="h-1.5 min-w-[160px] flex-1 cursor-pointer accent-cyan-600" />
                </div>
                <DeformedBeamSVG beam={beam} an={an} res={res} amp={amp} />
                {/* amplificazione in basso a sinistra */}
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 pb-1">
                    <span className="text-[11px] font-semibold tabular-nums text-slate-600">{amp === 0 ? "Indeformata" : `Amplificazione ×${fmt(deformedFactor(an, res, amp), 0)}`}</span>
                    <p className="text-[10px] text-slate-400">Solo per visualizzare la deformazione (f∞, combinazione quasi permanente): lo slider amplifica il disegno e non modifica i calcoli.</p>
                </div>
            </div>
            <DeflectionSVG beam={beam} an={an} res={res} focusX={focusX} onPick={onPick} onOpen={onOpen} cursor={cursor} />
            <Legend items={[[C_DEF, "freccia a lungo termine f∞ (q.p.)"], ...(opts.partitions ? [[C_DINC, "incremento f∞ − f₀(G₁)", true]] : []), [C_DLIM, "limite L/250", true]]} />
            {bar}
            <div className="scroll-thin-x mt-3 pb-1">
                <table className="w-full min-w-[980px] text-xs">
                    <thead>
                        <tr className="border-b border-slate-200 text-[11px] text-slate-500">
                            <th className="px-2 py-1.5 text-left font-semibold">Campata</th>
                            <th className="px-2 py-1.5 text-left font-semibold">Schema</th>
                            <th className={cell} title="Armatura tesa inferiore di campata">{sub("A_s inf")} {unit("mm²")}</th>
                            <th className={cell} title="Armatura tesa superiore sugli appoggi">{sub("A_s sup sx / dx")} {unit("mm²")}</th>
                            <th className={cell}>λ = L/h</th>
                            <th className={cell}>{sub("λ_lim")}</th>
                            <th className={cell}>{sub("f_∞")} {unit("mm")}</th>
                            <th className={cell}>L/250</th>
                            {opts.partitions && <th className={cell}>{sub("Δf")} {unit("mm")}</th>}
                            {opts.partitions && <th className={cell}>L/500</th>}
                            <th className="px-2 py-1.5 text-right font-semibold">Esito</th>
                        </tr>
                    </thead>
                    <tbody>
                        {res.spans.map((s) => (
                            <tr key={s.j} className="border-b border-slate-100">
                                <td className="px-2 py-1.5 font-semibold text-slate-700">{s.j + 1} <span className="font-normal text-slate-400">· L = {fmt(s.L, 2)} m</span></td>
                                <td className="px-2 py-1.5 text-slate-600">{s.kind} <span className="text-slate-400">(K = {fmt(s.K, 1)})</span></td>
                                <td className={cell}>{s.cant ? <span className="text-slate-400">–</span> : asInput("pos", s.j, R.pos[s.j])}</td>
                                <td className={cell}>
                                    <span className="inline-flex gap-1">
                                        {beam.nodes[s.j].type !== "free" ? asInput("neg", s.j, R.neg[s.j]) : <span className="w-20 text-slate-400">–</span>}
                                        {beam.nodes[s.j + 1].type !== "free" ? asInput("neg", s.j + 1, R.neg[s.j + 1]) : <span className="w-20 text-slate-400">–</span>}
                                    </span>
                                </td>
                                <td className={cell}>{fmt(s.lam, 1)}</td>
                                <td className={cell}>
                                    {s.lamLim !== null ? <span className={s.simpleOk ? "text-emerald-700" : "text-slate-700"} title={s.simpleOk ? "Snellezza entro il limite: il calcolo della freccia si può omettere" : "Snellezza oltre il limite: serve il calcolo della freccia"}>{fmt(s.lamLim, 1)}{s.simpleOk ? " ✓" : ""}</span> : "–"}
                                </td>
                                <td className={`${cell} font-semibold text-slate-800`}>{fmt(Math.abs(s.f), 2)}<span className="block text-[10px] font-normal text-slate-400">L/{fmt((s.Leff * 1000) / Math.max(Math.abs(s.f), 1e-9), 0)}</span></td>
                                <td className={cell}>{fmt(s.fLim, 1)}</td>
                                {opts.partitions && <td className={`${cell} font-semibold text-slate-800`}>{fmt(Math.abs(s.fIncr), 2)}</td>}
                                {opts.partitions && <td className={cell}>{fmt(s.fIncrLim, 1)}</td>}
                                <td className="px-2 py-1.5"><span className="flex justify-end">{status(s.ok && (!opts.partitions || s.okIncr), s.missing)}</span></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <p className="mt-2 text-[11px] leading-4 text-slate-500">
                {sub(`E_cm = ${fmt(res.Ecm, 0)} MPa, E_c,eff = E_cm/(1 + φ) = ${fmt(res.Eeff, 0)} MPa, α_e = ${fmt(res.alphaE, 1)}, f_ctm = ${fmt(res.fctm, 2)} MPa. `)}
                {sub("Armature: dalla cascata (sezione di campata con il massimo M⁺, sezioni sugli appoggi con M⁻) oppure inserite a mano (campo azzurro); campo giallo = nessuna sezione progettata. ")}
                {sub("Variabili ψ_2·Q disposti, per ogni campata, sulle campate che ne aumentano la freccia. Mensole: L = 2·luce. λ_lim con A_s,eff/A_s,calc = 1.")}
            </p>
        </Card>
    );
}

// deformata amplificata: a slider = 100 la freccia massima vale DEF_PX px nel disegno
const DEF_PX = 60;
const deflMax = (res) => Math.max(1e-9, ...res.spans.flatMap((s) => s.w.map(Math.abs)));
// fattore di amplificazione = spostamento disegnato / spostamento reale (nella scala delle lunghezze)
function deformedFactor(an, res, amp) {
    const pxPerM = (W - ML - MR) / (an.Ltot || 1);
    return ((amp / 100) * DEF_PX) / ((deflMax(res) / 1000) * pxPerM);
}
function DeformedBeamSVG({ beam, an, res, amp }) {
    const L = an.Ltot, X = useX(L), H = 180, y0 = 82;
    const pxPerM = (W - ML - MR) / (L || 1);
    const t = Math.min(24, Math.max(8, (beam.section.h / 1000) * pxPerM));   // spessore disegnato della trave
    const k = ((amp / 100) * DEF_PX) / deflMax(res);                           // px per mm di freccia
    // ogni campata con la sua disposizione dei variabili (quella della sua freccia massima)
    const pts = res.spans.flatMap((s) => s.xs.map((xl, i) => ({ x: an.xs0[s.j] + xl, w: s.w[i] })));
    const top = pts.map((p, i) => `${i ? "L" : "M"}${X(p.x).toFixed(1)},${(y0 - t / 2 + k * p.w).toFixed(1)}`).join(" ");
    const botR = [...pts].reverse().map((p) => `L${X(p.x).toFixed(1)},${(y0 + t / 2 + k * p.w).toFixed(1)}`).join(" ");
    const axis = pts.map((p, i) => `${i ? "L" : "M"}${X(p.x).toFixed(1)},${(y0 + k * p.w).toFixed(1)}`).join(" ");
    return (
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Deformata amplificata della trave">
            {/* trave indeformata */}
            <rect x={X(0)} y={y0 - t / 2} width={X(L) - X(0)} height={t} fill="none" stroke="#94a3b8" strokeWidth="1" strokeDasharray="5 4" />
            {/* trave deformata */}
            <path d={`${top} ${botR} Z`} fill={C_DEF} fillOpacity="0.18" stroke={C_DEF} strokeWidth="1.4" strokeLinejoin="round" />
            <path d={axis} fill="none" stroke={C_DEF} strokeWidth="0.8" strokeDasharray="2 3" />
            {beam.nodes.map((nd, i) => {
                const x = X(an.xs0[i] ?? L), yb = y0 + t / 2;
                if (nd.type === "free") return null;
                if (nd.type === "fixed") return <g key={i}><rect x={i === 0 ? x - 8 : x} y={y0 - t / 2 - 14} width="8" height={t + 28} fill="#cbd5e1" stroke="#334155" strokeWidth="1" /></g>;
                return <path key={i} d={`M${x},${yb} l-8,13 h16 Z`} fill="#fff" stroke="#334155" strokeWidth="1.2" />;
            })}
            {/* freccia massima di ogni campata */}
            {amp > 0 && res.spans.map((s) => {
                const xs = X(an.xs0[s.j] + s.xf), yv = y0 + k * s.f + (s.f >= 0 ? t / 2 + 14 : -t / 2 - 6);
                return (
                    <text key={s.j} x={xs} y={yv} fontSize="10" textAnchor="middle" fill={C_DEF} fontWeight="bold" stroke="#fff" strokeWidth="3" paintOrder="stroke">
                        {fmt(Math.abs(s.f), 1)} mm
                    </text>
                );
            })}
        </svg>
    );
}

function DeflectionSVG({ beam, an, res, focusX, onPick = null, onOpen = null, cursor = null }) {
    const ref = useRef(null);
    const L = an.Ltot, X = useX(L), H = 210, top = 26, bot = H - 26;
    // freccia nel punto x (curva della campata che lo contiene)
    const wAt = (x) => {
        const j = Math.max(0, an.xs0.findLastIndex((x0) => x >= x0 - 1e-9));
        const sp = res.spans[Math.min(j, res.spans.length - 1)];
        const i = Math.max(0, Math.min(sp.xs.length - 1, Math.round(((x - an.xs0[sp.j]) / sp.L) * (sp.xs.length - 1))));
        return sp.w[i];
    };
    const click = (e) => { if (!onPick) return; const p = pickX(e, ref.current, L); if (p.x >= -0.02 && p.x <= L + 0.02) onPick(p.x); };
    const part = !!res.partitions;
    const vals = res.spans.flatMap((s) => [...s.w, s.fLim, ...(part ? s.dw : [])]);
    // limite dal lato della freccia (verso il basso o, per le mensole, anche verso l'alto)
    const lim = (s) => (s.f >= 0 ? s.fLim : -s.fLim);
    const hi = Math.max(1e-6, ...vals), lo = Math.min(0, ...res.spans.flatMap((s) => [...s.w, lim(s)]));
    const k = (bot - top) / (hi - lo || 1), Y = (v) => top + (v - lo) * k, y0 = Y(0);
    const xAt = (s, i) => X(an.xs0[s.j] + s.xs[i]);
    return (
        <svg ref={ref} viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Frecce della trave" onClick={click} style={onPick ? { cursor: "crosshair" } : undefined}>
            {[0, ...an.xs0.slice(1), L].map((x, i) => <line key={i} x1={X(x)} x2={X(x)} y1={top - 10} y2={bot + 6} stroke="#e2e8f0" />)}
            <line x1={X(0)} x2={X(L)} y1={y0} y2={y0} stroke="#334155" strokeWidth="1.4" />
            {beam.nodes.map((nd, i) => nd.type !== "free" && (
                <path key={i} d={`M${X(an.xs0[i] ?? L)},${y0} l-6,10 h12 Z`} fill={nd.type === "fixed" ? "#334155" : "#fff"} stroke="#334155" strokeWidth="1" />
            ))}
            {res.spans.map((s) => {
                const x0 = X(an.xs0[s.j]), x1 = X(an.xs0[s.j] + s.L);
                const d = s.w.map((v, i) => `${i ? "L" : "M"}${xAt(s, i).toFixed(1)},${Y(v).toFixed(1)}`).join(" ");
                const dInc = part ? s.dw.map((v, i) => `${i ? "L" : "M"}${xAt(s, i).toFixed(1)},${Y(v).toFixed(1)}`).join(" ") : null;
                const xm = X(an.xs0[s.j] + s.xf), ym = Y(s.f);
                const col = s.missing ? "#d97706" : s.ok ? "#059669" : "#dc2626";
                return (
                    <g key={s.j}>
                        <line x1={x0} x2={x1} y1={Y(lim(s))} y2={Y(lim(s))} stroke={C_DLIM} strokeWidth="1" strokeDasharray="6 4" />
                        <text x={x1 - 4} y={Y(lim(s)) + (s.f >= 0 ? -4 : 11)} fontSize="9" textAnchor="end" fill={C_DLIM}>{s.f >= 0 ? "" : "−"}{s.cant ? "2L" : "L"}/250 = {fmt(s.fLim, 1)} mm</text>
                        <path d={`${d} L${x1},${y0} L${x0},${y0} Z`} fill={C_DEF} fillOpacity="0.08" />
                        <path d={d} fill="none" stroke={C_DEF} strokeWidth="2" />
                        {dInc && <path d={dInc} fill="none" stroke={C_DINC} strokeWidth="1.4" strokeDasharray="5 3" />}
                        <circle cx={xm} cy={ym} r="4" fill={col} stroke="#fff" strokeWidth="1.5" />
                        <text x={xm > W - 170 ? xm - 6 : xm < 170 ? xm + 6 : xm} y={s.f >= 0 ? ym + 16 : ym - 8} fontSize="10" textAnchor={xm > W - 170 ? "end" : xm < 170 ? "start" : "middle"} fill={col} fontWeight="bold" stroke="#fff" strokeWidth="3" paintOrder="stroke">
                            {fmt(Math.abs(s.f), 2)} mm
                        </text>
                    </g>
                );
            })}
            {focusX !== null && <line x1={X(focusX)} x2={X(focusX)} y1={top - 12} y2={bot + 8} stroke={C_SEC} strokeWidth="1.1" strokeDasharray="3 2" />}
            {/* sezioni (clic: apre la sezione sulla verifica di deformabilità) */}
            {onOpen && beam.sections.map((q) => (
                <g key={q.id} onClick={(e) => { e.stopPropagation(); onOpen(q.id); }} style={{ cursor: "pointer" }}>
                    <line x1={X(q.x)} x2={X(q.x)} y1={top - 10} y2={bot + 8} stroke={C_SEC} strokeWidth="1.1" strokeDasharray="3 2" />
                    <rect x={X(q.x) - 6} y={top - 12} width="12" height={bot - top + 22} fill="transparent" />
                    <text x={X(q.x)} y={top - 12} fontSize="9" textAnchor="middle" fill={C_SEC} fontWeight="bold">{q.label.length > 6 ? q.label.slice(0, 6) : q.label}</text>
                </g>
            ))}
            {cursor && (() => {
                const w = wAt(cursor.x), xs = X(cursor.x), right = xs > W - 150;
                return (
                    <>
                        <CursorMark X={X} {...cursor} y1={top - 4} y2={bot + 8} />
                        <circle cx={xs} cy={Y(w)} r="3.5" fill={C_CUR} stroke="#fff" strokeWidth="1.2" pointerEvents="none" />
                        <text x={xs + (right ? -8 : 8)} y={Y(w) + (w >= 0 ? -7 : 14)} fontSize="10" textAnchor={right ? "end" : "start"} fill="#0369a1" fontWeight="bold" stroke="#fff" strokeWidth="3" paintOrder="stroke" pointerEvents="none">
                            w = {fmt(Math.abs(w), 2)} mm
                        </text>
                    </>
                );
            })()}
        </svg>
    );
}

// passo 5 della cascata: la freccia della campata che contiene la sezione e le
// grandezze della sezione (rigidezze, M_cr, ζ, curvatura)
function DeflectionStep({ beam, an, section, updateBeam }) {
    const { res } = useDeflection(beam, an);
    if (!res.ok) return <Card><p className="text-sm text-slate-500">Analisi non disponibile.</p></Card>;
    const j = Math.max(0, an.xs0.findLastIndex((x0) => section.x >= x0 - 1e-9));
    const s = res.spans[Math.min(j, res.spans.length - 1)];
    const xl = section.x - an.xs0[s.j];
    const i = Math.max(0, Math.min(s.xs.length - 1, Math.round((xl / s.L) * (s.xs.length - 1))));
    const q = s.cv[i];
    const row = (lab, val) => <div className="flex justify-between gap-3 border-b border-slate-100 py-1 text-xs"><span className="text-slate-500">{lab}</span><span className="font-semibold tabular-nums text-slate-800">{val}</span></div>;
    return (
        <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
                <Status ok={!s.missing && s.ok} text={s.missing ? `Campata ${s.j + 1}: armatura mancante in una zona fessurata` : `Campata ${s.j + 1}: f∞ = ${fmt(Math.abs(s.f), 2)} mm ${s.ok ? "≤" : ">"} L/250 = ${fmt(s.fLim, 1)} mm`} />
                {res.partitions && !s.missing && <Status ok={s.okIncr} text={`Δf = ${fmt(Math.abs(s.fIncr), 2)} mm ${s.okIncr ? "≤" : ">"} L/500 = ${fmt(s.fIncrLim, 1)} mm`} />}
                {s.lamLim !== null && <Status ok={s.simpleOk} text={`Snellezza λ = ${fmt(s.lam, 1)} ${s.simpleOk ? "≤" : ">"} λ_lim = ${fmt(s.lamLim, 1)}${s.simpleOk ? " (calcolo omissibile)" : ""}`} />}
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
                <Card title={`Sezione ${section.label} – x = ${fmt(section.x, 3)} m`}>
                    {row(sub("M_qp (disposizione della campata)"), `${fmt(q.M, 2)} kNm`)}
                    {row(sub("Lato teso"), q.M >= 0 ? "inferiore" : "superiore")}
                    {row(sub("I_I (omogeneizzata, α_e − 1)"), `${fmt(q.I1 / 1e6, 0)} ·10⁶ mm⁴`)}
                    {row(sub("I_II (fessurata, α_e)"), q.I2 ? `${fmt(q.I2 / 1e6, 0)} ·10⁶ mm⁴` : "–")}
                    {row(sub("x_II asse neutro fessurato"), q.x ? `${fmt(q.x, 1)} mm` : "–")}
                    {row(sub("M_cr = f_ctm·I_I/(h − y_G)"), `${fmt(q.Mcr, 2)} kNm`)}
                    {row("ζ", q.zeta === null ? "–" : fmt(q.zeta, 3))}
                    {row("1/r", `${fmt(q.kap * 1000, 4)} ·10⁻³ 1/m`)}
                </Card>
                <Card title="Formule">
                    <div className="space-y-2 text-sm">
                        <Tex display>{String.raw`\frac{1}{r}=\zeta\,\frac{M}{E_{c,eff}\,I_{II}}+(1-\zeta)\,\frac{M}{E_{c,eff}\,I_{I}}`}</Tex>
                        <Tex display>{String.raw`\zeta=1-\beta\left(\frac{M_{cr}}{M}\right)^2\quad(\beta=0{,}5),\qquad E_{c,eff}=\frac{E_{cm}}{1+\varphi}`}</Tex>
                        <Tex display>{String.raw`f=\iint -\frac{1}{r}\,dx\,dx,\quad f_\infty\le\frac{L}{250}`}</Tex>
                        <Tex display>{String.raw`\lambda=\frac{l}{h}\le K\left[11+\frac{0{,}0015\,f_{ck}}{\rho+\rho'}\right]\frac{500\,A_{s,eff}}{f_{yk}\,A_{s,calc}}`}</Tex>
                    </div>
                </Card>
            </div>
            <DeflectionCard beam={beam} an={an} upd={updateBeam} focusX={section.x} />
        </div>
    );
}

// ---------------------------------------------------------------------------
// FORMULETTE DELLE REAZIONI: R = c·q·L (es. qL/2, 3/8 qL, 5/4 qL), M = m·q·L²
// ---------------------------------------------------------------------------
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
function asFraction(c) {
    const a = Math.abs(c);
    for (let den = 1; den <= 64; den++) {
        const n = Math.round(a * den);
        if (n > 0 && Math.abs(a * den - n) < 1e-6 * Math.max(1, a * den)) { const g = gcd(n, den); return { n: n / g, d: den / g }; }
    }
    return null;
}
const SubT = ({ children }) => <tspan baselineShift="-0.12em" fontSize="70%">{children}</tspan>;
const SupT = ({ children }) => <tspan baselineShift="super" fontSize="70%">{children}</tspan>;
// termini della formula: [{c, k}] → nodi SVG (q e L con l'indice di campata se diversi fra le campate)
function formulaNodes(coefs, beam, an, pow) {
    const sameQ = an.qd.every((q) => Math.abs(q - an.qd[0]) < 1e-9);
    const sameL = beam.spans.every((s) => Math.abs(s.L - beam.spans[0].L) < 1e-9);
    let terms = coefs.map((c, k) => ({ c, k })).filter((t) => Math.abs(t.c) > 1e-9);
    if (sameQ && sameL && terms.length) terms = [{ c: terms.reduce((t, x) => t + x.c, 0), k: 0 }];
    terms = terms.filter((t) => Math.abs(t.c) > 1e-9);
    if (!terms.length) return ["0"];
    const out = [];
    terms.forEach((t, i) => {
        const neg = t.c < 0, f = asFraction(t.c);
        out.push(i === 0 ? (neg ? "−" : "") : neg ? " − " : " + ");
        if (f) { if (!(f.n === 1 && f.d === 1)) out.push(f.d === 1 ? `${f.n}·` : `${f.n}/${f.d}·`); }
        else out.push(`${fmt(Math.abs(t.c), 3)}·`);
        // indice di campata solo dove serve: q₁ se i carichi differiscono, L₁ se le luci differiscono
        out.push("q"); if (!sameQ) out.push(<SubT key={`q${i}`}>{t.k + 1}</SubT>);
        out.push("L"); if (!sameL) out.push(<SubT key={`l${i}`}>{t.k + 1}</SubT>);
        if (pow === 2) out.push(<SupT key={`p${i}`}>2</SupT>);
    });
    return out;
}

function DiagramSVG({ beam, an, kind, show, onPick, onOpen, cursor = null }) {
    const ref = useRef(null);
    const [hov, setHov] = useState(null);
    const L = an.Ltot, X = useX(L), H = 230, top = 22, bot = H - 22;
    const isM = kind === "M";
    const series = isM
        ? [["MmaxU", C_POS, false], ["MminU", C_NEG, false], ...(show.T ? [["MmaxT", C_TRASL, true], ["MminT", C_TRASL, true]] : []), ...(show.SLE ? [["MmaxR", C_SLE, true], ["MminR", C_SLE, true]] : [])]
        : [["VmaxU", C_V, false], ["VminU", C_V, false]];
    const all = an.pts.flatMap((p) => series.map(([k]) => p[k]));
    const hi = Math.max(0, ...all), lo = Math.min(0, ...all);
    // M positivo verso il basso (lato delle fibre tese); V positivo verso l'alto
    const span = hi - lo || 1, k = (bot - top) / span;
    const Y = isM ? (v) => top + (v - lo) * k : (v) => top + (hi - v) * k;
    const y0 = Y(0);
    const path = (key) => an.pts.map((p, i) => `${i ? "L" : "M"}${X(p.x).toFixed(1)},${Y(p[key]).toFixed(1)}`).join(" ");
    const area = (key) => `M${X(0)},${y0} ${an.pts.map((p) => `L${X(p.x).toFixed(1)},${Y(p[key]).toFixed(1)}`).join(" ")} L${X(L)},${y0} Z`;
    // etichette dei valori estremi: massimo di campata e minimo agli appoggi (M), estremi di campata (V)
    const labels = [];
    beam.spans.forEach((_, j) => {
        const sp = an.pts.filter((p) => p.span === j);
        if (isM) {
            const mx = sp.reduce((m, p) => (p.MmaxU > m.MmaxU ? p : m), sp[0]);
            if (mx.MmaxU > 0.05 * span) labels.push({ x: mx.x, v: mx.MmaxU, col: C_POS, below: true });
        } else {
            const a = sp[0], b = sp[sp.length - 1];
            if (Math.abs(a.VmaxU) > 0.05 * span) labels.push({ x: a.x, v: a.VmaxU, col: C_V, below: false, anchor: "start" });
            if (Math.abs(b.VminU) > 0.05 * span) labels.push({ x: b.x, v: b.VminU, col: C_V, below: true, anchor: "end" });
        }
    });
    if (isM) {
        const nodesX = [0, ...an.xs0.slice(1), L];
        nodesX.forEach((x) => {
            const v = valuesAt(an, x);
            if (v && v.MminU < -0.05 * span) labels.push({ x, v: v.MminU, col: C_NEG, below: false });
        });
    }
    const move = (e) => { const p = pickX(e, ref.current, L); if (p.x < 0 || p.x > L) { setHov(null); return; } setHov({ x: p.x, v: valuesAt(an, p.x) }); };
    const click = (e) => { const p = pickX(e, ref.current, L); if (p.x >= -0.02 && p.x <= L + 0.02) onPick(p.x); };
    return (
        <svg ref={ref} viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={isM ? "Diagramma del momento" : "Diagramma del taglio"}
            onMouseMove={move} onMouseLeave={() => setHov(null)} onClick={click} style={{ cursor: "crosshair" }}>
            {/* appoggi (richiami verticali) */}
            {[0, ...an.xs0.slice(1), L].map((x, i) => <line key={i} x1={X(x)} x2={X(x)} y1={top - 8} y2={bot + 8} stroke="#e2e8f0" />)}
            <line x1={X(0)} x2={X(L)} y1={y0} y2={y0} stroke="#334155" strokeWidth="1.2" />
            {series.filter(([, , dash]) => !dash).map(([key, col]) => <path key={`a${key}`} d={area(key)} fill={col} fillOpacity="0.1" />)}
            {series.map(([key, col, dash]) => <path key={key} d={path(key)} fill="none" stroke={col} strokeWidth={dash ? 1.3 : 1.8} strokeDasharray={dash ? "5 3" : undefined} />)}
            {labels.map((l, i) => (
                <text key={i} x={X(l.x)} y={l.below ? Y(l.v) + 13 : Y(l.v) - 5} fontSize="10" textAnchor={l.anchor ?? "middle"} fill={l.col} fontWeight="bold" stroke="#fff" strokeWidth="3" paintOrder="stroke">{fmt(l.v, 1)}</text>
            ))}
            {/* sezioni */}
            {beam.sections.map((s) => (
                <g key={s.id} onClick={(e) => { e.stopPropagation(); onOpen(s.id); }} style={{ cursor: "pointer" }}>
                    <line x1={X(s.x)} x2={X(s.x)} y1={top - 10} y2={bot + 10} stroke={C_SEC} strokeWidth="1.2" strokeDasharray="3 2" />
                    <rect x={X(s.x) - 6} y={top - 12} width="12" height={bot - top + 24} fill="transparent" />
                    <text x={X(s.x)} y={top - 12} fontSize="9" textAnchor="middle" fill={C_SEC} fontWeight="bold">{s.label.length > 6 ? s.label.slice(0, 6) : s.label}</text>
                </g>
            ))}
            {cursor && <CursorMark X={X} {...cursor} y1={top - 4} y2={bot + 10} />}
            {/* puntatore con i valori */}
            {hov && hov.v && (() => {
                const xs = X(hov.x), right = xs > W - 190;
                const rows = isM
                    ? [["x", `${fmt(hov.x, 2)} m`, "#334155"], ["M max", fmt(hov.v.MmaxU, 1), C_POS], ["M min", fmt(hov.v.MminU, 1), C_NEG], ...(show.T ? [["trasl.", `${fmt(hov.v.MmaxT, 1)} / ${fmt(hov.v.MminT, 1)}`, C_TRASL]] : [])]
                    : [["x", `${fmt(hov.x, 2)} m`, "#334155"], ["V max", fmt(hov.v.VmaxU, 1), C_V], ["V min", fmt(hov.v.VminU, 1), C_V]];
                const bx = right ? xs - 150 : xs + 10;
                return (
                    <g pointerEvents="none">
                        <line x1={xs} x2={xs} y1={top - 6} y2={bot + 6} stroke="#64748b" strokeWidth="0.8" />
                        <rect x={bx} y={top} width="140" height={rows.length * 14 + 8} rx="6" fill="#fff" fillOpacity="0.95" stroke="#cbd5e1" />
                        {rows.map(([a, b, c], i) => <g key={a}><text x={bx + 8} y={top + 15 + i * 14} fontSize="10" fill="#64748b">{a}</text><text x={bx + 132} y={top + 15 + i * 14} fontSize="10" textAnchor="end" fill={c} fontWeight="600">{b}</text></g>)}
                        <text x={xs} y={bot + 18} fontSize="9" textAnchor="middle" fill="#94a3b8">clic: aggiungi sezione</text>
                    </g>
                );
            })()}
        </svg>
    );
}

// ---------------------------------------------------------------------------
// TABELLA DELLE SEZIONI (valori automatici, sovrascrivibili)
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// CURSORE DI SEZIONE: slider e input per spostare la sezione attiva (o la
// posizione di una nuova), oltre al clic sui disegni
// ---------------------------------------------------------------------------
const C_CUR = "#0ea5e9";
function CursorMark({ X, x, isNew, y1, y2 }) {
    const xs = X(x);
    return (
        <g pointerEvents="none">
            <line x1={xs} x2={xs} y1={y1} y2={y2} stroke={C_CUR} strokeWidth="2" strokeOpacity="0.8" strokeDasharray={isNew ? "6 3" : undefined} />
            <path d={`M${xs - 6},${y1 - 9} h12 l-6,8 Z`} fill={C_CUR} />
        </g>
    );
}
function SectionCursorBar({ beam, L, curSec, curX, setCur, moveTo, onAdd, onOpen }) {
    const field = "rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100";
    return (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-600">
            <select value={curSec?.id ?? ""} onChange={(e) => setCur(e.target.value ? { id: e.target.value, x: null } : { id: null, x: curX })} aria-label="Sezione da spostare" className={`${field} cursor-pointer font-semibold text-slate-700`}>
                <option value="">Nuova sezione</option>
                {beam.sections.map((q) => <option key={q.id} value={q.id}>{q.label} · {fmt(q.x, 3)} m</option>)}
            </select>
            <input type="range" min="0" max={L} step="0.001" value={curX} onChange={(e) => moveTo(Number(e.target.value))} aria-label="Posizione della sezione"
                className="h-1.5 min-w-[160px] flex-1 cursor-pointer accent-sky-500" />
            <label className="inline-flex items-center gap-1">x
                <input type="number" step="0.001" min="0" max={L} value={curX} onChange={(e) => { if (e.target.value !== "") moveTo(Number(e.target.value)); }} aria-label="Ascissa della sezione"
                    className={`${field} w-20 text-right tabular-nums`} /> m
            </label>
            {curSec ? (
                <button type="button" onClick={() => onOpen(curSec.id)} className="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-sky-700" title={`Apri ${curSec.label}`}>Apri <ChevronRight size={12} /></button>
            ) : (
                <button type="button" onClick={onAdd} className="inline-flex items-center gap-1 rounded-lg border border-sky-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-sky-700 hover:bg-sky-50"><Plus size={12} /> Aggiungi sezione qui</button>
            )}
        </div>
    );
}

function SectionsTable({ beam, an, upd, openSection }) {
    const setS = (id, fn) => upd((b) => ({ ...b, sections: b.sections.map((s) => (s.id === id ? fn(s) : s)) }));
    const del = (id) => upd((b) => ({ ...b, sections: b.sections.filter((s) => s.id !== id) }));
    const cols = [["Mpos", <>M<sup>+</sup><sub>Ed</sub></>, "kNm"], ["Mneg", <>M<sup>−</sup><sub>Ed</sub></>, "kNm"], ["V", <>V<sub>Ed</sub></>, "kN"], ["Mrara", "M rara", "kNm"], ["Mqp", "M q.p.", "kNm"]];
    return (
        <Card title="Sezioni di calcolo">
            {beam.sections.length === 0 ? (
                <p className="text-sm text-slate-500">Nessuna sezione: clicca sullo schema o sui diagrammi, oppure usa «Sezioni caratteristiche».</p>
            ) : (
                <div className="scroll-thin-x pb-1">
                    <table className="w-full min-w-[720px] text-xs">
                        <thead>
                            <tr className="border-b border-slate-200 text-left text-[11px] text-slate-500">
                                <th className="py-1.5 pr-2 font-semibold">Sezione</th>
                                <th className="py-1.5 pr-2 font-semibold">x [m]</th>
                                {cols.map(([k, l, u]) => <th key={k} className="py-1.5 pr-2 font-semibold">{typeof l === "string" ? sub(l) : l} <span className="font-normal text-slate-400">[{u}]</span></th>)}
                                <th className="py-1.5 font-semibold">Stato</th>
                                <th />
                            </tr>
                        </thead>
                        <tbody>
                            {beam.sections.map((s) => {
                                const v = sectionValues(beam, an, s);
                                const st = s.check;
                                return (
                                    <tr key={s.id} className="border-b border-slate-100 align-middle">
                                        <td className="py-1.5 pr-2"><input value={s.label} onChange={(e) => setS(s.id, (x) => ({ ...x, label: e.target.value }))} className="w-24 rounded-md border border-slate-200 px-1.5 py-1 text-xs" /></td>
                                        <td className="py-1.5 pr-2"><input type="number" step="0.001" value={s.x} onChange={(e) => setS(s.id, (x) => ({ ...x, x: Math.min(an.Ltot, Math.max(0, num(e.target.value))) }))} className="w-20 rounded-md border border-slate-200 px-1.5 py-1 text-right text-xs tabular-nums" /></td>
                                        {cols.map(([k]) => {
                                            const manual = s.over?.[k] !== undefined && s.over?.[k] !== null && s.over?.[k] !== "";
                                            return (
                                                <td key={k} className="py-1.5 pr-2">
                                                    <input type="number" value={manual ? s.over[k] : ""} placeholder={fmt(v[k], 1)}
                                                        onChange={(e) => setS(s.id, (x) => ({ ...x, over: { ...x.over, [k]: e.target.value === "" ? null : e.target.value } }))}
                                                        title={manual ? "Valore inserito a mano (svuota per tornare al calcolo)" : "Valore calcolato: scrivi per sovrascriverlo"}
                                                        className={`w-20 rounded-md border px-1.5 py-1 text-xs tabular-nums ${manual ? "border-amber-300 bg-amber-50 font-semibold text-amber-800" : "border-slate-200 placeholder:text-slate-700"}`} />
                                                </td>
                                            );
                                        })}
                                        <td className="py-1.5 pr-2">{st ? <Status ok={st.ok} text={st.text} /> : <span className="text-slate-400">da fare</span>}</td>
                                        <td className="py-1.5 text-right whitespace-nowrap">
                                            <button type="button" onClick={() => openSection(s.id)} className="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-sky-700">Apri <ChevronRight size={12} /></button>
                                            <MiniBtn title="Elimina sezione" onClick={() => del(s.id)}><Trash2 size={12} /></MiniBtn>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    <p className="mt-2 text-[11px] text-slate-400">Le celle vuote mostrano i valori calcolati (inviluppo{beam.useTranslated !== false ? " traslato" : ""} per M⁺/M⁻); scrivendo un valore lo si sovrascrive (in ambra).</p>
                </div>
            )}
        </Card>
    );
}

// ---------------------------------------------------------------------------
// CASCATA DI UNA SEZIONE: progetto → verifica a flessione → taglio → fessurazione
// ---------------------------------------------------------------------------
const STEPS = [
    { id: "design", label: "1. Progetto" },
    { id: "bending", label: "2. Verifica a flessione" },
    { id: "shear", label: "3. Verifica a taglio" },
    { id: "crack", label: "4. Fessurazione (SLE)" },
    { id: "defl", label: "5. Deformabilità (SLE)" },
];

function SectionWorkspace({ beam, an, section, initialStep = null, onBack, updateBeam }) {
    const v = sectionValues(beam, an, section);
    const { b, h, c, fck, fyk } = beam.section;
    // momento di progetto: il più gravoso fra M⁺ e M⁻ (selezionabile)
    const signs = [v.Mpos > 1e-6 ? 1 : null, v.Mneg < -1e-6 ? -1 : null].filter(Boolean);
    const [sign, setSign] = useState(() => (Math.abs(v.Mneg) > Math.abs(v.Mpos) ? -1 : 1));
    const [step, setStep] = useState(() => (STEPS.some((q) => q.id === initialStep) ? initialStep : "design"));
    // atterrando sulla pagina della sezione lo scroll riparte dall'alto
    useLayoutEffect(() => {
        const main = document.querySelector("main.page-scroll");
        if (main) main.scrollTop = 0; else window.scrollTo(0, 0);
    }, []);
    const MEd = sign > 0 ? v.Mpos : v.Mneg;
    const adopted = section.adopted?.[sign > 0 ? "pos" : "neg"] ?? null;

    const onAdopted = useCallback((a) => {
        const k = sign > 0 ? "pos" : "neg";
        updateBeam((bm) => {
            const cur = bm.sections.find((s) => s.id === section.id);
            if (!cur || JSON.stringify(cur.adopted?.[k] ?? null) === JSON.stringify(a)) return bm;
            return { ...bm, sections: bm.sections.map((s) => (s.id === section.id ? { ...s, adopted: { ...(s.adopted ?? {}), [k]: a } } : s)) };
        });
    }, [updateBeam, section.id, sign]);

    // armature inferiore/superiore della sezione adottata
    const r1 = (x) => Math.round(x * 10) / 10;      // aree arrotondate a 0,1 mm²
    const bars = adopted ? (adopted.tensionTop ? { top: r1(adopted.AT), bot: r1(adopted.AC), phiT: adopted.phiT } : { bot: r1(adopted.AT), top: r1(adopted.AC), phiT: adopted.phiT }) : null;
    const hA = adopted?.h ?? h;
    // verifica a flessione per M⁺ e M⁻ con la stessa armatura (riepilogo)
    const checks = bars ? [v.Mpos, v.Mneg].filter((m) => Math.abs(m) > 1e-6).map((m) => {
        const r = verifySection({ b, h: hA, c, cPrime: c, As: bars.bot, AsPrime: bars.top, fck, fyk, alphaCc: 0.85, gammaC: 1.5, gammaS: 1.15, NEd: 0, MEd: m, concreteModel: "rectangular", steelModel: "ep", ks: 1.15 });
        return { m, ok: r.ok && r.verified, util: r.ok ? r.utilization : Infinity, MRd: r.ok ? r.MRdAtN : null };
    }) : [];

    // stato riassuntivo salvato nella sezione (per la tabella)
    const summary = checks.length ? { ok: checks.every((q) => q.ok), text: checks.map((q) => `${q.m > 0 ? "M⁺" : "M⁻"} ${fmt(q.util * 100, 0)}%`).join(" · ") } : null;
    const summaryKey = JSON.stringify(summary);
    useEffect(() => {
        updateBeam((bm) => {
            const cur = bm.sections.find((s) => s.id === section.id);
            if (!cur || JSON.stringify(cur.check ?? null) === summaryKey) return bm;
            return { ...bm, sections: bm.sections.map((s) => (s.id === section.id ? { ...s, check: summary } : s)) };
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [summaryKey]);

    const designInput = { mode: "fixBH", B: b, h, MEd, NEd: 0, dInf: c, dSup: c, fck, fyk, beta: 0, steelGrade: STEEL_GRADES.find((g) => g.fyk === fyk)?.id ?? "B450C" };
    const tensionA = bars ? (MEd >= 0 ? bars.bot : bars.top) : 0;
    const verifyInput = bars ? { b, h: hA, c, cPrime: c, As: bars.bot, AsPrime: bars.top, MEd, NEd: 0, fck, fyk } : null;
    const shearInput = bars ? { bw: b, h: hA, c, VEd: v.V, NEd: 0, Asl: tensionA, fck, fyk, cotgTheta: beam.cotTheta, alpha: beam.alphaDeg, phiSw: adopted.phiStirrup ?? 8 } : null;
    const Mser = v.Mqp;                               // fessurazione: combinazione quasi permanente
    const crackInput = bars ? { b, h: hA, c, cPrime: c, As: Mser >= 0 ? bars.bot : bars.top, AsPrime: Mser >= 0 ? bars.top : bars.bot, phi: bars.phiT, MSer: Math.abs(Mser), fck, longTerm: true } : null;
    const key = (o) => JSON.stringify(o);
    // verifica mostrata: quelle che richiedono l'armatura partono dal progetto
    // finché la sezione non ne ha una adottata
    const shown = step !== "design" && step !== "defl" && !bars ? "design" : step;

    return (
        <div className="space-y-4">
            {/* intestazione della sezione: sticky sotto il titolo della pagina */}
            <div className="sticky z-20 bg-slate-100 pb-1" style={{ top: "var(--tool-header-h, 0px)" }}>
            <Card>
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"><ArrowLeft size={14} /> {beam.name}</button>
                        <div>
                            <p className="text-sm font-bold text-slate-800">{beam.name} › {section.label}</p>
                            <p className="text-xs text-slate-500">x = {fmt(section.x, 3)} m · sezione {b}×{h} mm · copriferro {c} mm</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
                        {STEPS.map((s) => (
                            <button key={s.id} type="button" onClick={() => setStep(s.id)} disabled={s.id !== "design" && s.id !== "defl" && !bars}
                                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${shown === s.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>{s.label}</button>
                        ))}
                    </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
                    {bars
                        ? <span className="text-[11px] text-slate-400">Armatura adottata: inferiore {fmt(bars.bot, 0)} mm², superiore {fmt(bars.top, 0)} mm²</span>
                        : <span className="text-[11px] text-slate-500">Completa il progetto: l'armatura adottata passa automaticamente alle verifiche.</span>}
                    {signs.length > 1 && (
                        <div className="flex items-center gap-2 text-xs text-slate-600">
                            Momento di progetto:
                            <div className="inline-flex rounded-lg bg-slate-100 p-0.5">
                                {signs.map((sg) => (
                                    <button key={sg} type="button" onClick={() => setSign(sg)} className={`rounded-md px-2 py-1 font-semibold ${sign === sg ? "bg-white shadow-sm" : "text-slate-500"}`} style={{ color: sign === sg ? (sg > 0 ? C_POS : C_NEG) : undefined }}>
                                        {sg > 0 ? `M⁺ = ${fmt(v.Mpos, 1)}` : `M⁻ = ${fmt(v.Mneg, 1)}`}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </Card>
            </div>

            {shown === "design" && <SectionDesignTool key={`d${sign}${key(designInput)}`} initialInput={designInput} onAdopted={onAdopted} />}
            {shown === "bending" && verifyInput && <VerifySectionTool key={`v${key(verifyInput)}`} initialInput={verifyInput} />}
            {shown === "shear" && shearInput && <VerifyShearTool key={`s${key(shearInput)}`} initialInput={shearInput} />}
            {shown === "crack" && crackInput && (
                <>
                    <p className="text-xs text-slate-500">{sub(`Fessurazione con la combinazione quasi permanente: M_qp = ${fmt(Mser, 1)} kNm (rara: ${fmt(v.Mrara, 1)} kNm). Armatura tesa dal lato ${Mser >= 0 ? "inferiore" : "superiore"}.`)}</p>
                    <VerifyCrackTool key={`c${key(crackInput)}`} initialInput={crackInput} />
                </>
            )}
            {shown === "defl" && <DeflectionStep beam={beam} an={an} section={section} updateBeam={updateBeam} />}
        </div>
    );
}

// ---------------------------------------------------------------------------
// PANNELLO LATERALE dei dati della trave: le modifiche si vedono subito nei disegni
// ---------------------------------------------------------------------------
function EditDrawer({ title, onClose, children }) {
    const { isVisible, close, finishClose } = useModalTransition(onClose);
    useEffect(() => {
        const onKey = (e) => { if (e.key === "Escape") close(); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [close]);
    return toModalRoot(
        <div className={`fixed inset-0 z-50 ${modalBackdropCls(isVisible)}`} onTransitionEnd={finishClose} role="dialog" aria-modal="true" aria-label={title}>
            {/* sfondo trasparente: i diagrammi restano visibili e cliccando fuori si chiude */}
            <div className="absolute inset-0 bg-slate-900/10" onClick={close} />
            <aside className={`absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-slate-200 bg-slate-50 shadow-2xl ${drawerPanelCls(isVisible)}`}>
                <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
                    <div>
                        <p className="text-sm font-bold text-slate-800">{title}</p>
                        <p className="text-[11px] text-slate-500">Sezione, schema statico, carichi, combinazioni e traslazione: i disegni si aggiornano subito.</p>
                    </div>
                    <button type="button" onClick={close} aria-label="Chiudi" title="Chiudi (Esc)" className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"><X size={18} /></button>
                </div>
                <div className="scroll-thin flex-1 space-y-4 py-4 pl-4 pr-3">{children}</div>
            </aside>
        </div>
    );
}

// ---------------------------------------------------------------------------
// PRIMITIVI UI
// ---------------------------------------------------------------------------
function Card({ title, subtitle = null, right, children }) {
    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            {(title || right) && (
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    {title && <div className="min-w-0"><h3 className="text-sm font-bold text-slate-800">{title}</h3>{subtitle && <p className="mt-0.5 text-[11px] text-slate-500">{subtitle}</p>}</div>}
                    {right}
                </div>
            )}
            {children}
        </section>
    );
}
function IconBtn({ children, onClick, title }) {
    return <button type="button" onClick={onClick} title={title} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50">{children}</button>;
}
function MiniBtn({ children, onClick, title }) {
    return <button type="button" onClick={onClick} title={title} aria-label={title} className="ml-1 rounded-md p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800">{children}</button>;
}
function Status({ ok, text }) {
    return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{ok ? <CheckCircle2 size={12} /> : <XCircle size={12} />}{sub(text)}</span>;
}
function Legend({ items }) {
    return (
        <div className="mt-1 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
            {items.map(([c, l, dash]) => <span key={l} className="inline-flex items-center gap-1.5"><span className="inline-block w-5 border-t-2" style={{ borderColor: c, borderStyle: dash ? "dashed" : "solid" }} />{sub(l)}</span>)}
        </div>
    );
}
function NumField({ label, unit, value, onChange, small = false }) {
    return (
        <label className="block">
            <span className={`mb-1 block font-semibold text-slate-500 ${small ? "text-[11px]" : "text-xs"}`}>{sub(label)}{unit && <span className="ml-1 font-normal text-slate-400">[{unit}]</span>}</span>
            <input type="number" step="any" value={value} onChange={(e) => onChange(num(e.target.value))}
                className={`w-full rounded-xl border border-slate-200 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100 ${small ? "px-2 py-1 text-xs" : "px-3 py-2 text-sm"}`} />
        </label>
    );
}
function TextField({ label, value, onChange }) {
    return (
        <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-500">{label}</span>
            <input value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100" />
        </label>
    );
}
function SelField({ label, value, onChange, options }) {
    return (
        <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-500">{label}</span>
            <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100">
                {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
        </label>
    );
}
