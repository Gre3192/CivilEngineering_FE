// src/components/steel/SteelWeldTool.jsx
import { useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";
import { steelWeld, DEFAULT_WELD_INPUT } from "../../lib/steel/steelWeld";
import { STEEL_GRADES } from "../../lib/steel/steelData";
import { Card, CardTitle, ResultGrid, ResultRow, BigResult, VerdictBanner, UtilBar, NumberField, SelectField, InfoBox, fmt } from "./kit";

export default function SteelWeldTool() {
    const [input, setInput] = useState(DEFAULT_WELD_INPUT);
    const r = useMemo(() => steelWeld(input), [input]);
    const set = (f) => (v) => setInput((p) => ({ ...p, [f]: v }));
    const setN = (f) => (v) => setInput((p) => ({ ...p, [f]: Number(v) || 0 }));

    return (
        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
            <div className="space-y-4">
                <Card>
                    <CardTitle>Cordone d'angolo</CardTitle>
                    <div className="space-y-3">
                        <SelectField label="Acciaio" value={input.grade} onChange={set("grade")} options={STEEL_GRADES.map((g) => ({ value: g.id, label: g.id }))} />
                        <div className="grid grid-cols-2 gap-3">
                            <NumberField label="Sezione di gola a" unit="mm" value={input.a} step="0.5" onChange={setN("a")} />
                            <NumberField label="Lunghezza L_eff" unit="mm" value={input.L} onChange={setN("L")} />
                        </div>
                        <NumberField label="Forza applicata F" unit="kN" value={input.F} onChange={setN("F")} />
                    </div>
                </Card>
                <button type="button" onClick={() => setInput(DEFAULT_WELD_INPUT)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                    <RotateCcw size={15} /> Valori predefiniti
                </button>
            </div>
            <div className="space-y-4">
                <VerdictBanner ok={r.verified} title={r.verified ? "Saldatura verificata" : "Saldatura NON verificata"} subtitle={`F/F_w,Rd = ${fmt(r.utilization * 100, 0)}%`} />
                <BigResult title="Capacità del cordone" value={fmt(r.capacity, 1)} unit="kN" note={`F_w,Rd = ${fmt(r.FwRd, 0)} N/mm · L`} />
                <Card><CardTitle>Sfruttamento</CardTitle><UtilBar label="Cordone d'angolo (metodo semplificato)" u={r.utilization} /></Card>
                <Card>
                    <CardTitle>Grandezze</CardTitle>
                    <ResultGrid>
                        <ResultRow label="f_u (piastra)" value={fmt(r.fu, 0)} unit="MPa" />
                        <ResultRow label="β_w" value={fmt(r.betaW, 2)} />
                        <ResultRow label="f_vw,d" value={fmt(r.fvwd, 1)} unit="MPa" strong />
                        <ResultRow label="F_w,Rd (per mm)" value={fmt(r.FwRd, 0)} unit="N/mm" />
                    </ResultGrid>
                </Card>
                <InfoBox>
                    NTC2018 §4.2.8.2.4 / EC3 §4.5.3.3 (metodo semplificato). f_vw,d =
                    (f_u/√3)/(β_w·γ_M2); la resistenza per unità di lunghezza è F_w,Rd =
                    f_vw,d·a, da confrontare con la forza per unità di lunghezza qualunque
                    sia la direzione.
                </InfoBox>
            </div>
        </div>
    );
}
