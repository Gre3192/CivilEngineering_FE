// src/components/wood/WoodSLUTool.jsx
import { useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";
import { woodSLU, DEFAULT_WOOD_SLU_INPUT } from "../../lib/wood/woodSLU";
import { TIMBER_CLASSES, SERVICE_CLASSES, LOAD_DURATIONS } from "../../lib/wood/woodMaterials";
import { Card, CardTitle, ResultGrid, ResultRow, VerdictBanner, UtilBar, NumberField, SelectField, InfoBox, fmt } from "./kit";

export default function WoodSLUTool() {
    const [input, setInput] = useState(DEFAULT_WOOD_SLU_INPUT);
    const r = useMemo(() => woodSLU(input), [input]);
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
                    <CardTitle>Sezione e sollecitazioni</CardTitle>
                    <div className="grid grid-cols-2 gap-3">
                        <NumberField label="Base b" unit="mm" value={input.b} onChange={setN("b")} />
                        <NumberField label="Altezza h" unit="mm" value={input.h} onChange={setN("h")} />
                        <NumberField label="N (+ trazione)" unit="kN" value={input.N} onChange={setN("N")} />
                        <NumberField label="M" unit="kNm" value={input.M} onChange={setN("M")} />
                        <NumberField label="V" unit="kN" value={input.V} onChange={setN("V")} />
                    </div>
                </Card>
                <button type="button" onClick={() => setInput(DEFAULT_WOOD_SLU_INPUT)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                    <RotateCcw size={15} /> Valori predefiniti
                </button>
            </div>
            <div className="space-y-4">
                {!r.ok ? <Card><ul className="list-disc pl-5 text-sm text-red-600">{r.errors.map((e) => <li key={e}>{e}</li>)}</ul></Card> : (
                    <>
                        <VerdictBanner ok={r.verified} title={r.verified ? "Verifiche SLU soddisfatte" : "Verifica SLU NON soddisfatta"} subtitle={`Governa: ${r.governing.label} — ${fmt(r.governing.u * 100, 0)}%`} />
                        <Card>
                            <CardTitle>Sfruttamenti</CardTitle>
                            {r.checks.map((c) => <UtilBar key={c.key} label={c.label} u={c.u} />)}
                        </Card>
                        <div className="grid gap-4 md:grid-cols-2">
                            <Card>
                                <CardTitle>Resistenze di progetto</CardTitle>
                                <ResultGrid>
                                    <ResultRow label="k_mod" value={fmt(r.km, 2)} />
                                    <ResultRow label="γ_M" value={fmt(r.gM, 2)} />
                                    <ResultRow label="k_h" value={fmt(r.kh, 3)} />
                                    <ResultRow label="f_m,d" value={fmt(r.fmd, 2)} unit="MPa" />
                                    <ResultRow label="f_t,0,d" value={fmt(r.ft0d, 2)} unit="MPa" />
                                    <ResultRow label="f_c,0,d" value={fmt(r.fc0d, 2)} unit="MPa" />
                                    <ResultRow label="f_v,d" value={fmt(r.fvd, 2)} unit="MPa" />
                                </ResultGrid>
                            </Card>
                            <Card>
                                <CardTitle>Tensioni</CardTitle>
                                <ResultGrid>
                                    <ResultRow label="σ_m,d" value={fmt(r.sigmaM, 2)} unit="MPa" />
                                    <ResultRow label="σ_t,0,d" value={fmt(r.sigmaT0, 2)} unit="MPa" />
                                    <ResultRow label="σ_c,0,d" value={fmt(r.sigmaC0, 2)} unit="MPa" />
                                    <ResultRow label="τ_d" value={fmt(r.tau, 2)} unit="MPa" />
                                </ResultGrid>
                            </Card>
                        </div>
                        <InfoBox>
                            NTC2018 §4.4.8 / EC5 §6.1–6.2. X_d = k_mod·X_k/γ_M. Flessione con
                            k_h; taglio con τ_d=1,5·V/(k_cr·b·h) (k_cr=0,67); combinate 6.2.3
                            (tenso-flessione) e 6.2.4 (presso-flessione). Instabilità esclusa.
                        </InfoBox>
                    </>
                )}
            </div>
        </div>
    );
}
