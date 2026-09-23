// src/components/wood/WoodNotchBearingTool.jsx
import { useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";
import { woodNotchBearing, DEFAULT_NOTCH_INPUT } from "../../lib/wood/woodNotchBearing";
import { TIMBER_CLASSES, SERVICE_CLASSES, LOAD_DURATIONS } from "../../lib/wood/woodMaterials";
import { Card, CardTitle, ResultGrid, ResultRow, VerdictBanner, UtilBar, NumberField, SelectField, InfoBox, fmt } from "./kit";

export default function WoodNotchBearingTool() {
    const [input, setInput] = useState(DEFAULT_NOTCH_INPUT);
    const r = useMemo(() => woodNotchBearing(input), [input]);
    const set = (f) => (v) => setInput((p) => ({ ...p, [f]: v }));
    const setN = (f) => (v) => setInput((p) => ({ ...p, [f]: Number(v) || 0 }));

    return (
        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
            <div className="space-y-4">
                <Card>
                    <CardTitle>Materiale e sezione</CardTitle>
                    <div className="space-y-3">
                        <SelectField label="Classe legno" value={input.timber} onChange={set("timber")} options={TIMBER_CLASSES.map((t) => ({ value: t.id, label: t.id }))} />
                        <div className="grid grid-cols-2 gap-3">
                            <SelectField label="Classe servizio" value={input.serviceClass} onChange={set("serviceClass")} options={SERVICE_CLASSES.map((s) => ({ value: s.id, label: `Classe ${s.id}` }))} />
                            <SelectField label="Durata" value={input.duration} onChange={set("duration")} options={LOAD_DURATIONS.map((d) => ({ value: d.id, label: d.label }))} />
                            <NumberField label="Base b" unit="mm" value={input.b} onChange={setN("b")} />
                            <NumberField label="Altezza h" unit="mm" value={input.h} onChange={setN("h")} />
                        </div>
                    </div>
                </Card>
                <Card>
                    <CardTitle>Intaglio</CardTitle>
                    <div className="grid grid-cols-2 gap-3">
                        <NumberField label="Taglio V" unit="kN" value={input.V} onChange={setN("V")} />
                        <SelectField label="Lato intaglio" value={input.notchSide} onChange={set("notchSide")} options={[{ value: "bottom", label: "Lato appoggio" }, { value: "top", label: "Lato opposto" }]} />
                        <NumberField label="h_ef" unit="mm" value={input.hef} onChange={setN("hef")} />
                        <NumberField label="x (reazione-spigolo)" unit="mm" value={input.x} onChange={setN("x")} />
                        <NumberField label="i (inclinazione)" unit="mm" value={input.i} onChange={setN("i")} />
                    </div>
                </Card>
                <Card>
                    <CardTitle>Appoggio (compr. ⟂)</CardTitle>
                    <div className="grid grid-cols-2 gap-3">
                        <NumberField label="F_c,90" unit="kN" value={input.Fc90} onChange={setN("Fc90")} />
                        <NumberField label="Lungh. appoggio ℓ" unit="mm" value={input.lBear} onChange={setN("lBear")} />
                        <NumberField label="k_c,90" value={input.kc90} step="0.05" onChange={setN("kc90")} />
                    </div>
                </Card>
                <button type="button" onClick={() => setInput(DEFAULT_NOTCH_INPUT)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                    <RotateCcw size={15} /> Valori predefiniti
                </button>
            </div>
            <div className="space-y-4">
                {!r.ok ? <Card><ul className="list-disc pl-5 text-sm text-red-600">{r.errors.map((e) => <li key={e}>{e}</li>)}</ul></Card> : (
                    <>
                        <VerdictBanner ok={r.verified} title={r.verified ? "Intaglio e appoggio verificati" : "Verifica NON soddisfatta"} subtitle={`Intaglio ${fmt(r.uNotch * 100, 0)}% · Appoggio ${fmt(r.uBearing * 100, 0)}%`} />
                        <Card>
                            <CardTitle>Sfruttamenti</CardTitle>
                            <UtilBar label="Taglio all'intaglio (τ_d ≤ k_v·f_v,d)" u={r.uNotch} />
                            <UtilBar label="Compressione all'appoggio (σ_c,90,d ≤ k_c,90·f_c,90,d)" u={r.uBearing} />
                        </Card>
                        <div className="grid gap-4 md:grid-cols-2">
                            <Card>
                                <CardTitle>Intaglio</CardTitle>
                                <ResultGrid>
                                    <ResultRow label="k_n" value={fmt(r.kn, 1)} />
                                    <ResultRow label="α = h_ef/h" value={fmt(r.alpha, 3)} />
                                    <ResultRow label="k_v" value={fmt(r.kv, 3)} strong />
                                    <ResultRow label="τ_d" value={fmt(r.tau, 2)} unit="MPa" />
                                    <ResultRow label="k_v·f_v,d" value={fmt(r.tauRes, 2)} unit="MPa" />
                                </ResultGrid>
                            </Card>
                            <Card>
                                <CardTitle>Appoggio</CardTitle>
                                <ResultGrid>
                                    <ResultRow label="f_c,90,d" value={fmt(r.fc90d, 2)} unit="MPa" />
                                    <ResultRow label="σ_c,90,d" value={fmt(r.sigmaC90, 2)} unit="MPa" />
                                    <ResultRow label="k_c,90·f_c,90,d" value={fmt(r.c90Res, 2)} unit="MPa" strong />
                                </ResultGrid>
                            </Card>
                        </div>
                        <InfoBox>
                            EC5 §6.5.2 (intaglio) e §6.1.5 (compressione ortogonale). Intaglio
                            lato appoggio: τ_d=1,5·V/(b·h_ef) ≤ k_v·f_v,d con k_v ridotto
                            (k_n=5 massiccio, 6,5 lamellare). Appoggio: σ_c,90,d ≤ k_c,90·f_c,90,d.
                        </InfoBox>
                    </>
                )}
            </div>
        </div>
    );
}
