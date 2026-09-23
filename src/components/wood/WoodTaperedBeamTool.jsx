// src/components/wood/WoodTaperedBeamTool.jsx
import { useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";
import { woodTaperedBeam, DEFAULT_TAPERED_INPUT } from "../../lib/wood/woodTaperedBeam";
import { TIMBER_CLASSES, SERVICE_CLASSES, LOAD_DURATIONS } from "../../lib/wood/woodMaterials";
import { Card, CardTitle, ResultGrid, ResultRow, VerdictBanner, UtilBar, NumberField, SelectField, InfoBox, fmt } from "./kit";

export default function WoodTaperedBeamTool() {
    const [input, setInput] = useState(DEFAULT_TAPERED_INPUT);
    const r = useMemo(() => woodTaperedBeam(input), [input]);
    const set = (f) => (v) => setInput((p) => ({ ...p, [f]: v }));
    const setN = (f) => (v) => setInput((p) => ({ ...p, [f]: Number(v) || 0 }));

    return (
        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
            <div className="space-y-4">
                <Card>
                    <CardTitle>Materiale e condizioni</CardTitle>
                    <div className="space-y-3">
                        <SelectField label="Classe legno" value={input.timber} onChange={set("timber")} options={TIMBER_CLASSES.map((t) => ({ value: t.id, label: t.id }))} />
                        <SelectField label="Classe di servizio" value={input.serviceClass} onChange={set("serviceClass")} options={SERVICE_CLASSES.map((s) => ({ value: s.id, label: s.label }))} />
                        <SelectField label="Durata del carico" value={input.duration} onChange={set("duration")} options={LOAD_DURATIONS.map((d) => ({ value: d.id, label: d.label }))} />
                    </div>
                </Card>
                <Card>
                    <CardTitle>Geometria e sollecitazione</CardTitle>
                    <div className="grid grid-cols-2 gap-3">
                        <NumberField label="Base b" unit="mm" value={input.b} onChange={setN("b")} />
                        <NumberField label="Altezza h" unit="mm" value={input.h} onChange={setN("h")} />
                        <NumberField label="Angolo α" unit="°" value={input.alpha} step="0.5" onChange={setN("alpha")} />
                        <NumberField label="M" unit="kNm" value={input.M} onChange={setN("M")} />
                    </div>
                    <div className="mt-3">
                        <SelectField label="Bordo inclinato" value={input.edge} onChange={set("edge")} options={[{ value: "tension", label: "Teso" }, { value: "compression", label: "Compresso" }]} />
                    </div>
                </Card>
                <button type="button" onClick={() => setInput(DEFAULT_TAPERED_INPUT)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                    <RotateCcw size={15} /> Valori predefiniti
                </button>
            </div>
            <div className="space-y-4">
                {!r.ok ? <Card><ul className="list-disc pl-5 text-sm text-red-600">{r.errors.map((e) => <li key={e}>{e}</li>)}</ul></Card> : (
                    <>
                        <VerdictBanner ok={r.verified} title={r.verified ? "Bordo inclinato verificato" : "Bordo inclinato NON verificato"} subtitle={`σ_m,α,d / (k_m,α·f_m,d) = ${fmt(r.utilization * 100, 0)}%`} />
                        <Card>
                            <CardTitle>Sfruttamento</CardTitle>
                            <UtilBar label={`Flessione al bordo inclinato (${r.edge === "tension" ? "teso" : "compresso"})`} u={r.utilization} />
                        </Card>
                        <Card>
                            <CardTitle>Grandezze</CardTitle>
                            <ResultGrid>
                                <ResultRow label="k_mod" value={fmt(r.km, 2)} />
                                <ResultRow label="k_h" value={fmt(r.kh, 3)} />
                                <ResultRow label="f_m,d" value={fmt(r.fmd, 2)} unit="MPa" />
                                <ResultRow label="tan α" value={fmt(r.tan, 3)} />
                                <ResultRow label="k_m,α" value={fmt(r.kmAlpha, 3)} strong />
                                <ResultRow label="σ_m,α,d" value={fmt(r.sigmaM, 2)} unit="MPa" />
                                <ResultRow label="Resistenza k_m,α·f_m,d" value={fmt(r.resist, 2)} unit="MPa" strong />
                            </ResultGrid>
                        </Card>
                        <InfoBox>
                            EC5 §6.4.2 — trave rastremata. σ_m,α,d = 6M/(b·h²) al bordo
                            inclinato; k_m,α ridotto secondo lembo teso/compresso. Per travi
                            a doppia rastremazione/curve va verificata anche la zona di colmo
                            (trazione ortogonale).
                        </InfoBox>
                    </>
                )}
            </div>
        </div>
    );
}
