// src/components/concrete/DomainFieldsTool.jsx
//
// Laboratorio (temporaneo): costruzione del dominio M-N campo per campo con le
// formule degli appunti della prof., per controllarle prima di riscrivere la
// verifica sezione.
//
// Struttura comune a ogni campo (accordion), da riusare per i campi 2–6:
//   barra comandi: ramo (M > 0 / M < 0) e "numeri sostituiti" del campo
//   1. Intervallo e stati deformativi   (formule + diagramma delle deformazioni)
//   2. Legami costitutivi               (tratti percorsi dai materiali, punto corrente)
//   3. Congruenza e sottocampi          (deformazioni in funzione di ξ, confini)
//   4. Equazioni di campo               (dimensionali e adimensionali, per sottocampo)
//   5. Stato corrente                   (cursore ξ del campo, valori, forze, confronto numerico)
//   6. Punti caratteristici e osservazioni
// Fuori dagli accordion: dati, dominio con assi fissi, cursore ξ globale e ramo globale.

import { createContext, memo, useContext, useDeferredValue, useMemo, useRef, useState } from "react";
import { ChevronDown, CheckCircle2, XCircle, Hourglass } from "lucide-react";
import Tex, { Eq, fmtNum, texNum as T } from "../Tex";
import { CONCRETE_CLASSES, STEEL_GRADES } from "../../lib/concrete/sectionDesign";
import {
    DEFAULT_DOMAIN_INPUT, EPS_C2, FIELDS, branchParams, domainExtents, field1, field2, field3, field4, field5, field6, fieldOf, numericPivotA, numericPivotB, numericPivotC, psiLambda, pureTension, sigmaC,
} from "../../lib/concrete/domainFields";

const FIELD_COL = { 1: "#7c3aed", 2: "#2563eb", 3: "#db2777", 4: "#ca8a04", 5: "#ea580c", 6: "#dc2626" };
const F1_COL = FIELD_COL[1];
const CUR_COL = "#16a34a";    // stato corrente (verde, come negli appunti)
const GLB_COL = "#0f172a";    // punto del cursore globale
const LIM_COL = "#2563eb";    // retta limite 1/2 (blu, come negli appunti)
const SUB_COL = "#ea580c";    // confine fra sottocampi
const CONC_COL = "#a16207";   // calcestruzzo compresso (σ_c, C_c)
const CONC_PT = "#78350f";    // punto del lembo di calcestruzzo (nel diagramma e nel legame), distinto dal verde dell'acciaio
const SUB1A_COL = "#4c1d95"; // sottocampo 1a: viola scuro
const SUB1B_COL = "#c4b5fd"; // sottocampo 1b: viola chiaro (lavanda)
const AS_COL = "#0f172a", ASP_COL = "#64748b";

// pedici nel testo semplice: "ε′_su", "A′_s", "N_Rd" → ε′<sub>su</sub> ...
// hs: per l'HTML (<sub>), ss: per l'SVG (<tspan> abbassato)
const SUBX = /([A-Za-zα-ωΑ-ΩφΦ][′']*)_([A-Za-z0-9/]+)/g;
const splitSub = (text, mk) => {
    if (typeof text !== "string") return text;
    const out = []; let last = 0;
    for (const m of text.matchAll(SUBX)) {
        if (m.index > last) out.push(text.slice(last, m.index));
        out.push(m[1], mk(m[2], m.index));
        last = m.index + m[0].length;
    }
    if (!out.length) return text;
    if (last < text.length) out.push(text.slice(last));
    return out;
};
const hs = (t) => splitSub(t, (x, k) => <sub key={k}>{x}</sub>);
const ss = (t) => splitSub(t, (x, k) => <tspan key={k} baselineShift="-0.12em" fontSize="70%">{x}</tspan>);

// similitudini fra triangoli del campo 1: triangolo grande (ambra) e piccolo (azzurro)
const TRI1_COL = "#d97706", TRI2_COL = "#0284c7";
const TRI_TEX = {
    cur: String.raw`\color{#0284c7}\dfrac{\varepsilon'_s}{d''-x}\color{black}=\color{#d97706}\dfrac{\varepsilon_{su}}{d-x}\color{black}\;\Rightarrow\;\varepsilon'_s=\dfrac{\varepsilon_{su}}{d-x}\,(d''-x)`,
    s12: String.raw`\color{#0284c7}\dfrac{\varepsilon'_{s1/2}}{d''}\color{black}=\color{#d97706}\dfrac{\varepsilon_{su}}{d}\color{black}\;\Rightarrow\;\varepsilon'_{s1/2}=\varepsilon_{su}\,\delta''`,
    ab: String.raw`\color{#d97706}\dfrac{\varepsilon_{su}-\varepsilon'_{se}}{d-d''}\color{black}=\color{#0284c7}\dfrac{\varepsilon'_{se}}{d''-x_{1a/1b}}`,
};
const TRI_NOTE = {
    cur: "Vertice comune nel punto dell'asse neutro (x ≤ 0, sopra il lembo superiore), sulla retta dello stato corrente.",
    s12: "Retta limite 1/2: vertice comune in O (x = 0).",
    ab: "Retta di confine 1a/1b: triangolo sopra A′s con vertice nell'asse neutro x1a/1b e triangolo fra A′s e A.",
};

// sezioni di esempio (300×500, 6φ16 + 2φ16): cambia solo il copriferro superiore d″
const EXAMPLES = [
    { id: "c2", title: "A′s snerva nel campo 2 → sottocampi 2a, 2b, 3b", desc: "d″ = 40 mm: δ″ = 0,087 < 0,114", values: { b: 300, h: 500, dInf: 40, dSup: 40, As: 1206, AsP: 402 } },
    { id: "c3", title: "A′s snerva nel campo 3 → sottocampi 2a, 3a, 3b", desc: "d″ = 90 mm: 0,114 < δ″ = 0,196 < 0,283", values: { b: 300, h: 500, dInf: 40, dSup: 90, As: 1206, AsP: 402 } },
    { id: "c4", title: "A′s snerva nel campo 4 → sottocampi 2a, 3a, 4a, 4b", desc: "d″ = 150 mm (copriferro molto spesso, caso raro): δ″ = 0,326 > 0,283", values: { b: 300, h: 500, dInf: 40, dSup: 150, As: 1206, AsP: 402 } },
];

const pm = (eps, dec = 2) => `${T(eps * 1000, dec)}\\text{‰}`;

// cursore di un campo: s ∈ [0, 1000] su un intervallo (a, b), con a/b anche ±∞
const sliderToXi = (s, a, b) => {
    if (a === -Infinity && b === Infinity) {
        const t = s / 500 - 1;
        return t <= -1 ? -Infinity : t >= 1 ? Infinity : t / (1 - Math.abs(t));
    }
    if (a === -Infinity) { const u = 1 - s / 1000; return s === 0 ? -Infinity : b - u / (1 - u); }
    if (b === Infinity) { const u = s / 1000; return s === 1000 ? Infinity : a + u / (1 - u); }
    return a + ((b - a) * s) / 1000;
};
const xiTex = (xi) => (xi === -Infinity ? "-\\infty" : xi === Infinity ? "+\\infty" : T(xi, 4));
const xiTxt = (xi) => (xi === -Infinity ? "−∞" : xi === Infinity ? "+∞" : fmtNum(xi, 4));

// "numeri sostituiti" (per campo): F mostra formula = numeri = risultato
// oppure solo formula = risultato
const NumCtx = createContext(false);
function F({ lhs, sym, num, val, br = true }) {
    const show = useContext(NumCtx);
    return <Eq lhs={lhs} sym={sym} num={show ? num : null} val={val} breakLine={br} />;
}

export default function DomainFieldsTool() {
    const [input, setInput] = useState(DEFAULT_DOMAIN_INPUT);
    const [open, setOpen] = useState({ 1: true });
    const [adim, setAdim] = useState(false);
    const [allMode, setAllMode] = useState("fields"); // vista del disegno unico (campi / profilo)
    const [gBranch, setGBranch] = useState(1);   // ramo globale
    const [gSlider, setGSlider] = useState(400); // ξ globale (−∞ … +∞)
    // stato di ciascun campo: ramo, cursore, numeri sostituiti
    // stato di tutti i campi creato subito: riferimenti stabili → i campi non toccati
    // non si ridisegnano (React.memo) quando si muove il cursore di un altro campo
    const [fs, setFs] = useState(() => Object.fromEntries(FIELDS.map((f) => [f.id, { branch: 1, slider: f.id === 1 ? 700 : 500, num: false }])));
    const fState = (id) => fs[id];
    const setters = useMemo(() => Object.fromEntries(FIELDS.map((f) => [f.id, (patch) => setFs((s) => ({ ...s, [f.id]: { ...s[f.id], ...patch } }))])), []);
    const setF = (id) => setters[id];
    // il ramo globale si applica anche a tutti i campi (che restano modificabili)
    const changeGlobalBranch = (v) => {
        setGBranch(v);
        setFs((s) => Object.fromEntries(Object.entries(s).map(([k, st]) => [k, { ...st, branch: v }])));
    };

    const setNum = (k) => (v) => setInput((s) => ({ ...s, [k]: Number(v) || 0 }));
    const valid = input.b > 0 && input.h > input.dInf + input.dSup && input.dInf > 0 && input.dSup > 0;

    const data = useMemo(() => {
        if (!valid) return null;
        const pos = branchParams(input, 1), neg = branchParams(input, -1);
        return { pos, neg, f1pos: field1(pos), f1neg: field1(neg), f2pos: field2(pos), f2neg: field2(neg), f3pos: field3(pos), f3neg: field3(neg), f4pos: field4(pos), f4neg: field4(neg), f5pos: field5(pos), f5neg: field5(neg), f6pos: field6(pos), f6neg: field6(neg), pt: pureTension(input), ext: domainExtents(input) };
    }, [input, valid]);

    // punto del cursore globale (solo nei campi già implementati)
    const gXi = sliderToXi(gSlider, -Infinity, Infinity);
    const global = data && (() => {
        const p = gBranch > 0 ? data.pos : data.neg;
        const field = fieldOf(p, gXi);
        const pt = field === 1 ? (gBranch > 0 ? data.f1pos : data.f1neg).point(gXi)
            : field === 2 ? (gBranch > 0 ? data.f2pos : data.f2neg).point(gXi)
                : field === 3 ? (gBranch > 0 ? data.f3pos : data.f3neg).point(gXi)
                    : field === 4 ? (gBranch > 0 ? data.f4pos : data.f4neg).point(gXi)
                        : field === 5 ? (gBranch > 0 ? data.f5pos : data.f5neg).point(gXi)
                            : (gBranch > 0 ? data.f6pos : data.f6neg).point(gXi);
        return { field, pt };
    })();
    // punti dei campi aperti (cursore del campo)
    const locals = data ? FIELDS.filter((f) => f.ready && open[f.id]).map((f) => {
        const st = fState(f.id);
        if (f.id === 6) {
            const f6 = st.branch > 0 ? data.f6pos : data.f6neg;
            return { id: 6, pt: f6.point(sliderToXi(st.slider, f6.xi0, Infinity)) };
        }
        if (f.id === 5) {
            const f5 = st.branch > 0 ? data.f5pos : data.f5neg;
            return { id: 5, pt: f5.point(sliderToXi(st.slider, 1, f5.xiE)) };
        }
        if (f.id === 4) {
            const f4 = st.branch > 0 ? data.f4pos : data.f4neg;
            return { id: 4, pt: f4.point(sliderToXi(st.slider, f4.xiN, 1)) };
        }
        if (f.id === 3) {
            const f3 = st.branch > 0 ? data.f3pos : data.f3neg;
            return { id: 3, pt: f3.point(sliderToXi(st.slider, f3.xiH, f3.xiN)) };
        }
        if (f.id === 2) {
            const f2 = st.branch > 0 ? data.f2pos : data.f2neg;
            return { id: 2, pt: f2.point(sliderToXi(st.slider, 0, f2.xiH)) };
        }
        const fl = st.branch > 0 ? data.f1pos : data.f1neg;
        return { id: f.id, pt: fl.point(sliderToXi(st.slider, -Infinity, 0)) };
    }) : [];

    // pedici HTML piccoli e vicini alla lettera (abbassati di poco); KaTeX non usa <sub>
    return (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[340px_minmax(0,1fr)] [&_sub]:text-[0.72em] [&_sub]:bottom-[-0.12em]">
            {/* -------- INPUT -------- */}
            <div className="space-y-4">
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
                    Sezione di laboratorio <b>temporanea</b>: dominio M-N costruito campo per campo con le formule
                    degli appunti, confrontate con un calcolo numerico indipendente. Sarà rimossa quando la teoria
                    sarà integrata nella Verifica sezione.
                </div>
                {/* sezioni di esempio: dove snerva A′s in compressione dipende da δ″ = d″/d
                    (soglie (ε_cu − ε_se)/(ε_cu + ε_su) ≈ 0,114 e (ε_cu − ε_se)/(ε_cu + ε_se) ≈ 0,283) */}
                <Card title="Sezione di esempio">
                    <div className="grid grid-cols-1 gap-2">
                        {EXAMPLES.map((ex) => {
                            const active = Object.entries(ex.values).every(([k, v]) => input[k] === v);
                            return (
                                <button key={ex.id} type="button" onClick={() => setInput((s) => ({ ...s, ...ex.values }))}
                                    className={`cursor-pointer rounded-xl border px-3 py-2 text-left transition ${active ? "border-sky-400 bg-sky-50" : "border-slate-200 bg-white hover:bg-slate-50"}`}>
                                    <span className="block text-xs font-semibold text-slate-700">{ex.title}</span>
                                    <span className="block text-[11px] leading-4 text-slate-500">{hs(ex.desc)}</span>
                                </button>
                            );
                        })}
                    </div>
                </Card>
                <Card title="Geometria">
                    <div className="grid grid-cols-2 gap-3">
                        <NumberField label="Base b" unit="mm" value={input.b} onChange={setNum("b")} />
                        <NumberField label="Altezza h" unit="mm" value={input.h} onChange={setNum("h")} />
                        <NumberField label="d′ (copr. inferiore)" unit="mm" value={input.dInf} onChange={setNum("dInf")} />
                        <NumberField label="d″ (copr. superiore)" unit="mm" value={input.dSup} onChange={setNum("dSup")} />
                    </div>
                </Card>
                <Card title="Armature">
                    <div className="grid grid-cols-2 gap-3">
                        <NumberField label={hs("A_s (inferiore)")} unit="mm²" value={input.As} onChange={setNum("As")} />
                        <NumberField label={hs("A′_s (superiore)")} unit="mm²" value={input.AsP} onChange={setNum("AsP")} />
                    </div>
                </Card>
                <Card title="Materiali">
                    <div className="grid grid-cols-2 gap-3">
                        <SelectField label="Calcestruzzo" value={input.fck} onChange={setNum("fck")}
                            options={CONCRETE_CLASSES.map((c) => ({ value: c.fck, label: c.id }))} />
                        <SelectField label="Acciaio" value={input.fyk} onChange={setNum("fyk")}
                            options={STEEL_GRADES.filter((s, i, a) => a.findIndex((t) => t.fyk === s.fyk) === i).map((s) => ({ value: s.fyk, label: `${s.id} (fyk ${s.fyk})` }))} />
                        <NumberField label={hs("ε_su")} unit="‰" value={input.epsSu * 1000} onChange={(v) => setInput((s) => ({ ...s, epsSu: (Number(v) || 0) / 1000 }))} />
                        <NumberField label={hs("ε_cu")} unit="‰" value={input.epsCu * 1000} onChange={(v) => setInput((s) => ({ ...s, epsCu: (Number(v) || 0) / 1000 }))} />
                    </div>
                    {data && (
                        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 border-t border-slate-100 pt-3 text-xs text-slate-600">
                            <span>d = h − d′ = <b>{fmtNum(data.pos.d, 1)}</b> mm</span>
                            <span>f<sub>cd</sub> = <b>{fmtNum(data.pos.fcd, 2)}</b> MPa</span>
                            <span>f<sub>yd</sub> = <b>{fmtNum(data.pos.fyd, 2)}</b> MPa</span>
                            <span>ε′<sub>se</sub> = f<sub>yd</sub>/E<sub>s</sub> = <b>{fmtNum(data.pos.epsSe * 1000, 3)}</b>‰</span>
                        </div>
                    )}
                </Card>
            </div>

            {/* -------- DOMINIO, CURSORE GLOBALE E CAMPI -------- */}
            <div className="space-y-4">
                {!data && <Card title="Dati non validi"><p className="text-sm text-red-600">Controlla dimensioni e copriferri (h &gt; d′ + d″).</p></Card>}
                {data && (
                    <>
                        <Card title="Dominio M-N (campi implementati)" right={
                            <Segmented value={adim ? "adim" : "dim"} onChange={(v) => setAdim(v === "adim")}
                                options={[{ value: "dim", label: "N, M" }, { value: "adim", label: "ν, μ" }]} />}>
                            <DomainChart data={data} adim={adim} global={global} locals={locals} />
                            {/* cursore e ramo globali */}
                            <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span className="text-xs font-semibold text-slate-600">Esplora l'intero dominio</span>
                                    <Segmented value={gBranch} onChange={changeGlobalBranch}
                                        options={[{ value: 1, label: "Ramo M > 0" }, { value: -1, label: "Ramo M < 0" }]} />
                                </div>
                                <XiSlider value={gSlider} onChange={setGSlider} left="−∞" right="+∞" accent="accent-slate-800" />
                                <p className="text-xs text-slate-600">
                                    ξ = <b>{xiTxt(gXi)}</b> → <b style={{ color: FIELD_COL[global.field] }}>campo {global.field}{global.pt ? ` (${global.pt.sub})` : ""}</b>
                                    {global.pt
                                        ? <> · N<sub>Rd</sub> = <b>{fmtNum(global.pt.N, 1)}</b> kN · M<sub>Rd</sub> = <b>{fmtNum(global.pt.M, 2)}</b> kNm</>
                                        : <span className="text-slate-400"> · non ancora implementato</span>}
                                </p>
                            </div>
                        </Card>

                        {FIELDS.map((f) => (
                            <Accordion key={f.id} field={f} isOpen={!!open[f.id]} onToggle={() => setOpen((s) => ({ ...s, [f.id]: !s[f.id] }))}>
                                {f.id === 1 ? <FieldOneM data={data} st={fState(1)} set={setF(1)} />
                                    : f.id === 2 ? <FieldTwoM data={data} st={fState(2)} set={setF(2)} />
                                        : f.id === 3 ? <FieldThreeM data={data} st={fState(3)} set={setF(3)} />
                                            : f.id === 4 ? <FieldFourM data={data} st={fState(4)} set={setF(4)} />
                                                : f.id === 5 ? <FieldFiveM data={data} st={fState(5)} set={setF(5)} />
                                                    : f.id === 6 ? <FieldSixM data={data} st={fState(6)} set={setF(6)} />
                                            : <Pending field={f} data={data} />}
                            </Accordion>
                        ))}

                        {/* disegno unico: tutti i campi, comandato dal cursore e dal ramo globali */}
                        <AllFieldsCard data={data} branch={gBranch} onBranch={changeGlobalBranch} slider={gSlider} onSlider={setGSlider}
                            mode={allMode} onMode={setAllMode} pt={global?.pt} />
                    </>
                )}
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Barra comandi comune ai campi
// ---------------------------------------------------------------------------
function FieldToolbar({ st, set, note }) {
    return (
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 px-3 py-2">
            <Segmented value={st.branch} onChange={(v) => set({ branch: v })}
                options={[{ value: 1, label: "Ramo M > 0" }, { value: -1, label: "Ramo M < 0" }]} />
            <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-600">
                <input type="checkbox" checked={st.num} onChange={(e) => set({ num: e.target.checked })} className="cursor-pointer accent-sky-600" />
                Numeri sostituiti
            </label>
            {note && <span className="text-xs text-slate-500">{hs(note)}</span>}
        </div>
    );
}

// ---------------------------------------------------------------------------
// CAMPO 1
// ---------------------------------------------------------------------------
function FieldOne({ data, st, set }) {
    const p = st.branch > 0 ? data.pos : data.neg;
    const f = st.branch > 0 ? data.f1pos : data.f1neg;
    const xi = sliderToXi(st.slider, -Infinity, 0);
    const xiB = useDeferredValue(xi); // blocchi 2–6: aggiornati subito dopo, senza bloccare il cursore
    const cur = f.point(xi);
    const d1 = T(p.delta1, 4), d2 = T(p.delta2, 4), eSu = T(p.epsSu, 4), eSe = T(p.epsSe, 5);
    const sgnM = st.branch < 0 ? "-" : "";

    return (
        <NumCtx.Provider value={st.num}>
            <div className="space-y-5">
                <FieldToolbar st={st} set={set} note={st.branch > 0
                    ? "A_s inferiore a ε_su (pivot A in basso), A′_s superiore."
                    : "Sezione ribaltata: pivot A sull'armatura superiore; A_s ↔ A′_s, d′ ↔ d″, M cambia segno."} />

                {/* 1. intervallo e stati deformativi */}
                <Block n="1" title="Intervallo e stati deformativi">
                    <div className="space-y-4">
                        <div className="tex-left space-y-1 text-sm text-slate-600">
                            <Tex display>{String.raw`-\infty < x \le 0 \quad\Longleftrightarrow\quad -\infty < \xi \le 0,\qquad \xi=\dfrac{x}{d}`}</Tex>
                            <p className="text-xs">Pivot A: armatura {st.branch > 0 ? "inferiore" : "superiore"} a ε<sub>su</sub>; asse neutro esterno, calcestruzzo tutto teso (non reagente).</p>
                            <p className="text-xs">L'armatura opposta va da ε′<sub>s1/2</sub> (retta limite 1/2, ξ = 0, in blu) a ε<sub>su</sub> (ξ → −∞, deformazione uniforme, in grigio). In verde lo stato corrente, scelto con il cursore sotto il disegno.</p>
                            <p className="text-xs">Sopra e sotto: legami σ-ε di A′<sub>s</sub> e A<sub>s</sub> con la stessa scala delle deformazioni; in evidenza i tratti percorsi nel campo.</p>
                        </div>
                        {/* disegno interattivo centrato sotto il testo: a sinistra interruttore +
                            riquadro del cursore e, sotto, i triangoli simili (in alto); a destra i diagrammi (impilati su schermi stretti) */}
                        <div className="flex w-full flex-col items-center gap-3">
                            <div className="flex w-full flex-wrap items-start justify-center gap-3">
                                <div className="flex justify-center">
                                    <Segmented small value={st.hl ?? "fields"} onChange={(v) => set({ hl: v })} options={[{ value: "fields", label: "Sottocampi" }, { value: "profile", label: "Profilo" }, { value: "triangles", label: "Triangoli simili" }]} />
                                </div>
                                <MiniXiSlider value={st.slider} onChange={(v) => set({ slider: v })} left="−∞" right="0" sub={cur.sub} items={[
                                    { label: "ξ", value: xiTxt(xi) },
                                    { label: "x", value: xi === -Infinity ? "−∞" : `${fmtNum(xi * p.d, 1)} mm` },
                                    { label: "ε′_s", value: `${fmtNum(cur.epsSP * 1000, 2)}‰` },
                                ]} />
                                {st.hl === "triangles" && (() => {
                                    const tri = !f.has1b && st.tri === "ab" ? "cur" : (st.tri ?? "cur");
                                    return (
                                        <div className="w-full max-w-[340px] space-y-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2">
                                            <div className="flex justify-center">
                                                <Segmented small value={tri} onChange={(v) => set({ tri: v })} options={[
                                                    { value: "cur", label: hs("ε′_s(ξ)") },
                                                    { value: "s12", label: hs("ε′_s1/2") },
                                                    ...(f.has1b ? [{ value: "ab", label: hs("ξ_1a/1b") }] : []),
                                                ]} />
                                            </div>
                                            <div className="tex-left text-sm"><Tex display>{TRI_TEX[tri]}</Tex></div>
                                            <p className="text-[11px] leading-4 text-slate-500">{TRI_NOTE[tri]}</p>
                                        </div>
                                    );
                                })()}
                            </div>
                            <div className="w-full">
                                <StrainDiagram p={p} f={f} xi={xi} branch={st.branch} mode={st.hl ?? "fields"} tri={!f.has1b && st.tri === "ab" ? "cur" : (st.tri ?? "cur")} onSlider={(v) => set({ slider: v })} />
                            </div>
                        </div>
                    </div>
                </Block>

                <Lazy deps={[p, f, xiB, st.num, st.branch, data]} render={() => {
                    const xi = xiB; const cur = f.point(xi); const ref = numericPivotA(p, xi); const errN = Math.abs(cur.N - ref.N), errM = Math.abs(cur.M - ref.M); const ok = errN < 1e-6 && errM < 1e-6;
                    return (<>
                {/* 2. legami costitutivi */}
                <Block n="2" title="Legami costitutivi">
                    <div className="space-y-1 text-xs leading-5 text-slate-600">
                        <p>I legami σ-ε sono disegnati sopra (A′<sub>s</sub>) e sotto (A<sub>s</sub>) il diagramma delle deformazioni del blocco 1, con la stessa scala delle deformazioni (trazioni verso sinistra), come negli appunti.</p>
                        <p><b>Acciaio</b> elastico-perfettamente plastico: E<sub>s</sub> = 200 000 MPa, f<sub>yd</sub> = {fmtNum(p.fyd, 2)} MPa, ε′<sub>se</sub> = {fmtNum(p.epsSe * 1000, 3)}‰, ε<sub>su</sub> = {fmtNum(p.epsSu * 1000, 1)}‰.</p>
                        <p>• A<sub>s</sub> è sempre nel pivot A: ε<sub>s</sub> = ε<sub>su</sub>, σ<sub>s</sub> = f<sub>yd</sub> (punto fisso).</p>
                        <p>• A′<sub>s</sub> percorre {f.has1b ? <>il tratto elastico da ε′<sub>s1/2</sub> a ε′<sub>se</sub> (1b) e quello plastico fino a ε<sub>su</sub> (1a)</> : <>solo il tratto plastico (1a)</>}; il punto verde è lo stato corrente.</p>
                        <p><b>Calcestruzzo</b>: tutto teso, non reagente (nessun contributo nel campo 1).</p>
                    </div>
                </Block>

                {/* 3. congruenza e sottocampi */}
                <Block n="3" title="Congruenza e sottocampi">
                    <div className="tex-left space-y-1">
                        <Tex display>{String.raw`\varepsilon_s=\varepsilon_{su}\qquad\varepsilon'_s=\dfrac{\varepsilon_{su}}{d-x}\,(d''-x)\;\Longleftrightarrow\;\varepsilon'_s=\dfrac{\varepsilon_{su}}{1-\xi}\,(\delta''-\xi)`}</Tex>
                        <F lhs="\delta''" sym="\dfrac{d''}{d}" num={String.raw`\dfrac{${T(p.dSup, 1)}}{${T(p.d, 1)}}`} val={d2} br={false} />
                        <F lhs="\varepsilon'_{s1/2}" sym="\varepsilon_{su}\,\delta''" num={`${eSu}\\cdot ${d2}`} val={`${pm(f.epsS12)}\\;${f.has1b ? "<" : "\\ge"}\\;\\varepsilon'_{se}=${pm(p.epsSe)}`} br={false} />
                        {f.has1b ? (
                            <>
                                <F lhs="\xi_{1a/1b}" sym={String.raw`\dfrac{\varepsilon_{su}\,\delta''-\varepsilon'_{se}}{\varepsilon_{su}-\varepsilon'_{se}}`}
                                    num={String.raw`\dfrac{${eSu}\cdot ${d2}-${eSe}}{${eSu}-${eSe}}`} val={T(f.xi1ab, 4)} br={false} />
                                <F lhs="x_{1a/1b}" sym="\xi_{1a/1b}\,d" num={`${T(f.xi1ab, 4)}\\cdot ${T(p.d, 1)}`} val={`${T(f.x1ab, 1)}\\ \\text{mm}`} br={false} />
                                <Tex display>{String.raw`\begin{aligned}&\text{1a: }A'_s\text{ plastica, }\sigma'_s=f_{yd}&&-\infty<\xi\le ${T(f.xi1ab, 4)}\\&\text{1b: }A'_s\text{ elastica, }\sigma'_s=E_s\,\varepsilon'_s&&${T(f.xi1ab, 4)}\le\xi\le 0\end{aligned}`}</Tex>
                            </>
                        ) : (
                            <p className="text-xs font-semibold text-amber-700">{hs("ε′_s1/2 ≥ ε′_se: l'armatura opposta è sempre snervata, il sottocampo 1b non esiste (tutto il campo 1 è il punto 1a). Succede se δ″ ≥ ε′_se/ε_su = ")}{fmtNum(p.epsSe / p.epsSu, 3)}.</p>
                        )}
                    </div>
                </Block>

                {/* 4. equazioni di campo */}
                <Block n="4" title="Equazioni di campo">
                    <div className="tex-left space-y-2">
                        <p className="text-xs font-semibold text-slate-500">Equilibrio (momenti rispetto ad h/2):</p>
                        <Tex display>{String.raw`\begin{cases}A_s\,f_{yd}+A'_s\,\sigma'_s=-N_{Rd}\\[4pt]A_s\,f_{yd}\left(\tfrac{h}{2}-d'\right)-A'_s\,\sigma'_s\left(\tfrac{h}{2}-d''\right)=M_{Rd}\end{cases}\qquad\sigma'_s=\begin{cases}f_{yd}&\text{(1a)}\\E_s\,\dfrac{\varepsilon_{su}}{d-x}(d''-x)&\text{(1b)}\end{cases}`}</Tex>
                        <p className="text-xs font-semibold text-slate-500">Adimensionalizzazione (÷ b·d·f<sub>cd</sub> e ÷ b·d²·f<sub>cd</sub>):</p>
                        <F lhs="\omega_s" sym="\dfrac{A_s f_{yd}}{b\,d\,f_{cd}}" num={String.raw`\dfrac{${T(p.As, 0)}\cdot ${T(p.fyd, 2)}}{${T(p.b, 0)}\cdot ${T(p.d, 1)}\cdot ${T(p.fcd, 2)}}`} val={T(p.omegaS, 4)} br={false} />
                        <F lhs="\omega'_s" sym="\dfrac{A'_s f_{yd}}{b\,d\,f_{cd}}" num={String.raw`\dfrac{${T(p.AsP, 0)}\cdot ${T(p.fyd, 2)}}{${T(p.b, 0)}\cdot ${T(p.d, 1)}\cdot ${T(p.fcd, 2)}}`} val={T(p.omegaSP, 4)} br={false} />
                        <F lhs="\dfrac{h/2-d'}{d}" sym="\dfrac{1-\delta'}{2}" num={`\\dfrac{1-${d1}}{2}`} val={T(p.armS, 4)} br={false} />
                        <F lhs="\dfrac{h/2-d''}{d}" sym="\dfrac{1+\delta'-2\delta''}{2}" num={`\\dfrac{1+${d1}-2\\cdot ${d2}}{2}`} val={T(p.armSP, 4)} br={false} />
                        <Tex display>{String.raw`\begin{cases}\omega_s+\alpha'_s\,\omega'_s=-\nu_{Rd}\\[4pt]\omega_s\,\dfrac{1-\delta'}{2}-\alpha'_s\,\omega'_s\,\dfrac{1+\delta'-2\delta''}{2}=\mu_{Rd}\end{cases}\qquad\alpha'_s=\dfrac{\sigma'_s}{f_{yd}}=\begin{cases}1&\text{(1a)}\\\dfrac{E_s}{f_{yd}}\,\dfrac{\varepsilon_{su}}{1-\xi}\,(\delta''-\xi)&\text{(1b)}\end{cases}`}</Tex>
                        <p className="text-xs text-slate-400">N<sub>Rd</sub> = ν<sub>Rd</sub>·b·d·f<sub>cd</sub>, M<sub>Rd</sub> = μ<sub>Rd</sub>·b·d²·f<sub>cd</sub>{st.branch < 0 ? " (ramo M < 0: M cambia segno)" : ""}.</p>
                    </div>
                </Block>

                {/* 5. stato corrente */}
                <Block n="5" title="Stato corrente (ξ dal cursore del blocco 1)">
                    <div className="space-y-3">
                        <div className="tex-left space-y-1">
                            <Tex display>{String.raw`\xi=${xiTex(xi)}\qquad x=${xi === -Infinity ? "-\\infty" : `${T(xi * p.d, 1)}\\ \\text{mm}`}\qquad\text{sottocampo }${cur.sub}`}</Tex>
                            {xi === -Infinity
                                ? <Tex display>{String.raw`\varepsilon'_s=\varepsilon_{su}=${pm(cur.epsSP)}`}</Tex>
                                : <F lhs="\varepsilon'_s" sym={String.raw`\dfrac{\varepsilon_{su}}{1-\xi}\,(\delta''-\xi)`} num={String.raw`\dfrac{${eSu}}{1-(${T(xi, 4)})}\,(${d2}-(${T(xi, 4)}))`} val={pm(cur.epsSP, 3)} br={false} />}
                            {cur.sub === "1a"
                                ? <Tex display>{String.raw`\alpha'_s=1\quad(\varepsilon'_s\ge\varepsilon'_{se})\qquad\sigma'_s=f_{yd}=${T(cur.sigmaSP, 1)}\ \text{MPa}`}</Tex>
                                : <F lhs="\alpha'_s" sym={String.raw`\dfrac{E_s\,\varepsilon'_s}{f_{yd}}`} num={String.raw`\dfrac{200\,000\cdot ${T(cur.epsSP, 6)}}{${T(p.fyd, 2)}}`} val={`${T(cur.alphaSP, 4)}\\qquad\\sigma'_s=${T(cur.sigmaSP, 1)}\\ \\text{MPa}`} br={false} />}
                            <F lhs="\nu_{Rd}" sym="-(\omega_s+\alpha'_s\,\omega'_s)" num={`-(${T(p.omegaS, 4)}+${T(cur.alphaSP, 4)}\\cdot ${T(p.omegaSP, 4)})`} val={T(cur.nu, 4)} br={false} />
                            <F lhs="\mu_{Rd}" sym={String.raw`${sgnM ? "-\\Big(" : ""}\omega_s\,\dfrac{1-\delta'}{2}-\alpha'_s\,\omega'_s\,\dfrac{1+\delta'-2\delta''}{2}${sgnM ? "\\Big)" : ""}`}
                                num={`${sgnM ? "-\\big(" : ""}${T(p.omegaS, 4)}\\cdot ${T(p.armS, 4)}-${T(cur.alphaSP, 4)}\\cdot ${T(p.omegaSP, 4)}\\cdot ${T(p.armSP, 4)}${sgnM ? "\\big)" : ""}`} val={T(cur.mu, 4)} br={false} />
                            <F lhs="N_{Rd}" sym="\nu_{Rd}\,b\,d\,f_{cd}" num={`${T(cur.nu, 4)}\\cdot ${T(p.b, 0)}\\cdot ${T(p.d, 1)}\\cdot ${T(p.fcd, 2)}`} val={`${T(cur.N, 1)}\\ \\text{kN}`} br={false} />
                            <F lhs="M_{Rd}" sym="\mu_{Rd}\,b\,d^2\,f_{cd}" num={`${T(cur.mu, 4)}\\cdot ${T(p.b, 0)}\\cdot ${T(p.d, 1)}^2\\cdot ${T(p.fcd, 2)}`} val={`${T(cur.M, 2)}\\ \\text{kNm}`} br={false} />
                        </div>
                        <p className="text-xs text-slate-400">Il diagramma delle forze interne di questo stato è disegnato sulla sezione, nel blocco 1.</p>
                        <div className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs ${ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                            {ok ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
                            Calcolo numerico (piano di deformazione + legami): N = {fmtNum(ref.N, 1)} kN, M = {fmtNum(ref.M, 2)} kNm
                            — scarto ΔN = {errN.toExponential(1)}, ΔM = {errM.toExponential(1)}
                        </div>
                    </div>
                </Block>

                {/* 6. punti caratteristici e osservazioni */}
                <Block n="6" title="Punti caratteristici e osservazioni">
                    <PointsTable rows={[
                        { label: "Punto 1a (ξ ≤ ξ1a/1b, compreso ξ → −∞)", pt: f.pointA },
                        ...(f.has1b ? [{ label: "Confine 1a/1b (ξ = ξ1a/1b)", pt: f.point(f.xi1ab) }] : []),
                        { label: "Retta limite 1/2 (ξ = 0)", pt: f.point(0) },
                    ]} />
                    <div className="mt-3 space-y-1 text-xs leading-5 text-slate-600">
                        <p>• Il campo 1a è un <b>punto</b>: con acciaio elastico-perfettamente plastico le tensioni non cambiano. Lo stato a deformazione costante (ξ → −∞) dà una coppia (N, M), non trazione pura: M<sub>Rd</sub> = 0 solo se h/2 è il baricentro delle resistenze, A<sub>s</sub>f<sub>yd</sub>(h/2 − d′) = A′<sub>s</sub>f<sub>yd</sub>(h/2 − d″).</p>
                        <p>• Nel tratto 1b σ′<sub>s</sub> diminuisce verso la retta 1/2: N<sub>Rd</sub> diventa meno negativo e M<sub>Rd</sub> cresce (in modulo).</p>
                        <p>• Trazione pura massima (M = 0, appunti p. 76): {data.pt.centroid
                            ? <>h/2 è baricentro delle resistenze, N<sub>Rd</sub> = −(A<sub>s</sub> + A′<sub>s</sub>)·f<sub>yd</sub> = <b>{fmtNum(data.pt.N, 1)} kN</b>.</>
                            : <>snervano le barre {data.pt.yielded === "AsP" ? "superiori" : "inferiori"}, le altre lavorano a σ = {fmtNum(data.pt.yielded === "AsP" ? data.pt.sigmaS : data.pt.sigmaSP, 1)} MPa → N<sub>Rd</sub> = <b>{fmtNum(data.pt.N, 1)} kN</b> (cerchio arancio nel dominio).</>}</p>
                    </div>
                </Block>
                    </>);
                }} />
            </div>
        </NumCtx.Provider>
    );
}

// ---------------------------------------------------------------------------
// CAMPO 2 (stessa struttura del campo 1, con il calcestruzzo compresso)
// ---------------------------------------------------------------------------
const SUB2A_COL = "#1e3a8a"; // sottocampo 2a: blu scuro
const SUB2B_COL = "#93c5fd"; // sottocampo 2b: azzurro chiaro
const LIM23_COL = "#0f766e"; // retta limite 2/3
const TRI3_COL = "#db2777";  // triangolo del calcestruzzo
const TRI2_TEX = {
    cur: String.raw`\color{#d97706}\dfrac{\varepsilon_{su}}{d-x}\color{black}=\color{#0284c7}\dfrac{-\varepsilon'_s}{x-d''}\color{black}=\color{#db2777}\dfrac{\varepsilon_c}{x}`,
    H: String.raw`\color{#db2777}\dfrac{\varepsilon_{cu}}{x_H}\color{black}=\color{#d97706}\dfrac{\varepsilon_{su}}{d-x_H}\color{black}\;\Rightarrow\;x_H=\dfrac{\varepsilon_{cu}}{\varepsilon_{su}+\varepsilon_{cu}}\,d`,
    ab: String.raw`\color{#d97706}\dfrac{\varepsilon_{su}-\varepsilon'_{se}}{d-d''}\color{black}=\color{#0284c7}\dfrac{-\varepsilon'_{se}}{x_{2a/2b}-d''}`,
};
const TRI2_NOTE = {
    cur: "Vertice comune nel punto dell'asse neutro (0 ≤ x ≤ x_H), sulla retta dello stato corrente: tre triangoli simili per A_s, A′_s e il lembo compresso.",
    H: "Retta limite 2/3: crisi contemporanea di acciaio (ε_su) e calcestruzzo (ε_cu).",
    ab: "Retta di confine 2a/2b (A′_s a ε′_se in compressione): triangolo dall'asse neutro fino ad A′_s e triangolo fra A′_s e A.",
};

function FieldTwo({ data, st, set }) {
    const p = st.branch > 0 ? data.pos : data.neg;
    const f = st.branch > 0 ? data.f2pos : data.f2neg;
    const xi = sliderToXi(st.slider, 0, f.xiH);
    const xiB = useDeferredValue(xi); // blocchi 2–6: aggiornati subito dopo, senza bloccare il cursore
    const cur = f.point(xi);
    const d1 = T(p.delta1, 4), d2 = T(p.delta2, 4), eSu = T(p.epsSu, 4), eCu = T(p.epsCu, 4), eSe = T(-p.epsSe, 5);
    const sgnM = st.branch < 0 ? "-" : "";
    const tri = !f.has2b && st.tri === "ab" ? "cur" : (st.tri ?? "cur");

    return (
        <NumCtx.Provider value={st.num}>
            <div className="space-y-5">
                <FieldToolbar st={st} set={set} note={st.branch > 0
                    ? "A_s inferiore a ε_su (pivot A in basso), A′_s superiore, lembo compresso in alto."
                    : "Sezione ribaltata: pivot A sull'armatura superiore; A_s ↔ A′_s, d′ ↔ d″, M cambia segno."} />

                {/* 1. intervallo e stati deformativi */}
                <Block n="1" title="Intervallo e stati deformativi">
                    <div className="space-y-4">
                        <div className="tex-left space-y-1 text-sm text-slate-600">
                            <Tex display>{String.raw`0 \le x \le x_H \quad\Longleftrightarrow\quad 0 \le \xi \le \xi_H=\dfrac{\varepsilon_{cu}}{\varepsilon_{su}+\varepsilon_{cu}}=${T(f.xiH, 4)}`}</Tex>
                            <p className="text-xs">Campo delle deboli armature. Pivot A: armatura {st.branch > 0 ? "inferiore" : "superiore"} a ε<sub>su</sub>; il lembo compresso va da 0 (retta limite 1/2, in blu) a ε<sub>cu</sub> (retta limite 2/3, verde acqua: crisi contemporanea di acciaio e calcestruzzo).</p>
                            <p className="text-xs">A′<sub>s</sub> passa da trazione (ε′<sub>s1/2</sub>) a compressione (ε′<sub>s2/3</sub>); in verde lo stato corrente, trascinabile anche dal punto verde.</p>
                            <p className="text-xs">In alto il legame del calcestruzzo, poi quello di A′<sub>s</sub> (trazione a sinistra, compressione a destra), in basso quello di A<sub>s</sub>: stessa scala delle deformazioni.</p>
                        </div>
                        <div className="flex w-full flex-col items-center gap-3">
                            <div className="flex w-full flex-wrap items-start justify-center gap-3">
                                <div className="flex justify-center">
                                    <Segmented small value={st.hl ?? "fields"} onChange={(v) => set({ hl: v })} options={[{ value: "fields", label: "Sottocampi" }, { value: "profile", label: "Profilo" }, { value: "triangles", label: "Triangoli simili" }]} />
                                </div>
                                <MiniXiSlider value={st.slider} onChange={(v) => set({ slider: v })} left="0" right={<>ξ<sub>H</sub></>} sub={cur.sub} items={[
                                    { label: "ξ", value: xiTxt(xi) },
                                    { label: "x", value: `${fmtNum(xi * p.d, 1)} mm` },
                                    { label: "ε_c", value: `${fmtNum(cur.epsC * 1000, 2)}‰` },
                                    { label: "ε′_s", value: `${fmtNum(cur.epsSP * 1000, 2)}‰` },
                                ]} />
                                {st.hl === "triangles" && (
                                    <div className="w-full max-w-[340px] space-y-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2">
                                        <div className="flex justify-center">
                                            <Segmented small value={tri} onChange={(v) => set({ tri: v })} options={[
                                                { value: "cur", label: hs("ε′_s, ε_c(ξ)") },
                                                { value: "H", label: hs("ξ_H") },
                                                ...(f.has2b ? [{ value: "ab", label: hs("ξ_2a/2b") }] : []),
                                            ]} />
                                        </div>
                                        <div className="tex-left text-sm"><Tex display>{TRI2_TEX[tri]}</Tex></div>
                                        <p className="text-[11px] leading-4 text-slate-500">{hs(TRI2_NOTE[tri])}</p>
                                    </div>
                                )}
                            </div>
                            <div className="w-full">
                                <StrainDiagramPivot p={p} xi={xi} branch={st.branch} mode={st.hl ?? "fields"} tri={tri}
                                    onSlider={(v) => set({ slider: v })} spec={spec2(p, f)} />
                            </div>
                        </div>
                    </div>
                </Block>

                <Lazy deps={[p, f, xiB, st.num, st.branch, data]} render={() => {
                    const xi = xiB; const cur = f.point(xi); const ref = numericPivotA(p, xi); const errN = Math.abs(cur.N - ref.N), errM = Math.abs(cur.M - ref.M); const ok = errN < 1e-3 && errM < 1e-3; const xiv = T(xi, 4);
                    return (<>
                {/* 2. legami costitutivi */}
                <Block n="2" title="Legami costitutivi">
                    <div className="space-y-1 text-xs leading-5 text-slate-600">
                        <p><b>Calcestruzzo</b>: parabola-rettangolo (n = 2, ε<sub>c2</sub> = 2‰, ε<sub>cu</sub> = {fmtNum(p.epsCu * 1000, 1)}‰, f<sub>cd</sub> = {fmtNum(p.fcd, 2)} MPa), non reagente a trazione.</p>
                        <div className="tex-left"><Tex display>{String.raw`\sigma_c=\begin{cases}f_{cd}\left[1-\left(1-\dfrac{\varepsilon_c}{\varepsilon_{c2}}\right)^{n}\right]&0\le\varepsilon_c\le\varepsilon_{c2}\\[6pt]f_{cd}&\varepsilon_{c2}\le\varepsilon_c\le\varepsilon_{cu}\end{cases}`}</Tex></div>
                        <p>Nel campo 2 il lembo compresso percorre tutto il legame, da 0 a ε<sub>cu</sub>.</p>
                        <p><b>Acciaio</b> elastico-perfettamente plastico: E<sub>s</sub> = 200 000 MPa, f<sub>yd</sub> = {fmtNum(p.fyd, 2)} MPa, ε<sub>se</sub> = {fmtNum(p.epsSe * 1000, 3)}‰. Deformazioni e tensioni positive in trazione, <b>negative in compressione</b> (ε′<sub>se</sub> = −{fmtNum(p.epsSe * 1000, 3)}‰).</p>
                        <p>• A<sub>s</sub> resta nel pivot A: ε<sub>s</sub> = ε<sub>su</sub>, σ<sub>s</sub> = f<sub>yd</sub>.</p>
                        <p>• A′<sub>s</sub> percorre {f.has2b ? <>il tratto elastico da ε′<sub>s1/2</sub> a ε′<sub>se</sub> (2a) e quello plastico in compressione fino a ε′<sub>s2/3</sub> (2b)</> : <>solo il tratto elastico (2a): lo snervamento in compressione avviene nel campo 3</>}.</p>
                    </div>
                </Block>

                {/* 3. congruenza e sottocampi */}
                <Block n="3" title="Congruenza e sottocampi">
                    <div className="tex-left space-y-1">
                        <Tex display>{String.raw`\dfrac{\varepsilon_{su}}{d-x}=\dfrac{-\varepsilon'_s}{x-d''}=\dfrac{\varepsilon_c}{x}\;\Longleftrightarrow\;\dfrac{\varepsilon_{su}}{1-\xi}=\dfrac{-\varepsilon'_s}{\xi-\delta''}=\dfrac{\varepsilon_c}{\xi}`}</Tex>
                        <Tex display>{String.raw`\varepsilon'_s=-\dfrac{\varepsilon_{su}}{1-\xi}\,(\xi-\delta'')\qquad\varepsilon_c=\dfrac{\varepsilon_{su}\,\xi}{1-\xi}`}</Tex>
                        <F lhs="\xi_H" sym="\dfrac{\varepsilon_{cu}}{\varepsilon_{su}+\varepsilon_{cu}}" num={`\\dfrac{${eCu}}{${eSu}+${eCu}}`} val={T(f.xiH, 4)} br={false} />
                        <F lhs="x_H" sym="\xi_H\,d" num={`${T(f.xiH, 4)}\\cdot ${T(p.d, 1)}`} val={`${T(f.xH, 1)}\\ \\text{mm}`} br={false} />
                        <F lhs="\varepsilon'_{s1/2}" sym="\varepsilon_{su}\,\delta''" num={`${eSu}\\cdot ${d2}`} val={pm(f.epsS12, 3)} br={false} />
                        <F lhs="\varepsilon'_{s2/3}" sym={String.raw`-\dfrac{\varepsilon_{su}}{1-\xi_H}\,(\xi_H-\delta'')`} num={String.raw`-\dfrac{${eSu}}{1-${T(f.xiH, 4)}}\,(${T(f.xiH, 4)}-${d2})`} val={pm(f.epsS23, 3)} br={false} />
                        <F lhs="\varepsilon'_{se}" sym="-\dfrac{f_{yd}}{E_s}" num={`-\\dfrac{${T(p.fyd, 2)}}{200\\,000}`} val={pm(-p.epsSe, 3)} br={false} />
                        {f.has2b ? (
                            <>
                                <F lhs="\xi_{2a/2b}" sym={String.raw`\dfrac{\varepsilon_{su}\,\delta''-\varepsilon'_{se}}{\varepsilon_{su}-\varepsilon'_{se}}`}
                                    num={String.raw`\dfrac{${eSu}\cdot ${d2}-(${eSe})}{${eSu}-(${eSe})}`} val={T(f.xi2ab, 4)} br={false} />
                                <F lhs="x_{2a/2b}" sym="\xi_{2a/2b}\,d" num={`${T(f.xi2ab, 4)}\\cdot ${T(p.d, 1)}`} val={`${T(f.x2ab, 1)}\\ \\text{mm}`} br={false} />
                                <Tex display>{String.raw`\begin{aligned}&\text{2a: }A'_s\text{ elastica, }\sigma'_s=E_s\,\varepsilon'_s&&0\le\xi\le ${T(f.xi2ab, 4)}\\&\text{2b: }A'_s\text{ plastica (compressa), }\sigma'_s=-f_{yd}&&${T(f.xi2ab, 4)}\le\xi\le ${T(f.xiH, 4)}\end{aligned}`}</Tex>
                            </>
                        ) : (
                            <p className="text-xs font-semibold text-amber-700">ξ<sub>2a/2b</sub> = {fmtNum(f.xi2ab, 4)} &gt; ξ<sub>H</sub>: A′<sub>s</sub> non snerva in compressione nel campo 2 (copriferro d″ grande), il campo è tutto 2a; lo snervamento avverrà nel campo 3.</p>
                        )}
                        <p className="pt-1 text-xs font-semibold text-slate-500">Coefficienti del calcestruzzo (in funzione di ε<sub>c</sub> del lembo compresso):</p>
                        <Tex display>{String.raw`\varepsilon_c\le\varepsilon_{c2}:\;\psi=\dfrac{\varepsilon_c}{3\varepsilon_{c2}^2}\,(3\varepsilon_{c2}-\varepsilon_c),\;\;\lambda=\dfrac{4\varepsilon_{c2}-\varepsilon_c}{4\,(3\varepsilon_{c2}-\varepsilon_c)}`}</Tex>
                        <Tex display>{String.raw`\varepsilon_c\ge\varepsilon_{c2}:\;\psi=1-\dfrac{\varepsilon_{c2}}{3\,\varepsilon_c},\;\;\lambda=\dfrac{6\varepsilon_c^2-4\varepsilon_c\varepsilon_{c2}+\varepsilon_{c2}^2}{4\,\varepsilon_c\,(3\varepsilon_c-\varepsilon_{c2})}`}</Tex>
                        <p className="text-xs text-slate-400">C<sub>c</sub> = b·ψ·x·f<sub>cd</sub>, applicata a λ·x dal lembo compresso. Sulla retta 2/3 (ε<sub>c</sub> = 3,5‰): ψ = 0,8095, λ = 0,416.</p>
                    </div>
                </Block>

                {/* 4. equazioni di campo */}
                <Block n="4" title="Equazioni di campo">
                    <div className="tex-left space-y-2">
                        <p className="text-xs font-semibold text-slate-500">Equilibrio (C<sub>c</sub> + C′<sub>s</sub> − T<sub>s</sub> = N<sub>Rd</sub>, momenti rispetto ad h/2):</p>
                        <Tex display>{String.raw`\begin{cases}b\,\psi\,x\,f_{cd}-A'_s\,\sigma'_s-A_s\,f_{yd}=N_{Rd}\\[4pt]b\,\psi\,x\,f_{cd}\left(\tfrac{h}{2}-\lambda x\right)-A'_s\,\sigma'_s\left(\tfrac{h}{2}-d''\right)+A_s\,f_{yd}\left(\tfrac{h}{2}-d'\right)=M_{Rd}\end{cases}\qquad\sigma'_s=\begin{cases}E_s\,\varepsilon'_s&\text{(2a)}\\-f_{yd}&\text{(2b)}\end{cases}`}</Tex>
                        <p className="text-xs font-semibold text-slate-500">Adimensionalizzazione (÷ b·d·f<sub>cd</sub> e ÷ b·d²·f<sub>cd</sub>):</p>
                        <F lhs="\omega_s" sym="\dfrac{A_s f_{yd}}{b\,d\,f_{cd}}" num={String.raw`\dfrac{${T(p.As, 0)}\cdot ${T(p.fyd, 2)}}{${T(p.b, 0)}\cdot ${T(p.d, 1)}\cdot ${T(p.fcd, 2)}}`} val={T(p.omegaS, 4)} br={false} />
                        <F lhs="\omega'_s" sym="\dfrac{A'_s f_{yd}}{b\,d\,f_{cd}}" num={String.raw`\dfrac{${T(p.AsP, 0)}\cdot ${T(p.fyd, 2)}}{${T(p.b, 0)}\cdot ${T(p.d, 1)}\cdot ${T(p.fcd, 2)}}`} val={T(p.omegaSP, 4)} br={false} />
                        <Tex display>{String.raw`\dfrac{h/2-\lambda x}{d}=\dfrac{1+\delta'}{2}-\lambda\xi\qquad\dfrac{h/2-d''}{d}=\dfrac{1+\delta'-2\delta''}{2}=${T(p.armSP, 4)}\qquad\dfrac{h/2-d'}{d}=\dfrac{1-\delta'}{2}=${T(p.armS, 4)}`}</Tex>
                        <Tex display>{String.raw`\begin{cases}\psi\,\xi-\alpha'_s\,\omega'_s-\omega_s=\nu_{Rd}\\[4pt]\psi\,\xi\left(\dfrac{1+\delta'}{2}-\lambda\xi\right)-\alpha'_s\,\omega'_s\,\dfrac{1+\delta'-2\delta''}{2}+\omega_s\,\dfrac{1-\delta'}{2}=\mu_{Rd}\end{cases}\qquad\alpha'_s=\begin{cases}-\dfrac{E_s}{f_{yd}}\,\dfrac{\varepsilon_{su}}{1-\xi}\,(\xi-\delta'')&\text{(2a)}\\-1&\text{(2b)}\end{cases}`}</Tex>
                        <p className="rounded-lg bg-amber-50 px-2 py-1 text-[11px] leading-4 text-amber-800">Nota sui segni: negli appunti, per 2b, compaiono α′<sub>s</sub> = f′<sub>yd</sub>/f′<sub>yd</sub> = 1 e il termine −A′<sub>s</sub>f′<sub>yd</sub>. Con la convenzione degli appunti (barre compresse con segno negativo) σ′<sub>s</sub> = −f<sub>yd</sub> e quindi α′<sub>s</sub> = −1: così le formule coincidono con il calcolo numerico.</p>
                        <p className="text-xs text-slate-400">N<sub>Rd</sub> = ν<sub>Rd</sub>·b·d·f<sub>cd</sub>, M<sub>Rd</sub> = μ<sub>Rd</sub>·b·d²·f<sub>cd</sub>{st.branch < 0 ? " (ramo M < 0: M cambia segno)" : ""}.</p>
                    </div>
                </Block>

                {/* 5. stato corrente */}
                <Block n="5" title="Stato corrente (ξ dal cursore del blocco 1)">
                    <div className="space-y-3">
                        <div className="tex-left space-y-1">
                            <Tex display>{String.raw`\xi=${xiv}\qquad x=${T(xi * p.d, 1)}\ \text{mm}\qquad\text{sottocampo }${cur.sub}`}</Tex>
                            <F lhs="\varepsilon_c" sym={String.raw`\dfrac{\varepsilon_{su}\,\xi}{1-\xi}`} num={String.raw`\dfrac{${eSu}\cdot ${xiv}}{1-${xiv}}`} val={pm(cur.epsC, 3)} br={false} />
                            {cur.epsC <= 0.002
                                ? <F lhs="\psi" sym={String.raw`\dfrac{\varepsilon_c}{3\varepsilon_{c2}^2}(3\varepsilon_{c2}-\varepsilon_c)`} num={String.raw`\dfrac{${T(cur.epsC, 6)}}{3\cdot 0{,}002^2}(3\cdot 0{,}002-${T(cur.epsC, 6)})`} val={`${T(cur.psi, 4)}\\qquad\\lambda=${T(cur.lam, 4)}`} br={false} />
                                : <F lhs="\psi" sym={String.raw`1-\dfrac{\varepsilon_{c2}}{3\varepsilon_c}`} num={String.raw`1-\dfrac{0{,}002}{3\cdot ${T(cur.epsC, 6)}}`} val={`${T(cur.psi, 4)}\\qquad\\lambda=${T(cur.lam, 4)}`} br={false} />}
                            <F lhs="\varepsilon'_s" sym={String.raw`-\dfrac{\varepsilon_{su}}{1-\xi}\,(\xi-\delta'')`} num={String.raw`-\dfrac{${eSu}}{1-${xiv}}\,(${xiv}-${d2})`} val={pm(cur.epsSP, 3)} br={false} />
                            {cur.sub === "2b"
                                ? <Tex display>{String.raw`\alpha'_s=-1\quad(\varepsilon'_s\le\varepsilon'_{se})\qquad\sigma'_s=-f_{yd}=${T(cur.sigmaSP, 1)}\ \text{MPa}`}</Tex>
                                : <F lhs="\alpha'_s" sym={String.raw`\dfrac{E_s\,\varepsilon'_s}{f_{yd}}`} num={String.raw`\dfrac{200\,000\cdot (${T(cur.epsSP, 6)})}{${T(p.fyd, 2)}}`} val={`${T(cur.alphaSP, 4)}\\qquad\\sigma'_s=${T(cur.sigmaSP, 1)}\\ \\text{MPa}`} br={false} />}
                            <F lhs="\nu_{Rd}" sym="\psi\,\xi-\alpha'_s\,\omega'_s-\omega_s" num={`${T(cur.psi, 4)}\\cdot ${xiv}-(${T(cur.alphaSP, 4)})\\cdot ${T(p.omegaSP, 4)}-${T(p.omegaS, 4)}`} val={T(cur.nu, 4)} br={false} />
                            <F lhs="\mu_{Rd}" sym={String.raw`${sgnM ? "-\\Big[" : ""}\psi\xi\left(\tfrac{1+\delta'}{2}-\lambda\xi\right)-\alpha'_s\omega'_s\tfrac{1+\delta'-2\delta''}{2}+\omega_s\tfrac{1-\delta'}{2}${sgnM ? "\\Big]" : ""}`}
                                num={`${sgnM ? "-\\big[" : ""}${T(cur.psi, 4)}\\cdot ${xiv}\\,(\\tfrac{1+${d1}}{2}-${T(cur.lam, 4)}\\cdot ${xiv})-(${T(cur.alphaSP, 4)})\\cdot ${T(p.omegaSP, 4)}\\cdot ${T(p.armSP, 4)}+${T(p.omegaS, 4)}\\cdot ${T(p.armS, 4)}${sgnM ? "\\big]" : ""}`} val={T(cur.mu, 4)} br={false} />
                            <F lhs="N_{Rd}" sym="\nu_{Rd}\,b\,d\,f_{cd}" num={`${T(cur.nu, 4)}\\cdot ${T(p.b, 0)}\\cdot ${T(p.d, 1)}\\cdot ${T(p.fcd, 2)}`} val={`${T(cur.N, 1)}\\ \\text{kN}`} br={false} />
                            <F lhs="M_{Rd}" sym="\mu_{Rd}\,b\,d^2\,f_{cd}" num={`${T(cur.mu, 4)}\\cdot ${T(p.b, 0)}\\cdot ${T(p.d, 1)}^2\\cdot ${T(p.fcd, 2)}`} val={`${T(cur.M, 2)}\\ \\text{kNm}`} br={false} />
                        </div>
                        <p className="text-xs text-slate-400">Il diagramma delle forze interne di questo stato è disegnato sulla sezione, nel blocco 1.</p>
                        <div className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs ${ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                            {ok ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
                            Calcolo numerico (piano di deformazione + legami, cls integrato a strisce): N = {fmtNum(ref.N, 1)} kN, M = {fmtNum(ref.M, 2)} kNm
                            — scarto ΔN = {errN.toExponential(1)}, ΔM = {errM.toExponential(1)}
                        </div>
                    </div>
                </Block>

                {/* 6. punti caratteristici e osservazioni */}
                <Block n="6" title="Punti caratteristici e osservazioni">
                    <PointsTable cols={[COL_EPSC, COL_PSI, COL_LAM, COL_EPSSP, COL_ALPHA]} rows={[
                        { label: "Retta limite 1/2 (ξ = 0)", pt: f.point(0) },
                        ...(f.has2b ? [{ label: "Confine 2a/2b (ξ = ξ2a/2b)", pt: f.point(f.xi2ab) }] : []),
                        { label: "Retta limite 2/3 (ξ = ξH)", pt: f.point(f.xiH) },
                    ]} />
                    <div className="mt-3 space-y-1 text-xs leading-5 text-slate-600">
                        <p>• Il punto ξ = 0 coincide con l'ultimo punto del campo 1: il dominio è continuo.</p>
                        <p>• Abbassando l'asse neutro il contributo del calcestruzzo compresso prevale su quello di A′<sub>s</sub>: N<sub>Rd</sub> cresce, passando da trazione a compressione.</p>
                        <p>• Aumentano in valore assoluto sia il momento del calcestruzzo sia quello dell'armatura superiore; prevale il primo e M<sub>Rd</sub> cresce, nonostante il braccio diminuisca per l'aumento di λx.</p>
                        <p>• Lo snervamento di A′<sub>s</sub> in compressione può avvenire nel campo 2 (sottocampo 2b) o, con copriferro d″ grande, nel campo 3; va verificato che non avvenga nel campo 4.</p>
                    </div>
                </Block>
                    </>);
                }} />
            </div>
        </NumCtx.Provider>
    );
}

// Stati deformativi dei campi con calcestruzzo compresso (2, 3, …): legame del
// cls (in alto), di A'_s (trazione a sinistra, compressione a destra e in basso),
// deformazioni, legame di A_s. Compressioni a destra dell'asse x, trazioni a
// sinistra (come negli appunti). Il disegno è generico: ogni campo passa una
// "spec" con piano di deformazione, rette limite, fasce dei sottocampi, tratti
// percorsi nei legami, trascinamento del punto verde e triangoli simili.
function StrainDiagramPivot({ p, xi, branch, mode = "fields", tri = "cur", onSlider, spec }) {
    const svgRef = useRef(null);
    const dragging = useRef(false);
    const id = spec.id;
    const profile = mode === "profile", triangles = mode === "triangles";
    const showCur = !(triangles && tri !== "cur");
    // sezione a sinistra (freccia di x alla sua sinistra), poi le forze interne sulla faccia
    // destra della sezione (regione larga FW), poi deformazioni e legami (origine O in ax)
    // LW: azioni resistenti N_Rd, M_Rd a sinistra della sezione; FW: forze interne sulla faccia destra
    const FW = 180, LW = 112, secL = LW + 16;
    const lawH = 54, sigPx = lawH - 16, top = 14;
    const ax = secL + 70 + FW + 206, k = 200 / p.epsSu; // origine O e px per unità di deformazione
    const W = ax + 120;
    const ex = (e) => ax - e * k;                   // e > 0 trazione (sinistra), e < 0 compressione (destra)
    const baseC = top + lawH;                       // asse ε_c del legame del cls
    const baseS = baseC + 34 + lawH;                // asse ε'_s del legame di A'_s
    const sTop = baseS + sigPx + 30, secH = 170;    // diagramma delle deformazioni
    const s = secH / p.h;
    const baseBot = sTop + secH + 28 + lawH;        // asse ε_s del legame di A_s
    const Hh = baseBot + (spec.asFull ? sigPx + 20 : 26); // con A_s compressa serve il ramo di compressione
    const secW = Math.max(36, Math.min(70, p.b * s)), face = secL + secW; // faccia destra della sezione
    const yD = (depth) => sTop + depth * s;
    const yA = yD(p.d), yAp = yD(p.dSup);
    const strainAt = spec.strainAt;                 // (ξ, profondità) → deformazione (trazione +)
    // rette fino alla quota di A_s (d); fino al lembo inferiore (h) solo dove serve (campi 5 e 6)
    const lineFor = (xv, dEnd = p.d) => ({ x1: ex(strainAt(xv, 0)), y1: yD(0), x2: ex(strainAt(xv, dEnd)), y2: yD(dEnd) });
    const Lc = lineFor(xi, p.h);
    const eCur = strainAt(xi, p.dSup), ecTop = -strainAt(xi, 0), esCur = strainAt(xi, p.d), yN = yD(xi * p.d);
    // legami
    const sigS = (e) => Math.sign(e) * Math.min(ES_MPA * Math.abs(e), p.fyd);
    const steelPts = (base, e0, e1) => [e0, ...[-p.epsSe, 0, p.epsSe].filter((q) => q > e0 && q < e1), e1]
        .map((e) => `${ex(e).toFixed(1)},${(base - (sigS(e) / p.fyd) * sigPx).toFixed(1)}`).join(" ");
    const concPts = (e0, e1) => Array.from({ length: 25 }, (_, i) => e0 + ((e1 - e0) * i) / 24)
        .map((e) => `${ex(-e).toFixed(1)},${(baseC - sigmaC(e, 1) * sigPx).toFixed(1)}`).join(" ");
    // trascinamento dell'asse neutro (freccia di x o linea n–n): y del puntatore → x → ξ
    const draggingNA = useRef(false);
    const [naHover, setNaHover] = useState(false); // hover sul pallino dell'asse neutro
    const dragNA = (ev) => {
        const svg = svgRef.current;
        if (!svg || !onSlider || !spec.range) return;
        const pt = svg.createSVGPoint();
        pt.x = ev.clientX; pt.y = ev.clientY;
        const loc = pt.matrixTransform(svg.getScreenCTM().inverse());
        const [a, b] = spec.range;
        const yLim = baseBot - lawH + 2;                 // punta dell'asse σ del legame di A_s
        const yUp = baseS - lawH + 2;                    // punta dell'asse σ del legame di A'_s
        if (b === Infinity && loc.y >= yLim - 1) { onSlider(1000); return; }
        if (a === -Infinity && loc.y <= yUp + 1) { onSlider(0); return; }
        const xiP = Math.min(b, Math.max(a, (loc.y - sTop) / s / p.d));
        onSlider(Math.round(spec.xiToSlider ? spec.xiToSlider(xiP) : (1000 * (xiP - a)) / (b - a)));
    };
    const dragTo = (ev) => {
        const svg = svgRef.current;
        if (!svg || !onSlider) return;
        const pt = svg.createSVGPoint();
        pt.x = ev.clientX; pt.y = ev.clientY;
        const loc = pt.matrixTransform(svg.getScreenCTM().inverse());
        const e = Math.min(spec.drag.eMax, Math.max(spec.drag.eMin, (ax - loc.x) / k));
        onSlider(Math.max(0, Math.min(1000, Math.round(spec.drag.toSlider(e)))));
    };
    const eAt = (depth) => strainAt(xi, depth);
    const barMark = (base, e, col, lab, law) => {
        const yP = law === "c" ? baseC - sigmaC(-e, 1) * sigPx : base - (sigS(e) / p.fyd) * sigPx;
        return (
            <g>
                <line x1={ax} x2={ex(e)} y1={base} y2={base} stroke={col} strokeWidth="1.6" />
                <line x1={ex(e)} x2={ex(e)} y1={base} y2={yP} stroke={col} strokeWidth="0.8" strokeDasharray="2 2" />
                <circle cx={ex(e)} cy={base} r="2.2" fill={col} />
                <text x={ex(e)} y={law === "c" ? base + 22 : base - 3} fontSize="7.5" textAnchor={law === "c" ? "middle" : e > p.epsSe || e < 0 ? "start" : "end"} dx={law === "c" ? 0 : e > p.epsSe || e < 0 ? 3 : -3} fill={col}>{ss(lab)} = {fmtNum(Math.abs(e) * 1000, 2)}‰</text>
            </g>
        );
    };
    // fasce dei sottocampi: quadrilatero fra due rette (dal lembo superiore alla quota di A_s).
    // Etichetta dentro la fascia dove è più larga, se c'è spazio; altrimenti appena fuori dal
    // lato largo della fascia (sopra il lembo superiore o sotto la quota di A_s), centrata,
    // con alone bianco; etichette vicine sfalsate per non sovrapporsi.
    const bandsLayer = () => {
        const items = spec.bands.map((bd) => {
            const dEnd = bd.toH ? p.h : p.d, l1 = lineFor(bd.xi0, dEnd), l2 = lineFor(bd.xi1, dEnd);
            const at = (L, t) => L.x1 + t * (L.x2 - L.x1);
            let best = { t: 0.5, w: -1 };
            for (let t = 0.04; t <= 0.96; t += 0.02) { const w = Math.abs(at(l1, t) - at(l2, t)); if (w > best.w) best = { t, w }; }
            const inside = best.w >= 24;
            const bottom = best.t > 0.5;
            const lab = inside
                ? { x: (at(l1, best.t) + at(l2, best.t)) / 2, y: sTop + best.t * (yD(dEnd) - sTop), size: 11, inside: true }
                : { x: bottom ? (l1.x2 + l2.x2) / 2 : (l1.x1 + l2.x1) / 2, y: bottom ? yD(dEnd) + 11 : sTop - 5, size: 9.5, inside: false, dir: bottom ? 1 : -1 };
            return { bd, l1, l2, lab };
        });
        // etichette esterne: lontano dall'etichetta "x" dell'asse e sfalsate se troppo vicine
        const outs = items.filter((it) => !it.lab.inside).sort((p1, p2) => p1.lab.x - p2.lab.x);
        outs.forEach((it) => { if (it.lab.x > ax - 8 && it.lab.x < ax + 16) it.lab.x = ax - 12; });
        for (let i = 1; i < outs.length; i++) {
            const pr = outs[i - 1].lab, cu = outs[i].lab;
            if (Math.abs(cu.x - pr.x) < 18 && Math.abs(cu.y - pr.y) < 9) cu.y = pr.y + 10 * cu.dir;
        }
        return items.map(({ bd, l1, l2, lab }) => (
            <g key={bd.label}>
                <polygon points={`${l1.x1},${l1.y1} ${l2.x1},${l2.y1} ${l2.x2},${l2.y2} ${l1.x2},${l1.y2}`} fill={bd.color} fillOpacity={bd.op} />
                <text x={lab.x} y={lab.y} fontSize={lab.size} textAnchor="middle" dominantBaseline="middle" fill={bd.labelCol ?? bd.color} fontWeight="bold"
                    stroke="#fff" strokeWidth={lab.inside ? 0 : 3} paintOrder="stroke" strokeLinejoin="round">{bd.label}</text>
            </g>
        ));
    };
    const cfg = { ax, ex, yD, yA, yAp, sTop, xi };
    return (
        <svg ref={svgRef} viewBox={`0 0 ${W} ${Hh}`} width="100%" role="img" aria-label={`Stati deformativi del campo ${id}`}>
            <defs>
                <marker id={`sd${id}-arr`} markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0,0 L7,4 L0,8 Z" fill="#64748b" /></marker>
                <marker id={`sd${id}-na`} markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0,0 L6,3.5 L0,7 Z" fill="#0284c7" /></marker>
                <pattern id={`sd${id}-hatch`} width="6" height="6" patternUnits="userSpaceOnUse"><line x1="0" y1="3" x2="6" y2="3" stroke="#94a3b8" strokeWidth="0.8" strokeOpacity="0.4" /></pattern>
                <pattern id={`sd${id}-hatchc`} width="6" height="6" patternUnits="userSpaceOnUse"><line x1="0" y1="3" x2="6" y2="3" stroke={CONC_COL} strokeWidth="0.8" strokeOpacity="0.4" /></pattern>
            </defs>
            {/* richiami verticali (ε_su, ±ε_se, ε_c2, ε_cu) */}
            {[p.epsSu, p.epsSe, -p.epsSe, -EPS_C2, -p.epsCu].map((e) => <line key={e} x1={ex(e)} x2={ex(e)} y1={baseC - lawH + 6} y2={baseBot} stroke="#eef2f7" strokeDasharray="3 3" />)}

            {/* legame del calcestruzzo (compressione a destra) */}
            <g>
                <line x1={ax - 6} x2={ex(-p.epsCu) + 26} y1={baseC} y2={baseC} stroke="#64748b" markerEnd={`url(#sd${id}-arr)`} />
                <line x1={ax} x2={ax} y1={baseC + 4} y2={baseC - lawH + 2} stroke="#64748b" markerEnd={`url(#sd${id}-arr)`} />
                <text x={ex(-p.epsCu) + 28} y={baseC - 5} fontSize="10" textAnchor="start" fill="#475569">{ss("ε_c")}</text>
                <text x={ax - 5} y={baseC - lawH + 10} fontSize="10" textAnchor="end" fill="#475569">{ss("σ_c")}</text>
                <line x1={ax} x2={ex(-EPS_C2)} y1={baseC - sigPx} y2={baseC - sigPx} stroke="#cbd5e1" strokeDasharray="3 3" />
                <text x={ax - 5} y={baseC - sigPx + 4} fontSize="9" textAnchor="end" fill="#64748b">{ss("f_cd")}</text>
                <polyline points={concPts(0, p.epsCu)} fill="none" stroke="#94a3b8" strokeWidth="1.6" />
                {spec.concRange[1] - spec.concRange[0] > 1e-9 && <polyline points={concPts(spec.concRange[0], spec.concRange[1])} fill="none" stroke={CONC_COL} strokeWidth="2.4" strokeLinecap="round" strokeOpacity="0.85" />}
                <text x={ex(-EPS_C2)} y={baseC + 12} fontSize="9" textAnchor="middle" fill="#64748b">{ss("ε_c2")}</text>
                <text x={ex(-p.epsCu)} y={baseC + 12} fontSize="9" textAnchor="middle" fill="#64748b">{ss("ε_cu")}</text>
                {/* punto corrente solo se il lembo è compresso (dentro il legame del cls) */}
                {ecTop >= -1e-12 && <circle cx={ex(-ecTop)} cy={baseC - sigmaC(ecTop, 1) * sigPx} r="4" fill={CONC_PT} stroke="#fff" strokeWidth="1.5"><title>lembo superiore</title></circle>}
                {spec.concBottom && (() => { const eb = Math.max(0, -strainAt(xi, p.h)); return <circle cx={ex(-eb)} cy={baseC - sigmaC(eb, 1) * sigPx} r="3.4" fill="#fff" stroke={CONC_PT} strokeWidth="1.8"><title>lembo inferiore</title></circle>; })()}
                {profile && ecTop > 1e-12 && barMark(baseC, -ecTop, CONC_COL, "ε_c", "c")}
            </g>

            {/* legame di A'_s (trazione a sinistra in alto, compressione a destra in basso) */}
            <g>
                <line x1={ex(-p.epsCu) + 20} x2={ex(p.epsSu) - 24} y1={baseS} y2={baseS} stroke="#64748b" markerEnd={`url(#sd${id}-arr)`} />
                <line x1={ax} x2={ax} y1={baseS + sigPx + 6} y2={baseS - lawH + 2} stroke="#64748b" markerEnd={`url(#sd${id}-arr)`} />
                <text x={ex(p.epsSu) - 26} y={baseS - 5} fontSize="10" textAnchor="end" fill="#475569">{ss("ε′_s")}</text>
                <text x={ax + 5} y={baseS - lawH + 10} fontSize="10" fill="#475569">{ss("σ′_s")}</text>
                <text x={ex(p.epsSe)} y={baseS - sigPx - 4} fontSize="9" textAnchor="middle" fill="#64748b">{ss("f′_yd")}</text>
                <text x={ex(-p.epsSe)} y={baseS + sigPx + 12} fontSize="9" textAnchor="middle" fill="#64748b">−{ss("f′_yd")}</text>
                <polyline points={steelPts(baseS, -p.epsCu, p.epsSu)} fill="none" stroke="#94a3b8" strokeWidth="1.6" />
                {/* plateau −f'_yd prolungato fino alla fine dell'asse ε */}
                <line x1={ex(-p.epsCu)} x2={ex(-p.epsCu) + 20} y1={baseS + sigPx} y2={baseS + sigPx} stroke="#94a3b8" strokeWidth="1.6" />
                {spec.aspRanges.map((r) => <polyline key={r.key} points={steelPts(baseS, r.e0, r.e1)} fill="none" stroke={r.color} strokeWidth="2.4" strokeLinecap="round" />)}
                <circle cx={ex(eCur)} cy={baseS - (sigS(eCur) / p.fyd) * sigPx} r="4" fill={CUR_COL} stroke="#fff" strokeWidth="1.5" />
                <text x={ex(p.epsSu)} y={baseS + 12} fontSize="9" textAnchor="middle" fill="#64748b">{ss("ε′_su")}</text>
                <text x={ex(p.epsSe)} y={baseS + 12} fontSize="9" textAnchor="middle" fill="#64748b">{ss("ε_se")}</text>
                <text x={ex(-p.epsSe)} y={baseS + 12} fontSize="9" textAnchor="middle" fill="#64748b">{ss("ε′_se")}</text>
                {profile && barMark(baseS, eCur, ASP_COL, "ε′_s", "s")}
            </g>

            {/* sezione con la zona compressa */}
            <rect x={secL} y={sTop} width={secW} height={secH} fill="#f8fafc" stroke="#334155" strokeWidth="1.4" />
            {showCur && yN > sTop && <rect x={secL} y={sTop} width={secW} height={Math.min(yN, sTop + secH) - sTop} fill="#0284c7" fillOpacity="0.14" />}
            <rect x={secL} y={sTop} width={secW} height={secH} fill="none" stroke="#334155" strokeWidth="1.4" />
            <line x1={secL + 6} x2={secL + secW - 6} y1={yAp} y2={yAp} stroke={ASP_COL} strokeWidth="2.5" />
            <line x1={secL + 6} x2={secL + secW - 6} y1={yA} y2={yA} stroke={AS_COL} strokeWidth="2.5" />
            <text x={secL + secW / 2} y={yAp + 12} fontSize="10" textAnchor="middle" fill={ASP_COL}>{ss("A′_s")}</text>
            <text x={secL + secW / 2} y={yA - 5} fontSize="10" textAnchor="middle" fill={AS_COL}>{ss("A_s")}</text>
            {branch < 0 && <text x={secL} y={sTop + secH + 12} fontSize="9" fill="#94a3b8">sezione ribaltata</text>}
            <line x1={face + FW - 4} x2={ex(-p.epsCu) + 6} y1={yAp} y2={yAp} stroke="#cbd5e1" strokeDasharray="3 3" />
            <line x1={face + FW - 4} x2={ax + 10} y1={yA} y2={yA} stroke="#cbd5e1" strokeDasharray="3 3" />
            <line x1={ax} y1={sTop - 6} x2={ax} y2={sTop + secH + 10} stroke="#334155" strokeWidth="1" markerEnd={`url(#sd${id}-arr)`} />
            <text x={ax + 5} y={sTop + secH + 8} fontSize="10" fill="#334155">x</text>
            <text x={ax - 5} y={sTop - 3} fontSize="10" textAnchor="end" fill="#334155">O</text>

            {/* forze interne dello stato corrente sulla faccia destra della sezione: diagramma σc,
                risultanti (compressione → entrante, trazione → uscente) e azioni N_Rd, M_Rd */}
            {showCur && (() => {
                const xc = Math.min(Math.max(xi * p.d, 0), p.h);
                const cf = spec.concForce ? spec.concForce(xi) : (() => {
                    const { psi, lam } = psiLambda(ecTop);
                    return { Cc: psi * p.b * xi * p.d * p.fcd, depth: lam * xi * p.d };
                })();
                const Cc = cf.Cc;                                            // [N]
                const sP = sigS(eCur), sS = sigS(esCur);                     // trazione +
                const forces = [
                    ...(Cc > 1e-6 ? [{ key: "cc", name: "C_c", y: yD(cf.depth), v: Cc, col: CONC_COL }] : []),
                    { key: "csp", name: sP > 0 ? "T′_s" : "C′_s", y: yAp, v: -p.AsP * sP, col: ASP_COL },
                    { key: "cs", name: sS > 0 ? "T_s" : "C_s*", y: yA, v: -p.As * sS, col: AS_COL },
                ];
                const Nn = forces.reduce((acc, q) => acc + q.v, 0) / 1000;  // [kN], compressione +
                const Mm = (Cc * (p.h / 2 - cf.depth) - p.AsP * sP * (p.h / 2 - p.dSup) + p.As * sS * (p.h / 2 - p.dInf)) / 1e6; // nel riferimento del disegno
                // etichette distanziate in verticale se le forze sono troppo vicine (es. C_c e C′_s)
                const byY = [...forces].sort((q1, q2) => q1.y - q2.y);
                byY.forEach((q, i) => { q.ly = i && q.y - byY[i - 1].ly < 11 ? byY[i - 1].ly + 11 : q.y; });
                const maxF = Math.max(1, ...forces.map((q) => Math.abs(q.v)));
                const len = (v) => 16 + (Math.abs(v) / maxF) * 62;
                const wMax = 38, cyG = yD(p.h / 2), xa = LW / 2 + 2, r = 15; // azioni a sinistra della sezione
                const stress = Array.from({ length: 25 }, (_, i) => {
                    const dpt = (xc * i) / 24;
                    return `${(face + sigmaC(-strainAt(xi, dpt), 1) * wMax).toFixed(1)},${yD(dpt).toFixed(1)}`;
                });
                // faccia sinistra: M ≥ 0 (fibre inferiori tese) → verso orario; arco a sinistra del centro
                const arc = Mm >= 0
                    ? `M${xa + 8},${cyG + r} A${r},${r} 0 0 1 ${xa + 8},${cyG - r}`
                    : `M${xa + 8},${cyG - r} A${r},${r} 0 0 0 ${xa + 8},${cyG + r}`;
                const mk = (c) => `url(#sd${id}-f${c.slice(1)})`;
                return (
                    <g>
                        <defs>
                            {[CONC_COL, ASP_COL, AS_COL, "#2563eb"].map((c) => (
                                <marker key={c} id={`sd${id}-f${c.slice(1)}`} markerUnits="userSpaceOnUse" markerWidth="8" markerHeight="8" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 Z" fill={c} /></marker>
                            ))}
                        </defs>
                        {xc > 0 && <polygon points={`${face},${yD(0)} ${stress.join(" ")} ${face},${yD(xc)}`} fill={CONC_COL} fillOpacity="0.14" stroke={CONC_COL} strokeWidth="1" />}
                        {xc > 0 && <text x={face + 3} y={yD(0) - 4} fontSize="9" fill={CONC_COL}>{ss("σ_c")}</text>}
                        {forces.map((q) => {
                            const L = len(q.v), tension = q.v < 0;
                            return (
                                <g key={q.key}>
                                    {Math.abs(q.v) > 1e-6 && (tension
                                        ? <line x1={face} x2={face + L} y1={q.y} y2={q.y} stroke={q.col} strokeWidth="1.8" markerEnd={mk(q.col)} />
                                        : <line x1={face + L + 2} x2={face + 2} y1={q.y} y2={q.y} stroke={q.col} strokeWidth="1.8" markerEnd={mk(q.col)} />)}
                                    <text x={face + L + 6} y={q.ly + 3.5} fontSize="9" fill={q.col} stroke="#fff" strokeWidth="2.5" paintOrder="stroke">{ss(q.name)} = {fmtNum(Math.abs(q.v) / 1000, 1)} kN</text>
                                </g>
                            );
                        })}
                        {/* azioni risultanti a h/2 */}
                        <line x1={xa - 34} x2={face + FW - 6} y1={cyG} y2={cyG} stroke="#cbd5e1" strokeDasharray="4 3" />
                        <text x={xa - 34} y={cyG - 3} fontSize="8" fill="#94a3b8">h/2</text>
                        {/* azioni sulla faccia SINISTRA del concio: compressione → verso la sezione,
                            trazione → uscente; momento con verso opposto a quello sulla faccia destra */}
                        {Math.abs(Nn) > 1e-6 && (Nn < 0
                            ? <line x1={xa + 26} x2={xa - 20} y1={cyG} y2={cyG} stroke="#2563eb" strokeWidth="1.8" markerEnd={mk("#2563eb")} />
                            : <line x1={xa - 22} x2={xa + 26} y1={cyG} y2={cyG} stroke="#2563eb" strokeWidth="1.8" markerEnd={mk("#2563eb")} />)}
                        {Math.abs(Mm) > 1e-9 && <path d={arc} fill="none" stroke="#2563eb" strokeWidth="1.6" markerEnd={mk("#2563eb")} />}
                        <text x={xa} y={cyG - r - 7} fontSize="9" textAnchor="middle" fill="#2563eb" stroke="#fff" strokeWidth="2.5" paintOrder="stroke">{ss("M_Rd")} = {fmtNum(Math.abs(Mm), 2)} kNm</text>
                        <text x={xa} y={cyG + r + 13} fontSize="9" textAnchor="middle" fill="#2563eb" stroke="#fff" strokeWidth="2.5" paintOrder="stroke">{ss("N_Rd")} = {fmtNum(Math.abs(Nn), 1)} kN</text>
                    </g>
                );
            })()}

            {/* fasce dei sottocampi */}
            {mode === "fields" && bandsLayer()}

            {/* profilo: cls compresso (a destra, sopra l'asse neutro) e teso non reagente */}
            {profile && <>
                {(() => {
                    const xcP = Math.min(Math.max(xi * p.d, 0), p.h);
                    const pts = `${ax},${yD(0)} ${ex(-ecTop)},${yD(0)} ${ex(eAt(xcP))},${yD(xcP)} ${ax},${yD(xcP)}`;
                    return <>
                        <polygon points={pts} fill={CONC_COL} fillOpacity="0.14" />
                        <polygon points={pts} fill={`url(#sd${id}-hatchc)`} stroke={CONC_COL} strokeWidth="1" />
                    </>;
                })()}
                {xi * p.d < p.h && (() => {
                    const xs = Math.max(xi * p.d, 0);
                    return <polygon points={`${ax},${yD(xs)} ${ex(eAt(xs))},${yD(xs)} ${ex(eAt(p.h))},${yD(p.h)} ${ax},${yD(p.h)}`} fill={`url(#sd${id}-hatch)`} stroke="#cbd5e1" strokeWidth="1" />;
                })()}
            </>}

            {/* triangoli simili */}
            {triangles && (() => {
                const pts = (Tr) => Tr.map(([x, y]) => `${x},${y}`).join(" ");
                const lbl = [];
                const H = (xa, xb, y, t, c) => { if (Math.abs(xb - xa) >= 3) lbl.push({ x: (xa + xb) / 2, y, t, c, a: "middle" }); };
                const V = (x, ya, yb, t, c, a = "start") => { if (Math.abs(yb - ya) >= 12) lbl.push({ x, y: (ya + yb) / 2 + 3, t, c, a }); };
                const tris = spec.triangles(tri, cfg, H, V);
                return (
                    <g>
                        {tris.map((t, i) => <polygon key={i} points={pts(t.T)} fill={t.c} fillOpacity="0.18" stroke={t.c} strokeWidth="1.3" strokeLinejoin="round" />)}
                        {lbl.map((l) => <text key={l.t + l.x} x={l.x} y={l.y} fontSize="9" fontWeight="bold" fill={l.c} textAnchor={l.a} stroke="#fff" strokeWidth="3" paintOrder="stroke" strokeLinejoin="round">{ss(l.t)}</text>)}
                    </g>
                );
            })()}

            {/* confini fra sottocampi e rette limite */}
            {spec.boundaries.map((bd) => <line key={bd.xi} {...lineFor(bd.xi, bd.toH ? p.h : p.d)} stroke={SUB_COL} strokeWidth="1.2" strokeDasharray="5 3" />)}
            {spec.lines.map((ln) => <line key={ln.xi} {...lineFor(ln.xi, ln.toH ? p.h : p.d)} stroke={ln.color} strokeWidth="1.8" />)}
            {/* stato corrente */}
            {showCur && <line {...Lc} stroke={CUR_COL} strokeWidth="2" />}
            {/* lembo di calcestruzzo compresso: stesso punto del legame del cls (superiore pieno, inferiore vuoto) */}
            {showCur && ecTop >= -1e-12 && <circle cx={ex(-ecTop)} cy={yD(0)} r="4" fill={CONC_PT} stroke="#fff" strokeWidth="1.5"><title>lembo superiore</title></circle>}
            {showCur && spec.concBottom && (() => { const eb = -strainAt(xi, p.h); return eb >= 0 && <circle cx={ex(-eb)} cy={yD(p.h)} r="3.4" fill="#fff" stroke={CONC_PT} strokeWidth="1.8"><title>lembo inferiore</title></circle>; })()}
            {/* asse neutro n–n che taglia la sezione fino all'asse x; la freccia parte dal vertice
                superiore della sezione (x = 0) e scende fino all'asse neutro (profondità x) */}
            {showCur && (() => {
                const yLim = baseBot - lawH + 2, yUp = baseS - lawH + 2;
                const yEnd = Math.max(yUp, Math.min(yN, yLim)), inView = yN <= yLim && yN >= yUp, up = yN < sTop;
                return (
                    <g>
                        {inView && <line x1={secL - 16} x2={up ? face + 10 : ax} y1={yN} y2={yN} stroke="#0284c7" strokeWidth="1.1" strokeDasharray="6 3" strokeOpacity="0.45" />}
                        <circle cx={secL} cy={sTop} r="2.4" fill="#0284c7" />
                        {Math.abs(yEnd - sTop) > 7 && <line x1={secL - 8} x2={secL - 8} y1={sTop} y2={up ? yEnd + 5 : yEnd - 5} stroke="#0284c7" strokeWidth="1.3" markerEnd={`url(#sd${id}-na)`} />}
                        {!inView && (up
                            ? <line x1={secL - 8} x2={secL - 8} y1={yUp - 3} y2={yUp - 12} stroke="#0284c7" strokeWidth="1.3" strokeDasharray="1.5 2.5" />
                            : <line x1={secL - 8} x2={secL - 8} y1={yLim + 3} y2={yLim + 12} stroke="#0284c7" strokeWidth="1.3" strokeDasharray="1.5 2.5" />)}
                        {Math.abs(yEnd - sTop) > 14 && <text x={secL - 12} y={(sTop + yEnd) / 2 + 3} fontSize="9" textAnchor="end" fill="#0284c7">{xi === Infinity ? "x → +∞" : xi === -Infinity ? "x → −∞" : "x"}</text>}
                        {inView && !up && <circle cx={ax} cy={yN} r="2.5" fill="#0284c7" />}
                        {/* maniglia trascinabile: punta della freccia e linea dell'asse neutro */}
                        <circle cx={secL - 8} cy={yEnd} r={naHover ? 6 : 4} fill={naHover ? "#0369a1" : "#0284c7"} stroke={naHover ? "#bae6fd" : "#fff"} strokeWidth={naHover ? 3 : 1.2} pointerEvents="none" style={{ transition: "all 120ms ease-out" }} />
                        <rect x={secL - 22} y={yEnd - 7} width={secW + 26} height="14" fill="transparent" style={{ cursor: "pointer", touchAction: "none" }}
                            onPointerDown={(ev) => { draggingNA.current = true; ev.currentTarget.setPointerCapture(ev.pointerId); dragNA(ev); }}
                            onPointerMove={(ev) => { if (draggingNA.current) dragNA(ev); }}
                            onPointerUp={(ev) => { draggingNA.current = false; ev.currentTarget.releasePointerCapture(ev.pointerId); }}
                            onPointerEnter={() => setNaHover(true)} onPointerLeave={() => setNaHover(false)}>
                            <title>Trascina per spostare l'asse neutro</title>
                        </rect>
                    </g>
                );
            })()}
            {profile && [
                { key: "sp", y: yAp, e: eCur, col: ASP_COL },
                { key: "s", y: yA, e: esCur, col: AS_COL },
            ].map((b) => (
                <g key={b.key}>
                    <line x1={ax} x2={ex(b.e)} y1={b.y} y2={b.y} stroke={b.col} strokeWidth="1.6" />
                    <circle cx={ex(b.e)} cy={b.y} r="2.2" fill={b.col} />
                </g>
            ))}
            {showCur && <circle cx={ex(eCur)} cy={yAp} r="4" fill={CUR_COL} stroke="#fff" strokeWidth="1.2" pointerEvents="none" />}
            {/* A_s: stesso punto (vuoto verde) del legame di A_s */}
            {showCur && <circle cx={ex(esCur)} cy={yA} r="3.4" fill="#fff" stroke={CUR_COL} strokeWidth="1.8" pointerEvents="none"><title>A_s (armatura inferiore)</title></circle>}
            {showCur && spec.drag && <circle cx={ex(eCur)} cy={yAp} r="11" fill="transparent" style={{ cursor: "pointer", touchAction: "none" }}
                onPointerDown={(ev) => { dragging.current = true; ev.currentTarget.setPointerCapture(ev.pointerId); dragTo(ev); }}
                onPointerMove={(ev) => { if (dragging.current) dragTo(ev); }}
                onPointerUp={(ev) => { dragging.current = false; ev.currentTarget.releasePointerCapture(ev.pointerId); }}>
                <title>Trascina per cambiare lo stato deformativo</title>
            </circle>}
            {/* pivot (A: acciaio a ε_su; B: cls a ε_cu) */}
            {/* pivot A coincide con A_s (punto vuoto verde): niente pallino scuro, solo l'etichetta */}
            {spec.pivot.label !== "A" && <circle cx={ex(spec.pivot.e)} cy={yD(spec.pivot.depth)} r="3" fill={spec.pivot.color} />}
            <text x={ex(spec.pivot.e) + spec.pivot.dx} y={yD(spec.pivot.depth) + spec.pivot.dy} fontSize="10" textAnchor={spec.pivot.anchor} fill={spec.pivot.color}>{spec.pivot.label}</text>

            {/* legame di A_s (sotto); con A_s compressa (campi 5, 6) anche il ramo di compressione */}
            <g>
                <line x1={spec.asFull ? ex(-p.epsCu) + 20 : ax + 6} x2={ex(p.epsSu) - 24} y1={baseBot} y2={baseBot} stroke="#64748b" markerEnd={`url(#sd${id}-arr)`} />
                <line x1={ax} x2={ax} y1={spec.asFull ? baseBot + sigPx + 6 : baseBot + 4} y2={baseBot - lawH + 2} stroke="#64748b" markerEnd={`url(#sd${id}-arr)`} />
                <text x={ex(p.epsSu) - 26} y={baseBot - 5} fontSize="10" textAnchor="end" fill="#475569">{ss("ε_s")}</text>
                <text x={ax + 5} y={baseBot - lawH + 10} fontSize="10" fill="#475569">{ss("σ_s")}</text>
                <text x={ex(p.epsSe)} y={baseBot - sigPx - 4} fontSize="9" textAnchor="middle" fill="#64748b">{ss("f_yd")}</text>
                {spec.asFull && <text x={ex(-p.epsSe)} y={baseBot + sigPx + 12} fontSize="9" textAnchor="middle" fill="#64748b">−{ss("f_yd")}</text>}
                {spec.asFull && <text x={ex(-p.epsSe)} y={baseBot + 12} fontSize="9" textAnchor="middle" fill="#64748b">−{ss("ε_se")}</text>}
                <polyline points={steelPts(baseBot, spec.asFull ? -p.epsCu : 0, p.epsSu)} fill="none" stroke="#94a3b8" strokeWidth="1.6" />
                {spec.asFull && <line x1={ex(-p.epsCu)} x2={ex(-p.epsCu) + 20} y1={baseBot + sigPx} y2={baseBot + sigPx} stroke="#94a3b8" strokeWidth="1.6" />}
                {spec.asRanges.map((r) => <polyline key={r.key} points={steelPts(baseBot, r.e0, r.e1)} fill="none" stroke={r.color} strokeWidth="2.4" strokeLinecap="round" />)}
                <circle cx={ex(esCur)} cy={baseBot - (sigS(esCur) / p.fyd) * sigPx} r="3.4" fill="#fff" stroke={CUR_COL} strokeWidth="1.8"><title>A_s (armatura inferiore)</title></circle>
                <text x={ex(p.epsSu)} y={baseBot + 12} fontSize="9" textAnchor="middle" fill="#64748b">{ss("ε_su")}</text>
                <text x={ex(p.epsSe)} y={baseBot + 12} fontSize="9" textAnchor="middle" fill="#64748b">{ss("ε_se")}</text>
                {profile && barMark(baseBot, esCur, AS_COL, "ε_s", "s")}
            </g>
        </svg>
    );
}

// specifica del disegno del campo 2 (pivot A)
function spec2(p, f) {
    return {
        id: "2",
        range: [0, f.xiH],
        strainAt: (xv, depth) => (p.epsSu * (depth - xv * p.d)) / (p.d - xv * p.d),
        lines: [{ xi: 0, color: LIM_COL }, { xi: f.xiH, color: LIM23_COL }],
        boundaries: f.has2b ? [{ xi: f.xi2ab }] : [],
        bands: f.has2b
            ? [{ xi0: 0, xi1: f.xi2ab, color: SUB2A_COL, op: 0.14, label: "2a" }, { xi0: f.xi2ab, xi1: f.xiH, color: SUB2B_COL, op: 0.3, label: "2b", labelCol: "#3b82f6" }]
            : [{ xi0: 0, xi1: f.xiH, color: SUB2A_COL, op: 0.14, label: "2a" }],
        concRange: [0, p.epsCu],
        aspRanges: [
            { key: "2a", e0: f.has2b ? -p.epsSe : f.epsS23, e1: f.epsS12, color: SUB2A_COL },
            ...(f.has2b ? [{ key: "2b", e0: f.epsS23, e1: -p.epsSe, color: SUB2B_COL }] : []),
        ],
        asRanges: [],
        pivot: { e: p.epsSu, depth: p.d, label: "A", color: AS_COL, dx: -6, dy: 4, anchor: "end" },
        drag: { eMin: f.epsS23, eMax: f.epsS12, toSlider: (e) => (1000 * ((p.epsSu * p.delta2 - e) / (p.epsSu - e))) / f.xiH },
        triangles: (tri, c, H, V) => {
            const { ax, ex, yD, yA, yAp, xi } = c;
            if (tri === "ab") {
                const yn = yD(f.x2ab), N = [ax, yn];
                V(ax - 4, yn, yAp, "x − d″", TRI2_COL, "end"); H(ax, ex(-p.epsSe), yAp - 4, "ε′_se", TRI2_COL);
                V(ex(-p.epsSe) + 4, yAp, yA, "d − d″", TRI1_COL); H(ex(-p.epsSe), ex(p.epsSu), yA + 11, "ε_su − ε′_se", TRI1_COL);
                return [
                    { T: [N, [ax, yAp], [ex(-p.epsSe), yAp]], c: TRI2_COL },
                    { T: [[ex(-p.epsSe), yAp], [ex(-p.epsSe), yA], [ex(p.epsSu), yA]], c: TRI1_COL },
                ];
            }
            const xv = tri === "H" ? f.xiH : xi, yn = yD(xv * p.d), N = [ax, yn];
            const ec = f.epsC(xv), es = f.epsSP(xv);
            V(ax + 4, yn, yA, "d − x", TRI1_COL); H(ax, ex(p.epsSu), yA + 11, "ε_su", TRI1_COL);
            V(ax - 4, yD(0), yn, "x", TRI3_COL, "end"); H(ax, ex(-ec), yD(0) - 4, tri === "H" ? "ε_cu" : "ε_c", TRI3_COL);
            if (tri === "cur") H(ax, ex(es), yAp + 10, "ε′_s", TRI2_COL);
            return [
                { T: [N, [ax, yA], [ex(p.epsSu), yA]], c: TRI1_COL },
                { T: [N, [ax, yD(0)], [ex(-ec), yD(0)]], c: TRI3_COL },
                ...(tri === "cur" ? [{ T: [N, [ax, yAp], [ex(es), yAp]], c: TRI2_COL }] : []),
            ];
        },
    };
}

// ---------------------------------------------------------------------------
// CAMPO 3 (pivot B: lembo compresso a ε_cu, A_s snervata)
// ---------------------------------------------------------------------------
const SUB3A_COL = "#831843"; // sottocampo 3a: rosa scuro
const SUB3B_COL = "#f9a8d4"; // sottocampo 3b: rosa chiaro
const LIM34_COL = "#b45309"; // retta limite 3/4
const TRI3_TEX = {
    cur: String.raw`\color{#db2777}\dfrac{\varepsilon_{cu}}{x}\color{black}=\color{#0284c7}\dfrac{-\varepsilon'_s}{x-d''}\color{black}=\color{#d97706}\dfrac{\varepsilon_s}{d-x}`,
    N: String.raw`\color{#d97706}\dfrac{\varepsilon_{se}+\varepsilon_{cu}}{d}\color{black}=\color{#db2777}\dfrac{\varepsilon_{cu}}{x_N}\color{black}\;\Rightarrow\;x_N=\dfrac{\varepsilon_{cu}}{\varepsilon_{cu}+\varepsilon_{se}}\,d`,
    ab: String.raw`\color{#db2777}\dfrac{\varepsilon_{cu}}{x_{3a/3b}}\color{black}=\color{#0284c7}\dfrac{\varepsilon_{cu}+\varepsilon'_{se}}{d''}`,
};
const TRI3_NOTE = {
    cur: "Vertice comune nel punto dell'asse neutro (x_H ≤ x ≤ x_N), sulla retta dello stato corrente: tre triangoli simili per il lembo compresso, A′_s e A_s.",
    N: "Retta limite 3/4: A_s allo snervamento (ε_se) con il calcestruzzo a ε_cu.",
    ab: "Retta di confine 3a/3b (A′_s a ε′_se in compressione): triangolo dal lembo compresso all'asse neutro e triangolo da B alla quota di A′_s.",
};

function spec3(p, f) {
    const bands = [];
    if (f.has3a) bands.push({ xi0: f.xiH, xi1: f.has3b ? f.xi3ab : f.xiN, color: SUB3A_COL, op: 0.14, label: "3a" });
    if (f.has3b) bands.push({ xi0: f.has3a ? f.xi3ab : f.xiH, xi1: f.xiN, color: SUB3B_COL, op: 0.3, label: "3b", labelCol: "#db2777" });
    return {
        id: "3",
        range: [f.xiH, f.xiN],
        strainAt: (xv, depth) => (p.epsCu * (depth - xv * p.d)) / (xv * p.d),
        lines: [{ xi: f.xiH, color: LIM23_COL }, { xi: f.xiN, color: LIM34_COL }],
        boundaries: f.has3a && f.has3b ? [{ xi: f.xi3ab }] : [],
        bands,
        concRange: [p.epsCu, p.epsCu],
        aspRanges: [
            ...(f.has3a ? [{ key: "3a", e0: f.has3b ? -p.epsSe : f.epsS34, e1: f.epsS23, color: SUB3A_COL }] : []),
            ...(f.has3b ? [{ key: "3b", e0: f.epsS34, e1: f.has3a ? -p.epsSe : f.epsS23, color: SUB3B_COL }] : []),
        ],
        asRanges: [{ key: "as", e0: p.epsSe, e1: p.epsSu, color: FIELD_COL[3] }],
        pivot: { e: -p.epsCu, depth: 0, label: "B", color: CONC_COL, dx: 6, dy: -4, anchor: "start" },
        drag: {
            eMin: f.epsS34, eMax: f.epsS23,
            toSlider: (e) => (1000 * ((p.epsCu * p.delta2) / (p.epsCu + e) - f.xiH)) / (f.xiN - f.xiH),
        },
        triangles: (tri, c, H, V) => {
            const { ax, ex, yD, yA, yAp, xi } = c;
            const xB = ex(-p.epsCu), y0 = yD(0);
            if (tri === "N") {
                const yn = yD(f.xN), N = [ax, yn];
                V(ax - 4, y0, yn, "x_N", TRI3_COL, "end"); H(ax, xB, y0 - 4, "ε_cu", TRI3_COL);
                V(xB + 4, y0, yA, "d", TRI1_COL); H(xB, ex(p.epsSe), yA + 11, "ε_se + ε_cu", TRI1_COL);
                return [
                    { T: [N, [ax, y0], [xB, y0]], c: TRI3_COL },
                    { T: [[xB, y0], [xB, yA], [ex(p.epsSe), yA]], c: TRI1_COL },
                ];
            }
            if (tri === "ab") {
                const yn = yD(f.x3ab), N = [ax, yn];
                V(ax - 4, y0, yn, "x_3a/3b", TRI3_COL, "end"); H(ax, xB, y0 - 4, "ε_cu", TRI3_COL);
                V(xB + 4, y0, yAp, "d″", TRI2_COL); H(xB, ex(-p.epsSe), yAp + 10, "ε_cu + ε′_se", TRI2_COL);
                return [
                    { T: [N, [ax, y0], [xB, y0]], c: TRI3_COL },
                    { T: [[xB, y0], [xB, yAp], [ex(-p.epsSe), yAp]], c: TRI2_COL },
                ];
            }
            const yn = yD(xi * p.d), N = [ax, yn], es = f.epsS(xi), esp = f.epsSP(xi);
            V(ax - 4, y0, yn, "x", TRI3_COL, "end"); H(ax, xB, y0 - 4, "ε_cu", TRI3_COL);
            H(ax, ex(esp), yAp + 10, "ε′_s", TRI2_COL);
            V(ax + 4, yn, yA, "d − x", TRI1_COL); H(ax, ex(es), yA + 11, "ε_s", TRI1_COL);
            return [
                { T: [N, [ax, y0], [xB, y0]], c: TRI3_COL },
                { T: [N, [ax, yAp], [ex(esp), yAp]], c: TRI2_COL },
                { T: [N, [ax, yA], [ex(es), yA]], c: TRI1_COL },
            ];
        },
    };
}

function FieldThree({ data, st, set }) {
    const p = st.branch > 0 ? data.pos : data.neg;
    const f = st.branch > 0 ? data.f3pos : data.f3neg;
    const xi = sliderToXi(st.slider, f.xiH, f.xiN);
    const xiB = useDeferredValue(xi); // blocchi 2–6: aggiornati subito dopo, senza bloccare il cursore
    const cur = f.point(xi);
    const d1 = T(p.delta1, 4), d2 = T(p.delta2, 4), eCu = T(p.epsCu, 4), eSe = T(-p.epsSe, 5);
    const sgnM = st.branch < 0 ? "-" : "";
    const tri = !(f.has3a && f.has3b) && st.tri === "ab" ? "cur" : (st.tri === "N" || st.tri === "ab" ? st.tri : "cur");
    const subs = [f.has3a && "3a", f.has3b && "3b"].filter(Boolean);

    return (
        <NumCtx.Provider value={st.num}>
            <div className="space-y-5">
                <FieldToolbar st={st} set={set} note={st.branch > 0
                    ? "Lembo compresso in alto a ε_cu (pivot B), A_s inferiore snervata, A′_s superiore."
                    : "Sezione ribaltata: lembo compresso in basso; A_s ↔ A′_s, d′ ↔ d″, M cambia segno."} />

                {/* 1. intervallo e stati deformativi */}
                <Block n="1" title="Intervallo e stati deformativi">
                    <div className="space-y-4">
                        <div className="tex-left space-y-1 text-sm text-slate-600">
                            <Tex display>{String.raw`x_H \le x \le x_N \quad\Longleftrightarrow\quad \dfrac{\varepsilon_{cu}}{\varepsilon_{cu}+\varepsilon_{su}}=${T(f.xiH, 4)} \le \xi \le \dfrac{\varepsilon_{cu}}{\varepsilon_{cu}+\varepsilon_{se}}=${T(f.xiN, 4)}`}</Tex>
                            <p className="text-xs">Crisi lato calcestruzzo: il fascio di rette fa perno in B (lembo compresso a ε<sub>cu</sub>). A<sub>s</sub> è snervata (ε<sub>se</sub> ≤ ε<sub>s</sub> ≤ ε<sub>su</sub>): il campo va dalla retta 2/3 (verde acqua) alla retta 3/4 (ambra, A<sub>s</sub> a ε<sub>se</sub>). Campo molto ampio: x fra circa il {fmtNum(f.xiH * 100, 0)}% e il {fmtNum(f.xiN * 100, 0)}% di d.</p>
                            <p className="text-xs">A′<sub>s</sub> compressa: {subs.length === 2 ? "elastica (3a) e poi plastica (3b)" : f.has3b ? "già snervata nel campo 2, tutto il campo è 3b" : "resta elastica (3a): snerverà nel campo 4"}.</p>
                        </div>
                        <div className="flex w-full flex-col items-center gap-3">
                            <div className="flex w-full flex-wrap items-start justify-center gap-3">
                                <div className="flex justify-center">
                                    <Segmented small value={st.hl ?? "fields"} onChange={(v) => set({ hl: v })} options={[{ value: "fields", label: "Sottocampi" }, { value: "profile", label: "Profilo" }, { value: "triangles", label: "Triangoli simili" }]} />
                                </div>
                                <MiniXiSlider value={st.slider} onChange={(v) => set({ slider: v })} left={<>ξ<sub>H</sub></>} right={<>ξ<sub>N</sub></>} sub={cur.sub} items={[
                                    { label: "ξ", value: xiTxt(xi) },
                                    { label: "x", value: `${fmtNum(xi * p.d, 1)} mm` },
                                    { label: "ε′_s", value: `${fmtNum(cur.epsSP * 1000, 2)}‰` },
                                    { label: "ε_s", value: `${fmtNum(cur.epsS * 1000, 2)}‰` },
                                ]} />
                                {st.hl === "triangles" && (
                                    <div className="w-full max-w-[340px] space-y-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2">
                                        <div className="flex justify-center">
                                            <Segmented small value={tri} onChange={(v) => set({ tri: v })} options={[
                                                { value: "cur", label: hs("ε′_s, ε_s(ξ)") },
                                                { value: "N", label: hs("ξ_N") },
                                                ...(f.has3a && f.has3b ? [{ value: "ab", label: hs("ξ_3a/3b") }] : []),
                                            ]} />
                                        </div>
                                        <div className="tex-left text-sm"><Tex display>{TRI3_TEX[tri]}</Tex></div>
                                        <p className="text-[11px] leading-4 text-slate-500">{hs(TRI3_NOTE[tri])}</p>
                                    </div>
                                )}
                            </div>
                            <div className="w-full">
                                <StrainDiagramPivot p={p} xi={xi} branch={st.branch} mode={st.hl ?? "fields"} tri={tri}
                                    onSlider={(v) => set({ slider: v })} spec={spec3(p, f)} />
                            </div>
                        </div>
                    </div>
                </Block>

                <Lazy deps={[p, f, xiB, st.num, st.branch, data]} render={() => {
                    const xi = xiB; const cur = f.point(xi); const ref = numericPivotB(p, xi); const errN = Math.abs(cur.N - ref.N), errM = Math.abs(cur.M - ref.M); const ok = errN < 1e-3 && errM < 1e-3; const xiv = T(xi, 4);
                    return (<>
                {/* 2. legami costitutivi */}
                <Block n="2" title="Legami costitutivi">
                    <div className="space-y-1 text-xs leading-5 text-slate-600">
                        <p><b>Calcestruzzo</b>: parabola-rettangolo; nel campo 3 il lembo compresso è sempre a ε<sub>cu</sub> = {fmtNum(p.epsCu * 1000, 1)}‰, quindi si sviluppa l'intero diagramma per ogni stato deformativo: ψ e λ sono costanti.</p>
                        <p><b>Acciaio</b>: A<sub>s</sub> snervata, ε<sub>s</sub> scende da ε<sub>su</sub> (retta 2/3) a ε<sub>se</sub> (retta 3/4) lungo il tratto plastico, σ<sub>s</sub> = f<sub>yd</sub>.</p>
                        <p>• A′<sub>s</sub> compressa (deformazioni negative): {f.has3a && f.has3b
                            ? <>tratto elastico da ε′<sub>s2/3</sub> a ε′<sub>se</sub> (3a), poi plastico fino a ε′<sub>s3/4</sub> (3b)</>
                            : f.has3b ? <>già snervata nel campo 2: tratto plastico da ε′<sub>s2/3</sub> a ε′<sub>s3/4</sub> (3b)</>
                                : <>tratto elastico da ε′<sub>s2/3</sub> a ε′<sub>s3/4</sub> (3a): non snerva nel campo 3</>}.</p>
                    </div>
                </Block>

                {/* 3. congruenza e sottocampi */}
                <Block n="3" title="Congruenza e sottocampi">
                    <div className="tex-left space-y-1">
                        <Tex display>{String.raw`\dfrac{\varepsilon_{cu}}{x}=\dfrac{-\varepsilon'_s}{x-d''}=\dfrac{\varepsilon_s}{d-x}\;\Longleftrightarrow\;\dfrac{\varepsilon_{cu}}{\xi}=\dfrac{-\varepsilon'_s}{\xi-\delta''}=\dfrac{\varepsilon_s}{1-\xi}`}</Tex>
                        <Tex display>{String.raw`\varepsilon'_s=-\dfrac{\varepsilon_{cu}}{\xi}\,(\xi-\delta'')\qquad\varepsilon_s=\dfrac{\varepsilon_{cu}}{\xi}\,(1-\xi)`}</Tex>
                        <F lhs="\xi_N" sym="\dfrac{\varepsilon_{cu}}{\varepsilon_{cu}+\varepsilon_{se}}" num={`\\dfrac{${eCu}}{${eCu}+${T(p.epsSe, 5)}}`} val={T(f.xiN, 4)} br={false} />
                        <F lhs="x_N" sym="\xi_N\,d" num={`${T(f.xiN, 4)}\\cdot ${T(p.d, 1)}`} val={`${T(f.xN, 1)}\\ \\text{mm}`} br={false} />
                        <F lhs="\varepsilon'_{s2/3}" sym={String.raw`-\dfrac{\varepsilon_{cu}}{\xi_H}\,(\xi_H-\delta'')`} num={String.raw`-\dfrac{${eCu}}{${T(f.xiH, 4)}}\,(${T(f.xiH, 4)}-${d2})`} val={pm(f.epsS23, 3)} br={false} />
                        <F lhs="\varepsilon'_{s3/4}" sym={String.raw`-\dfrac{\varepsilon_{cu}}{\xi_N}\,(\xi_N-\delta'')`} num={String.raw`-\dfrac{${eCu}}{${T(f.xiN, 4)}}\,(${T(f.xiN, 4)}-${d2})`} val={pm(f.epsS34, 3)} br={false} />
                        <F lhs="\xi_{3a/3b}" sym={String.raw`\dfrac{\varepsilon_{cu}\,\delta''}{\varepsilon_{cu}+\varepsilon'_{se}}`} num={String.raw`\dfrac{${eCu}\cdot ${d2}}{${eCu}+(${eSe})}`} val={T(f.xi3ab, 4)} br={false} />
                        {f.has3a && f.has3b
                            ? <Tex display>{String.raw`\begin{aligned}&\text{3a: }A'_s\text{ elastica, }\sigma'_s=E_s\,\varepsilon'_s&&${T(f.xiH, 4)}\le\xi\le ${T(f.xi3ab, 4)}\\&\text{3b: }A'_s\text{ plastica (compressa), }\sigma'_s=-f_{yd}&&${T(f.xi3ab, 4)}\le\xi\le ${T(f.xiN, 4)}\end{aligned}`}</Tex>
                            : <p className="text-xs font-semibold text-amber-700">{f.has3b
                                ? <>ξ<sub>3a/3b</sub> ≤ ξ<sub>H</sub>: A′<sub>s</sub> è già snervata nel campo 2 (sottocampo 2b), tutto il campo 3 è 3b.</>
                                : <>ξ<sub>3a/3b</sub> ≥ ξ<sub>N</sub>: A′<sub>s</sub> resta elastica in tutto il campo 3 (3a), snerverà nel campo 4 (copriferro molto spesso).</>}</p>}
                        <p className="pt-1 text-xs font-semibold text-slate-500">In quale campo snerva A′<sub>s</sub>? Copriferro per cui snerva proprio sulla retta 2/3:</p>
                        <F lhs="d''_{\varepsilon se,2/3}" sym={String.raw`\dfrac{\varepsilon_{cu}+\varepsilon'_{se}}{\varepsilon_{cu}}\,x_H`} num={String.raw`\dfrac{${eCu}+(${eSe})}{${eCu}}\cdot ${T(f.xH, 1)}`} val={`${T(f.dSup23, 1)}\\ \\text{mm}`} br={false} />
                        <p className="text-xs text-slate-500">d″ = {fmtNum(p.dSup, 1)} mm {p.dSup < f.dSup23 ? "<" : "≥"} d″<sub>εse,2/3</sub> → sottocampi {p.dSup < f.dSup23 ? "2a, 2b, 3b" : "2a, 3a, 3b"}.</p>
                        <Tex display>{String.raw`\psi=1-\dfrac{\varepsilon_{c2}}{3\,\varepsilon_{cu}}=${T(f.psi, 5)}\qquad\lambda=\dfrac{6\varepsilon_{cu}^2-4\varepsilon_{cu}\varepsilon_{c2}+\varepsilon_{c2}^2}{4\,\varepsilon_{cu}\,(3\varepsilon_{cu}-\varepsilon_{c2})}=${T(f.lam, 4)}`}</Tex>
                    </div>
                </Block>

                {/* 4. equazioni di campo */}
                <Block n="4" title="Equazioni di campo">
                    <div className="tex-left space-y-2">
                        <p className="text-xs font-semibold text-slate-500">Equilibrio (identiche al campo 2, con ψ e λ costanti):</p>
                        <Tex display>{String.raw`\begin{cases}b\,\psi\,x\,f_{cd}-A'_s\,\sigma'_s-A_s\,f_{yd}=N_{Rd}\\[4pt]b\,\psi\,x\,f_{cd}\left(\tfrac{h}{2}-\lambda x\right)-A'_s\,\sigma'_s\left(\tfrac{h}{2}-d''\right)+A_s\,f_{yd}\left(\tfrac{h}{2}-d'\right)=M_{Rd}\end{cases}\qquad\sigma'_s=\begin{cases}E_s\,\varepsilon'_s=-E_s\dfrac{\varepsilon_{cu}}{x}(x-d'')&\text{(3a)}\\-f_{yd}&\text{(3b)}\end{cases}`}</Tex>
                        <Tex display>{String.raw`\begin{cases}\psi\,\xi-\alpha'_s\,\omega'_s-\omega_s=\nu_{Rd}\\[4pt]\psi\,\xi\left(\dfrac{1+\delta'}{2}-\lambda\xi\right)-\alpha'_s\,\omega'_s\,\dfrac{1+\delta'-2\delta''}{2}+\omega_s\,\dfrac{1-\delta'}{2}=\mu_{Rd}\end{cases}\qquad\alpha'_s=\begin{cases}-\dfrac{E_s}{f_{yd}}\,\dfrac{\varepsilon_{cu}}{\xi}\,(\xi-\delta'')&\text{(3a)}\\-1&\text{(3b)}\end{cases}`}</Tex>
                        <p className="text-xs text-slate-500">ω<sub>s</sub> = {fmtNum(p.omegaS, 4)}, ω′<sub>s</sub> = {fmtNum(p.omegaSP, 4)}, (1 − δ′)/2 = {fmtNum(p.armS, 4)}, (1 + δ′ − 2δ″)/2 = {fmtNum(p.armSP, 4)}, ψ = {fmtNum(f.psi, 5)}, λ = {fmtNum(f.lam, 4)}.</p>
                        <p className="rounded-lg bg-amber-50 px-2 py-1 text-[11px] leading-4 text-amber-800">Nota sui segni: come nel campo 2b, negli appunti per 3b compare α′<sub>s</sub> = 1; con la convenzione dei segni (compressione negativa) è α′<sub>s</sub> = −1, valore che coincide con il calcolo numerico.</p>
                    </div>
                </Block>

                {/* 5. stato corrente */}
                <Block n="5" title="Stato corrente (ξ dal cursore del blocco 1)">
                    <div className="space-y-3">
                        <div className="tex-left space-y-1">
                            <Tex display>{String.raw`\xi=${xiv}\qquad x=${T(xi * p.d, 1)}\ \text{mm}\qquad\text{sottocampo }${cur.sub}\qquad\varepsilon_c=\varepsilon_{cu},\ \psi=${T(f.psi, 5)},\ \lambda=${T(f.lam, 4)}`}</Tex>
                            <F lhs="\varepsilon_s" sym={String.raw`\dfrac{\varepsilon_{cu}}{\xi}\,(1-\xi)`} num={String.raw`\dfrac{${eCu}}{${xiv}}\,(1-${xiv})`} val={`${pm(cur.epsS, 3)}\\;\\ge\\;\\varepsilon_{se}\\;\\Rightarrow\\;\\sigma_s=f_{yd}`} br={false} />
                            <F lhs="\varepsilon'_s" sym={String.raw`-\dfrac{\varepsilon_{cu}}{\xi}\,(\xi-\delta'')`} num={String.raw`-\dfrac{${eCu}}{${xiv}}\,(${xiv}-${d2})`} val={pm(cur.epsSP, 3)} br={false} />
                            {cur.sub === "3b"
                                ? <Tex display>{String.raw`\alpha'_s=-1\quad(\varepsilon'_s\le\varepsilon'_{se})\qquad\sigma'_s=-f_{yd}=${T(cur.sigmaSP, 1)}\ \text{MPa}`}</Tex>
                                : <F lhs="\alpha'_s" sym={String.raw`\dfrac{E_s\,\varepsilon'_s}{f_{yd}}`} num={String.raw`\dfrac{200\,000\cdot (${T(cur.epsSP, 6)})}{${T(p.fyd, 2)}}`} val={`${T(cur.alphaSP, 4)}\\qquad\\sigma'_s=${T(cur.sigmaSP, 1)}\\ \\text{MPa}`} br={false} />}
                            <F lhs="\nu_{Rd}" sym="\psi\,\xi-\alpha'_s\,\omega'_s-\omega_s" num={`${T(f.psi, 5)}\\cdot ${xiv}-(${T(cur.alphaSP, 4)})\\cdot ${T(p.omegaSP, 4)}-${T(p.omegaS, 4)}`} val={T(cur.nu, 4)} br={false} />
                            <F lhs="\mu_{Rd}" sym={String.raw`${sgnM ? "-\\Big[" : ""}\psi\xi\left(\tfrac{1+\delta'}{2}-\lambda\xi\right)-\alpha'_s\omega'_s\tfrac{1+\delta'-2\delta''}{2}+\omega_s\tfrac{1-\delta'}{2}${sgnM ? "\\Big]" : ""}`}
                                num={`${sgnM ? "-\\big[" : ""}${T(f.psi, 5)}\\cdot ${xiv}\\,(\\tfrac{1+${d1}}{2}-${T(f.lam, 4)}\\cdot ${xiv})-(${T(cur.alphaSP, 4)})\\cdot ${T(p.omegaSP, 4)}\\cdot ${T(p.armSP, 4)}+${T(p.omegaS, 4)}\\cdot ${T(p.armS, 4)}${sgnM ? "\\big]" : ""}`} val={T(cur.mu, 4)} br={false} />
                            <F lhs="N_{Rd}" sym="\nu_{Rd}\,b\,d\,f_{cd}" num={`${T(cur.nu, 4)}\\cdot ${T(p.b, 0)}\\cdot ${T(p.d, 1)}\\cdot ${T(p.fcd, 2)}`} val={`${T(cur.N, 1)}\\ \\text{kN}`} br={false} />
                            <F lhs="M_{Rd}" sym="\mu_{Rd}\,b\,d^2\,f_{cd}" num={`${T(cur.mu, 4)}\\cdot ${T(p.b, 0)}\\cdot ${T(p.d, 1)}^2\\cdot ${T(p.fcd, 2)}`} val={`${T(cur.M, 2)}\\ \\text{kNm}`} br={false} />
                        </div>
                        <p className="text-xs text-slate-400">Il diagramma delle forze interne di questo stato è disegnato sulla sezione, nel blocco 1.</p>
                        <div className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs ${ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                            {ok ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
                            Calcolo numerico (piano di deformazione per B + legami, cls integrato a strisce): N = {fmtNum(ref.N, 1)} kN, M = {fmtNum(ref.M, 2)} kNm
                            — scarto ΔN = {errN.toExponential(1)}, ΔM = {errM.toExponential(1)}
                        </div>
                    </div>
                </Block>

                {/* 6. punti caratteristici e osservazioni */}
                <Block n="6" title="Punti caratteristici e osservazioni">
                    <PointsTable cols={[{ key: "es", h: <>ε<sub>s</sub> [‰]</>, v: (pt) => fmtNum(pt.epsS * 1000, 3) }, COL_EPSSP, COL_ALPHA]} rows={[
                        { label: "Retta limite 2/3 (ξ = ξH)", pt: f.point(f.xiH) },
                        ...(f.has3a && f.has3b ? [{ label: "Confine 3a/3b (ξ = ξ3a/3b)", pt: f.point(f.xi3ab) }] : []),
                        { label: "Retta limite 3/4 (ξ = ξN)", pt: f.point(f.xiN) },
                    ]} />
                    <div className="mt-3 space-y-1 text-xs leading-5 text-slate-600">
                        <p>• Il punto ξ = ξ<sub>H</sub> coincide con l'ultimo punto del campo 2.</p>
                        <p>• Come nel campo 2, l'asse neutro scende: la sezione è sempre più compressa (N<sub>Rd</sub> cresce) e il momento resistente aumenta.</p>
                        <p>• Sottocampi possibili: campo 2 solo 2a → A′<sub>s</sub> snerva nel campo 3 (3a + 3b); campo 2 con 2a e 2b → campo 3 tutto 3b; solo sottocampi elastici in 2 e 3 → snervamento nel campo 4 (copriferro molto spesso, raro).</p>
                    </div>
                </Block>
                    </>);
                }} />
            </div>
        </NumCtx.Provider>
    );
}


// ---------------------------------------------------------------------------
// CAMPO 4 (pivot B, A_s elastica: campo delle forti armature)
// ---------------------------------------------------------------------------
const SUB4A_COL = "#713f12"; // sottocampo 4a: ocra scuro
const SUB4B_COL = "#fde68a"; // sottocampo 4b (o campo intero): giallo chiaro
const LIM45_COL = "#475569"; // retta limite 4/5 (x = d)
const TRI4_TEX = {
    cur: String.raw`\color{#db2777}\dfrac{\varepsilon_{cu}}{x}\color{black}=\color{#0284c7}\dfrac{-\varepsilon'_s}{x-d''}\color{black}=\color{#d97706}\dfrac{\varepsilon_s}{d-x}`,
    N: String.raw`\color{#d97706}\dfrac{\varepsilon_{se}+\varepsilon_{cu}}{d}\color{black}=\color{#db2777}\dfrac{\varepsilon_{cu}}{x_N}\color{black}\;\Rightarrow\;x_N=\dfrac{\varepsilon_{cu}}{\varepsilon_{cu}+\varepsilon_{se}}\,d`,
    ab: String.raw`\color{#db2777}\dfrac{\varepsilon_{cu}}{x_{4a/4b}}\color{black}=\color{#0284c7}\dfrac{\varepsilon_{cu}+\varepsilon'_{se}}{d''}`,
};
const TRI4_NOTE = {
    cur: "Vertice comune nel punto dell'asse neutro (x_N ≤ x ≤ d): tre triangoli simili per il lembo compresso, A′_s e A_s (ora elastica).",
    N: "Retta limite 3/4 (inizio del campo): A_s allo snervamento (ε_se) con il calcestruzzo a ε_cu.",
    ab: "Retta di confine 4a/4b (A′_s a ε′_se in compressione): triangolo dal lembo compresso all'asse neutro e triangolo da B alla quota di A′_s.",
};

function spec4(p, f) {
    const bands = f.split
        ? [{ xi0: f.xiN, xi1: f.xi4ab, color: SUB4A_COL, op: 0.14, label: "4a" }, { xi0: f.xi4ab, xi1: 1, color: SUB4B_COL, op: 0.45, label: "4b", labelCol: "#a16207" }]
        : [{ xi0: f.xiN, xi1: 1, color: SUB4B_COL, op: 0.45, label: "4", labelCol: "#a16207" }];
    const s3 = spec3(p, field3(p)); // stessi triangoli del campo 3 (pivot B)
    return {
        id: "4",
        range: [f.xiN, 1],
        strainAt: (xv, depth) => (p.epsCu * (depth - xv * p.d)) / (xv * p.d),
        lines: [{ xi: f.xiN, color: LIM34_COL }, { xi: 1, color: LIM45_COL }],
        boundaries: f.split ? [{ xi: f.xi4ab }] : [],
        bands,
        concRange: [p.epsCu, p.epsCu],
        aspRanges: f.split
            ? [{ key: "4a", e0: -p.epsSe, e1: f.epsS34, color: SUB4A_COL }, { key: "4b", e0: f.epsS45, e1: -p.epsSe, color: "#eab308" }]
            : [{ key: "4", e0: f.epsS45, e1: f.epsS34, color: f.has4b ? "#eab308" : SUB4A_COL }],
        asRanges: [{ key: "as", e0: 0, e1: p.epsSe, color: FIELD_COL[4] }],
        pivot: { e: -p.epsCu, depth: 0, label: "B", color: CONC_COL, dx: 6, dy: -4, anchor: "start" },
        drag: {
            eMin: f.epsS45, eMax: f.epsS34,
            toSlider: (e) => (1000 * ((p.epsCu * p.delta2) / (p.epsCu + e) - f.xiN)) / (1 - f.xiN),
        },
        triangles: (tri, c, H, V) => {
            if (tri === "ab") {
                const { ax, ex, yD, yAp } = c, xB = ex(-p.epsCu), y0 = yD(0), yn = yD(f.x4ab), N = [ax, yn];
                V(ax - 4, y0, yn, "x_4a/4b", TRI3_COL, "end"); H(ax, xB, y0 - 4, "ε_cu", TRI3_COL);
                V(xB + 4, y0, yAp, "d″", TRI2_COL); H(xB, ex(-p.epsSe), yAp + 10, "ε_cu + ε′_se", TRI2_COL);
                return [
                    { T: [N, [ax, y0], [xB, y0]], c: TRI3_COL },
                    { T: [[xB, y0], [xB, yAp], [ex(-p.epsSe), yAp]], c: TRI2_COL },
                ];
            }
            return s3.triangles(tri, c, H, V);
        },
    };
}

function FieldFour({ data, st, set }) {
    const p = st.branch > 0 ? data.pos : data.neg;
    const f = st.branch > 0 ? data.f4pos : data.f4neg;
    const xi = sliderToXi(st.slider, f.xiN, 1);
    const xiB = useDeferredValue(xi); // blocchi 2–6: aggiornati subito dopo, senza bloccare il cursore
    const cur = f.point(xi);
    const d1 = T(p.delta1, 4), d2 = T(p.delta2, 4), eCu = T(p.epsCu, 4), eSe = T(-p.epsSe, 5);
    const sgnM = st.branch < 0 ? "-" : "";
    const tri = !f.split && st.tri === "ab" ? "cur" : (st.tri === "N" || st.tri === "ab" ? st.tri : "cur");

    return (
        <NumCtx.Provider value={st.num}>
            <div className="space-y-5">
                <FieldToolbar st={st} set={set} note={st.branch > 0
                    ? "Lembo compresso in alto a ε_cu (pivot B), A_s inferiore in campo elastico, A′_s superiore."
                    : "Sezione ribaltata: lembo compresso in basso; A_s ↔ A′_s, d′ ↔ d″, M cambia segno."} />

                {/* 1. intervallo e stati deformativi */}
                <Block n="1" title="Intervallo e stati deformativi">
                    <div className="space-y-4">
                        <div className="tex-left space-y-1 text-sm text-slate-600">
                            <Tex display>{String.raw`x_N \le x \le d \quad\Longleftrightarrow\quad \dfrac{\varepsilon_{cu}}{\varepsilon_{cu}+\varepsilon_{se}}=${T(f.xiN, 4)} \le \xi \le 1`}</Tex>
                            <p className="text-xs">Campo delle forti armature: le barre inferiori sono in campo elastico (σ<sub>s</sub> = E<sub>s</sub>ε<sub>s</sub>) e quindi poco sfruttate. Pivot B (lembo compresso a ε<sub>cu</sub>); il campo va dalla retta 3/4 (ambra, A<sub>s</sub> a ε<sub>se</sub>) alla retta 4/5 (grigio, asse neutro sull'armatura tesa, ε<sub>s</sub> = 0): x fra circa il {fmtNum(f.xiN * 100, 0)}% e il 100% di d.</p>
                            <p className="text-xs">A′<sub>s</sub> compressa: {f.split ? "elastica (4a) e poi plastica (4b)" : f.has4b ? "tipicamente già snervata nei campi precedenti (nessun sottocampo)" : "resta elastica in tutto il campo"}.</p>
                        </div>
                        <div className="flex w-full flex-col items-center gap-3">
                            <div className="flex w-full flex-wrap items-start justify-center gap-3">
                                <div className="flex justify-center">
                                    <Segmented small value={st.hl ?? "fields"} onChange={(v) => set({ hl: v })} options={[{ value: "fields", label: "Sottocampi" }, { value: "profile", label: "Profilo" }, { value: "triangles", label: "Triangoli simili" }]} />
                                </div>
                                <MiniXiSlider value={st.slider} onChange={(v) => set({ slider: v })} left={<>ξ<sub>N</sub></>} right="1" sub={cur.sub} items={[
                                    { label: "ξ", value: xiTxt(xi) },
                                    { label: "x", value: `${fmtNum(xi * p.d, 1)} mm` },
                                    { label: "ε′_s", value: `${fmtNum(cur.epsSP * 1000, 2)}‰` },
                                    { label: "ε_s", value: `${fmtNum(cur.epsS * 1000, 2)}‰` },
                                ]} />
                                {st.hl === "triangles" && (
                                    <div className="w-full max-w-[340px] space-y-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2">
                                        <div className="flex justify-center">
                                            <Segmented small value={tri} onChange={(v) => set({ tri: v })} options={[
                                                { value: "cur", label: hs("ε′_s, ε_s(ξ)") },
                                                { value: "N", label: hs("ξ_N") },
                                                ...(f.split ? [{ value: "ab", label: hs("ξ_4a/4b") }] : []),
                                            ]} />
                                        </div>
                                        <div className="tex-left text-sm"><Tex display>{TRI4_TEX[tri]}</Tex></div>
                                        <p className="text-[11px] leading-4 text-slate-500">{hs(TRI4_NOTE[tri])}</p>
                                    </div>
                                )}
                            </div>
                            <div className="w-full">
                                <StrainDiagramPivot p={p} xi={xi} branch={st.branch} mode={st.hl ?? "fields"} tri={tri}
                                    onSlider={(v) => set({ slider: v })} spec={spec4(p, f)} />
                            </div>
                        </div>
                    </div>
                </Block>

                <Lazy deps={[p, f, xiB, st.num, st.branch, data]} render={() => {
                    const xi = xiB; const cur = f.point(xi); const ref = numericPivotB(p, xi); const errN = Math.abs(cur.N - ref.N), errM = Math.abs(cur.M - ref.M); const ok = errN < 1e-3 && errM < 1e-3;
                    const xiv = T(xi, 4);
                    return (<>
                {/* 2. legami costitutivi */}
                <Block n="2" title="Legami costitutivi">
                    <div className="space-y-1 text-xs leading-5 text-slate-600">
                        <p><b>Calcestruzzo</b>: lembo compresso sempre a ε<sub>cu</sub> = {fmtNum(p.epsCu * 1000, 1)}‰: diagramma parabola-rettangolo completo, ψ e λ costanti.</p>
                        <p><b>Acciaio</b>: A<sub>s</sub> nel tratto <b>elastico</b>, ε<sub>s</sub> scende da ε<sub>se</sub> (retta 3/4) a 0 (retta 4/5), σ<sub>s</sub> = E<sub>s</sub>ε<sub>s</sub>.</p>
                        <p>• A′<sub>s</sub> compressa: {f.split
                            ? <>tratto elastico da ε′<sub>s3/4</sub> a ε′<sub>se</sub> (4a), poi plastico fino a ε′<sub>s4/5</sub> (4b)</>
                            : f.has4b ? <>già snervata: tratto plastico da ε′<sub>s3/4</sub> a ε′<sub>s4/5</sub></>
                                : <>tratto elastico da ε′<sub>s3/4</sub> a ε′<sub>s4/5</sub>: non snerva</>}.</p>
                    </div>
                </Block>

                {/* 3. congruenza e sottocampi */}
                <Block n="3" title="Congruenza e sottocampi">
                    <div className="tex-left space-y-1">
                        <Tex display>{String.raw`\dfrac{\varepsilon_{cu}}{x}=\dfrac{-\varepsilon'_s}{x-d''}=\dfrac{\varepsilon_s}{d-x}\;\Longleftrightarrow\;\dfrac{\varepsilon_{cu}}{\xi}=\dfrac{-\varepsilon'_s}{\xi-\delta''}=\dfrac{\varepsilon_s}{1-\xi}`}</Tex>
                        <Tex display>{String.raw`\varepsilon_s=\dfrac{\varepsilon_{cu}}{x}\,(d-x)\;\Rightarrow\;\sigma_s=E_s\,\dfrac{\varepsilon_{cu}}{x}\,(d-x)\qquad\varepsilon'_s=-\dfrac{\varepsilon_{cu}}{x}\,(x-d'')`}</Tex>
                        <F lhs="\varepsilon'_{s3/4}" sym={String.raw`-\dfrac{\varepsilon_{cu}}{\xi_N}\,(\xi_N-\delta'')`} num={String.raw`-\dfrac{${eCu}}{${T(f.xiN, 4)}}\,(${T(f.xiN, 4)}-${d2})`} val={pm(f.epsS34, 3)} br={false} />
                        <F lhs="\varepsilon'_{s4/5}" sym={String.raw`-\varepsilon_{cu}\,(1-\delta'')`} num={String.raw`-${eCu}\cdot(1-${d2})`} val={pm(f.epsS45, 3)} br={false} />
                        {f.split ? (
                            <>
                                <F lhs="\xi_{4a/4b}" sym={String.raw`\dfrac{\varepsilon_{cu}\,\delta''}{\varepsilon_{cu}+\varepsilon'_{se}}`} num={String.raw`\dfrac{${eCu}\cdot ${d2}}{${eCu}+(${eSe})}`} val={T(f.xi4ab, 4)} br={false} />
                                <Tex display>{String.raw`\begin{aligned}&\text{4a: }A'_s\text{ elastica, }\sigma'_s=E_s\,\varepsilon'_s&&${T(f.xiN, 4)}\le\xi\le ${T(f.xi4ab, 4)}\\&\text{4b: }A'_s\text{ plastica (compressa), }\sigma'_s=-f_{yd}&&${T(f.xi4ab, 4)}\le\xi\le 1\end{aligned}`}</Tex>
                            </>
                        ) : (
                            <p className="text-xs text-slate-500">{f.has4b
                                ? <>ε′<sub>s3/4</sub> ≤ ε′<sub>se</sub>: A′<sub>s</sub> è già snervata (caso tipico), nessun sottocampo; α′<sub>s</sub> = −1 in tutto il campo.</>
                                : <>A′<sub>s</sub> non snerva nemmeno nel campo 4: resta elastica.</>}</p>
                        )}
                        <Tex display>{String.raw`\psi=${T(f.psi, 5)}\qquad\lambda=${T(f.lam, 4)}\quad(\varepsilon_c=\varepsilon_{cu})`}</Tex>
                    </div>
                </Block>

                {/* 4. equazioni di campo */}
                <Block n="4" title="Equazioni di campo">
                    <div className="tex-left space-y-2">
                        <p className="text-xs font-semibold text-slate-500">Equilibrio (ora anche A<sub>s</sub> lavora in campo elastico):</p>
                        <Tex display>{String.raw`\begin{cases}b\,\psi\,x\,f_{cd}-A'_s\,\sigma'_s-A_s\,\sigma_s=N_{Rd}\\[4pt]b\,\psi\,x\,f_{cd}\left(\tfrac{h}{2}-\lambda x\right)-A'_s\,\sigma'_s\left(\tfrac{h}{2}-d''\right)+A_s\,\sigma_s\left(\tfrac{h}{2}-d'\right)=M_{Rd}\end{cases}\qquad\sigma_s=E_s\,\dfrac{\varepsilon_{cu}}{x}(d-x)`}</Tex>
                        <Tex display>{String.raw`\begin{cases}\psi\,\xi-\alpha'_s\,\omega'_s-\alpha_s\,\omega_s=\nu_{Rd}\\[4pt]\psi\,\xi\left(\dfrac{1+\delta'}{2}-\lambda\xi\right)-\alpha'_s\,\omega'_s\,\dfrac{1+\delta'-2\delta''}{2}+\alpha_s\,\omega_s\,\dfrac{1-\delta'}{2}=\mu_{Rd}\end{cases}`}</Tex>
                        <Tex display>{String.raw`\alpha_s=\dfrac{E_s\,\varepsilon_s}{f_{yd}}=\dfrac{E_s}{f_{yd}}\,\dfrac{\varepsilon_{cu}}{\xi}\,(1-\xi)\qquad\alpha'_s=\begin{cases}-\dfrac{E_s}{f_{yd}}\,\dfrac{\varepsilon_{cu}}{\xi}\,(\xi-\delta'')&\text{(4a: }A'_s\text{ elastica)}\\-1&\text{(}A'_s\text{ snervata)}\end{cases}`}</Tex>
                        <p className="text-xs text-slate-500">ω<sub>s</sub> = {fmtNum(p.omegaS, 4)}, ω′<sub>s</sub> = {fmtNum(p.omegaSP, 4)}, (1 − δ′)/2 = {fmtNum(p.armS, 4)}, (1 + δ′ − 2δ″)/2 = {fmtNum(p.armSP, 4)}, ψ = {fmtNum(f.psi, 5)}, λ = {fmtNum(f.lam, 4)}.</p>
                        <p className="rounded-lg bg-amber-50 px-2 py-1 text-[11px] leading-4 text-amber-800">Nota sui segni: negli appunti "tipicamente α′<sub>s</sub> = 1"; con la convenzione dei segni (compressione negativa) per A′<sub>s</sub> snervata è α′<sub>s</sub> = −1, come nei campi 2b e 3b.</p>
                    </div>
                </Block>

                {/* 5. stato corrente */}
                <Block n="5" title="Stato corrente (ξ dal cursore del blocco 1)">
                    <div className="space-y-3">
                        <div className="tex-left space-y-1">
                            <Tex display>{String.raw`\xi=${xiv}\qquad x=${T(xi * p.d, 1)}\ \text{mm}\qquad\text{sottocampo }${cur.sub}\qquad\varepsilon_c=\varepsilon_{cu},\ \psi=${T(f.psi, 5)},\ \lambda=${T(f.lam, 4)}`}</Tex>
                            <F lhs="\varepsilon_s" sym={String.raw`\dfrac{\varepsilon_{cu}}{\xi}\,(1-\xi)`} num={String.raw`\dfrac{${eCu}}{${xiv}}\,(1-${xiv})`} val={pm(cur.epsS, 3)} br={false} />
                            <F lhs="\alpha_s" sym={String.raw`\dfrac{E_s\,\varepsilon_s}{f_{yd}}`} num={String.raw`\dfrac{200\,000\cdot ${T(cur.epsS, 6)}}{${T(p.fyd, 2)}}`} val={`${T(cur.alphaS, 4)}\\qquad\\sigma_s=${T(cur.sigmaS, 1)}\\ \\text{MPa}`} br={false} />
                            <F lhs="\varepsilon'_s" sym={String.raw`-\dfrac{\varepsilon_{cu}}{\xi}\,(\xi-\delta'')`} num={String.raw`-\dfrac{${eCu}}{${xiv}}\,(${xiv}-${d2})`} val={pm(cur.epsSP, 3)} br={false} />
                            {cur.alphaSP <= -1 + 1e-12
                                ? <Tex display>{String.raw`\alpha'_s=-1\quad(\varepsilon'_s\le\varepsilon'_{se})\qquad\sigma'_s=-f_{yd}=${T(cur.sigmaSP, 1)}\ \text{MPa}`}</Tex>
                                : <F lhs="\alpha'_s" sym={String.raw`\dfrac{E_s\,\varepsilon'_s}{f_{yd}}`} num={String.raw`\dfrac{200\,000\cdot (${T(cur.epsSP, 6)})}{${T(p.fyd, 2)}}`} val={`${T(cur.alphaSP, 4)}\\qquad\\sigma'_s=${T(cur.sigmaSP, 1)}\\ \\text{MPa}`} br={false} />}
                            <F lhs="\nu_{Rd}" sym="\psi\,\xi-\alpha'_s\,\omega'_s-\alpha_s\,\omega_s" num={`${T(f.psi, 5)}\\cdot ${xiv}-(${T(cur.alphaSP, 4)})\\cdot ${T(p.omegaSP, 4)}-${T(cur.alphaS, 4)}\\cdot ${T(p.omegaS, 4)}`} val={T(cur.nu, 4)} br={false} />
                            <F lhs="\mu_{Rd}" sym={String.raw`${sgnM ? "-\\Big[" : ""}\psi\xi\left(\tfrac{1+\delta'}{2}-\lambda\xi\right)-\alpha'_s\omega'_s\tfrac{1+\delta'-2\delta''}{2}+\alpha_s\omega_s\tfrac{1-\delta'}{2}${sgnM ? "\\Big]" : ""}`}
                                num={`${sgnM ? "-\\big[" : ""}${T(f.psi, 5)}\\cdot ${xiv}\\,(\\tfrac{1+${d1}}{2}-${T(f.lam, 4)}\\cdot ${xiv})-(${T(cur.alphaSP, 4)})\\cdot ${T(p.omegaSP, 4)}\\cdot ${T(p.armSP, 4)}+${T(cur.alphaS, 4)}\\cdot ${T(p.omegaS, 4)}\\cdot ${T(p.armS, 4)}${sgnM ? "\\big]" : ""}`} val={T(cur.mu, 4)} br={false} />
                            <F lhs="N_{Rd}" sym="\nu_{Rd}\,b\,d\,f_{cd}" num={`${T(cur.nu, 4)}\\cdot ${T(p.b, 0)}\\cdot ${T(p.d, 1)}\\cdot ${T(p.fcd, 2)}`} val={`${T(cur.N, 1)}\\ \\text{kN}`} br={false} />
                            <F lhs="M_{Rd}" sym="\mu_{Rd}\,b\,d^2\,f_{cd}" num={`${T(cur.mu, 4)}\\cdot ${T(p.b, 0)}\\cdot ${T(p.d, 1)}^2\\cdot ${T(p.fcd, 2)}`} val={`${T(cur.M, 2)}\\ \\text{kNm}`} br={false} />
                        </div>
                        <p className="text-xs text-slate-400">Il diagramma delle forze interne di questo stato è disegnato sulla sezione, nel blocco 1.</p>
                        <div className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs ${ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                            {ok ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
                            Calcolo numerico (piano di deformazione per B + legami, cls integrato a strisce): N = {fmtNum(ref.N, 1)} kN, M = {fmtNum(ref.M, 2)} kNm
                            — scarto ΔN = {errN.toExponential(1)}, ΔM = {errM.toExponential(1)}
                        </div>
                    </div>
                </Block>

                {/* 6. punti caratteristici e osservazioni */}
                <Block n="6" title="Punti caratteristici e osservazioni">
                    <PointsTable cols={[{ key: "es", h: <>ε<sub>s</sub> [‰]</>, v: (pt) => fmtNum(pt.epsS * 1000, 3) }, { key: "as", h: <>α<sub>s</sub></>, v: (pt) => fmtNum(pt.alphaS, 4) }, COL_EPSSP, COL_ALPHA]} rows={[
                        { label: "Retta limite 3/4 (ξ = ξN)", pt: f.point(f.xiN) },
                        ...(f.split ? [{ label: "Confine 4a/4b (ξ = ξ4a/4b)", pt: f.point(f.xi4ab) }] : []),
                        { label: "Retta limite 4/5 (ξ = 1, x = d)", pt: f.point(1) },
                    ]} />
                    <div className="mt-3 space-y-1 text-xs leading-5 text-slate-600">
                        <p>• Il punto ξ = ξ<sub>N</sub> coincide con l'ultimo punto del campo 3.</p>
                        <p>• Trascurando l'armatura superiore: all'aumentare di x il termine del calcestruzzo cresce e quello di A<sub>s</sub> diminuisce, quindi N<sub>Rd</sub> aumenta.</p>
                        <p>• Il braccio del calcestruzzo diminuisce (λx cresce) e il termine di A<sub>s</sub> è sempre meno caricato: <b>M<sub>Rd</sub> decresce</b>: il momento massimo del ramo si ha in genere sulla retta 3/4.</p>
                        <p>• Tipicamente A′<sub>s</sub> è già snervata nei campi precedenti; se non lo è (copriferro molto spesso) il campo si divide in 4a e 4b.</p>
                    </div>
                </Block>
                    </>);
                }} />
            </div>
        </NumCtx.Provider>
    );
}

// ---------------------------------------------------------------------------
// CAMPO 5 (pivot B, d ≤ x ≤ h: anche A_s è compressa)
// ---------------------------------------------------------------------------
const SUB5A_COL = "#7c2d12"; // sottocampo 5a
const SUB5B_COL = "#fdba74"; // sottocampo 5b (o campo intero)
const LIM56_COL = "#9a3412"; // retta limite 5/6 (x = h)
const TRI5_TEX = {
    cur: String.raw`\color{#db2777}\dfrac{\varepsilon_{cu}}{x}\color{black}=\color{#d97706}\dfrac{-\varepsilon_s}{x-d}\color{black}=\color{#0284c7}\dfrac{-\varepsilon'_s}{x-d''}`,
    E: String.raw`\color{#db2777}\dfrac{\varepsilon_{cu}}{h}\color{black}=\color{#d97706}\dfrac{-\varepsilon_{s,5/6}}{h-d}\color{black}\;\Rightarrow\;\varepsilon_{s,5/6}=-\varepsilon_{cu}\,\dfrac{d'}{h}`,
    ab: String.raw`\color{#db2777}\dfrac{\varepsilon_{cu}}{x_{5a/5b}}\color{black}=\color{#0284c7}\dfrac{\varepsilon_{cu}+\varepsilon'_{se}}{d''}`,
};
const TRI5_NOTE = {
    cur: "Vertice comune nel punto dell'asse neutro, ora sotto A_s (d ≤ x ≤ h): tre triangoli simili per il lembo compresso, A_s e A′_s, tutti compressi.",
    E: "Retta limite 5/6: asse neutro sul lembo inferiore (x = h), deformazione di A_s sulla retta.",
    ab: "Retta di confine 5a/5b (A′_s a ε′_se in compressione): triangolo dal lembo compresso all'asse neutro e triangolo da B alla quota di A′_s.",
};

function spec5(p, f) {
    const bands = f.split
        ? [{ xi0: 1, xi1: f.xi5ab, color: SUB5A_COL, op: 0.14, label: "5a", toH: true }, { xi0: f.xi5ab, xi1: f.xiE, color: SUB5B_COL, op: 0.45, label: "5b", labelCol: "#c2410c", toH: true }]
        : [{ xi0: 1, xi1: f.xiE, color: SUB5B_COL, op: 0.45, label: "5", labelCol: "#c2410c", toH: true }];
    return {
        id: "5",
        range: [1, f.xiE],
        strainAt: (xv, depth) => (p.epsCu * (depth - xv * p.d)) / (xv * p.d),
        lines: [{ xi: 1, color: LIM45_COL, toH: true }, { xi: f.xiE, color: LIM56_COL, toH: true }],
        boundaries: f.split ? [{ xi: f.xi5ab, toH: true }] : [],
        bands,
        concRange: [p.epsCu, p.epsCu],
        aspRanges: f.split
            ? [{ key: "5a", e0: -p.epsSe, e1: f.epsS45, color: SUB5A_COL }, { key: "5b", e0: f.epsS56, e1: -p.epsSe, color: "#f97316" }]
            : [{ key: "5", e0: f.epsS56, e1: f.epsS45, color: f.has5b ? "#f97316" : SUB5A_COL }],
        asRanges: [{ key: "as", e0: f.epsAs56, e1: 0, color: FIELD_COL[5] }],
        asFull: true,
        pivot: { e: -p.epsCu, depth: 0, label: "B", color: CONC_COL, dx: 6, dy: -4, anchor: "start" },
        drag: {
            eMin: f.epsS56, eMax: f.epsS45,
            toSlider: (e) => (1000 * ((p.epsCu * p.delta2) / (p.epsCu + e) - 1)) / (f.xiE - 1),
        },
        triangles: (tri, c, H, V) => {
            const { ax, ex, yD, yA, yAp, xi } = c;
            const xB = ex(-p.epsCu), y0 = yD(0);
            if (tri === "ab") {
                const yn = yD(f.x5ab), N = [ax, yn];
                V(ax - 4, y0, yn, "x_5a/5b", TRI3_COL, "end"); H(ax, xB, y0 - 4, "ε_cu", TRI3_COL);
                V(xB + 4, y0, yAp, "d″", TRI2_COL); H(xB, ex(-p.epsSe), yAp + 10, "ε_cu + ε′_se", TRI2_COL);
                return [
                    { T: [N, [ax, y0], [xB, y0]], c: TRI3_COL },
                    { T: [[xB, y0], [xB, yAp], [ex(-p.epsSe), yAp]], c: TRI2_COL },
                ];
            }
            const xv = tri === "E" ? f.xiE : xi, yn = yD(xv * p.d), N = [ax, yn];
            const es = f.epsS(xv), esp = f.epsSP(xv);
            V(ax - 4, y0, yn, tri === "E" ? "h" : "x", TRI3_COL, "end"); H(ax, xB, y0 - 4, "ε_cu", TRI3_COL);
            V(ax + 4, yA, yn, tri === "E" ? "h − d" : "x − d", TRI1_COL); H(ax, ex(es), yA - 4, tri === "E" ? "ε_s,5/6" : "ε_s", TRI1_COL);
            if (tri === "cur") H(ax, ex(esp), yAp + 10, "ε′_s", TRI2_COL);
            return [
                { T: [N, [ax, y0], [xB, y0]], c: TRI3_COL },
                { T: [N, [ax, yA], [ex(es), yA]], c: TRI1_COL },
                ...(tri === "cur" ? [{ T: [N, [ax, yAp], [ex(esp), yAp]], c: TRI2_COL }] : []),
            ];
        },
    };
}

function FieldFive({ data, st, set }) {
    const p = st.branch > 0 ? data.pos : data.neg;
    const f = st.branch > 0 ? data.f5pos : data.f5neg;
    const xi = sliderToXi(st.slider, 1, f.xiE);
    const xiB = useDeferredValue(xi); // blocchi 2–6: aggiornati subito dopo, senza bloccare il cursore
    const cur = f.point(xi);
    const d1 = T(p.delta1, 4), d2 = T(p.delta2, 4), eCu = T(p.epsCu, 4), eSe = T(-p.epsSe, 5);
    const sgnM = st.branch < 0 ? "-" : "";
    const tri = !f.split && st.tri === "ab" ? "cur" : (st.tri === "E" || st.tri === "ab" ? st.tri : "cur");

    return (
        <NumCtx.Provider value={st.num}>
            <div className="space-y-5">
                <FieldToolbar st={st} set={set} note={st.branch > 0
                    ? "Lembo compresso in alto a ε_cu (pivot B); asse neutro fra A_s e il lembo inferiore: A_s e A′_s compresse."
                    : "Sezione ribaltata: lembo compresso in basso; A_s ↔ A′_s, d′ ↔ d″, M cambia segno."} />

                {/* 1. intervallo e stati deformativi */}
                <Block n="1" title="Intervallo e stati deformativi">
                    <div className="space-y-4">
                        <div className="tex-left space-y-1 text-sm text-slate-600">
                            <Tex display>{String.raw`d \le x \le h \quad\Longleftrightarrow\quad 1 \le \xi \le 1+\delta'=${T(f.xiE, 4)}\qquad\left(\dfrac{h}{d}=\dfrac{d+d'}{d}=1+\delta'\right)`}</Tex>
                            <p className="text-xs">Campo molto piccolo: l'asse neutro sta fra l'armatura tesa e il lembo inferiore. Pivot B (lembo compresso a ε<sub>cu</sub>); il campo va dalla retta 4/5 (grigio, x = d) alla retta 5/6 (bruno, x = h). La sezione è presso-inflessa: nessuna parte fornisce trazione.</p>
                            <p className="text-xs">A<sub>s</sub> è compressa e tipicamente elastica (σ<sub>s</sub> = E<sub>s</sub>ε<sub>s</sub>): per snervarla nel campo 5 servirebbe un copriferro inferiore molto spesso. A′<sub>s</sub>: {f.split ? "elastica (5a) e poi plastica (5b)" : f.has5b ? "già snervata" : "ancora elastica"}.</p>
                        </div>
                        <div className="flex w-full flex-col items-center gap-3">
                            <div className="flex w-full flex-wrap items-start justify-center gap-3">
                                <div className="flex justify-center">
                                    <Segmented small value={st.hl ?? "fields"} onChange={(v) => set({ hl: v })} options={[{ value: "fields", label: "Sottocampi" }, { value: "profile", label: "Profilo" }, { value: "triangles", label: "Triangoli simili" }]} />
                                </div>
                                <MiniXiSlider value={st.slider} onChange={(v) => set({ slider: v })} left="1" right={<>1 + δ′</>} sub={cur.sub} items={[
                                    { label: "ξ", value: xiTxt(xi) },
                                    { label: "x", value: `${fmtNum(xi * p.d, 1)} mm` },
                                    { label: "ε′_s", value: `${fmtNum(cur.epsSP * 1000, 2)}‰` },
                                    { label: "ε_s", value: `${fmtNum(cur.epsS * 1000, 3)}‰` },
                                ]} />
                                {st.hl === "triangles" && (
                                    <div className="w-full max-w-[340px] space-y-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2">
                                        <div className="flex justify-center">
                                            <Segmented small value={tri} onChange={(v) => set({ tri: v })} options={[
                                                { value: "cur", label: hs("ε_s, ε′_s(ξ)") },
                                                { value: "E", label: hs("ε_s,5/6") },
                                                ...(f.split ? [{ value: "ab", label: hs("ξ_5a/5b") }] : []),
                                            ]} />
                                        </div>
                                        <div className="tex-left text-sm"><Tex display>{TRI5_TEX[tri]}</Tex></div>
                                        <p className="text-[11px] leading-4 text-slate-500">{hs(TRI5_NOTE[tri])}</p>
                                    </div>
                                )}
                            </div>
                            <div className="w-full">
                                <StrainDiagramPivot p={p} xi={xi} branch={st.branch} mode={st.hl ?? "fields"} tri={tri}
                                    onSlider={(v) => set({ slider: v })} spec={spec5(p, f)} />
                            </div>
                        </div>
                    </div>
                </Block>

                <Lazy deps={[p, f, xiB, st.num, st.branch, data]} render={() => {
                    const xi = xiB; const cur = f.point(xi); const ref = numericPivotB(p, xi); const errN = Math.abs(cur.N - ref.N), errM = Math.abs(cur.M - ref.M); const ok = errN < 1e-3 && errM < 1e-3;
                    const xiv = T(xi, 4);
                    return (<>
                {/* 2. legami costitutivi */}
                <Block n="2" title="Legami costitutivi">
                    <div className="space-y-1 text-xs leading-5 text-slate-600">
                        <p><b>Calcestruzzo</b>: lembo compresso sempre a ε<sub>cu</sub> = {fmtNum(p.epsCu * 1000, 1)}‰: diagramma completo, ψ e λ costanti.</p>
                        <p><b>Acciaio</b>: A<sub>s</sub> passa da 0 (retta 4/5) a ε<sub>s,5/6</sub> = {fmtNum(f.epsAs56 * 1000, 3)}‰ in compressione, sul tratto elastico (nel legame di A<sub>s</sub> ora compare anche il ramo di compressione).</p>
                        <p>• A′<sub>s</sub> compressa: {f.split
                            ? <>tratto elastico fino a ε′<sub>se</sub> (5a), poi plastico (5b)</>
                            : f.has5b ? <>già snervata: tratto plastico da ε′<sub>s4/5</sub> a ε′<sub>s5/6</sub></>
                                : <>tratto elastico da ε′<sub>s4/5</sub> a ε′<sub>s5/6</sub></>}.</p>
                    </div>
                </Block>

                {/* 3. congruenza e sottocampi */}
                <Block n="3" title="Congruenza e sottocampi">
                    <div className="tex-left space-y-1">
                        <Tex display>{String.raw`\dfrac{\varepsilon_{cu}}{x}=\dfrac{-\varepsilon_s}{x-d}=\dfrac{-\varepsilon'_s}{x-d''}\;\Longleftrightarrow\;\dfrac{\varepsilon_{cu}}{\xi}=\dfrac{-\varepsilon_s}{\xi-1}=\dfrac{-\varepsilon'_s}{\xi-\delta''}`}</Tex>
                        <Tex display>{String.raw`\varepsilon_s=-\dfrac{\varepsilon_{cu}}{x}\,(x-d)\;\Longleftrightarrow\;\varepsilon_s=-\dfrac{\varepsilon_{cu}}{\xi}\,(\xi-1)\qquad\varepsilon'_s=-\dfrac{\varepsilon_{cu}}{\xi}\,(\xi-\delta'')`}</Tex>
                        <F lhs="\varepsilon_{s,5/6}" sym={String.raw`-\varepsilon_{cu}\,\dfrac{d'}{h}`} num={String.raw`-${eCu}\cdot\dfrac{${T(p.dInf, 1)}}{${T(p.h, 1)}}`} val={pm(f.epsAs56, 3)} br={false} />
                        <F lhs="\varepsilon'_{s4/5}" sym={String.raw`-\varepsilon_{cu}\,(1-\delta'')`} num={String.raw`-${eCu}\cdot(1-${d2})`} val={pm(f.epsS45, 3)} br={false} />
                        <F lhs="\varepsilon'_{s5/6}" sym={String.raw`-\dfrac{\varepsilon_{cu}}{1+\delta'}\,(1+\delta'-\delta'')`} num={String.raw`-\dfrac{${eCu}}{${T(f.xiE, 4)}}\,(${T(f.xiE, 4)}-${d2})`} val={pm(f.epsS56, 3)} br={false} />
                        {f.split ? (
                            <>
                                <F lhs="\xi_{5a/5b}" sym={String.raw`\dfrac{\varepsilon_{cu}\,\delta''}{\varepsilon_{cu}+\varepsilon'_{se}}`} num={String.raw`\dfrac{${eCu}\cdot ${d2}}{${eCu}+(${eSe})}`} val={T(f.xi5ab, 4)} br={false} />
                                <Tex display>{String.raw`\begin{aligned}&\text{5a: }A'_s\text{ elastica}&&1\le\xi\le ${T(f.xi5ab, 4)}\\&\text{5b: }A'_s\text{ plastica (compressa)}&&${T(f.xi5ab, 4)}\le\xi\le ${T(f.xiE, 4)}\end{aligned}`}</Tex>
                            </>
                        ) : (
                            <p className="text-xs text-slate-500">{f.has5b ? <>A′<sub>s</sub> è già snervata (caso tipico): α′<sub>s</sub> = −1 in tutto il campo.</> : <>A′<sub>s</sub> resta elastica in tutto il campo.</>}</p>
                        )}
                        <Tex display>{String.raw`\psi=${T(f.psi, 5)}\qquad\lambda=${T(f.lam, 4)}\quad(\varepsilon_c=\varepsilon_{cu},\ x\le h)`}</Tex>
                    </div>
                </Block>

                {/* 4. equazioni di campo */}
                <Block n="4" title="Equazioni di campo">
                    <div className="tex-left space-y-2">
                        <p className="text-xs font-semibold text-slate-500">Equilibrio (C<sub>c</sub> + C<sub>s</sub> + C*<sub>s</sub> = N<sub>Rd</sub>: anche A<sub>s</sub> è compressa, σ<sub>s</sub> &lt; 0):</p>
                        <Tex display>{String.raw`\begin{cases}b\,\psi\,x\,f_{cd}-\sigma'_s\,A'_s-\sigma_s\,A_s=N_{Rd}\\[4pt]b\,\psi\,x\,f_{cd}\left(\tfrac{h}{2}-\lambda x\right)-\sigma'_s\,A'_s\left(\tfrac{h}{2}-d''\right)+\sigma_s\,A_s\left(\tfrac{h}{2}-d'\right)=M_{Rd}\end{cases}\qquad\sigma_s=-E_s\,\dfrac{\varepsilon_{cu}}{x}(x-d)`}</Tex>
                        <Tex display>{String.raw`\begin{cases}\psi\,\xi-\alpha'_s\,\omega'_s-\alpha_s\,\omega_s=\nu_{Rd}\\[4pt]\psi\,\xi\left(\dfrac{1+\delta'}{2}-\lambda\xi\right)-\alpha'_s\,\omega'_s\,\dfrac{1+\delta'-2\delta''}{2}+\alpha_s\,\omega_s\,\dfrac{1-\delta'}{2}=\mu_{Rd}\end{cases}`}</Tex>
                        <Tex display>{String.raw`\alpha_s=\dfrac{E_s\,\varepsilon_s}{f_{yd}}=-\dfrac{E_s}{f_{yd}}\,\dfrac{\varepsilon_{cu}}{\xi}\,(\xi-1)\qquad\alpha'_s=\begin{cases}-\dfrac{E_s}{f_{yd}}\,\dfrac{\varepsilon_{cu}}{\xi}\,(\xi-\delta'')&\text{(}A'_s\text{ elastica)}\\-1&\text{(}A'_s\text{ snervata)}\end{cases}`}</Tex>
                        <p className="text-xs text-slate-500">ω<sub>s</sub> = {fmtNum(p.omegaS, 4)}, ω′<sub>s</sub> = {fmtNum(p.omegaSP, 4)}, (1 − δ′)/2 = {fmtNum(p.armS, 4)}, (1 + δ′ − 2δ″)/2 = {fmtNum(p.armSP, 4)}, ψ = {fmtNum(f.psi, 5)}, λ = {fmtNum(f.lam, 4)}.</p>
                        <p className="rounded-lg bg-amber-50 px-2 py-1 text-[11px] leading-4 text-amber-800">Nota sui segni: negli appunti "α′<sub>s</sub> = 1 (tipicamente)"; con la convenzione dei segni (compressione negativa) per A′<sub>s</sub> snervata è α′<sub>s</sub> = −1. α<sub>s</sub> è negativo (A<sub>s</sub> compressa), come negli appunti.</p>
                    </div>
                </Block>

                {/* 5. stato corrente */}
                <Block n="5" title="Stato corrente (ξ dal cursore del blocco 1)">
                    <div className="space-y-3">
                        <div className="tex-left space-y-1">
                            <Tex display>{String.raw`\xi=${xiv}\qquad x=${T(xi * p.d, 1)}\ \text{mm}\qquad\text{sottocampo }${cur.sub}\qquad\varepsilon_c=\varepsilon_{cu},\ \psi=${T(f.psi, 5)},\ \lambda=${T(f.lam, 4)}`}</Tex>
                            <F lhs="\varepsilon_s" sym={String.raw`-\dfrac{\varepsilon_{cu}}{\xi}\,(\xi-1)`} num={String.raw`-\dfrac{${eCu}}{${xiv}}\,(${xiv}-1)`} val={pm(cur.epsS, 4)} br={false} />
                            <F lhs="\alpha_s" sym={String.raw`\dfrac{E_s\,\varepsilon_s}{f_{yd}}`} num={String.raw`\dfrac{200\,000\cdot (${T(cur.epsS, 7)})}{${T(p.fyd, 2)}}`} val={`${T(cur.alphaS, 4)}\\qquad\\sigma_s=${T(cur.sigmaS, 1)}\\ \\text{MPa}`} br={false} />
                            <F lhs="\varepsilon'_s" sym={String.raw`-\dfrac{\varepsilon_{cu}}{\xi}\,(\xi-\delta'')`} num={String.raw`-\dfrac{${eCu}}{${xiv}}\,(${xiv}-${d2})`} val={pm(cur.epsSP, 3)} br={false} />
                            {cur.alphaSP <= -1 + 1e-12
                                ? <Tex display>{String.raw`\alpha'_s=-1\quad(\varepsilon'_s\le\varepsilon'_{se})\qquad\sigma'_s=-f_{yd}=${T(cur.sigmaSP, 1)}\ \text{MPa}`}</Tex>
                                : <F lhs="\alpha'_s" sym={String.raw`\dfrac{E_s\,\varepsilon'_s}{f_{yd}}`} num={String.raw`\dfrac{200\,000\cdot (${T(cur.epsSP, 6)})}{${T(p.fyd, 2)}}`} val={`${T(cur.alphaSP, 4)}\\qquad\\sigma'_s=${T(cur.sigmaSP, 1)}\\ \\text{MPa}`} br={false} />}
                            <F lhs="\nu_{Rd}" sym="\psi\,\xi-\alpha'_s\,\omega'_s-\alpha_s\,\omega_s" num={`${T(f.psi, 5)}\\cdot ${xiv}-(${T(cur.alphaSP, 4)})\\cdot ${T(p.omegaSP, 4)}-(${T(cur.alphaS, 4)})\\cdot ${T(p.omegaS, 4)}`} val={T(cur.nu, 4)} br={false} />
                            <F lhs="\mu_{Rd}" sym={String.raw`${sgnM ? "-\\Big[" : ""}\psi\xi\left(\tfrac{1+\delta'}{2}-\lambda\xi\right)-\alpha'_s\omega'_s\tfrac{1+\delta'-2\delta''}{2}+\alpha_s\omega_s\tfrac{1-\delta'}{2}${sgnM ? "\\Big]" : ""}`}
                                num={`${sgnM ? "-\\big[" : ""}${T(f.psi, 5)}\\cdot ${xiv}\\,(\\tfrac{1+${d1}}{2}-${T(f.lam, 4)}\\cdot ${xiv})-(${T(cur.alphaSP, 4)})\\cdot ${T(p.omegaSP, 4)}\\cdot ${T(p.armSP, 4)}+(${T(cur.alphaS, 4)})\\cdot ${T(p.omegaS, 4)}\\cdot ${T(p.armS, 4)}${sgnM ? "\\big]" : ""}`} val={T(cur.mu, 4)} br={false} />
                            <F lhs="N_{Rd}" sym="\nu_{Rd}\,b\,d\,f_{cd}" num={`${T(cur.nu, 4)}\\cdot ${T(p.b, 0)}\\cdot ${T(p.d, 1)}\\cdot ${T(p.fcd, 2)}`} val={`${T(cur.N, 1)}\\ \\text{kN}`} br={false} />
                            <F lhs="M_{Rd}" sym="\mu_{Rd}\,b\,d^2\,f_{cd}" num={`${T(cur.mu, 4)}\\cdot ${T(p.b, 0)}\\cdot ${T(p.d, 1)}^2\\cdot ${T(p.fcd, 2)}`} val={`${T(cur.M, 2)}\\ \\text{kNm}`} br={false} />
                        </div>
                        <p className="text-xs text-slate-400">Il diagramma delle forze interne di questo stato è disegnato sulla sezione, nel blocco 1.</p>
                        <div className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs ${ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                            {ok ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
                            Calcolo numerico (piano di deformazione per B + legami, cls integrato a strisce): N = {fmtNum(ref.N, 1)} kN, M = {fmtNum(ref.M, 2)} kNm
                            — scarto ΔN = {errN.toExponential(1)}, ΔM = {errM.toExponential(1)}
                        </div>
                    </div>
                </Block>

                {/* 6. punti caratteristici e osservazioni */}
                <Block n="6" title="Punti caratteristici e osservazioni">
                    <PointsTable cols={[{ key: "es", h: <>ε<sub>s</sub> [‰]</>, v: (pt) => fmtNum(pt.epsS * 1000, 3) }, { key: "as", h: <>α<sub>s</sub></>, v: (pt) => fmtNum(pt.alphaS, 4) }, COL_EPSSP, COL_ALPHA]} rows={[
                        { label: "Retta limite 4/5 (ξ = 1, x = d)", pt: f.point(1) },
                        ...(f.split ? [{ label: "Confine 5a/5b (ξ = ξ5a/5b)", pt: f.point(f.xi5ab) }] : []),
                        { label: "Retta limite 5/6 (ξ = 1 + δ′, x = h)", pt: f.point(f.xiE) },
                    ]} />
                    <div className="mt-3 space-y-1 text-xs leading-5 text-slate-600">
                        <p>• Il punto ξ = 1 coincide con l'ultimo punto del campo 4.</p>
                        <p>• Tutti i contributi crescono verso la compressione: N<sub>Rd</sub> aumenta.</p>
                        <p>• M<sub>Rd</sub> continua a calare: il termine di A<sub>s</sub> è sempre più negativo, il contributo del calcestruzzo diminuisce con il braccio, quello di A′<sub>s</sub> è poco influente (al limite costante).</p>
                    </div>
                </Block>
                    </>);
                }} />
            </div>
        </NumCtx.Provider>
    );
}

// ---------------------------------------------------------------------------
// CAMPO 6 (pivot C: rette per F a ε_c2, sezione interamente compressa)
// ---------------------------------------------------------------------------
const SUB6A_COL = "#7f1d1d"; // sottocampo 6a: rosso scuro
const SUB6B_COL = "#fca5a5"; // sottocampo 6b: rosa
const LIMINF_COL = "#991b1b"; // retta limite inferiore (ξ → ∞, deformazione uniforme ε_c2)
const TRI6_TEX = {
    cur: String.raw`\color{#db2777}\dfrac{\varepsilon_{cs}-\varepsilon_{c2}}{t}\color{black}=\color{#0284c7}\dfrac{-(\varepsilon_{c2}+\varepsilon'_s)}{t-d''}\color{black}=\color{#d97706}\dfrac{\varepsilon_{c2}+\varepsilon_s}{d-t}\color{black}=\dfrac{\varepsilon_{c2}}{x-t}`,
    t: String.raw`\color{#d97706}\dfrac{\varepsilon_{cu}}{h}\color{black}=\color{#db2777}\dfrac{\varepsilon_{cu}-\varepsilon_{c2}}{t}\color{black}\;\Rightarrow\;t=\dfrac{\varepsilon_{cu}-\varepsilon_{c2}}{\varepsilon_{cu}}\,h`,
    ab: String.raw`\dfrac{\varepsilon_{c2}}{x_{6a/6b}-t}=\color{#d97706}\dfrac{\varepsilon_{c2}-\varepsilon_{se}}{d-t}\color{black}\;\Rightarrow\;x_{6a/6b}=t+\dfrac{\varepsilon_{c2}\,(d-t)}{\varepsilon_{c2}-\varepsilon_{se}}`,
};
const TRI6_NOTE = {
    cur: "Vertice comune nel punto F (profondità t, deformazione ε_c2): ogni retta del campo 6 passa per F; l'asse neutro (x ≥ h) è fuori dalla sezione.",
    t: "Retta limite 5/6 (x = h): ε_cu sul lembo superiore, 0 su quello inferiore; F è il punto della retta a ε_c2.",
    ab: "Retta di confine 6a/6b: A_s a −ε_se (snervamento in compressione), triangolo con vertice in F fino alla quota di A_s.",
};

function spec6(p, f) {
    const xiToSlider = (xv) => (xv === Infinity ? 1000 : (1000 * (xv - f.xi0)) / (1 + xv - f.xi0));
    return {
        id: "6",
        range: [f.xi0, Infinity],
        xiToSlider,
        strainAt: (xv, depth) => (xv === Infinity ? -f.epsC2 : (-f.epsC2 * (xv * p.d - depth)) / (xv * p.d - f.t)),
        lines: [{ xi: f.xi0, color: LIM56_COL, toH: true }, { xi: Infinity, color: LIMINF_COL, toH: true }],
        boundaries: f.has6b ? [{ xi: f.xi6ab, toH: true }] : [],
        bands: f.has6b
            ? [{ xi0: f.xi0, xi1: f.xi6ab, color: SUB6A_COL, op: 0.14, label: "6a", toH: true }, { xi0: f.xi6ab, xi1: Infinity, color: SUB6B_COL, op: 0.45, label: "6b", labelCol: "#b91c1c", toH: true }]
            : [{ xi0: f.xi0, xi1: Infinity, color: SUB6A_COL, op: 0.14, label: "6a", toH: true }],
        concRange: [f.epsC2, p.epsCu],
        concBottom: true,
        concForce: (xv) => {
            const { psi, lam } = f.coef(xv);
            return { Cc: psi * p.b * p.h * p.fcd, depth: lam * p.h };
        },
        aspRanges: [{ key: "6", e0: f.epsS56, e1: -f.epsC2, color: "#ef4444" }],
        asRanges: f.has6b
            ? [{ key: "6a", e0: -p.epsSe, e1: f.epsAs56, color: SUB6A_COL }, { key: "6b", e0: -f.epsC2, e1: -p.epsSe, color: "#ef4444" }]
            : [{ key: "6a", e0: -f.epsC2, e1: f.epsAs56, color: SUB6A_COL }],
        asFull: true,
        pivot: { e: -f.epsC2, depth: f.t, label: "F", color: LIMINF_COL, dx: 6, dy: 4, anchor: "start" },
        drag: {
            eMin: f.epsS56, eMax: -f.epsC2 - 1e-7,
            // ε'_s = −ε_c2 (ξ − δ'')/(ξ − t/d) → ξ = (ε'_s t/d + ε_c2 δ'')/(ε'_s + ε_c2)
            toSlider: (e) => xiToSlider((e * f.tD + f.epsC2 * p.delta2) / (e + f.epsC2)),
        },
        triangles: (tri, c, H, V) => {
            const { ax, ex, yD, yA, yAp, xi } = c;
            const xF = ex(-f.epsC2), yF = yD(f.t), y0 = yD(0), yH = yD(p.h);
            if (tri === "t") {
                const xB = ex(-p.epsCu);
                V(ax + 4, y0, yH, "h", TRI1_COL); H(ax, xB, y0 - 4, "ε_cu", TRI1_COL);
                V(xF - 4, y0, yF, "t", TRI3_COL, "end"); H(xF, xB, y0 + 10, "ε_cu − ε_c2", TRI3_COL);
                return [
                    { T: [[ax, yH], [ax, y0], [xB, y0]], c: TRI1_COL },
                    { T: [[xF, yF], [xF, y0], [xB, y0]], c: TRI3_COL },
                ];
            }
            if (tri === "ab") {
                V(xF - 4, yF, yA, "d − t", TRI1_COL, "end"); H(xF, ex(-p.epsSe), yA + 11, "ε_c2 − ε_se", TRI1_COL);
                return [{ T: [[xF, yF], [xF, yA], [ex(-p.epsSe), yA]], c: TRI1_COL }];
            }
            const ecs = f.epsCs(xi), es = f.epsS(xi), esp = f.epsSP(xi);
            V(xF + 4, y0, yF, "t", TRI3_COL); H(xF, ex(-ecs), y0 - 4, "ε_cs − ε_c2", TRI3_COL);
            V(xF + 4, yAp, yF, "t − d″", TRI2_COL); H(xF, ex(esp), yAp + 10, "|ε′_s| − ε_c2", TRI2_COL);
            V(xF - 4, yF, yA, "d − t", TRI1_COL, "end"); H(xF, ex(es), yA + 11, "ε_c2 + ε_s", TRI1_COL);
            return [
                { T: [[xF, yF], [xF, y0], [ex(-ecs), y0]], c: TRI3_COL },
                { T: [[xF, yF], [xF, yAp], [ex(esp), yAp]], c: TRI2_COL },
                { T: [[xF, yF], [xF, yA], [ex(es), yA]], c: TRI1_COL },
            ];
        },
    };
}

function FieldSix({ data, st, set }) {
    const p = st.branch > 0 ? data.pos : data.neg;
    const f = st.branch > 0 ? data.f6pos : data.f6neg;
    const xi = sliderToXi(st.slider, f.xi0, Infinity);
    const xiB = useDeferredValue(xi); // blocchi 2–6: aggiornati subito dopo, senza bloccare il cursore
    const cur = f.point(xi);
    const d1 = T(p.delta1, 4), eCu = T(p.epsCu, 4), eSe = T(p.epsSe, 5), tD = T(f.tD, 4);
    const sgnM = st.branch < 0 ? "-" : "";
    const tri = !f.has6b && st.tri === "ab" ? "cur" : (st.tri === "t" || st.tri === "ab" ? st.tri : "cur");
    const inf = xi === Infinity;

    return (
        <NumCtx.Provider value={st.num}>
            <div className="space-y-5">
                <FieldToolbar st={st} set={set} note={st.branch > 0
                    ? "Sezione interamente compressa, rette per il punto F (pivot C); A′_s superiore, A_s inferiore, entrambe compresse."
                    : "Sezione ribaltata: A_s ↔ A′_s, d′ ↔ d″, M cambia segno."} />

                {/* 1. intervallo e stati deformativi */}
                <Block n="1" title="Intervallo e stati deformativi">
                    <div className="space-y-4">
                        <div className="tex-left space-y-1 text-sm text-slate-600">
                            <Tex display>{String.raw`h \le x < +\infty \quad\Longleftrightarrow\quad 1+\delta'=${T(f.xi0, 4)} \le \xi < +\infty`}</Tex>
                            <p className="text-xs">Campo convenzionale, nato dalla prescrizione normativa. Tutte le rette passano per il punto F (pivot C), a profondità t = (ε<sub>cu</sub> − ε<sub>c2</sub>)/ε<sub>cu</sub>·h = {fmtNum(f.t, 1)} mm (3/7 h) con deformazione ε<sub>c2</sub>: dalla retta 5/6 (x = h) alla retta limite inferiore (ξ → ∞, deformazione uniforme ε<sub>c2</sub>, compressione pura).</p>
                            <p className="text-xs">ε<sub>se</sub> = {fmtNum(p.epsSe * 1000, 3)}‰ &lt; ε<sub>c2</sub> = 2‰: A′<sub>s</sub> è sicuramente già snervata. A<sub>s</sub> compressa snerva dentro il campo: sottocampi 6a (elastica) e 6b (plastica).</p>
                        </div>
                        <div className="flex w-full flex-col items-center gap-3">
                            <div className="flex w-full flex-wrap items-start justify-center gap-3">
                                <div className="flex justify-center">
                                    <Segmented small value={st.hl ?? "fields"} onChange={(v) => set({ hl: v })} options={[{ value: "fields", label: "Sottocampi" }, { value: "profile", label: "Profilo" }, { value: "triangles", label: "Triangoli simili" }]} />
                                </div>
                                <MiniXiSlider value={st.slider} onChange={(v) => set({ slider: v })} left={<>1 + δ′</>} right="+∞" sub={cur.sub} items={[
                                    { label: "ξ", value: xiTxt(xi) },
                                    { label: "x", value: inf ? "+∞" : `${fmtNum(xi * p.d, 1)} mm` },
                                    { label: "ε_cs", value: `${fmtNum(cur.epsCs * 1000, 2)}‰` },
                                    { label: "ε_s", value: `${fmtNum(cur.epsS * 1000, 3)}‰` },
                                ]} />
                                {st.hl === "triangles" && (
                                    <div className="w-full max-w-[340px] space-y-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2">
                                        <div className="flex justify-center">
                                            <Segmented small value={tri} onChange={(v) => set({ tri: v })} options={[
                                                { value: "cur", label: hs("ε_s, ε′_s(ξ)") },
                                                { value: "t", label: "t (punto F)" },
                                                ...(f.has6b ? [{ value: "ab", label: hs("ξ_6a/6b") }] : []),
                                            ]} />
                                        </div>
                                        <div className="tex-left text-sm"><Tex display>{TRI6_TEX[tri]}</Tex></div>
                                        <p className="text-[11px] leading-4 text-slate-500">{hs(TRI6_NOTE[tri])}</p>
                                    </div>
                                )}
                            </div>
                            <div className="w-full">
                                <StrainDiagramPivot p={p} xi={xi} branch={st.branch} mode={st.hl ?? "fields"} tri={tri}
                                    onSlider={(v) => set({ slider: v })} spec={spec6(p, f)} />
                            </div>
                        </div>
                    </div>
                </Block>

                <Lazy deps={[p, f, xiB, st.num, st.branch, data]} render={() => {
                    const xi = xiB; const cur = f.point(xi); const ref = numericPivotC(p, xi); const errN = Math.abs(cur.N - ref.N), errM = Math.abs(cur.M - ref.M); const ok = errN < 1e-3 && errM < 1e-3;
                    const inf = xi === Infinity; const xiv = inf ? "+\\infty" : T(xi, 4);
                    return (<>
                {/* 2. legami costitutivi */}
                <Block n="2" title="Legami costitutivi">
                    <div className="space-y-1 text-xs leading-5 text-slate-600">
                        <p><b>Calcestruzzo</b>: tutta la sezione è compressa; il lembo superiore va da ε<sub>cu</sub> a ε<sub>c2</sub> (punto pieno) e quello inferiore da 0 a ε<sub>c2</sub> (punto vuoto). Il diagramma parabola-rettangolo non è più "completo": ψ e λ non sono costanti e si riferiscono all'altezza h.</p>
                        <p><b>Acciaio</b>: A′<sub>s</sub> già snervata (σ′<sub>s</sub> = −f<sub>yd</sub>); A<sub>s</sub> compressa da ε<sub>s,5/6</sub> = {fmtNum(f.epsAs56 * 1000, 3)}‰ fino a −ε<sub>c2</sub>{f.has6b ? <>, elastica (6a) fino a −ε<sub>se</sub> e poi plastica (6b)</> : ""}.</p>
                    </div>
                </Block>

                {/* 3. congruenza e sottocampi */}
                <Block n="3" title="Congruenza e sottocampi">
                    <div className="tex-left space-y-1">
                        <F lhs="t" sym={String.raw`\dfrac{\varepsilon_{cu}-\varepsilon_{c2}}{\varepsilon_{cu}}\,h`} num={String.raw`\dfrac{${eCu}-0{,}002}{${eCu}}\cdot ${T(p.h, 1)}`} val={`${T(f.t, 1)}\\ \\text{mm}`} br={false} />
                        <Tex display>{String.raw`\dfrac{\varepsilon_{c2}}{x-t}=\dfrac{-\varepsilon_s}{x-d}=\dfrac{-\varepsilon'_s}{x-d''}=\dfrac{\varepsilon_{cs}}{x}=\dfrac{\varepsilon_{ci}}{x-h}\;\Longleftrightarrow\;\dfrac{\varepsilon_{c2}}{\xi-t/d}=\dfrac{-\varepsilon_s}{\xi-1}=\dfrac{-\varepsilon'_s}{\xi-\delta''}=\dfrac{\varepsilon_{cs}}{\xi}=\dfrac{\varepsilon_{ci}}{\xi-(1+\delta')}`}</Tex>
                        <Tex display>{String.raw`\varepsilon_s=-\dfrac{\varepsilon_{c2}}{\xi-t/d}\,(\xi-1)\qquad\varepsilon_{cs}=\dfrac{\varepsilon_{c2}\,\xi}{\xi-t/d}\qquad\varepsilon_{ci}=\dfrac{\varepsilon_{c2}\,(\xi-1-\delta')}{\xi-t/d}`}</Tex>
                        {f.has6b && <F lhs="\xi_{6a/6b}" sym={String.raw`\dfrac{\varepsilon_{c2}-\varepsilon_{se}\,t/d}{\varepsilon_{c2}-\varepsilon_{se}}`} num={String.raw`\dfrac{0{,}002-${eSe}\cdot ${tD}}{0{,}002-${eSe}}`} val={`${T(f.xi6ab, 3)}\\qquad x_{6a/6b}=${T(f.x6ab / 1000, 2)}\\ \\text{m}`} br={false} />}
                        {f.has6b && <Tex display>{String.raw`\begin{aligned}&\text{6a: }A_s\text{ elastica, }\sigma_s=E_s\,\varepsilon_s&&${T(f.xi0, 4)}\le\xi\le ${T(f.xi6ab, 3)}\\&\text{6b: }A_s\text{ plastica, }\sigma_s=-f_{yd}&&${T(f.xi6ab, 3)}\le\xi<+\infty\end{aligned}`}</Tex>}
                        <p className="text-xs text-slate-500">Negli appunti, per 6b, compare ε<sub>su</sub> ≤ ε<sub>s</sub> ≤ ε<sub>se</sub>: come notato dalla prof. dovrebbe essere −ε<sub>c2</sub> ≤ ε<sub>s</sub> ≤ −ε<sub>se</sub> (qui con i segni). Il confine 6a/6b è molto lontano perché ε<sub>se</sub> è vicina a ε<sub>c2</sub>.</p>
                        <p className="pt-1 text-xs font-semibold text-slate-500">Coefficienti del calcestruzzo sull'altezza h (differenza fra il blocco 0…x a ε<sub>cs</sub> e il blocco h…x a ε<sub>ci</sub>):</p>
                        <Tex display>{String.raw`\psi=\dfrac{x\,\psi(\varepsilon_{cs})-(x-h)\,\psi(\varepsilon_{ci})}{h}\qquad\lambda\,h=\dfrac{x\,\psi(\varepsilon_{cs})\,\lambda(\varepsilon_{cs})\,x-(x-h)\,\psi(\varepsilon_{ci})\,[h+\lambda(\varepsilon_{ci})(x-h)]}{\psi\,h}`}</Tex>
                        <p className="text-xs text-slate-400">ψ(ε), λ(ε): le formule del campo 2 (parabola-rettangolo). Per ξ → ∞: ψ = 1, λ = 0,5. Nel campo 6: 0,80952 ≤ ψ ≤ 1.</p>
                    </div>
                </Block>

                {/* 4. equazioni di campo */}
                <Block n="4" title="Equazioni di campo">
                    <div className="tex-left space-y-2">
                        <p className="text-xs font-semibold text-slate-500">Equilibrio (C<sub>c</sub> = bψh f<sub>cd</sub> applicata a λh dal lembo superiore):</p>
                        <Tex display>{String.raw`\begin{cases}b\,\psi\,h\,f_{cd}-\sigma'_s\,A'_s-\sigma_s\,A_s=N_{Rd}\\[4pt]b\,\psi\,h\,f_{cd}\left(\tfrac{h}{2}-\lambda h\right)-\sigma'_s\,A'_s\left(\tfrac{h}{2}-d''\right)+\sigma_s\,A_s\left(\tfrac{h}{2}-d'\right)=M_{Rd}\end{cases}\qquad\sigma_s=\begin{cases}-E_s\,\dfrac{\varepsilon_{c2}}{x-t}(x-d)&\text{(6a)}\\-f_{yd}&\text{(6b)}\end{cases}`}</Tex>
                        <Tex display>{String.raw`\begin{cases}\psi\,(1+\delta')-\alpha'_s\,\omega'_s-\alpha_s\,\omega_s=\nu_{Rd}\\[4pt]\psi\,(1+\delta')\left[\dfrac{1+\delta'}{2}-\lambda\,(1+\delta')\right]-\alpha'_s\,\omega'_s\,\dfrac{1+\delta'-2\delta''}{2}+\alpha_s\,\omega_s\,\dfrac{1-\delta'}{2}=\mu_{Rd}\end{cases}`}</Tex>
                        <Tex display>{String.raw`\alpha'_s=-1\qquad\alpha_s=\begin{cases}-\dfrac{E_s}{f_{yd}}\,\dfrac{\varepsilon_{c2}}{\xi-t/d}\,(\xi-1)&\text{(6a)}\\-1&\text{(6b)}\end{cases}`}</Tex>
                        <p className="rounded-lg bg-amber-50 px-2 py-1 text-[11px] leading-4 text-amber-800">Nota sui segni: negli appunti α′<sub>s</sub> = 1 (tipicamente) e, in 6b, α<sub>s</sub> = 1; con la convenzione dei segni (compressione negativa) sono −1, come nei campi precedenti.</p>
                    </div>
                </Block>

                {/* 5. stato corrente */}
                <Block n="5" title="Stato corrente (ξ dal cursore del blocco 1)">
                    <div className="space-y-3">
                        <div className="tex-left space-y-1">
                            <Tex display>{String.raw`\xi=${xiv}\qquad x=${inf ? "+\\infty" : `${T(xi * p.d, 1)}\\ \\text{mm}`}\qquad\text{sottocampo }${cur.sub}`}</Tex>
                            <Tex display>{String.raw`\varepsilon_{cs}=${pm(cur.epsCs, 3)}\qquad\varepsilon_{ci}=${pm(cur.epsCi, 3)}\qquad\psi=${T(cur.psi, 5)}\qquad\lambda=${T(cur.lam, 4)}`}</Tex>
                            {inf
                                ? <Tex display>{String.raw`\varepsilon_s=\varepsilon'_s=-\varepsilon_{c2}=${pm(-f.epsC2, 3)}\qquad\alpha_s=${T(cur.alphaS, 4)}`}</Tex>
                                : <F lhs="\varepsilon_s" sym={String.raw`-\dfrac{\varepsilon_{c2}}{\xi-t/d}\,(\xi-1)`} num={String.raw`-\dfrac{0{,}002}{${xiv}-${tD}}\,(${xiv}-1)`} val={`${pm(cur.epsS, 4)}\\qquad\\alpha_s=${T(cur.alphaS, 4)}`} br={false} />}
                            <Tex display>{String.raw`\varepsilon'_s=${pm(cur.epsSP, 3)}\;\Rightarrow\;\alpha'_s=${T(cur.alphaSP, 4)}`}</Tex>
                            <F lhs="\nu_{Rd}" sym="\psi\,(1+\delta')-\alpha'_s\,\omega'_s-\alpha_s\,\omega_s" num={`${T(cur.psi, 5)}\\cdot ${T(f.xi0, 4)}-(${T(cur.alphaSP, 4)})\\cdot ${T(p.omegaSP, 4)}-(${T(cur.alphaS, 4)})\\cdot ${T(p.omegaS, 4)}`} val={T(cur.nu, 4)} br={false} />
                            <F lhs="\mu_{Rd}" sym={String.raw`${sgnM ? "-\\Big[" : ""}\psi(1+\delta')\left[\tfrac{1+\delta'}{2}-\lambda(1+\delta')\right]-\alpha'_s\omega'_s\tfrac{1+\delta'-2\delta''}{2}+\alpha_s\omega_s\tfrac{1-\delta'}{2}${sgnM ? "\\Big]" : ""}`}
                                num={`${sgnM ? "-\\big[" : ""}${T(cur.psi, 5)}\\cdot ${T(f.xi0, 4)}\\,[\\tfrac{1+${d1}}{2}-${T(cur.lam, 4)}\\cdot ${T(f.xi0, 4)}]-(${T(cur.alphaSP, 4)})\\cdot ${T(p.omegaSP, 4)}\\cdot ${T(p.armSP, 4)}+(${T(cur.alphaS, 4)})\\cdot ${T(p.omegaS, 4)}\\cdot ${T(p.armS, 4)}${sgnM ? "\\big]" : ""}`} val={T(cur.mu, 4)} br={false} />
                            <F lhs="N_{Rd}" sym="\nu_{Rd}\,b\,d\,f_{cd}" num={`${T(cur.nu, 4)}\\cdot ${T(p.b, 0)}\\cdot ${T(p.d, 1)}\\cdot ${T(p.fcd, 2)}`} val={`${T(cur.N, 1)}\\ \\text{kN}`} br={false} />
                            <F lhs="M_{Rd}" sym="\mu_{Rd}\,b\,d^2\,f_{cd}" num={`${T(cur.mu, 4)}\\cdot ${T(p.b, 0)}\\cdot ${T(p.d, 1)}^2\\cdot ${T(p.fcd, 2)}`} val={`${T(cur.M, 2)}\\ \\text{kNm}`} br={false} />
                        </div>
                        <p className="text-xs text-slate-400">Il diagramma delle forze interne di questo stato è disegnato sulla sezione, nel blocco 1.</p>
                        <div className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs ${ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                            {ok ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
                            Calcolo numerico (piano di deformazione per F + legami, cls integrato a strisce): N = {fmtNum(ref.N, 1)} kN, M = {fmtNum(ref.M, 2)} kNm
                            — scarto ΔN = {errN.toExponential(1)}, ΔM = {errM.toExponential(1)}
                        </div>
                    </div>
                </Block>

                {/* 6. punti caratteristici e osservazioni */}
                <Block n="6" title="Punti caratteristici e osservazioni">
                    <PointsTable cols={[{ key: "ecs", h: <>ε<sub>cs</sub> [‰]</>, v: (pt) => fmtNum(pt.epsCs * 1000, 3) }, { key: "ec2", h: <>ε<sub>ci</sub> [‰]</>, v: (pt) => fmtNum(pt.epsCi * 1000, 3) }, COL_PSI, COL_LAM, { key: "es", h: <>ε<sub>s</sub> [‰]</>, v: (pt) => fmtNum(pt.epsS * 1000, 3) }, { key: "as", h: <>α<sub>s</sub></>, v: (pt) => fmtNum(pt.alphaS, 4) }]} rows={[
                        { label: "Retta limite 5/6 (ξ = 1 + δ′, x = h)", pt: f.point(f.xi0) },
                        ...(f.has6b ? [{ label: "Confine 6a/6b (ξ = ξ6a/6b)", pt: f.point(f.xi6ab) }] : []),
                        ...(f.pureComp ? [{ label: "Massima compressione pura (M = 0)", pt: f.pureComp }] : []),
                        { label: "Retta limite inferiore (ξ → ∞, ε = ε_c2 uniforme)", pt: f.point(Infinity) },
                    ]} />
                    <div className="mt-3 space-y-1 text-xs leading-5 text-slate-600">
                        <p>• Il punto ξ = 1 + δ′ coincide con l'ultimo punto del campo 5; per ξ → ∞ i due rami (M &gt; 0 e M &lt; 0) arrivano nello stesso punto e chiudono il dominio.</p>
                        <p>• Si tende alla compressione pura: N<sub>Rd</sub> cresce (calcestruzzo, ψ fino a 1, e A<sub>s</sub> fino allo snervamento), A′<sub>s</sub> resta costante; M<sub>Rd</sub> continua a calare.</p>
                        <p>• Sulla retta limite inferiore (ψ = 1, λ = 0,5, σ<sub>s</sub> = f<sub>yd</sub>): M<sub>Rd</sub> = −f′<sub>yd</sub>A′<sub>s</sub>(h/2 − d″) + f<sub>yd</sub>A<sub>s</sub>(h/2 − d′) = <b>{fmtNum(f.point(Infinity).M, 2)} kNm</b>. Con A<sub>s</sub> &gt; A′<sub>s</sub>, d′ = d″ e stesso acciaio il dominio termina sotto l'asse delle ascisse: deformazione costante non significa momento nullo (come nel campo 1).</p>
                        <p>• Massima compressione pura (M = 0, appunti p. 87): {f.pureComp
                            ? <>ξ = {xiTxt(f.pureComp.xi)}, sottocampo {f.pureComp.sub}: N<sub>Rd</sub> = <b>{fmtNum(f.pureComp.N, 1)} kN</b> (cerchio arancio nel dominio).</>
                            : <>in questo ramo il momento non si annulla nel campo 6 (si annulla nell'altro ramo).</>}</p>
                    </div>
                </Block>
                    </>);
                }} />
            </div>
        </NumCtx.Provider>
    );
}

// colonne della tabella dei punti caratteristici (comuni a tutti i campi)
const COL_EPSSP = { key: "es", h: <>ε′<sub>s</sub> [‰]</>, v: (pt) => fmtNum(pt.epsSP * 1000, 3) };
const COL_ALPHA = { key: "a", h: <>α′<sub>s</sub></>, v: (pt) => fmtNum(pt.alphaSP, 4) };
const COL_EPSC = { key: "ec", h: <>ε<sub>c</sub> [‰]</>, v: (pt) => fmtNum(pt.epsC * 1000, 3) };
const COL_PSI = { key: "psi", h: "ψ", v: (pt) => fmtNum(pt.psi, 4) };
const COL_LAM = { key: "lam", h: "λ", v: (pt) => fmtNum(pt.lam, 4) };
const COLS_RES = [
    { key: "nu", h: <>ν<sub>Rd</sub></>, v: (pt) => fmtNum(pt.nu, 4) },
    { key: "mu", h: <>μ<sub>Rd</sub></>, v: (pt) => fmtNum(pt.mu, 4) },
    { key: "N", h: <>N<sub>Rd</sub> [kN]</>, v: (pt) => fmtNum(pt.N, 1), strong: true },
    { key: "M", h: <>M<sub>Rd</sub> [kNm]</>, v: (pt) => fmtNum(pt.M, 2), strong: true },
];
function PointsTable({ rows, cols = [COL_EPSSP, COL_ALPHA] }) {
    const all = [...cols, ...COLS_RES];
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-xs tabular-nums">
                <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                        <th className="py-1 text-left font-semibold">Punto</th>
                        {all.map((c) => <th key={c.key} className="px-2 text-right font-semibold">{c.h}</th>)}
                    </tr>
                </thead>
                <tbody>
                    {rows.map(({ label, pt }) => (
                        <tr key={label} className="border-b border-slate-100 text-slate-700">
                            <td className="py-1 pr-2">{label}</td>
                            {all.map((c) => <td key={c.key} className={`px-2 text-right ${c.strong ? "font-semibold" : ""}`}>{c.v(pt)}</td>)}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Disegni
// ---------------------------------------------------------------------------

// Stati deformativi del campo 1 con i legami costitutivi delle armature, come
// negli appunti: legame di A'_s sopra, deformazioni al centro, legame di A_s
// sotto, tutti con la stessa scala delle deformazioni (trazioni verso sinistra)
// e origine sull'asse x (punto O).
// mode "fields": fasce dei sottocampi 1a / 1b; mode "profile": area del profilo
// deformativo dello stato corrente (posizione del cursore) sull'altezza della sezione
function StrainDiagram({ p, f, xi, branch, mode = "fields", tri = "cur", onSlider }) {
    const svgRef = useRef(null);
    const dragging = useRef(false);
    const profile = mode === "profile";
    const triangles = mode === "triangles";
    const showCur = !(triangles && tri !== "cur"); // con ε′s1/2 o ξ1a/1b lo stato corrente non c'entra
    const FW = 180, LW = 112;                  // forze interne sulla faccia destra; azioni N_Rd, M_Rd a sinistra
    const lawH = 54, top = 14;
    const baseC = top + lawH;                  // asse ε_c del legame del calcestruzzo (come negli altri campi)
    const baseTop = baseC + 34 + lawH;         // asse ε del legame di A'_s
    const sTop = baseTop + (lawH - 16) + 30, secH = 170; // deformazioni (sotto il ramo compresso di A'_s)
    const s = secH / p.h;
    const baseBot = sTop + secH + 28 + lawH;   // asse ε del legame di A_s
    const Hh = baseBot + 26;
    const secW = Math.max(36, Math.min(70, p.b * s)), secL = LW;
    const ax = secL + 70 + FW + 206;           // origine O / asse x (ε = 0)
    const W = ax + 120;
    const face = secL + secW;                  // faccia destra della sezione
    const k = 200 / p.epsSu;                   // px per unità di deformazione
    const ex = (e) => ax - e * k;
    const yD = (depth) => sTop + depth * s;
    const yA = yD(p.d), yAp = yD(p.dSup);
    const lineFor = (xv, dEnd = p.d) => { // retta dal lembo superiore alla profondità dEnd
        const e = (depth) => (xv === -Infinity ? p.epsSu : (p.epsSu * (depth - xv * p.d)) / (p.d - xv * p.d));
        return { x1: ex(e(0)), y1: yD(0), x2: ex(e(dEnd)), y2: yD(dEnd) };
    };
    const L0 = lineFor(0), Lab = lineFor(f.xi1ab), Linf = lineFor(-Infinity), Lc = lineFor(xi, p.h); // stato corrente: su tutta l'altezza, fino al lembo inferiore
    const eCur = xi === -Infinity ? p.epsSu : (p.epsSu * (p.dSup - xi * p.d)) / (p.d - xi * p.d);
    const sigPx = lawH - 16;                   // altezza di f_yd nei legami
    const sig = (e) => Math.min(ES_MPA * e, p.fyd);
    const lawPts = (base, e0, e1) => [e0, ...(e0 < p.epsSe && e1 > p.epsSe ? [p.epsSe] : []), e1]
        .map((e) => `${ex(e).toFixed(1)},${(base - (sig(e) / p.fyd) * sigPx).toFixed(1)}`).join(" ");
    const law = ({ base, eLab, sLab, fLab, suLab, seLab, ranges, pts, bar, full = false }) => (
        <g>
            <line x1={full ? ex(-p.epsCu) + 20 : ax + 6} x2={ex(p.epsSu) - 24} y1={base} y2={base} stroke="#64748b" markerEnd="url(#sd-arr)" />
            <line x1={ax} x2={ax} y1={full ? base + sigPx + 6 : base + 4} y2={base - lawH + 2} stroke="#64748b" markerEnd="url(#sd-arr)" />
            {/* ramo di compressione (come nei campi 2–5) */}
            {full && <polyline points={`${ex(-p.epsCu) + 20},${base + sigPx} ${ex(-p.epsSe)},${base + sigPx} ${ax},${base}`} fill="none" stroke="#94a3b8" strokeWidth="1.6" />}
            {full && <text x={ex(-p.epsSe)} y={base + sigPx + 12} fontSize="9" textAnchor="middle" fill="#64748b">−{ss("f′_yd")}</text>}
            {full && <text x={ex(-p.epsSe)} y={base + 12} fontSize="9" textAnchor="middle" fill="#64748b">{ss("ε′_se")}</text>}
            <text x={ex(p.epsSu) - 26} y={base - 5} fontSize="10" textAnchor="end" fill="#475569">{ss(eLab)}</text>
            <text x={ax + 5} y={base - lawH + 10} fontSize="10" fill="#475569">{ss(sLab)}</text>
            <line x1={ax} x2={ex(p.epsSe)} y1={base - sigPx} y2={base - sigPx} stroke="#cbd5e1" strokeDasharray="3 3" />
            <text x={ex(p.epsSe)} y={base - sigPx - 4} fontSize="9" textAnchor="middle" fill="#64748b">{ss(fLab)}</text>
            <polyline points={lawPts(base, 0, p.epsSu)} fill="none" stroke="#94a3b8" strokeWidth="1.6" />
            {ranges.map((r) => <polyline key={r.key} points={lawPts(base, r.e0, r.e1)} fill="none" stroke={r.color} strokeWidth="2.4" strokeLinecap="round" />)}
            {pts.map((q) => q.hollow
                ? <circle key={q.key} cx={ex(q.e)} cy={base - (sig(q.e) / p.fyd) * sigPx} r="3.4" fill="#fff" stroke={q.color} strokeWidth="1.8" />
                : <circle key={q.key} cx={ex(q.e)} cy={base - (sig(q.e) / p.fyd) * sigPx} r="4" fill={q.color} stroke="#fff" strokeWidth="1.5" />)}
            <text x={ex(p.epsSu)} y={base + 12} fontSize="9" textAnchor="middle" fill="#64748b">{ss(suLab)}</text>
            <text x={ex(p.epsSe)} y={base + 12} fontSize="9" textAnchor="middle" fill="#64748b">{ss(seLab)}</text>
            {/* profilo deformativo: deformazione della barra riportata sull'asse ε del legame,
                con il valore (piccolo) sopra l'asse, accanto al punto che si muove */}
            {bar && <g>
                <line x1={ax} x2={ex(bar.e)} y1={base} y2={base} stroke={bar.col} strokeWidth="1.6" />
                <line x1={ex(bar.e)} x2={ex(bar.e)} y1={base} y2={base - (sig(bar.e) / p.fyd) * sigPx} stroke={bar.col} strokeWidth="0.8" strokeDasharray="2 2" />
                <circle cx={ex(bar.e)} cy={base} r="2.2" fill={bar.col} />
                <text x={bar.e > p.epsSe ? ex(bar.e) + 3 : ex(bar.e) - 3} y={base - 3} fontSize="7.5" textAnchor={bar.e > p.epsSe ? "start" : "end"} fill={bar.col}>{ss(bar.lab)} = {fmtNum(bar.e * 1000, 2)}‰</text>
            </g>}
        </g>
    );
    // trascinamento del punto verde: x del puntatore → ε'_s (fra ε'_s1/2 ed ε_su)
    // → ξ = (ε_su δ'' − ε'_s)/(ε_su − ε'_s) → valore del cursore (inverso di sliderToXi)
    // asse neutro (sopra la sezione, x ≤ 0): freccia dal vertice superiore verso l'alto, fino
    // all'altezza della punta dell'asse σ del legame di A'_s; trascinabile in verticale
    const yTip = baseTop - lawH + 2;
    const draggingNA = useRef(false);
    const [naHover, setNaHover] = useState(false); // hover sul pallino dell'asse neutro
    const dragNA = (ev) => {
        const svg = svgRef.current;
        if (!svg || !onSlider) return;
        const pt = svg.createSVGPoint();
        pt.x = ev.clientX; pt.y = ev.clientY;
        const loc = pt.matrixTransform(svg.getScreenCTM().inverse());
        if (loc.y <= yTip + 1) { onSlider(0); return; }           // oltre la punta: ξ → −∞
        const xv = Math.min(0, (loc.y - sTop) / s / p.d);          // ξ ≤ 0
        const u = -xv / (1 - xv);
        onSlider(Math.max(0, Math.min(1000, Math.round(1000 * (1 - u)))));
    };
    const dragTo = (ev) => {
        const svg = svgRef.current;
        if (!svg || !onSlider) return;
        const pt = svg.createSVGPoint();
        pt.x = ev.clientX; pt.y = ev.clientY;
        const loc = pt.matrixTransform(svg.getScreenCTM().inverse());
        const e = Math.min(p.epsSu, Math.max(f.epsS12, (ax - loc.x) / k));
        if (e >= p.epsSu - 1e-12) { onSlider(0); return; }
        const x = (p.epsSu * p.delta2 - e) / (p.epsSu - e);   // ξ ≤ 0
        const u = -x / (1 - x);
        onSlider(Math.max(0, Math.min(1000, Math.round(1000 * (1 - u)))));
    };
    // profilo deformativo corrente esteso a tutta l'altezza della sezione
    const eAt = (depth) => (xi === -Infinity ? p.epsSu : (p.epsSu * (depth - xi * p.d)) / (p.d - xi * p.d));
    const profPts = `${ax},${yD(0)} ${ex(eAt(0))},${yD(0)} ${ex(eAt(p.h))},${yD(p.h)} ${ax},${yD(p.h)}`;
    return (
        <div className="relative">
        <svg ref={svgRef} viewBox={`0 0 ${W} ${Hh}`} width="100%" role="img" aria-label="Stati deformativi del campo 1">
            <defs>
                <marker id="sd-arr" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0,0 L7,4 L0,8 Z" fill="#64748b" /></marker>
            </defs>
            {/* richiami verticali di ε_su ed ε'_se attraverso i tre diagrammi */}
            {[p.epsSu, p.epsSe, -p.epsSe, -EPS_C2, -p.epsCu].map((e) => <line key={e} x1={ex(e)} x2={ex(e)} y1={baseC - lawH + 6} y2={baseBot} stroke="#eef2f7" strokeDasharray="3 3" />)}

            {/* legame del calcestruzzo (compressione a destra): nel campo 1 è tutto teso, σc = 0 */}
            <g>
                <line x1={ax - 6} x2={ex(-p.epsCu) + 26} y1={baseC} y2={baseC} stroke="#64748b" markerEnd="url(#sd-arr)" />
                <line x1={ax} x2={ax} y1={baseC + 4} y2={baseC - lawH + 2} stroke="#64748b" markerEnd="url(#sd-arr)" />
                <text x={ex(-p.epsCu) + 28} y={baseC - 5} fontSize="10" textAnchor="start" fill="#475569">{ss("ε_c")}</text>
                <text x={ax - 5} y={baseC - lawH + 10} fontSize="10" textAnchor="end" fill="#475569">{ss("σ_c")}</text>
                <line x1={ax} x2={ex(-EPS_C2)} y1={baseC - (lawH - 16)} y2={baseC - (lawH - 16)} stroke="#cbd5e1" strokeDasharray="3 3" />
                <text x={ax - 5} y={baseC - (lawH - 16) + 4} fontSize="9" textAnchor="end" fill="#64748b">{ss("f_cd")}</text>
                <polyline points={Array.from({ length: 25 }, (_, i) => (p.epsCu * i) / 24).map((e) => `${ex(-e).toFixed(1)},${(baseC - sigmaC(e, 1) * (lawH - 16)).toFixed(1)}`).join(" ")} fill="none" stroke="#94a3b8" strokeWidth="1.6" />
                <text x={ex(-EPS_C2)} y={baseC + 12} fontSize="9" textAnchor="middle" fill="#64748b">{ss("ε_c2")}</text>
                <text x={ex(-p.epsCu)} y={baseC + 12} fontSize="9" textAnchor="middle" fill="#64748b">{ss("ε_cu")}</text>
                <circle cx={ax} cy={baseC} r="4" fill={CONC_PT} stroke="#fff" strokeWidth="1.5" />
                <text x={ax - 8} y={baseC - 6} fontSize="8.5" textAnchor="end" fill="#94a3b8">cls tutto teso: {ss("σ_c")} = 0</text>
            </g>

            {/* legame di A'_s (sopra) */}
            {law({
                base: baseTop, eLab: "ε′_s", sLab: "σ′_s", fLab: "f′_yd", suLab: "ε′_su", seLab: "ε_se", full: true,
                ranges: [
                    ...(f.has1b ? [{ key: "1b", e0: f.epsS12, e1: p.epsSe, color: SUB1B_COL }] : []),
                    { key: "1a", e0: f.has1b ? p.epsSe : f.epsS12, e1: p.epsSu, color: SUB1A_COL },
                ],
                pts: [{ key: "c", e: eCur, color: CUR_COL }],
                bar: profile ? { e: eAt(p.dSup), col: ASP_COL, lab: "ε′_s" } : null,
            })}

            {/* sezione */}
            <rect x={secL} y={sTop} width={secW} height={secH} fill="#f8fafc" stroke="#334155" strokeWidth="1.4" />
            <line x1={secL + 6} x2={secL + secW - 6} y1={yAp} y2={yAp} stroke={ASP_COL} strokeWidth="2.5" />
            <line x1={secL + 6} x2={secL + secW - 6} y1={yA} y2={yA} stroke={AS_COL} strokeWidth="2.5" />
            <text x={secL + secW / 2} y={yAp + 12} fontSize="10" textAnchor="middle" fill={ASP_COL}>{ss("A′_s")}</text>
            <text x={secL + secW / 2} y={yA - 5} fontSize="10" textAnchor="middle" fill={AS_COL}>{ss("A_s")}</text>
            {branch < 0 && <text x={secL} y={sTop + secH + 12} fontSize="9" fill="#94a3b8">sezione ribaltata</text>}
            {/* asse neutro del campo 1 (x ≤ 0, sopra la sezione): la freccia di x sale dal vertice superiore
                sinistro; se l'asse neutro è più in alto della punta dell'asse σ, la freccia si ferma lì e
                prosegue a puntini (verso −∞) */}
            {showCur && (() => {
                const yN1 = xi === -Infinity ? -Infinity : sTop + xi * p.d * s;
                const visible = yN1 >= yTip;
                const yEnd = visible ? yN1 : yTip, xA = secL - 8;
                return (
                    <g>
                        <defs><marker id="sd1-na" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0,0 L6,3.5 L0,7 Z" fill="#0284c7" /></marker></defs>
                        {visible && <line x1={secL - 16} x2={secL + secW + 12} y1={yN1} y2={yN1} stroke="#0284c7" strokeWidth="1.1" strokeDasharray="6 3" strokeOpacity="0.45" />}
                        <circle cx={secL} cy={sTop} r="2.4" fill="#0284c7" />
                        {sTop - yEnd > 7 && <line x1={xA} x2={xA} y1={sTop} y2={yEnd + 5} stroke="#0284c7" strokeWidth="1.3" markerEnd="url(#sd1-na)" />}
                        {!visible && <line x1={xA} x2={xA} y1={yTip - 3} y2={yTip - 12} stroke="#0284c7" strokeWidth="1.3" strokeDasharray="1.5 2.5" />}
                        {sTop - yEnd > 14 && <text x={xA - 4} y={(sTop + yEnd) / 2 + 3} fontSize="9" textAnchor="end" fill="#0284c7">{xi === -Infinity ? "x → −∞" : "x"}</text>}
                        <circle cx={xA} cy={yEnd} r={naHover ? 6 : 4} fill={naHover ? "#0369a1" : "#0284c7"} stroke={naHover ? "#bae6fd" : "#fff"} strokeWidth={naHover ? 3 : 1.2} pointerEvents="none" style={{ transition: "all 120ms ease-out" }} />
                        <rect x={xA - 10} y={yEnd - 8} width="20" height="16" fill="transparent" style={{ cursor: "pointer", touchAction: "none" }}
                            onPointerDown={(ev) => { draggingNA.current = true; ev.currentTarget.setPointerCapture(ev.pointerId); dragNA(ev); }}
                            onPointerMove={(ev) => { if (draggingNA.current) dragNA(ev); }}
                            onPointerUp={(ev) => { draggingNA.current = false; ev.currentTarget.releasePointerCapture(ev.pointerId); }}
                            onPointerEnter={() => setNaHover(true)} onPointerLeave={() => setNaHover(false)}>
                            <title>Trascina per spostare l'asse neutro</title>
                        </rect>
                    </g>
                );
            })()}
            <line x1={face + FW - 4} x2={ax + 10} y1={yAp} y2={yAp} stroke="#cbd5e1" strokeDasharray="3 3" />
            <line x1={face + FW - 4} x2={ax + 10} y1={yA} y2={yA} stroke="#cbd5e1" strokeDasharray="3 3" />
            {/* asse x con origine O sul lembo superiore */}
            <line x1={ax} y1={sTop - 6} x2={ax} y2={sTop + secH + 10} stroke="#334155" strokeWidth="1" markerEnd="url(#sd-arr)" />
            <text x={ax + 5} y={sTop + secH + 8} fontSize="10" fill="#334155">x</text>
            <text x={ax + 5} y={sTop - 3} fontSize="10" fill="#334155">O</text>
            {/* forze interne dello stato corrente sulla faccia destra della sezione (calcestruzzo
                tutto teso: solo le armature), con le azioni N_Rd e M_Rd a h/2 */}
            {showCur && (() => {
                const sP = Math.sign(eCur) * Math.min(ES_MPA * Math.abs(eCur), p.fyd), sS = p.fyd; // trazione +
                const forces = [
                    { key: "tsp", name: sP > 0 ? "T′_s" : "C′_s", y: yAp, v: -p.AsP * sP, col: ASP_COL },
                    { key: "ts", name: "T_s", y: yA, v: -p.As * sS, col: AS_COL },
                ];
                const Nn = forces.reduce((acc, q) => acc + q.v, 0) / 1000;
                const Mm = (-p.AsP * sP * (p.h / 2 - p.dSup) + p.As * sS * (p.h / 2 - p.dInf)) / 1e6; // riferimento del disegno
                const maxF = Math.max(1, ...forces.map((q) => Math.abs(q.v)));
                const len = (v) => 16 + (Math.abs(v) / maxF) * 62;
                const cyG = yD(p.h / 2), xa = LW / 2 + 2, r = 15; // azioni a sinistra della sezione
                // faccia sinistra: M ≥ 0 (fibre inferiori tese) → verso orario; arco a sinistra del centro
                const arc = Mm >= 0
                    ? `M${xa + 8},${cyG + r} A${r},${r} 0 0 1 ${xa + 8},${cyG - r}`
                    : `M${xa + 8},${cyG - r} A${r},${r} 0 0 0 ${xa + 8},${cyG + r}`;
                const mk = (c) => `url(#sd1-f${c.slice(1)})`;
                return (
                    <g>
                        <defs>
                            {[ASP_COL, AS_COL, "#2563eb"].map((c) => (
                                <marker key={c} id={`sd1-f${c.slice(1)}`} markerUnits="userSpaceOnUse" markerWidth="8" markerHeight="8" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 Z" fill={c} /></marker>
                            ))}
                        </defs>
                        {forces.map((q) => {
                            const L = len(q.v), tension = q.v < 0;
                            return (
                                <g key={q.key}>
                                    {Math.abs(q.v) > 1e-6 && (tension
                                        ? <line x1={face} x2={face + L} y1={q.y} y2={q.y} stroke={q.col} strokeWidth="1.8" markerEnd={mk(q.col)} />
                                        : <line x1={face + L + 2} x2={face + 2} y1={q.y} y2={q.y} stroke={q.col} strokeWidth="1.8" markerEnd={mk(q.col)} />)}
                                    <text x={face + L + 6} y={q.y + 3.5} fontSize="9" fill={q.col} stroke="#fff" strokeWidth="2.5" paintOrder="stroke">{ss(q.name)} = {fmtNum(Math.abs(q.v) / 1000, 1)} kN</text>
                                </g>
                            );
                        })}
                        <line x1={xa - 34} x2={face + FW - 6} y1={cyG} y2={cyG} stroke="#cbd5e1" strokeDasharray="4 3" />
                        <text x={xa - 34} y={cyG - 3} fontSize="8" fill="#94a3b8">h/2</text>
                        {/* azioni sulla faccia SINISTRA del concio: compressione → verso la sezione,
                            trazione → uscente; momento con verso opposto a quello sulla faccia destra */}
                        {Math.abs(Nn) > 1e-6 && (Nn < 0
                            ? <line x1={xa + 26} x2={xa - 20} y1={cyG} y2={cyG} stroke="#2563eb" strokeWidth="1.8" markerEnd={mk("#2563eb")} />
                            : <line x1={xa - 22} x2={xa + 26} y1={cyG} y2={cyG} stroke="#2563eb" strokeWidth="1.8" markerEnd={mk("#2563eb")} />)}
                        {Math.abs(Mm) > 1e-9 && <path d={arc} fill="none" stroke="#2563eb" strokeWidth="1.6" markerEnd={mk("#2563eb")} />}
                        <text x={xa} y={cyG - r - 7} fontSize="9" textAnchor="middle" fill="#2563eb" stroke="#fff" strokeWidth="2.5" paintOrder="stroke">{ss("M_Rd")} = {fmtNum(Math.abs(Mm), 2)} kNm</text>
                        <text x={xa} y={cyG + r + 13} fontSize="9" textAnchor="middle" fill="#2563eb" stroke="#fff" strokeWidth="2.5" paintOrder="stroke">{ss("N_Rd")} = {fmtNum(Math.abs(Nn), 1)} kN</text>
                    </g>
                );
            })()}
            {/* fasce 1a e 1b */}
            {mode === "fields" && f.has1b && <polygon points={`${Linf.x1},${Linf.y1} ${Lab.x1},${Lab.y1} ${Lab.x2},${Lab.y2}`} fill={SUB1A_COL} fillOpacity="0.14" />}
            {mode === "fields" && <polygon points={`${(f.has1b ? Lab : Linf).x1},${L0.y1} ${L0.x1},${L0.y1} ${L0.x2},${L0.y2}`} fill={f.has1b ? SUB1B_COL : SUB1A_COL} fillOpacity={f.has1b ? 0.2 : 0.14} />}
            {/* area del profilo deformativo corrente (calcestruzzo), tratteggiata come negli appunti */}
            {profile && <>
                <defs>
                    <pattern id="sd-hatch" width="6" height="6" patternUnits="userSpaceOnUse">
                        <line x1="0" y1="3" x2="6" y2="3" stroke="#94a3b8" strokeWidth="0.8" strokeOpacity="0.4" />
                    </pattern>
                </defs>
                <polygon points={profPts} fill="#94a3b8" fillOpacity="0.1" />
                <polygon points={profPts} fill="url(#sd-hatch)" stroke="#94a3b8" strokeWidth="1" />
            </>}
            {/* triangoli simili per le formule delle deformazioni */}
            {triangles && (() => {
                const yTopVis = baseTop + 4; // sopra c'è il legame di A'_s
                // vertice, cateto verticale sull'asse/su una verticale, cateto orizzontale
                let T1, T2, lab, vertexOut = false, parallel = false;
                // etichetta di un cateto orizzontale: centrata, subito sotto la sua linea (alone bianco)
                const H = (xa, xb, y, t, c) => ({ x: (xa + xb) / 2, y, t, c, anchor: "middle" });
                if (tri === "s12") {
                    const O = [ax, yD(0)];
                    T1 = [O, [ax, yA], [ex(p.epsSu), yA]];
                    T2 = [O, [ax, yAp], [ex(f.epsS12), yAp]];
                    lab = [
                        { x: ax + 4, y: (yD(0) + yA) / 2 + 12, t: "d", c: TRI1_COL },
                        { x: ax + 4, y: (yD(0) + yAp) / 2 + 3, t: "d″", c: TRI2_COL },
                        H(ax, ex(p.epsSu), yA + 11, "ε_su", TRI1_COL),
                        H(ax, ex(f.epsS12), yAp + 10, "ε′_s1/2", TRI2_COL),
                    ];
                } else if (tri === "ab") {
                    const yN = yD(f.x1ab), N = [ax, yN];
                    vertexOut = yN < yTopVis;
                    T2 = [N, [ax, yAp], [ex(p.epsSe), yAp]];
                    T1 = [[ex(p.epsSe), yAp], [ex(p.epsSe), yA], [ex(p.epsSu), yA]];
                    lab = [
                        { x: ax + 4, y: (yN + yAp) / 2 + 3, t: "d″ − x", c: TRI2_COL },
                        H(ax, ex(p.epsSe), yAp + 10, "ε′_se", TRI2_COL),
                        { x: ex(p.epsSe) + 4, y: (yAp + yA) / 2, t: "d − d″", c: TRI1_COL },
                        H(ex(p.epsSe), ex(p.epsSu), yA + 11, "ε_su − ε′_se", TRI1_COL),
                    ];
                } else {
                    parallel = xi === -Infinity;
                    const yN = parallel ? -1e6 : yD(xi * p.d), N = [ax, yN];
                    vertexOut = yN < yTopVis;
                    T1 = [N, [ax, yA], [ex(p.epsSu), yA]];
                    T2 = [N, [ax, yAp], [ex(eCur), yAp]];
                    lab = [
                        { x: ax + 4, y: (Math.max(yN, yTopVis) + yA) / 2 + 12, t: "d − x", c: TRI1_COL },
                        { x: ax + 4, y: (Math.max(yN, yTopVis) + yAp) / 2 + 3, t: "d″ − x", c: TRI2_COL },
                        H(ax, ex(p.epsSu), yA + 11, "ε_su", TRI1_COL),
                        H(ax, ex(eCur), yAp + 10, "ε′_s", TRI2_COL),
                    ];
                }
                const pts = (T) => T.map(([x, y]) => `${x},${y}`).join(" ");
                return (
                    <g>
                        <clipPath id="sd-tri-clip"><rect x="0" y={yTopVis} width={W} height={Hh} /></clipPath>
                        <g clipPath="url(#sd-tri-clip)">
                            <polygon points={pts(T1)} fill={TRI1_COL} fillOpacity="0.16" stroke={TRI1_COL} strokeWidth="1.3" strokeLinejoin="round" />
                            <polygon points={pts(T2)} fill={TRI2_COL} fillOpacity="0.2" stroke={TRI2_COL} strokeWidth="1.3" strokeLinejoin="round" />
                        </g>
                        {lab.map((l) => (
                            <text key={l.t} x={l.x} y={l.anchor ? l.y : Math.max(l.y, sTop + 12)} fontSize="9" fontWeight="bold" fill={l.c} textAnchor={l.anchor ?? "start"} stroke="#fff" strokeWidth="3" paintOrder="stroke" strokeLinejoin="round">{ss(l.t)}</text>
                        ))}
                        {vertexOut && <text x={ax - 4} y={yTopVis + 22} fontSize="8.5" textAnchor="end" fill="#64748b">
                            {parallel ? "ξ → −∞: rette parallele, nessun vertice" : `↑ vertice fuori disegno (x = ${fmtNum((tri === "ab" ? f.x1ab : xi * p.d), 0)} mm)`}
                        </text>}
                    </g>
                );
            })()}
            <line {...Linf} stroke="#94a3b8" strokeWidth="1.6" />
            {f.has1b && <line {...Lab} stroke={SUB_COL} strokeWidth="1.2" strokeDasharray="5 3" />}
            <line {...L0} stroke={LIM_COL} strokeWidth="1.8" />
            {/* stato corrente (retta e punto verdi) nascosto quando i triangoli mostrano una retta fissa (ε′s1/2, ξ1a/1b) */}
            {showCur && <line {...Lc} stroke={CUR_COL} strokeWidth="2" />}
            {/* profilo: deformazioni delle barre, distinte da quella del calcestruzzo */}
            {profile && [
                { key: "sp", y: yAp, e: eAt(p.dSup), col: ASP_COL, lab: "ε′_s" },
                { key: "s", y: yA, e: eAt(p.d), col: AS_COL, lab: "ε_s" },
            ].map((b) => (
                <g key={b.key}>
                    <line x1={ax} x2={ex(b.e)} y1={b.y} y2={b.y} stroke={b.col} strokeWidth="1.6" />
                    <circle cx={ex(b.e)} cy={b.y} r="2.2" fill={b.col} />
                </g>
            ))}
            {/* punto verde trascinabile: è un secondo cursore dello stato corrente */}
            {showCur && <circle cx={ex(eCur)} cy={yAp} r="4" fill={CUR_COL} stroke="#fff" strokeWidth="1.2" pointerEvents="none" />}
            {/* A_s: stesso punto (vuoto verde) del legame di A_s */}
            {showCur && <circle cx={ex(p.epsSu)} cy={yA} r="3.4" fill="#fff" stroke={CUR_COL} strokeWidth="1.8" pointerEvents="none"><title>A_s (armatura inferiore)</title></circle>}
            {showCur && <circle cx={ex(eCur)} cy={yAp} r="11" fill="transparent" style={{ cursor: "pointer", touchAction: "none" }}
                onPointerDown={(ev) => { dragging.current = true; ev.currentTarget.setPointerCapture(ev.pointerId); dragTo(ev); }}
                onPointerMove={(ev) => { if (dragging.current) dragTo(ev); }}
                onPointerUp={(ev) => { dragging.current = false; ev.currentTarget.releasePointerCapture(ev.pointerId); }}>
                <title>Trascina per cambiare lo stato deformativo</title>
            </circle>}
            <text x={L0.x2 - 6} y={yA + 4} fontSize="10" textAnchor="end" fill={AS_COL}>A</text>
            {/* etichette al centro delle fasce triangolari (vertice in A): punto medio della fascia a una frazione t dell'altezza */}
            {!triangles && f.has1b && (() => { const t = 0.4, Ax = Lab.x2; return <text x={((Linf.x1 + t * (Ax - Linf.x1)) + (Lab.x1 + t * (Ax - Lab.x1))) / 2} y={sTop + t * (yA - sTop)} fontSize="11" textAnchor="middle" dominantBaseline="middle" fill={SUB1A_COL} fontWeight="bold">1a</text>; })()}
            {/* 1b: fascia stretta e inclinata → etichetta ruotata lungo l'asse della fascia */}
            {!triangles && f.has1b && (() => { const t = ((yAp - sTop) / 2) / (yA - sTop), Ax = Lab.x2, xm = (Lab.x1 + L0.x1) / 2; const x = ((Lab.x1 + t * (Ax - Lab.x1)) + (L0.x1 + t * (Ax - L0.x1))) / 2, y = sTop + t * (yA - sTop); const ang = Math.atan2(yA - sTop, Ax - xm) * 180 / Math.PI + 180; return <text x={x} y={y} fontSize="9" textAnchor="middle" dominantBaseline="central" fill="#8b5cf6" fontWeight="bold" transform={`rotate(${ang} ${x} ${y})`}>1b</text>; })()}

            {/* legame di A_s (sotto) */}
            {law({ base: baseBot, eLab: "ε_s", sLab: "σ_s", fLab: "f_yd", suLab: "ε_su", seLab: "ε_se", ranges: [], pts: [{ key: "A", e: p.epsSu, color: CUR_COL, hollow: true }], bar: profile ? { e: eAt(p.d), col: AS_COL, lab: "ε_s" } : null })}
        </svg>
        </div>
    );
}
const ES_MPA = 200000;

// Dominio con assi fissi centrati in 0 (campi implementati, cursore globale e dei campi)
function DomainChart({ data, adim, global, locals }) {
    const W = 560, H = 340, m = 34;
    const X = (pt) => (adim ? pt.nu : pt.N), Y = (pt) => (adim ? pt.mu : pt.M);
    const pos = data.f1pos, neg = data.f1neg;
    // trazione pura (M = 0): in adimensionale con b·d·f_cd del ramo M > 0
    const ptN = adim ? (data.pt.N * 1000) / data.pos.bdf : data.pt.N;
    // assi FISSI e centrati in 0: scala dall'estensione dell'intero dominio
    // (tutti i campi, entrambi i rami), arrotondata a un valore "tondo"
    const nice = (v) => {
        const e = Math.pow(10, Math.floor(Math.log10(v || 1)));
        return [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map((k) => k * e).find((k) => k >= v * 1.05);
    };
    const xMax = nice(adim ? data.ext.nu : data.ext.N), yMax = nice(adim ? data.ext.mu : data.ext.M);
    const cx = W / 2, cy = H / 2, kx = (W / 2 - m) / xMax, ky = (H / 2 - m) / yMax;
    const sx = (v) => cx + v * kx;
    const sy = (v) => cy - v * ky;
    const path = (arr) => arr.map((q, i) => `${i ? "L" : "M"}${sx(X(q)).toFixed(1)},${sy(Y(q)).toFixed(1)}`).join(" ");
    const dec = adim ? 2 : 0;
    const tv = [-1, -0.5, 0.5, 1];
    return (
        <div>
            <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Dominio M-N per campi">
                <defs>
                    <marker id="dm-arr" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0,0 L7,4 L0,8 Z" fill="#64748b" /></marker>
                </defs>
                {/* griglia leggera */}
                {tv.map((t) => <line key={`gx${t}`} x1={sx(t * xMax)} x2={sx(t * xMax)} y1={sy(yMax)} y2={sy(-yMax)} stroke="#f1f5f9" />)}
                {tv.map((t) => <line key={`gy${t}`} x1={sx(-xMax)} x2={sx(xMax)} y1={sy(t * yMax)} y2={sy(t * yMax)} stroke="#f1f5f9" />)}
                {/* assi per l'origine */}
                <line x1={sx(-xMax) - 8} x2={sx(xMax) + 14} y1={cy} y2={cy} stroke="#64748b" strokeWidth="1.2" markerEnd="url(#dm-arr)" />
                <line x1={cx} x2={cx} y1={sy(-yMax) + 8} y2={sy(yMax) - 14} stroke="#64748b" strokeWidth="1.2" markerEnd="url(#dm-arr)" />
                {tv.map((t) => <g key={`tx${t}`}>
                    <line x1={sx(t * xMax)} x2={sx(t * xMax)} y1={cy - 3} y2={cy + 3} stroke="#64748b" />
                    <text x={sx(t * xMax)} y={cy + 14} fontSize="9.5" textAnchor="middle" fill="#94a3b8">{fmtNum(t * xMax, dec)}</text>
                </g>)}
                {tv.map((t) => <g key={`ty${t}`}>
                    <line x1={cx - 3} x2={cx + 3} y1={sy(t * yMax)} y2={sy(t * yMax)} stroke="#64748b" />
                    <text x={cx - 6} y={sy(t * yMax) + 3} fontSize="9.5" textAnchor="end" fill="#94a3b8">{fmtNum(t * yMax, adim ? 3 : 0)}</text>
                </g>)}
                <text x={cx - 5} y={cy + 13} fontSize="9.5" textAnchor="end" fill="#94a3b8">0</text>
                <text x={W - 4} y={cy - 8} fontSize="11" textAnchor="end" fill="#475569">{ss(adim ? "ν_Rd" : "N_Rd [kN]")}</text>
                <text x={cx + 8} y={14} fontSize="11" textAnchor="start" fill="#475569">{ss(adim ? "μ_Rd" : "M_Rd [kNm]")}</text>
                {/* campo 1 ramo M > 0 (pieno) e M < 0 (tratteggiato) */}
                {pos.curve.length > 0 && <path d={path(pos.curve)} fill="none" stroke={F1_COL} strokeWidth="2.6" />}
                {neg.curve.length > 0 && <path d={path(neg.curve)} fill="none" stroke={F1_COL} strokeWidth="2" strokeDasharray="6 4" />}
                <circle cx={sx(X(pos.pointA))} cy={sy(Y(pos.pointA))} r="4.5" fill={F1_COL} />
                <text x={sx(X(pos.pointA)) - 6} y={sy(Y(pos.pointA)) - 6} fontSize="10" textAnchor="end" fill={F1_COL} fontWeight="bold">1a</text>
                {/* campo 2 ramo M > 0 (pieno) e M < 0 (tratteggiato), retta 2/3 */}
                <path d={path(data.f2pos.curve)} fill="none" stroke={FIELD_COL[2]} strokeWidth="2.6" />
                <path d={path(data.f2neg.curve)} fill="none" stroke={FIELD_COL[2]} strokeWidth="2" strokeDasharray="6 4" />
                <circle cx={sx(X(data.f2pos.point(data.f2pos.xiH)))} cy={sy(Y(data.f2pos.point(data.f2pos.xiH)))} r="3" fill={LIM23_COL} />
                <circle cx={sx(X(data.f2neg.point(data.f2neg.xiH)))} cy={sy(Y(data.f2neg.point(data.f2neg.xiH)))} r="3" fill={LIM23_COL} />
                {/* campo 6 ramo M > 0 (pieno) e M < 0 (tratteggiato), fino a ξ → ∞ (punto di chiusura) */}
                <path d={path(data.f6pos.curve)} fill="none" stroke={FIELD_COL[6]} strokeWidth="2.6" />
                <path d={path(data.f6neg.curve)} fill="none" stroke={FIELD_COL[6]} strokeWidth="2" strokeDasharray="6 4" />
                <circle cx={sx(X(data.f6pos.point(Infinity)))} cy={sy(Y(data.f6pos.point(Infinity)))} r="3.5" fill={LIMINF_COL} />
                {[data.f6pos, data.f6neg].filter((q) => q.pureComp).map((q, i) => (
                    <circle key={`pc${i}`} cx={sx(X(q.pureComp))} cy={sy(Y(q.pureComp))} r="4" fill="none" stroke={SUB_COL} strokeWidth="1.8" />
                ))}
                {/* campo 5 ramo M > 0 (pieno) e M < 0 (tratteggiato), retta 5/6 */}
                <path d={path(data.f5pos.curve)} fill="none" stroke={FIELD_COL[5]} strokeWidth="2.6" />
                <path d={path(data.f5neg.curve)} fill="none" stroke={FIELD_COL[5]} strokeWidth="2" strokeDasharray="6 4" />
                <circle cx={sx(X(data.f5pos.point(data.f5pos.xiE)))} cy={sy(Y(data.f5pos.point(data.f5pos.xiE)))} r="3" fill={LIM56_COL} />
                <circle cx={sx(X(data.f5neg.point(data.f5neg.xiE)))} cy={sy(Y(data.f5neg.point(data.f5neg.xiE)))} r="3" fill={LIM56_COL} />
                {/* campo 4 ramo M > 0 (pieno) e M < 0 (tratteggiato), retta 4/5 */}
                <path d={path(data.f4pos.curve)} fill="none" stroke={FIELD_COL[4]} strokeWidth="2.6" />
                <path d={path(data.f4neg.curve)} fill="none" stroke={FIELD_COL[4]} strokeWidth="2" strokeDasharray="6 4" />
                <circle cx={sx(X(data.f4pos.point(1)))} cy={sy(Y(data.f4pos.point(1)))} r="3" fill={LIM45_COL} />
                <circle cx={sx(X(data.f4neg.point(1)))} cy={sy(Y(data.f4neg.point(1)))} r="3" fill={LIM45_COL} />
                {/* campo 3 ramo M > 0 (pieno) e M < 0 (tratteggiato), retta 3/4 */}
                <path d={path(data.f3pos.curve)} fill="none" stroke={FIELD_COL[3]} strokeWidth="2.6" />
                <path d={path(data.f3neg.curve)} fill="none" stroke={FIELD_COL[3]} strokeWidth="2" strokeDasharray="6 4" />
                <circle cx={sx(X(data.f3pos.point(data.f3pos.xiN)))} cy={sy(Y(data.f3pos.point(data.f3pos.xiN)))} r="3" fill={LIM34_COL} />
                <circle cx={sx(X(data.f3neg.point(data.f3neg.xiN)))} cy={sy(Y(data.f3neg.point(data.f3neg.xiN)))} r="3" fill={LIM34_COL} />
                <circle cx={sx(X(pos.point(0)))} cy={sy(Y(pos.point(0)))} r="3" fill={LIM_COL} />
                <circle cx={sx(X(neg.point(0)))} cy={sy(Y(neg.point(0)))} r="3" fill={LIM_COL} />
                {/* trazione pura M = 0 */}
                <circle cx={sx(ptN)} cy={sy(0)} r="4" fill="none" stroke={SUB_COL} strokeWidth="1.8" />
                {/* punti dei cursori dei campi aperti */}
                {locals.map((l) => (
                    <g key={l.id}>
                        <circle cx={sx(X(l.pt))} cy={sy(Y(l.pt))} r="5" fill={CUR_COL} stroke="#fff" strokeWidth="1.5" />
                        <text x={sx(X(l.pt)) + 7} y={sy(Y(l.pt)) + 12} fontSize="9" fill={CUR_COL} fontWeight="bold">{l.id}</text>
                    </g>
                ))}
                {/* punto del cursore globale */}
                {global?.pt && <rect x={sx(X(global.pt)) - 4.5} y={sy(Y(global.pt)) - 4.5} width="9" height="9" fill="none" stroke={GLB_COL} strokeWidth="2" transform={`rotate(45 ${sx(X(global.pt))} ${sy(Y(global.pt))})`} />}
            </svg>
            <div className="mt-1 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
                <span><span className="mr-1 inline-block h-1 w-5 rounded align-middle" style={{ background: F1_COL }} />Campo 1, ramo M &gt; 0</span>
                <span><span className="mr-1 inline-block w-5 border-t-2 border-dashed align-middle" style={{ borderColor: F1_COL }} />Campo 1, ramo M &lt; 0</span>
                <span><span className="mr-1 inline-block h-1 w-5 rounded align-middle" style={{ background: FIELD_COL[2] }} />Campo 2</span>
                <span><span className="mr-1 inline-block h-2 w-2 rounded-full align-middle" style={{ background: LIM_COL }} />retta limite 1/2</span>
                <span><span className="mr-1 inline-block h-2 w-2 rounded-full align-middle" style={{ background: LIM23_COL }} />retta limite 2/3</span>
                <span><span className="mr-1 inline-block h-1 w-5 rounded align-middle" style={{ background: FIELD_COL[3] }} />Campo 3</span>
                <span><span className="mr-1 inline-block h-2 w-2 rounded-full align-middle" style={{ background: LIM34_COL }} />retta limite 3/4</span>
                <span><span className="mr-1 inline-block h-1 w-5 rounded align-middle" style={{ background: FIELD_COL[4] }} />Campo 4</span>
                <span><span className="mr-1 inline-block h-2 w-2 rounded-full align-middle" style={{ background: LIM45_COL }} />retta limite 4/5</span>
                <span><span className="mr-1 inline-block h-1 w-5 rounded align-middle" style={{ background: FIELD_COL[5] }} />Campo 5</span>
                <span><span className="mr-1 inline-block h-2 w-2 rounded-full align-middle" style={{ background: LIM56_COL }} />retta limite 5/6</span>
                <span><span className="mr-1 inline-block h-1 w-5 rounded align-middle" style={{ background: FIELD_COL[6] }} />Campo 6</span>
                <span><span className="mr-1 inline-block h-2 w-2 rounded-full align-middle" style={{ background: LIMINF_COL }} />compressione uniforme (ξ → ∞)</span>
                <span><span className="mr-1 inline-block h-2 w-2 rounded-full border-2 align-middle" style={{ borderColor: SUB_COL }} />trazione / compressione pura (M = 0)</span>
                <span><span className="mr-1 inline-block h-2 w-2 rounded-full align-middle" style={{ background: CUR_COL }} />cursore del campo</span>
                <span><span className="mr-1 inline-block h-2 w-2 rotate-45 border-2 align-middle" style={{ borderColor: GLB_COL }} />cursore globale</span>
            </div>
            <p className="mt-1 text-center text-[11px] text-slate-400">N &gt; 0 compressione. Assi fissi, dimensionati sull'intero dominio: il dominio è completo (campi 1–6). Pieno: ramo M &gt; 0; tratteggiato: ramo M &lt; 0.</p>
        </div>
    );
}

function Pending({ field, data }) {
    const p = data.pos;
    const xiH = p.epsCu / (p.epsSu + p.epsCu);
    return (
        <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-500">
            <Hourglass size={16} className="mt-0.5 shrink-0 text-slate-400" />
            <div>
                <p>In attesa delle pagine degli appunti per il {field.title.toLowerCase()}.</p>
                {field.id === 2 && (
                    <div className="tex-left mt-1">
                        <Tex display>{String.raw`0\le\xi\le\xi_{2/3}=\dfrac{\varepsilon_{cu}}{\varepsilon_{su}+\varepsilon_{cu}}=\dfrac{${T(p.epsCu, 4)}}{${T(p.epsSu, 4)}+${T(p.epsCu, 4)}}=${T(xiH, 4)}`}</Tex>
                    </div>
                )}
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// primitivi UI
// ---------------------------------------------------------------------------
function XiSlider({ value, onChange, left, right, accent }) {
    return (
        <div className="flex items-center gap-3">
            <span className="w-8 text-right text-xs text-slate-500">{left}</span>
            <input type="range" min={0} max={1000} value={value} onChange={(e) => onChange(Number(e.target.value))}
                className={`w-full cursor-pointer ${accent}`} aria-label="Posizione dell'asse neutro ξ" />
            <span className="w-8 text-xs text-slate-500">{right}</span>
        </div>
    );
}
// cursore piccolo del campo, sotto il diagramma delle deformazioni
// riquadro: titolo + sottocampo, cursore con gli estremi, valori dello stato
// corrente in colonne di larghezza fissa (niente spostamenti al variare dei numeri)
function MiniXiSlider({ value, onChange, left, right, sub, items, subPrefix = "sottocampo" }) {
    return (
        <div className="w-full max-w-[300px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-slate-600">Posizione dell'asse neutro</span>
                {sub && <span className="rounded-full bg-white px-2 py-0.5 font-semibold shadow-sm" style={{ color: CUR_COL }}>{subPrefix} {sub}</span>}
            </div>
            <div className="mt-1.5 flex items-center gap-2 text-[11px] text-slate-500">
                <span className="min-w-5 shrink-0 whitespace-nowrap text-right">{left}</span>
                <input type="range" min={0} max={1000} value={value} onChange={(e) => onChange(Number(e.target.value))}
                    className="h-1 w-full cursor-pointer accent-green-600" aria-label="Posizione dell'asse neutro ξ nel campo" />
                <span className="min-w-5 shrink-0 whitespace-nowrap">{right}</span>
            </div>
            <div className="mt-1.5 space-y-0.5 border-t border-slate-200 pt-1.5 text-[11px] tabular-nums">
                {items.map((it) => (
                    <div key={it.label} className="flex items-baseline justify-between">
                        <span className="text-slate-500">{hs(it.label)}</span>
                        <span className="font-semibold" style={{ color: CUR_COL }}>{it.value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
function Accordion({ field, isOpen, onToggle, children }) {
    return (
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <button type="button" onClick={onToggle} aria-expanded={isOpen}
                className="flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3 text-left">
                <span className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white"
                        style={{ background: field.ready ? FIELD_COL[field.id] : "#cbd5e1" }}>{field.id}</span>
                    <span>
                        <span className="block text-sm font-bold text-slate-800">{field.title}</span>
                        <span className="block text-xs text-slate-500">{field.subtitle}{field.ready ? "" : " — in attesa"}</span>
                    </span>
                </span>
                <ChevronDown size={16} className={`text-slate-400 transition-transform ${isOpen ? "" : "-rotate-90"}`} />
            </button>
            <div className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                <div className="overflow-hidden" inert={!isOpen}>
                    <div className="border-t border-slate-100 px-4 py-4">{children}</div>
                </div>
            </div>
        </section>
    );
}
function Block({ n, title, children }) {
    return (
        <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">{n}. {title}</p>
            {children}
        </div>
    );
}
function Card({ title, right, children }) {
    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-sm font-bold text-slate-800">{title}</h3>
                {right}
            </div>
            {children}
        </div>
    );
}
function Segmented({ value, onChange, options, small = false }) {
    return (
        <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-0.5">
            {options.map((o) => (
                <button key={String(o.value)} type="button" onClick={() => onChange(o.value)}
                    className={`cursor-pointer rounded-full ${small ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-xs"} font-semibold transition ${value === o.value ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                    {o.label}
                </button>
            ))}
        </div>
    );
}
function NumberField({ label, unit, value, onChange }) {
    return (
        <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-500">{label}{unit && <span className="ml-1 text-slate-400">[{unit}]</span>}</span>
            <input type="number" value={value} step="any" onChange={(e) => onChange(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100" />
        </label>
    );
}
function SelectField({ label, value, onChange, options }) {
    return (
        <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-500">{label}</span>
            <select value={value} onChange={(e) => onChange(e.target.value)}
                className="w-full cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100">
                {options.map((o) => <option key={o.label} value={o.value}>{o.label}</option>)}
            </select>
        </label>
    );
}

// ---------------------------------------------------------------------------
// DISEGNO UNICO: tutti i campi (ξ da −∞ a +∞), pivot A / B / C secondo il campo
// ---------------------------------------------------------------------------
function specAll(p, F, xi) {
    const { f1, f2, f3, f4, f5, f6 } = F;
    const xiH = f2.xiH, xiN = f3.xiN, xiE = f5.xiE;
    const strainAt = (xv, depth) => {
        if (xv === -Infinity) return p.epsSu;
        if (xv === Infinity) return -EPS_C2;
        if (xv <= xiH) return (p.epsSu * (depth - xv * p.d)) / (p.d - xv * p.d);   // pivot A
        if (xv <= xiE) return (p.epsCu * (depth - xv * p.d)) / (xv * p.d);         // pivot B
        return (-EPS_C2 * (xv * p.d - depth)) / (xv * p.d - f6.t);                 // pivot C (F)
    };
    const field = xi <= 0 ? 1 : xi <= xiH ? 2 : xi <= xiN ? 3 : xi <= 1 ? 4 : xi <= xiE ? 5 : 6;
    const pivot = field <= 2
        ? { e: p.epsSu, depth: p.d, label: "A", color: AS_COL, dx: -6, dy: 4, anchor: "end" }
        : field <= 5
            ? { e: -p.epsCu, depth: 0, label: "B", color: CONC_COL, dx: 6, dy: -4, anchor: "start" }
            : { e: -EPS_C2, depth: f6.t, label: "F", color: LIMINF_COL, dx: 6, dy: 4, anchor: "start" };
    return {
        id: "all",
        range: [-Infinity, Infinity],
        xiToSlider: (xv) => (xv === -Infinity ? 0 : xv === Infinity ? 1000 : 500 * (xv / (1 + Math.abs(xv)) + 1)),
        strainAt,
        lines: [
            { xi: -Infinity, color: "#94a3b8" }, { xi: 0, color: LIM_COL }, { xi: xiH, color: LIM23_COL },
            { xi: xiN, color: LIM34_COL }, { xi: 1, color: LIM45_COL, toH: true }, { xi: xiE, color: LIM56_COL, toH: true }, { xi: Infinity, color: LIMINF_COL, toH: true },
        ],
        boundaries: [],
        bands: [
            { xi0: -Infinity, xi1: 0, color: FIELD_COL[1], op: 0.12, label: "1" },
            { xi0: 0, xi1: xiH, color: FIELD_COL[2], op: 0.12, label: "2" },
            { xi0: xiH, xi1: xiN, color: FIELD_COL[3], op: 0.12, label: "3" },
            { xi0: xiN, xi1: 1, color: FIELD_COL[4], op: 0.16, label: "4" },
            { xi0: 1, xi1: xiE, color: FIELD_COL[5], op: 0.2, label: "5", toH: true },
            { xi0: xiE, xi1: Infinity, color: FIELD_COL[6], op: 0.12, label: "6", toH: true },
        ],
        concRange: [0, p.epsCu],
        concBottom: field === 6,
        concForce: field === 6 ? (xv) => { const { psi, lam } = f6.coef(xv); return { Cc: psi * p.b * p.h * p.fcd, depth: lam * p.h }; } : undefined,
        aspRanges: [
            { key: "1", e0: f1.epsS12, e1: p.epsSu, color: FIELD_COL[1] },
            { key: "2", e0: f2.epsS23, e1: f2.epsS12, color: FIELD_COL[2] },
            { key: "3", e0: f3.epsS34, e1: f3.epsS23, color: FIELD_COL[3] },
            { key: "4", e0: f4.epsS45, e1: f4.epsS34, color: FIELD_COL[4] },
            { key: "5", e0: f5.epsS56, e1: f5.epsS45, color: FIELD_COL[5] },
            { key: "6", e0: f6.epsS56, e1: -EPS_C2, color: FIELD_COL[6] },
        ],
        asRanges: [
            { key: "3", e0: p.epsSe, e1: p.epsSu, color: FIELD_COL[3] },
            { key: "4", e0: 0, e1: p.epsSe, color: FIELD_COL[4] },
            { key: "5", e0: f5.epsAs56, e1: 0, color: FIELD_COL[5] },
            { key: "6", e0: -EPS_C2, e1: f5.epsAs56, color: FIELD_COL[6] },
        ],
        asFull: true,
        pivot,
        drag: null,       // nel disegno unico ε'_s non è monotona con ξ: si trascina l'asse neutro
        triangles: () => [],
    };
}

function AllFieldsCard({ data, branch, onBranch, slider, onSlider, mode, onMode, pt }) {
    const p = branch > 0 ? data.pos : data.neg;
    const F = branch > 0
        ? { f1: data.f1pos, f2: data.f2pos, f3: data.f3pos, f4: data.f4pos, f5: data.f5pos, f6: data.f6pos }
        : { f1: data.f1neg, f2: data.f2neg, f3: data.f3neg, f4: data.f4neg, f5: data.f5neg, f6: data.f6neg };
    const xi = sliderToXi(slider, -Infinity, Infinity);
    const spec = specAll(p, F, xi);
    const field = fieldOf(p, xi);
    const fin = Number.isFinite(xi);
    return (
        <Card title="Disegno unico: tutti i campi" right={
            <Segmented value={branch} onChange={onBranch} options={[{ value: 1, label: "Ramo M > 0" }, { value: -1, label: "Ramo M < 0" }]} />}>
            <p className="mb-3 text-xs leading-5 text-slate-600">
                L'asse neutro percorre tutta la sezione, da ξ → −∞ (trazione uniforme) a ξ → +∞ (compressione uniforme): il piano di
                deformazione ruota attorno al pivot A (campi 1–2, acciaio a ε<sub>su</sub>), B (campi 3–5, calcestruzzo a ε<sub>cu</sub>)
                e F (campo 6, ε<sub>c2</sub> a profondità t). Trascina la freccia dell'asse neutro o usa il cursore (lo stesso del dominio,
                dove il rombo segue lo stato corrente).
            </p>
            <div className="flex w-full flex-col items-center gap-3">
                <div className="flex w-full flex-wrap items-start justify-center gap-3">
                    <div className="flex justify-center">
                        <Segmented small value={mode} onChange={onMode} options={[{ value: "fields", label: "Campi" }, { value: "profile", label: "Profilo" }]} />
                    </div>
                    <MiniXiSlider value={slider} onChange={onSlider} left="−∞" right="+∞" subPrefix="campo" sub={pt ? `${field}${pt.sub && pt.sub !== String(field) ? ` · ${pt.sub}` : ""}` : String(field)} items={[
                        { label: "ξ", value: xiTxt(xi) },
                        { label: "x", value: fin ? `${fmtNum(xi * p.d, 1)} mm` : xi > 0 ? "+∞" : "−∞" },
                        { label: "ε′_s", value: `${fmtNum(spec.strainAt(xi, p.dSup) * 1000, 2)}‰` },
                        { label: "ε_s", value: `${fmtNum(spec.strainAt(xi, p.d) * 1000, 2)}‰` },
                        ...(pt ? [{ label: "N_Rd", value: `${fmtNum(pt.N, 1)} kN` }, { label: "M_Rd", value: `${fmtNum(pt.M, 2)} kNm` }] : []),
                    ]} />
                </div>
                <div className="w-full">
                    <StrainDiagramPivot p={p} xi={xi} branch={branch} mode={mode} tri="cur" onSlider={onSlider} spec={spec} />
                </div>
            </div>
        </Card>
    );
}

// blocchi di formule ridisegnati solo quando cambiano le dipendenze (deps)
const Lazy = memo(function Lazy({ render }) { return render(); },
    (a, b) => a.deps.length === b.deps.length && a.deps.every((v, i) => Object.is(v, b.deps[i])));

// campi memorizzati: si ridisegnano solo quando cambiano i loro dati o il loro stato
const FieldOneM = memo(FieldOne);
const FieldTwoM = memo(FieldTwo);
const FieldThreeM = memo(FieldThree);
const FieldFourM = memo(FieldFour);
const FieldFiveM = memo(FieldFive);
const FieldSixM = memo(FieldSix);
