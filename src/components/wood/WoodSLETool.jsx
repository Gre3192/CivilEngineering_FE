// src/components/wood/WoodSLETool.jsx
import { useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";
import { woodSLE, DEFAULT_WOOD_SLE_INPUT } from "../../lib/wood/woodSLE";
import { TIMBER_CLASSES, SERVICE_CLASSES } from "../../lib/wood/woodMaterials";
import { Card, CardTitle, ResultGrid, ResultRow, VerdictBanner, UtilBar, NumberField, SelectField, InfoBox, fmt } from "./kit";

export default function WoodSLETool() {
    const [input, setInput] = useState(DEFAULT_WOOD_SLE_INPUT);
    const r = useMemo(() => woodSLE(input), [input]);
    const set = (f) => (v) => setInput((p) => ({ ...p, [f]: v }));
    const setN = (f) => (v) => setInput((p) => ({ ...p, [f]: Number(v) || 0 }));

    return (
        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
            <div className="space-y-4">
                <Card>
                    <CardTitle>Trave e materiale</CardTitle>
                    <div className="space-y-3">
                        <SelectField label="Classe legno" value={input.timber} onChange={set("timber")} options={TIMBER_CLASSES.map((t) => ({ value: t.id, label: t.id }))} />
                        <SelectField label="Classe di servizio (k_def)" value={input.serviceClass} onChange={set("serviceClass")} options={SERVICE_CLASSES.map((s) => ({ value: s.id, label: s.label }))} />
                        <div className="grid grid-cols-2 gap-3">
                            <NumberField label="Luce L" unit="m" value={input.L} step="0.1" onChange={setN("L")} />
                            <NumberField label="ψ₂" value={input.psi2} step="0.1" onChange={setN("psi2")} />
                            <NumberField label="Base b" unit="mm" value={input.b} onChange={setN("b")} />
                            <NumberField label="Altezza h" unit="mm" value={input.h} onChange={setN("h")} />
                        </div>
                    </div>
                </Card>
                <Card>
                    <CardTitle>Carichi e limiti</CardTitle>
                    <div className="grid grid-cols-2 gap-3">
                        <NumberField label="g permanente" unit="kN/m" value={input.g} step="0.1" onChange={setN("g")} />
                        <NumberField label="q variabile" unit="kN/m" value={input.q} step="0.1" onChange={setN("q")} />
                        <NumberField label="Limite w_inst = L/" value={input.limInst} onChange={setN("limInst")} />
                        <NumberField label="Limite w_fin = L/" value={input.limFin} onChange={setN("limFin")} />
                    </div>
                </Card>
                <button type="button" onClick={() => setInput(DEFAULT_WOOD_SLE_INPUT)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                    <RotateCcw size={15} /> Valori predefiniti
                </button>
            </div>
            <div className="space-y-4">
                {!r.ok ? <Card><ul className="list-disc pl-5 text-sm text-red-600">{r.errors.map((e) => <li key={e}>{e}</li>)}</ul></Card> : (
                    <>
                        <VerdictBanner ok={r.verified} title={r.verified ? "Deformabilità verificata" : "Deformabilità NON verificata"} subtitle={`w_inst=${fmt(r.wInst, 1)} mm · w_fin=${fmt(r.wFin, 1)} mm`} />
                        <Card>
                            <CardTitle>Sfruttamenti</CardTitle>
                            <UtilBar label={`w_inst ≤ L/${input.limInst} (${fmt(r.limInstMm, 1)} mm)`} u={r.uInst} />
                            <UtilBar label={`w_fin ≤ L/${input.limFin} (${fmt(r.limFinMm, 1)} mm)`} u={r.uFin} />
                        </Card>
                        <Card>
                            <CardTitle>Frecce</CardTitle>
                            <ResultGrid>
                                <ResultRow label="E₀,mean" value={fmt(r.E, 0)} unit="MPa" />
                                <ResultRow label="I" value={(r.I / 1e6).toFixed(1)} unit="·10⁶ mm⁴" />
                                <ResultRow label="k_def" value={fmt(r.kdef, 2)} />
                                <ResultRow label="w_inst (G)" value={fmt(r.wInstG, 1)} unit="mm" />
                                <ResultRow label="w_inst (Q)" value={fmt(r.wInstQ, 1)} unit="mm" />
                                <ResultRow label="w_inst totale" value={fmt(r.wInst, 1)} unit="mm" strong />
                                <ResultRow label="w_fin" value={fmt(r.wFin, 1)} unit="mm" strong />
                            </ResultGrid>
                        </Card>
                        <InfoBox>
                            NTC2018 §4.4.7 / EC5 §7.2. Trave appoggiata con carico uniforme:
                            w = 5·w·L⁴/(384·E₀,mean·I). w_fin = w_inst,G·(1+k_def) +
                            w_inst,Q·(1+ψ₂·k_def). Deformazione a taglio trascurata.
                        </InfoBox>
                    </>
                )}
            </div>
        </div>
    );
}
