// src/components/wood/WoodConnectionTool.jsx
import { useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";
import { woodConnection, DEFAULT_CONN_INPUT, FASTENER_TYPES } from "../../lib/wood/woodConnection";
import { TIMBER_CLASSES, SERVICE_CLASSES, LOAD_DURATIONS } from "../../lib/wood/woodMaterials";
import { Card, CardTitle, ResultGrid, ResultRow, BigResult, NumberField, SelectField, InfoBox, fmt } from "./kit";

export default function WoodConnectionTool() {
    const [input, setInput] = useState(DEFAULT_CONN_INPUT);
    const r = useMemo(() => woodConnection(input), [input]);
    const set = (f) => (v) => setInput((p) => ({ ...p, [f]: v }));
    const setN = (f) => (v) => setInput((p) => ({ ...p, [f]: Number(v) || 0 }));

    return (
        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
            <div className="space-y-4">
                <Card>
                    <CardTitle>Connettore</CardTitle>
                    <div className="space-y-3">
                        <SelectField label="Tipo" value={input.fastener} onChange={set("fastener")} options={FASTENER_TYPES.map((f) => ({ value: f.id, label: f.label }))} />
                        <div className="grid grid-cols-2 gap-3">
                            <NumberField label="Diametro d" unit="mm" value={input.d} onChange={setN("d")} />
                            <NumberField label="f_u,k" unit="MPa" value={input.fuk} onChange={setN("fuk")} />
                        </div>
                        <SelectField label="Sezioni di taglio" value={input.shear} onChange={set("shear")} options={[{ value: "single", label: "Singola" }, { value: "double", label: "Doppia" }]} />
                        <NumberField label="Numero connettori n" value={input.n} onChange={setN("n")} />
                    </div>
                </Card>
                <Card>
                    <CardTitle>Legno e spessori</CardTitle>
                    <div className="space-y-3">
                        <SelectField label="Classe legno" value={input.timber} onChange={set("timber")} options={TIMBER_CLASSES.map((t) => ({ value: t.id, label: t.id }))} />
                        <div className="grid grid-cols-2 gap-3">
                            <NumberField label="t₁ (laterale)" unit="mm" value={input.t1} onChange={setN("t1")} />
                            <NumberField label="t₂ (centrale)" unit="mm" value={input.t2} onChange={setN("t2")} />
                        </div>
                        <SelectField label="Classe di servizio" value={input.serviceClass} onChange={set("serviceClass")} options={SERVICE_CLASSES.map((s) => ({ value: s.id, label: s.label }))} />
                        <SelectField label="Durata del carico" value={input.duration} onChange={set("duration")} options={LOAD_DURATIONS.map((d) => ({ value: d.id, label: d.label }))} />
                    </div>
                </Card>
                <button type="button" onClick={() => setInput(DEFAULT_CONN_INPUT)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                    <RotateCcw size={15} /> Valori predefiniti
                </button>
            </div>
            <div className="space-y-4">
                {!r.ok ? <Card><ul className="list-disc pl-5 text-sm text-red-600">{r.errors.map((e) => <li key={e}>{e}</li>)}</ul></Card> : (
                    <>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <BigResult title="Capacità connettore F_v,Rd" value={fmt(r.FvRd / 1000, 2)} unit="kN" note={`modo ${r.governingMode} · ${r.planes} sez. taglio`} />
                            <BigResult title="Capacità unione (n conn.)" value={fmt(r.FtotRd / 1000, 2)} unit="kN" note={`${r.n} connettori`} />
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                            <Card>
                                <CardTitle>Parametri</CardTitle>
                                <ResultGrid>
                                    <ResultRow label="ρ_k" value={fmt(r.rhok, 0)} unit="kg/m³" />
                                    <ResultRow label="f_h,k" value={fmt(r.fh1, 2)} unit="MPa" />
                                    <ResultRow label="M_y,Rk" value={fmt(r.My, 0)} unit="N·mm" />
                                    <ResultRow label="β" value={fmt(r.beta, 2)} />
                                    <ResultRow label="k_mod" value={fmt(r.km, 2)} />
                                    <ResultRow label="γ_M" value={fmt(r.gammaM, 2)} />
                                </ResultGrid>
                            </Card>
                            <Card>
                                <CardTitle>Modi di rottura (F_v,Rk/piano)</CardTitle>
                                <ResultGrid>
                                    {Object.entries(r.modes).map(([k, v]) => (
                                        <ResultRow key={k} label={`Modo ${k}`} value={fmt(v / 1000, 2)} unit="kN" highlight={k === r.governingMode} />
                                    ))}
                                </ResultGrid>
                            </Card>
                        </div>
                        <InfoBox>
                            EC5 §8.2 (Johansen). f_h,0,k = 0,082(1−0,01d)ρ_k (preforo);
                            M_y,Rk = 0,3·f_u,k·d^2,6. F_v,Rk = minimo dei modi di rottura;
                            F_v,Rd = k_mod·F_v,Rk/γ_M. Effetto fune trascurato (a favore di
                            sicurezza); verificare distanze e interassi minimi.
                        </InfoBox>
                    </>
                )}
            </div>
        </div>
    );
}
