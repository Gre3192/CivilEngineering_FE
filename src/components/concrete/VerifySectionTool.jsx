// src/components/concrete/VerifySectionTool.jsx
//
// Strumento: Verifica a pressoflessione retta (SLU) di una sezione
// rettangolare in c.a. con dominio di resistenza M-N.

import { useMemo, useState } from "react";
import { CheckCircle2, XCircle, Info, RotateCcw } from "lucide-react";
import {
    verifySection,
    DEFAULT_VERIFY_INPUT,
    FAILURE_FIELDS,
    CONCRETE_MODELS,
} from "../../lib/concrete/verifySection";
import { CONCRETE_CLASSES, STEEL_GRADES } from "../../lib/concrete/sectionDesign";

// Colori dei campi di rottura (dal violetto=trazione al rosso=compressione).
const FIELD_COLORS = {
    1: "#7c3aed",
    2: "#2563eb",
    3: "#16a34a",
    4: "#ca8a04",
    5: "#ea580c",
    6: "#dc2626",
};

function fmt(v, dec = 0) {
    if (v === undefined || v === null || Number.isNaN(v)) return "-";
    return Number(v).toLocaleString("it-IT", {
        minimumFractionDigits: dec,
        maximumFractionDigits: dec,
    });
}

export default function VerifySectionTool() {
    const [input, setInput] = useState(DEFAULT_VERIFY_INPUT);
    const [showAdvanced, setShowAdvanced] = useState(false);

    const result = useMemo(() => verifySection(input), [input]);

    function setField(field, value) {
        setInput((prev) => ({ ...prev, [field]: value }));
    }
    function setNumber(field, value) {
        const n = Number(value);
        setField(field, Number.isNaN(n) ? 0 : n);
    }
    function reset() {
        setInput(DEFAULT_VERIFY_INPUT);
    }

    return (
        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
            {/* -------- INPUT -------- */}
            <div className="space-y-4">
                <Card>
                    <CardTitle>Geometria</CardTitle>
                    <div className="grid grid-cols-2 gap-3">
                        <NumberField label="Base b" unit="mm" value={input.b} onChange={(v) => setNumber("b", v)} />
                        <NumberField label="Altezza h" unit="mm" value={input.h} onChange={(v) => setNumber("h", v)} />
                        <NumberField label="Copriferro c (teso)" unit="mm" value={input.c} onChange={(v) => setNumber("c", v)} />
                        <NumberField label="Copriferro c' (compr.)" unit="mm" value={input.cPrime} onChange={(v) => setNumber("cPrime", v)} />
                    </div>
                </Card>

                <Card>
                    <CardTitle>Armatura</CardTitle>
                    <div className="grid grid-cols-2 gap-3">
                        <NumberField label="A_s (tesa)" unit="mm²" value={input.As} onChange={(v) => setNumber("As", v)} />
                        <NumberField label="A_s' (compressa)" unit="mm²" value={input.AsPrime} onChange={(v) => setNumber("AsPrime", v)} />
                    </div>
                </Card>

                <Card>
                    <CardTitle>Sollecitazioni di progetto</CardTitle>
                    <div className="grid grid-cols-2 gap-3">
                        <NumberField label="N_Ed (compr. +)" unit="kN" value={input.NEd} onChange={(v) => setNumber("NEd", v)} />
                        <NumberField label="M_Ed" unit="kNm" value={input.MEd} onChange={(v) => setNumber("MEd", v)} />
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
                    <CardTitle>Diagramma calcestruzzo</CardTitle>
                    <SelectField
                        label="Modello costitutivo"
                        value={input.concreteModel}
                        onChange={(v) => setField("concreteModel", v)}
                        options={CONCRETE_MODELS.map((m) => ({ value: m.id, label: m.label }))}
                    />
                    {result.ok && <ConstitutiveDiagram result={result} />}
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

                        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
                            <Card>
                                <CardTitle>Dominio di resistenza M-N</CardTitle>
                                <DomainChart result={result} />
                                <FieldLegend result={result} />
                            </Card>

                            <div className="space-y-4">
                                <Card>
                                    <CardTitle>Risultati</CardTitle>
                                    <ResultGrid>
                                        <ResultRow label="M_Rd @ N_Ed" value={fmt(result.MRdAtN, 1)} unit="kNm" strong />
                                        <ResultRow label="M_Ed" value={fmt(result.MEd, 1)} unit="kNm" />
                                        <ResultRow label="M_Rd (N=0)" value={fmt(result.MRd0, 1)} unit="kNm" />
                                        <ResultRow label="M_Rd,max" value={fmt(result.MRdMax, 1)} unit="kNm" />
                                        <ResultRow label="N @ M_Rd,max" value={fmt(result.NatMmax, 0)} unit="kN" />
                                        <ResultRow label="N_Rd trazione" value={fmt(result.NRdMin, 0)} unit="kN" />
                                        <ResultRow label="N_Rd compress." value={fmt(result.NRdMax, 0)} unit="kN" />
                                    </ResultGrid>

                                    {result.failureField && (
                                        <div className="mt-3 flex items-center gap-2 rounded-xl bg-slate-50 p-3">
                                            <span
                                                className="h-3 w-3 shrink-0 rounded-full"
                                                style={{ background: FIELD_COLORS[result.failureField] }}
                                            />
                                            <span className="text-xs text-slate-600">
                                                Rottura in{" "}
                                                <b>{FAILURE_FIELDS[result.failureField].label}</b> –{" "}
                                                {FAILURE_FIELDS[result.failureField].desc}
                                            </span>
                                        </div>
                                    )}
                                </Card>

                                <Card>
                                    <CardTitle>Materiali</CardTitle>
                                    <ResultGrid>
                                        <ResultRow label="f_cd" value={fmt(result.fcd, 2)} unit="MPa" />
                                        <ResultRow label="f_yd" value={fmt(result.fyd, 2)} unit="MPa" />
                                        <ResultRow label="d" value={fmt(result.d, 0)} unit="mm" />
                                    </ResultGrid>
                                </Card>
                            </div>
                        </div>

                        <Card>
                            <CardTitle>Piani di rottura (campi)</CardTitle>
                            <p className="mb-2 text-xs text-slate-500">
                                Ventaglio dei diagrammi di deformazione ultimi:
                                i campi sono regioni piene, definite dalla rotazione
                                attorno ai pivot A (acciaio a ε_su), B (cls a ε_cu) e
                                C (cls a ε_c2). La linea marcata è il piano di rottura
                                per la sollecitazione corrente.
                            </p>
                            <RuptureFieldsDiagram result={result} />
                            <FieldLegend result={result} />
                        </Card>

                        <AssumptionsBox />
                    </>
                )}
            </div>
        </div>
    );
}

// -------- Grafico del legame costitutivo del calcestruzzo (sigma-eps) --------
function ConstitutiveDiagram({ result }) {
    const { fcd, epsCu, epsC2, epsC3, concreteModel } = result;

    const W = 300;
    const H = 150;
    const m = { l: 46, r: 14, t: 12, b: 30 };
    const iw = W - m.l - m.r;
    const ih = H - m.t - m.b;
    const epsMax = epsCu;

    const sx = (e) => m.l + (e / epsMax) * iw;
    const sy = (s) => m.t + (1 - s / fcd) * ih;

    const sigma = (e) => {
        if (concreteModel === "parabola")
            return e >= epsC2 ? fcd : fcd * (1 - Math.pow(1 - e / epsC2, 2));
        if (concreteModel === "bilinear")
            return e >= epsC3 ? fcd : (fcd * e) / epsC3;
        return fcd; // rettangolo: tensione costante (blocco equivalente)
    };

    const N = 40;
    const pts = [];
    for (let i = 0; i <= N; i++) {
        const e = (epsMax * i) / N;
        pts.push([sx(e), sy(sigma(e))]);
    }
    const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
    const area = `M${sx(0)},${sy(0)} ${line.slice(1)} L${sx(epsMax)},${sy(0)} Z`;

    const knee = concreteModel === "bilinear" ? epsC3 : concreteModel === "parabola" ? epsC2 : null;

    return (
        <div className="mt-3">
            <svg width="100%" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Legame costitutivo calcestruzzo">
                {/* assi */}
                <line x1={m.l} y1={m.t} x2={m.l} y2={m.t + ih} stroke="#cbd5e1" strokeWidth="1" />
                <line x1={m.l} y1={m.t + ih} x2={m.l + iw} y2={m.t + ih} stroke="#cbd5e1" strokeWidth="1" />

                {/* area e curva */}
                <path d={area} fill="#bae6fd" fillOpacity="0.5" />
                <path d={line} fill="none" stroke="#0284c7" strokeWidth="2" />

                {/* linea f_cd */}
                <line x1={m.l} y1={sy(fcd)} x2={m.l + iw} y2={sy(fcd)} stroke="#94a3b8" strokeWidth="0.75" strokeDasharray="3 3" />
                <text x={m.l - 4} y={sy(fcd) + 3} textAnchor="end" fontSize="9" fill="#64748b">f_cd</text>
                <text x={m.l - 4} y={sy(0) + 3} textAnchor="end" fontSize="9" fill="#94a3b8">0</text>

                {/* knee */}
                {knee && (
                    <>
                        <line x1={sx(knee)} y1={sy(fcd)} x2={sx(knee)} y2={m.t + ih} stroke="#cbd5e1" strokeWidth="0.75" strokeDasharray="2 2" />
                        <text x={sx(knee)} y={m.t + ih + 12} textAnchor="middle" fontSize="8" fill="#94a3b8">
                            {(knee * 1000).toFixed(2)}‰
                        </text>
                    </>
                )}
                <text x={sx(epsMax)} y={m.t + ih + 12} textAnchor="middle" fontSize="8" fill="#94a3b8">
                    {(epsMax * 1000).toFixed(1)}‰
                </text>
                <text x={m.l + iw / 2} y={H - 2} textAnchor="middle" fontSize="9" fill="#64748b">ε_c</text>
            </svg>
            {concreteModel === "rectangular" && (
                <p className="mt-1 text-[11px] leading-tight text-slate-400">
                    Blocco equivalente: tensione η·f_cd costante su profondità λ·x
                    (λ=0,8; η=1,0).
                </p>
            )}
        </div>
    );
}

// -------- Diagramma dei piani di rottura (campi come regioni piene) --------
function RuptureFieldsDiagram({ result }) {
    const { d, dPrime, h, yC, xAB, epsCu, epsC0, epsSu, epsYd, xDesign, failureField } = result;

    const W = 460;
    const H = 340;
    const yTop = 40;
    const yBot = 300;
    const yOf = (depth) => yTop + (depth / h) * (yBot - yTop);

    // Scala schematica delle deformazioni (compressione positiva a sinistra).
    const anchors = [
        { v: -epsSu, x: 410 },
        { v: -epsYd, x: 300 },
        { v: 0, x: 250 },
        { v: epsC0, x: 150 },
        { v: epsCu, x: 110 },
    ];
    const sEps = (v) => {
        if (v <= anchors[0].v) return anchors[0].x;
        if (v >= anchors[anchors.length - 1].v) return anchors[anchors.length - 1].x;
        for (let i = 1; i < anchors.length; i++) {
            if (v <= anchors[i].v) {
                const a = anchors[i - 1];
                const b = anchors[i];
                const t = (v - a.v) / (b.v - a.v);
                return a.x + t * (b.x - a.x);
            }
        }
        return anchors[anchors.length - 1].x;
    };

    const x0 = sEps(0);
    // Punti notevoli
    const A = { x: sEps(-epsSu), y: yOf(d) }; // pivot A
    const B = { x: sEps(epsCu), y: yOf(0) }; // pivot B
    const C = { x: sEps(epsC0), y: yOf(yC) }; // pivot C
    const topEsu = { x: sEps(-epsSu), y: yTop };
    const topZero = { x: x0, y: yTop };
    const steelYd = { x: sEps(-epsYd), y: yOf(d) };
    const steelZero = { x: x0, y: yOf(d) };
    const bottomZero = { x: x0, y: yBot };
    const topC2 = { x: sEps(epsC0), y: yTop };
    const bottomC2 = { x: sEps(epsC0), y: yBot };

    const poly = (pts) => pts.map((p) => `${p.x},${p.y}`).join(" ");

    const fields = [
        { f: 1, pts: [A, topEsu, topZero] },
        { f: 2, pts: [A, topZero, B] },
        { f: 3, pts: [B, A, steelYd] },
        { f: 4, pts: [B, steelYd, steelZero] },
        { f: 5, pts: [B, steelZero, bottomZero] },
        { f: 6, pts: [B, bottomZero, bottomC2, topC2] },
    ];

    // Linea di rottura corrente
    let designLine = null;
    let naMarker = null;
    if (xDesign !== null && xDesign !== undefined) {
        const curv =
            xDesign <= xAB
                ? epsSu / (d - xDesign)
                : xDesign <= h
                ? epsCu / xDesign
                : epsC0 / (xDesign - yC);
        const vTop = curv * xDesign;
        const vBot = curv * (xDesign - h);
        designLine = {
            x1: sEps(vTop),
            y1: yTop,
            x2: sEps(vBot),
            y2: yBot,
        };
        if (xDesign > 0 && xDesign < h) {
            naMarker = { x: x0, y: yOf(xDesign) };
        }
    }

    const refLines = [
        { v: epsCu, label: `${(epsCu * 1000).toFixed(1)}‰` },
        { v: epsC0, label: `${(epsC0 * 1000).toFixed(1)}‰` },
        { v: -epsYd, label: `${(epsYd * 1000).toFixed(2)}‰` },
        { v: -epsSu, label: `${(epsSu * 1000).toFixed(1)}‰` },
    ];

    return (
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Diagramma dei campi di rottura">
            {/* regioni dei campi */}
            {fields.map(({ f, pts }) => (
                <polygon
                    key={f}
                    points={poly(pts)}
                    fill={FIELD_COLORS[f]}
                    fillOpacity="0.18"
                    stroke={FIELD_COLORS[f]}
                    strokeOpacity="0.5"
                    strokeWidth="1"
                />
            ))}

            {/* sezione (a sinistra) */}
            <rect x="14" y={yTop} width="22" height={yBot - yTop} fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1" />
            {/* armature */}
            <circle cx="25" cy={yOf(d)} r="3" fill="#0f172a" />
            <circle cx="25" cy={yOf(dPrime)} r="3" fill="#64748b" />
            <text x="6" y={yOf(d) + 3} fontSize="9" fill="#475569">As</text>
            <text x="4" y={yOf(dPrime) + 3} fontSize="9" fill="#475569">As'</text>

            {/* riferimenti di deformazione */}
            {refLines.map((r) => {
                const x = sEps(r.v);
                return (
                    <g key={r.label + r.v}>
                        <line x1={x} y1={yTop - 6} x2={x} y2={yBot} stroke="#cbd5e1" strokeWidth="0.75" strokeDasharray="3 3" />
                        <text x={x} y={yTop - 10} textAnchor="middle" fontSize="9" fill="#94a3b8">{r.label}</text>
                    </g>
                );
            })}
            {/* asse a deformazione nulla */}
            <line x1={x0} y1={yTop - 6} x2={x0} y2={yBot} stroke="#94a3b8" strokeWidth="1" />
            <text x={x0} y={yBot + 14} textAnchor="middle" fontSize="9" fill="#64748b">ε = 0</text>
            <text x="120" y={yBot + 14} textAnchor="middle" fontSize="9" fill="#64748b">compressione</text>
            <text x="360" y={yBot + 14} textAnchor="middle" fontSize="9" fill="#64748b">trazione</text>

            {/* linea di rottura corrente */}
            {designLine && (
                <line
                    x1={designLine.x1}
                    y1={designLine.y1}
                    x2={designLine.x2}
                    y2={designLine.y2}
                    stroke={FIELD_COLORS[failureField] || "#0f172a"}
                    strokeWidth="2.5"
                    strokeDasharray="7 4"
                />
            )}
            {naMarker && (
                <circle cx={naMarker.x} cy={naMarker.y} r="4" fill="#fff" stroke={FIELD_COLORS[failureField] || "#0f172a"} strokeWidth="2" />
            )}

            {/* pivot */}
            {[{ p: A, l: "A" }, { p: B, l: "B" }, { p: C, l: "C" }].map(({ p, l }) => (
                <g key={l}>
                    <circle cx={p.x} cy={p.y} r="4" fill="#0f172a" />
                    <text x={p.x + 6} y={p.y - 6} fontSize="11" fontWeight="bold" fill="#0f172a">{l}</text>
                </g>
            ))}
        </svg>
    );
}

// -------- Verdetto --------
function VerdictBanner({ result }) {
    const ok = result.verified;
    const util = result.utilization;

    return (
        <div
            className={`flex items-center gap-4 rounded-2xl border p-4 ${
                ok ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"
            }`}
        >
            {ok ? (
                <CheckCircle2 size={28} className="shrink-0 text-emerald-600" />
            ) : (
                <XCircle size={28} className="shrink-0 text-red-600" />
            )}

            <div className="flex-1">
                <p className="text-lg font-bold text-slate-800">
                    {ok ? "Verifica soddisfatta" : "Verifica NON soddisfatta"}
                </p>
                <p className="mt-0.5 text-sm text-slate-600">
                    {result.axialInRange
                        ? `M_Ed / M_Rd = ${fmt(util, 3)} · sfruttamento ${fmt(util * 100, 0)}%`
                        : "Sforzo normale N_Ed fuori dal dominio resistente."}
                </p>
            </div>

            {result.axialInRange && (
                <div className="w-40">
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/70">
                        <div
                            className={`h-full rounded-full ${ok ? "bg-emerald-500" : "bg-red-500"}`}
                            style={{ width: `${Math.min(util * 100, 100)}%` }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

// -------- Grafico dominio M-N con regioni dei campi di rottura --------
function DomainChart({ result }) {
    const { domain, MEd, NEd, verified } = result;

    const W = 460;
    const H = 360;
    const m = { top: 20, right: 20, bottom: 40, left: 56 };
    const iw = W - m.left - m.right;
    const ih = H - m.top - m.bottom;

    // Bounds
    const Ms = domain.map((p) => p.M).concat(MEd, 0);
    const Ns = domain.map((p) => p.N).concat(NEd, 0);
    let minM = Math.min(...Ms);
    let maxM = Math.max(...Ms);
    let minN = Math.min(...Ns);
    let maxN = Math.max(...Ns);

    const padM = (maxM - minM) * 0.08 || 1;
    const padN = (maxN - minN) * 0.08 || 1;
    minM -= padM;
    maxM += padM;
    minN -= padN;
    maxN += padN;

    const sx = (M) => m.left + ((M - minM) / (maxM - minM)) * iw;
    const sy = (N) => m.top + (1 - (N - minN) / (maxN - minN)) * ih;

    const toXY = (p) => `${sx(p.M).toFixed(1)},${sy(p.N).toFixed(1)}`;

    // Path di riempimento (dominio chiuso)
    const fillPath =
        domain.map((p, i) => `${i === 0 ? "M" : "L"}${toXY(p)}`).join(" ") + " Z";

    // Contorno spezzato per campo: raggruppo punti consecutivi con stesso campo.
    const closed = [...domain, domain[0]];
    const groups = [];
    let cur = { field: closed[0].field, pts: [closed[0]] };
    for (let i = 1; i < closed.length; i++) {
        const p = closed[i];
        cur.pts.push(p);
        if (p.field !== cur.field) {
            groups.push(cur);
            cur = { field: p.field, pts: [p] };
        }
    }
    groups.push(cur);

    const px = sx(MEd);
    const py = sy(NEd);
    const zeroN = minN <= 0 && maxN >= 0 ? sy(0) : null;
    const zeroM = minM <= 0 && maxM >= 0 ? sx(0) : null;

    return (
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Dominio M-N con campi di rottura">
            {/* assi di riferimento (N=0, M=0) */}
            {zeroN !== null && (
                <line x1={m.left} y1={zeroN} x2={W - m.right} y2={zeroN} stroke="#e2e8f0" strokeWidth="1" />
            )}
            {zeroM !== null && (
                <line x1={zeroM} y1={m.top} x2={zeroM} y2={H - m.bottom} stroke="#e2e8f0" strokeWidth="1" />
            )}

            {/* riempimento neutro del dominio */}
            <path d={fillPath} fill="#f8fafc" stroke="none" />

            {/* contorno colorato per campo di rottura */}
            {groups.map((g, i) => (
                <polyline
                    key={i}
                    points={g.pts.map(toXY).join(" ")}
                    fill="none"
                    stroke={FIELD_COLORS[g.field] || "#334155"}
                    strokeWidth="3"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                />
            ))}

            {/* linea dal punto agli assi */}
            <line x1={px} y1={py} x2={zeroM ?? m.left} y2={py} stroke="#0284c7" strokeWidth="0.75" strokeDasharray="3 3" />

            {/* punto sollecitante */}
            <circle cx={px} cy={py} r="5.5" fill={verified ? "#0284c7" : "#dc2626"} stroke="#fff" strokeWidth="1.5" />
            <text x={px + 8} y={py - 8} fontSize="11" fill={verified ? "#0369a1" : "#b91c1c"} fontWeight="bold">
                ({fmt(MEd, 0)}; {fmt(NEd, 0)})
            </text>

            {/* etichette assi */}
            <text x={m.left + iw / 2} y={H - 8} textAnchor="middle" fontSize="12" fill="#475569">
                M [kNm]
            </text>
            <text x={16} y={m.top + ih / 2} textAnchor="middle" fontSize="12" fill="#475569" transform={`rotate(-90 16 ${m.top + ih / 2})`}>
                N [kN]
            </text>

            {/* tacche numeriche minime */}
            <text x={m.left} y={H - m.bottom + 14} textAnchor="middle" fontSize="10" fill="#94a3b8">
                {fmt(minM, 0)}
            </text>
            <text x={W - m.right} y={H - m.bottom + 14} textAnchor="middle" fontSize="10" fill="#94a3b8">
                {fmt(maxM, 0)}
            </text>
            <text x={m.left - 6} y={m.top + 4} textAnchor="end" fontSize="10" fill="#94a3b8">
                {fmt(maxN, 0)}
            </text>
            <text x={m.left - 6} y={H - m.bottom} textAnchor="end" fontSize="10" fill="#94a3b8">
                {fmt(minN, 0)}
            </text>
        </svg>
    );
}

// -------- Legenda dei campi di rottura --------
function FieldLegend({ result }) {
    const present = [...new Set(result.domain.map((p) => p.field))].sort();

    return (
        <div className="mt-3 grid grid-cols-1 gap-1.5 border-t border-slate-100 pt-3 sm:grid-cols-2">
            {present.map((f) => (
                <div key={f} className="flex items-center gap-2">
                    <span
                        className="h-1.5 w-5 shrink-0 rounded-full"
                        style={{ background: FIELD_COLORS[f] }}
                    />
                    <span className="text-[11px] leading-tight text-slate-500">
                        <b className="text-slate-700">{FAILURE_FIELDS[f].label}</b>{" "}
                        {FAILURE_FIELDS[f].desc}
                    </span>
                </div>
            ))}
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
                    Pressoflessione retta, SLU. Dominio M-N costruito spazzando l'asse
                    neutro nei campi di rottura (pivot A: acciaio a ε_su; B: cls a
                    ε_cu=3,5‰; C: cls a ε_c2=2‰ / ε_c3=1,75‰). Diagramma del
                    calcestruzzo selezionabile (rettangolo stress-block λ=0,8 η=1,0,
                    parabola-rettangolo o triangolo-rettangolo), non reagente a
                    trazione; acciaio elasto-plastico, Es=200 GPa. Convenzione: N&gt;0
                    compressione, M&gt;0 tende A_s. Verifica: M_Ed ≤ M_Rd(N_Ed).
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
