// src/components/concrete/SectionDesignTool.jsx
//
// Strumento: Progetto (dimensionamento) a flessione (SLU) di una sezione
// rettangolare in c.a. — metodo degli appunti (X = 0.2593 d).

import { useMemo, useRef, useState } from "react";
import { CheckCircle2, AlertTriangle, Info, RotateCcw, ChevronDown } from "lucide-react";
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
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [showSteps, setShowSteps] = useState(false);
    const [drawUnit, setDrawUnit] = useState("mm"); // unità delle quote del disegno

    const result = useMemo(() => designSection(input), [input]);

    const setField = (f) => (v) => setInput((p) => ({ ...p, [f]: v }));
    const setNumber = (f) => (v) => setInput((p) => ({ ...p, [f]: Number(v) || 0 }));

    return (
        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
            {/* -------- INPUT -------- */}
            <div className="space-y-4">
                <CollapsibleCard title="Dati di progetto">
                    <div className="mb-3">
                        <span className="mb-1 block text-xs font-semibold text-slate-500">Fissa</span>
                        <ModeToggle value={input.mode} onChange={setField("mode")} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        {input.mode !== "fixH" && (
                            <NumberField label="Larghezza B" unit="mm" value={input.B} onChange={setNumber("B")} />
                        )}
                        {input.mode !== "fixB" && (
                            <NumberField label="Altezza h" unit="mm" value={input.h} onChange={setNumber("h")} />
                        )}
                        <NumberField label="Momento M_Ed" unit="kNm" value={input.MEd} onChange={setNumber("MEd")} />
                        {input.mode !== "fixBH" && (
                            <NumberField label="β = A's/A_s" value={input.beta} step="0.05" onChange={setNumber("beta")} />
                        )}
                        <NumberField label="Copriferro c (teso)" unit="mm" value={input.c} onChange={setNumber("c")} />
                        <NumberField label="Copriferro c' (compr.)" unit="mm" value={input.cPrime} onChange={setNumber("cPrime")} />
                    </div>
                    <p className="mt-2 text-[11px] text-slate-400">
                        {input.mode === "fixBH"
                            ? "Sezione assegnata: A's calcolata solo se necessaria (doppia armatura)."
                            : "β = 0 → semplice armatura."}
                    </p>
                </CollapsibleCard>

                <CollapsibleCard title="Materiali">
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

                <CollapsibleCard title="Barre">
                    <div className="grid grid-cols-2 gap-3">
                        <SelectField label="Diametro φ" value={input.phi} onChange={setNumber("phi")} options={BAR_DIAMETERS.map((d) => ({ value: d, label: `φ ${d}` }))} />
                        <SelectField label="Staffa φ" value={input.phiStirrup} onChange={setNumber("phiStirrup")} options={STIRRUP_DIAMETERS.map((d) => ({ value: d, label: `φ ${d}` }))} />
                    </div>
                </CollapsibleCard>

                <Card>
                    <button type="button" onClick={() => setShowAdvanced((p) => !p)} className="flex w-full items-center justify-between text-sm font-semibold text-slate-600">
                        Dettagli avanzati
                        <span className="text-xs text-slate-400">{showAdvanced ? "nascondi" : "mostra"}</span>
                    </button>
                    {showAdvanced && (
                        <div className="mt-3 grid grid-cols-2 gap-3">
                            <NumberField label="Copriferro laterale" unit="mm" value={input.cLat} onChange={setNumber("cLat")} />
                            <NumberField label="Arrotond. d" unit="mm" value={input.dRound} onChange={setNumber("dRound")} />
                            <NumberField label="α_cc" value={input.alphaCc} step="0.05" onChange={setNumber("alphaCc")} />
                            <NumberField label="γ_c" value={input.gammaC} step="0.05" onChange={setNumber("gammaC")} />
                            <NumberField label="γ_s" value={input.gammaS} step="0.05" onChange={setNumber("gammaS")} />
                        </div>
                    )}
                </Card>

                <button type="button" onClick={() => setInput(DEFAULT_INPUT)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">
                    <RotateCcw size={15} /> Valori predefiniti
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
                                    {result.errors.map((e) => <li key={e}>{e}</li>)}
                                </ul>
                            </div>
                        </div>
                    </Card>
                ) : (
                    <>
                        <div className="grid gap-4 sm:grid-cols-3">
                            {result.mode === "fixB" && (
                                <>
                                    <BigResult title="Altezza utile d" value={fmt(result.d, 0)} unit="mm" note={`richiesta ${fmt(result.dReq, 0)} mm`} />
                                    <BigResult title="Altezza h" value={fmt(result.h, 0)} unit="mm" note="= d + c" />
                                </>
                            )}
                            {result.mode === "fixH" && (
                                <>
                                    <BigResult title="Larghezza B" value={fmt(result.B, 0)} unit="mm" note={`richiesta ${fmt(result.Breq, 0)} mm`} />
                                    <BigResult title="Altezza h" value={fmt(result.h, 0)} unit="mm" note={`d = ${fmt(result.d, 0)} mm`} />
                                </>
                            )}
                            {result.mode === "fixBH" && (
                                <>
                                    <BigResult title="Sezione B × h" value={`${fmt(result.B, 0)}×${fmt(result.h, 0)}`} unit="mm" note={`x = ${fmt(result.X, 1)} mm`} />
                                    <BigResult title={result.doubleReinf ? "Doppia armatura" : "Semplice armatura"} value={result.doubleReinf ? `${result.nBarsPrime}φ${result.phi}` : "—"} note={result.doubleReinf ? `A's = ${fmt(result.AsPrimeProvided, 0)} mm²` : "A's non necessaria"} />
                                </>
                            )}
                            <BigResult title="Armatura A_s" value={fmt(result.AsAdopt, 0)} unit="mm²" note={`${result.nBars} φ ${result.phi}`} />
                        </div>

                        <Card>
                            <div className="mb-3 flex items-center justify-between gap-3">
                                <h3 className="text-sm font-bold text-slate-800">Sezione progettata</h3>
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
                            </div>
                            <div className="mx-auto max-w-[480px]">
                                <DesignDrawing result={result} B={result.B} cPrime={input.cPrime} phiStirrup={input.phiStirrup} cLat={input.cLat} mode={input.mode} unit={drawUnit} />
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
                                <ResultRow label="ψ / k_G (cls)" value={`${fmt(result.psi, 3)} / ${fmt(result.kG, 3)}`} />
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
                            <CardTitle>Armatura adottata</CardTitle>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="rounded-xl bg-sky-50 p-4">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Armatura tesa</p>
                                    <p className="mt-1 text-2xl font-bold text-slate-900">{result.nBars} φ {result.phi}</p>
                                    <p className="mt-1 text-sm text-slate-500">A_s = {fmt(result.AsProvided, 0)} mm² · sfrutt. {fmt(result.utilization * 100, 0)}%</p>
                                </div>
                                {result.AsPrime > 0 && (
                                    <div className="rounded-xl bg-sky-50 p-4">
                                        <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Armatura compressa</p>
                                        <p className="mt-1 text-2xl font-bold text-slate-900">{result.nBarsPrime} φ {result.phi}</p>
                                        <p className="mt-1 text-sm text-slate-500">A's = {fmt(result.AsPrimeProvided, 0)} mm² · ε'_s = {fmt(result.epsSc * 1000, 2)}‰</p>
                                    </div>
                                )}
                            </div>
                            <div className="mt-3 space-y-2">
                                <CheckRow ok={result.widthOk} label={`Ingombro barre: ${fmt(result.reqWidth, 0)} mm ≤ B = ${fmt(input.B, 0)} mm`} />
                                <CheckRow ok={!result.belowMin} warn label={result.belowMin ? "A_s da calcolo < A_s,min: adottato il minimo" : "A_s ≥ A_s,min"} />
                                <CheckRow ok={!result.exceedsMax} label={result.exceedsMax ? "A_s supera A_s,max (0,04·A_c)" : "A_s ≤ A_s,max"} />
                                {result.beta > 0 && (
                                    <CheckRow ok={result.comprYield} warn label={result.comprYield ? "Acciaio compresso snervato (σ'_s = f_yd)" : "Acciaio compresso NON snervato: risultato approssimato"} />
                                )}
                            </div>
                        </Card>

                        <Card>
                            <button type="button" onClick={() => setShowSteps((s) => !s)} className="flex w-full items-center justify-between text-sm font-bold text-slate-800">
                                Foglio dei passaggi di calcolo
                                <span className="text-xs font-semibold text-sky-600">{showSteps ? "nascondi" : "mostra"}</span>
                            </button>
                            {showSteps && <CalcReport result={result} input={input} />}
                        </Card>

                        <AssumptionsBox />
                    </>
                )}
            </div>
        </div>
    );
}

// -------- Foglio dei passaggi di calcolo (formule in LaTeX) --------
function CalcReport({ result, input }) {
    const r = result;
    const { beta, cPrime, c, fck, fyk, alphaCc, gammaC, gammaS, phi, phiStirrup, cLat } = input;
    const B = r.B; // larghezza effettiva (progettata o assegnata)
    const mm = "\\ \\text{mm}";
    const mm2 = "\\ \\text{mm}^2";
    const MPa = "\\ \\text{MPa}";
    const base = r.mode === "fixB" ? 6 : 5; // numero dell'ultimo step "core"
    const kGX = r.kG * r.X;
    const leverAs = r.d - kGX + r.beta * (kGX - cPrime);
    const Mx = `${T(input.MEd, 0)}\\cdot 10^6`; // M_Ed in N·mm

    return (
        <div className="mt-4 space-y-5 text-sm text-slate-700">
            <Step n="1" title="Resistenze di progetto dei materiali">
                <Eq lhs="f_{cd}" sym="\dfrac{\alpha_{cc}\,f_{ck}}{\gamma_c}" num={`\\dfrac{${T(alphaCc, 2)}\\cdot ${T(fck, 0)}}{${T(gammaC, 2)}}`} val={`${T(r.fcd, 2)}${MPa}`} />
                <Eq lhs="f_{yd}" sym="\dfrac{f_{yk}}{\gamma_s}" num={`\\dfrac{${T(fyk, 0)}}{${T(gammaS, 2)}}`} val={`${T(r.fyd, 2)}${MPa}`} />
                <Eq lhs="\varepsilon_{yd}" sym="\dfrac{f_{yd}}{E_s}" num={`\\dfrac{${T(r.fyd, 1)}}{200000}`} val={`${T(r.epsYd * 1000, 2)}\\text{‰}`} />
            </Step>

            <Step n="2" title="Posizione dell'asse neutro">
                {r.mode === "fixBH" ? (
                    <>
                        <Eq lhs="x" sym="\dfrac{\psi f_{cd}Bd-\sqrt{(\psi f_{cd}Bd)^2-4\,\psi f_{cd}Bk_G M_{Ed}}}{2\,\psi f_{cd}Bk_G}" val={`${T(r.X, 1)}${mm}`} />
                        <Eq lhs="\dfrac{x}{d}" sym={`${T(r.X / r.d, 3)}\\;${r.doubleReinf ? ">" : "\\le"}\\;\\dfrac{x_{lim}}{d}=${T(r.xiLim, 3)}`} />
                        <p className="text-xs text-slate-400">{r.doubleReinf ? "x oltre il limite di duttilità → doppia armatura." : "x entro il limite → semplice armatura."}</p>
                    </>
                ) : (
                    <>
                        <Eq lhs="\xi" sym="\dfrac{\varepsilon_{cu}}{\varepsilon_{cu}+\varepsilon_s}" num="\dfrac{3{,}5}{3{,}5+10}" val={`${T(r.xi, 4)}`} />
                        <p className="text-xs text-slate-400">ε_s = 10‰ (duttilità), ε_cu = 3,5‰ → X = ξ·d.</p>
                    </>
                )}
            </Step>

            <Step n="3" title={`Coefficienti del diagramma cls (${r.concreteModel})`}>
                <Tex display>{`\\psi=${T(r.psi, 3)}\\qquad k_G=${T(r.kG, 3)}`}</Tex>
                <p className="text-xs text-slate-400">C = ψ·b·X·f_cd, baricentro a k_G·X dal lembo compresso.</p>
            </Step>

            {/* ---- core, dipendente dalla modalità ---- */}
            {r.mode === "fixB" && (
                <>
                    <Step n="4" title="Equazione di equilibrio in A_s">
                        <Eq lhs="a_2" sym="\dfrac{(1-\beta)\,[(1-k_G\xi)+k_G\xi\beta]\,f_{yd}^2}{B\,\psi\,\xi\,f_{cd}}" val={`${T(r.coeff2, 2)}`} />
                        <Eq lhs="a_1" sym="\beta\,f_{yd}\,c'" num={`${T(beta, 2)}\\cdot ${T(r.fyd, 1)}\\cdot ${T(cPrime, 0)}`} val={`${T(r.coeff1, 0)}`} />
                        <Eq lhs="A_s" sym="\dfrac{a_1+\sqrt{a_1^2+4\,a_2 M_{Ed}}}{2\,a_2}" val={`${T(r.AsDesignRaw, 0)}${mm2}`} />
                    </Step>
                    <Step n="5" title="Altezza utile progettata">
                        <Eq lhs="d" sym="\dfrac{f_{yd}(1-\beta)}{B\,\psi\,\xi\,f_{cd}}\,A_s" num={`\\dfrac{${T(r.fyd, 1)}(1-${T(beta, 2)})}{${T(B, 0)}\\cdot ${T(r.psi, 3)}\\cdot ${T(r.xi, 4)}\\cdot ${T(r.fcd, 2)}}\\cdot ${T(r.AsDesignRaw, 0)}`} val={`${T(r.dReq, 1)}${mm}\\to ${T(r.d, 0)}${mm}`} />
                        <Eq lhs="h" sym="d+c" num={`${T(r.d, 0)}+${T(c, 0)}`} val={`${T(r.h, 0)}${mm}`} />
                        <Eq lhs="X" sym="\xi\,d" num={`${T(r.xi, 4)}\\cdot ${T(r.d, 0)}`} val={`${T(r.X, 1)}${mm}`} />
                        <Eq lhs="z" sym="d-k_G X" num={`${T(r.d, 0)}-${T(r.kG, 3)}\\cdot ${T(r.X, 1)}`} val={`${T(r.z, 1)}${mm}`} />
                    </Step>
                    <Step n="6" title="Armatura tesa (con d adottato)">
                        <Eq lhs="A_s" sym="\dfrac{M_{Ed}}{[(d-k_G X)+\beta(k_G X-c')]\,f_{yd}}" num={`\\dfrac{${Mx}}{${T(leverAs, 1)}\\cdot ${T(r.fyd, 1)}}`} val={`${T(r.As, 0)}${mm2}`} />
                        {beta > 0 && <Eq lhs="A_s'" sym="\beta\,A_s" num={`${T(beta, 2)}\\cdot ${T(r.As, 0)}`} val={`${T(r.AsPrime, 0)}${mm2}`} />}
                    </Step>
                </>
            )}

            {r.mode === "fixH" && (
                <>
                    <Step n="4" title="Geometria (altezza assegnata)">
                        <Eq lhs="d" sym="h-c" num={`${T(r.h, 0)}-${T(c, 0)}`} val={`${T(r.d, 0)}${mm}`} />
                        <Eq lhs="X" sym="\xi\,d" num={`${T(r.xi, 4)}\\cdot ${T(r.d, 0)}`} val={`${T(r.X, 1)}${mm}`} />
                        <Eq lhs="z" sym="d-k_G X" num={`${T(r.d, 0)}-${T(r.kG, 3)}\\cdot ${T(r.X, 1)}`} val={`${T(r.z, 1)}${mm}`} />
                    </Step>
                    <Step n="5" title="Armatura e larghezza progettata">
                        <Eq lhs="A_s" sym="\dfrac{M_{Ed}}{[(d-k_G X)+\beta(k_G X-c')]\,f_{yd}}" num={`\\dfrac{${Mx}}{${T(leverAs, 1)}\\cdot ${T(r.fyd, 1)}}`} val={`${T(r.As, 0)}${mm2}`} />
                        <Eq lhs="B" sym="\dfrac{A_s f_{yd}(1-\beta)}{\psi\,\xi\,d\,f_{cd}}" num={`\\dfrac{${T(r.As, 0)}\\cdot ${T(r.fyd, 1)}(1-${T(beta, 2)})}{${T(r.psi, 3)}\\cdot ${T(r.xi, 4)}\\cdot ${T(r.d, 0)}\\cdot ${T(r.fcd, 2)}}`} val={`${T(r.Breq, 1)}${mm}\\to ${T(r.B, 0)}${mm}`} />
                        {beta > 0 && <Eq lhs="A_s'" sym="\beta\,A_s" num={`${T(beta, 2)}\\cdot ${T(r.As, 0)}`} val={`${T(r.AsPrime, 0)}${mm2}`} />}
                    </Step>
                </>
            )}

            {r.mode === "fixBH" && (
                <>
                    <Step n="4" title="Geometria (sezione assegnata)">
                        <Eq lhs="d" sym="h-c" num={`${T(r.h, 0)}-${T(c, 0)}`} val={`${T(r.d, 0)}${mm}`} />
                        <Eq lhs="z" sym="d-k_G x" num={`${T(r.d, 0)}-${T(r.kG, 3)}\\cdot ${T(r.X, 1)}`} val={`${T(r.z, 1)}${mm}`} />
                    </Step>
                    <Step n="5" title={r.doubleReinf ? "Armatura (doppia)" : "Armatura (semplice)"}>
                        {!r.doubleReinf && <Eq lhs="A_s" sym="\dfrac{\psi f_{cd} B x}{f_{yd}}" num={`\\dfrac{${T(r.psi, 3)}\\cdot ${T(r.fcd, 2)}\\cdot ${T(B, 0)}\\cdot ${T(r.X, 1)}}{${T(r.fyd, 1)}}`} val={`${T(r.As, 0)}${mm2}`} />}
                        {r.doubleReinf && <Eq lhs="M_1" sym="\psi f_{cd} B x (d-k_G x)" val={`${T(r.M1 / 1e6, 1)}\\ \\text{kNm}`} />}
                        {r.doubleReinf && <Eq lhs="M_2" sym="M_{Ed}-M_1" num={`${T(input.MEd, 0)}-${T(r.M1 / 1e6, 1)}`} val={`${T(r.M2 / 1e6, 1)}\\ \\text{kNm}`} />}
                        {r.doubleReinf && <Eq lhs="\varepsilon_s'" sym="\varepsilon_{cu}\Big(1-\dfrac{c'}{x}\Big)" num={`3{,}5\\big(1-${T(cPrime, 0)}/${T(r.X, 1)}\\big)`} val={`${T(r.epsSc * 1000, 2)}\\text{‰}\\Rightarrow\\sigma_s'=${T(r.sigmaSc, 1)}${MPa}`} />}
                        {r.doubleReinf && <Eq lhs="A_s'" sym="\dfrac{M_2}{\sigma_s'(d-c')}" num={`\\dfrac{${T(r.M2 / 1e6, 1)}\\cdot 10^6}{${T(r.sigmaSc, 1)}\\cdot (${T(r.d, 0)}-${T(cPrime, 0)})}`} val={`${T(r.AsPrime, 0)}${mm2}`} />}
                        {r.doubleReinf && <Eq lhs="A_s" sym="\dfrac{\psi f_{cd} B x}{f_{yd}}+\dfrac{M_2}{f_{yd}(d-c')}" val={`${T(r.As, 0)}${mm2}`} />}
                    </Step>
                </>
            )}

            <Step n={base + 1} title="Armature limite (NTC2018 §4.1.6.1.1)">
                <Eq lhs="A_{s,min}" sym="\max\!\Big(0{,}26\tfrac{f_{ctm}}{f_{yk}}Bd,\;0{,}0013\,Bd\Big)" num={`\\max\\!\\Big(0{,}26\\tfrac{${T(r.fctm, 2)}}{${T(fyk, 0)}}\\cdot ${T(B, 0)}\\cdot ${T(r.d, 0)},\\;0{,}0013\\cdot ${T(B, 0)}\\cdot ${T(r.d, 0)}\\Big)`} val={`${T(r.AsMin, 0)}${mm2}`} />
                <Eq lhs="A_{s,max}" sym="0{,}04\,B\,h" num={`0{,}04\\cdot ${T(B, 0)}\\cdot ${T(r.h, 0)}`} val={`${T(r.AsMax, 0)}${mm2}`} />
                <Eq lhs="A_{s,ad}" sym="\max(A_s,\,A_{s,min})" val={`${T(r.AsAdopt, 0)}${mm2}`} />
            </Step>

            <Step n={base + 2} title="Scelta delle barre">
                <Eq lhs="A_\phi" sym="\dfrac{\pi\phi^2}{4}" num={`\\dfrac{\\pi\\cdot ${T(phi, 0)}^2}{4}`} val={`${T(r.areaPhi, 1)}${mm2}`} />
                <Eq lhs="n" sym="\left\lceil\dfrac{A_{s,ad}}{A_\phi}\right\rceil" num={`\\left\\lceil\\dfrac{${T(r.AsAdopt, 0)}}{${T(r.areaPhi, 1)}}\\right\\rceil`} val={`${r.nBars}\\Rightarrow ${r.nBars}\\,\\phi${phi}`} />
                <Eq lhs="A_{s,prov}" sym="n\,A_\phi" num={`${r.nBars}\\cdot ${T(r.areaPhi, 1)}`} val={`${T(r.AsProvided, 0)}${mm2}`} />
            </Step>

            <Step n={base + 3} title="Verifica ingombro in larghezza">
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
    return (
        <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1">
            {DESIGN_MODES.map((m) => {
                const active = value === m.id;
                return (
                    <button
                        key={m.id}
                        type="button"
                        onClick={() => onChange(m.id)}
                        title={m.label}
                        className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition ${
                            active ? "bg-sky-600 text-white shadow-sm" : "text-slate-600 hover:bg-white"
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

function DesignDrawing({ result, B, cPrime, phiStirrup = 8, cLat = 30, mode = "fixB", unit = "mm" }) {
    const { h, d, X, phi, nBars, nBarsPrime, beta } = result;
    const cP = cPrime ?? 40;
    const c = h - d; // copriferro all'asse arm. tesa (dal lembo teso)

    // Colore delle quote B/h: grigio = dato di input, nero = valore calcolato.
    // fixB → B input, h calcolata; fixH → h input, B calcolata; fixBH → entrambe input.
    const INPUT_COLOR = "#0f172a"; // nero
    const CALC_COLOR = "#94a3b8"; // grigino
    const bColor = mode === "fixH" ? CALC_COLOR : INPUT_COLOR;
    const hColor = mode === "fixB" ? CALC_COLOR : INPUT_COLOR;

    // Comandi di visibilità (staffa / armature / quote)
    const [show, setShow] = useState({ stirrup: true, bars: true, dims: true });
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
    const mB = 58;
    const availW = BOX_W - mL - mR;
    const availH = BOX_H - mT - mB;

    // Scala che fa entrare la sezione (B x h) nell'area mantenendo le proporzioni
    const scale = Math.min(availW / B, availH / h);
    const w = B * scale;
    const ht = h * scale;
    const secLeft = mL + (availW - w) / 2;
    const secTop = mT + (availH - ht) / 2;
    const secRight = secLeft + w;
    const yOf = (depth) => secTop + depth * scale;

    // Posizione orizzontale delle barre: l'asse delle barre d'angolo è a
    // (cLat + phi_st + phi/2) dal bordo, così poggiano dentro la staffa.
    const lat = Math.min(cLat + phiStirrup + phi / 2, B / 2 - phi / 2); // asse barra d'angolo dal bordo [mm]
    const barsAt = (n, depthY) => {
        const arr = [];
        for (let i = 0; i < n; i++) {
            const pos = n === 1 ? B / 2 : lat + ((B - 2 * lat) * i) / (n - 1);
            arr.push({ x: secLeft + pos * scale, y: yOf(depthY) });
        }
        return arr;
    };
    const barR = Math.max(2.5, (phi * scale) / 2);
    const tensionBars = barsAt(nBars, d);
    const comprBars = beta > 0 ? barsAt(nBarsPrime, cP) : [];

    // Staffa TANGENTE alle armature: l'asse della staffa è distante
    // (phi/2 + phi_st/2) dall'asse delle barre, così la faccia interna tocca
    // le barre. Lati sx/dx tangenti alle barre d'angolo; lato inferiore
    // tangente alle barre tese; lato superiore tangente alle barre compresse
    // (se presenti), altrimenti al copriferro laterale.
    const off = phi / 2 + phiStirrup / 2; // distanza asse staffa - asse barra [mm]
    const xLeftA = lat - off; // = cLat + phi_st/2 (asse staffa dal bordo sx)
    const xRightA = B - lat + off;
    const yBotA = Math.min(d + off, h - (cLat + phiStirrup / 2)); // depth asse inferiore
    const yTopA = beta > 0 ? Math.max(cP - off, cLat + phiStirrup / 2) : cLat + phiStirrup / 2;
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
                <Toggle k="dims" label="Quote" color="#64748b" />
            </div>

            <svg width="100%" viewBox={`0 0 ${BOX_W} ${BOX_H}`} role="img" aria-label="Sezione progettata quotata">
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

                {/* barre */}
                {show.bars && tensionBars.map((b, i) => <circle key={`t${i}`} cx={b.x} cy={b.y} r={barR} fill="#0f172a" />)}
                {show.bars && comprBars.map((b, i) => <circle key={`c${i}`} cx={b.x} cy={b.y} r={barR} fill="#64748b" />)}

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
                {showStirrup && (
                    <text x={secLeft + w / 2} y={secTop + ht + 52} textAnchor="middle" fontSize="10" fill="#dc2626">
                        staffa φ{fmt(phiStirrup, 0)} (c = {fmtU(cLat)} {unit})
                    </text>
                )}
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

function CheckRow({ ok, label, warn }) {
    return (
        <div className="flex items-start gap-2 text-sm">
            {ok ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" /> : <AlertTriangle size={16} className={`mt-0.5 shrink-0 ${warn ? "text-amber-500" : "text-red-500"}`} />}
            <span className="text-slate-600">{label}</span>
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
                    SLU, flessione semplice. Si fissa X = ξ·d con ξ = ε_cu/(ε_cu+ε_s) =
                    0,2593 (acciaio a 10‰, cls a 3,5‰). La risultante del cls è
                    C = ψ·b·X·f_cd con baricentro a k_G·X dal lembo compresso; ψ e k_G
                    dipendono dal diagramma scelto (rettangolo 0,80/0,40;
                    parabola-rettangolo 0,81/0,416; triangolo-rettangolo 0,75/0,389).
                    Equilibrio a traslazione e rotazione → altezza utile d e armatura
                    A_s (A's = β·A_s); si adotta d arrotondato, si ricalcola A_s e si
                    sceglie il numero di barre verificando l'ingombro in larghezza.
                </p>
            </div>
        </div>
    );
}

// -------- primitivi UI --------
function Card({ children }) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">{children}</div>;
}
function CollapsibleCard({ title, children }) {
    const [isOpen, setIsOpen] = useState(true);
    const [contentHeight, setContentHeight] = useState("auto");
    const contentRef = useRef(null);
    const toggle = () => {
        const height = contentRef.current?.scrollHeight ?? 0;
        if (isOpen) {
            setContentHeight(`${height}px`);
            requestAnimationFrame(() => setContentHeight("0px"));
        } else {
            setContentHeight(`${height}px`);
            setIsOpen(true);
        }
        if (isOpen) setIsOpen(false);
    };
    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <button type="button" aria-expanded={isOpen} onClick={toggle}
                className="flex w-full items-center justify-between text-left text-sm font-bold text-slate-800">
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
function CardTitle({ children }) {
    return <h3 className="mb-3 text-sm font-bold text-slate-800">{children}</h3>;
}
function BigResult({ title, value, unit, note }) {
    return (
        <div className="rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 to-white p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">{title}</p>
            <div className="mt-1 flex items-end gap-2">
                <span className="text-3xl font-bold text-slate-900">{value}</span>
                {unit && <span className="mb-1 text-base font-semibold text-slate-400">{unit}</span>}
            </div>
            {note && <p className="mt-1 text-sm text-slate-500">{note}</p>}
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
                {label}{unit && <span className="ml-1 text-slate-400">[{unit}]</span>}
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
