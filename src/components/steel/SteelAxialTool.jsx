// src/components/steel/SteelAxialTool.jsx
import { useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";
import { steelAxial, DEFAULT_AXIAL_INPUT } from "../../lib/steel/steelAxial";
import { STEEL_GRADES } from "../../lib/steel/steelData";
import { STEEL_PROFILES } from "../../lib/steel/steelProfiles";
import { Card, CardTitle, ResultGrid, ResultRow, VerdictBanner, UtilBar, NumberField, SelectField, InfoBox, fmt } from "./kit";

export default function SteelAxialTool() {
    const [input, setInput] = useState(DEFAULT_AXIAL_INPUT);
    const r = useMemo(() => steelAxial(input), [input]);
    const set = (f) => (v) => setInput((p) => ({ ...p, [f]: v }));
    const setN = (f) => (v) => setInput((p) => ({ ...p, [f]: Number(v) || 0 }));

    return (
        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
            <div className="space-y-4">
                <Card>
                    <CardTitle>Profilo e materiale</CardTitle>
                    <div className="space-y-3">
                        <SelectField label="Profilo" value={input.profile} onChange={set("profile")} options={STEEL_PROFILES.map((p) => ({ value: p.id, label: p.id }))} />
                        <SelectField label="Acciaio" value={input.grade} onChange={set("grade")} options={STEEL_GRADES.map((g) => ({ value: g.id, label: g.id }))} />
                        <NumberField label="N_Ed (+ trazione)" unit="kN" value={input.N} onChange={setN("N")} />
                    </div>
                </Card>
                <Card>
                    <CardTitle>Fori (sezione netta, per trazione)</CardTitle>
                    <div className="grid grid-cols-3 gap-3">
                        <NumberField label="n° fori" value={input.nHoles} onChange={setN("nHoles")} />
                        <NumberField label="d foro" unit="mm" value={input.dHole} onChange={setN("dHole")} />
                        <NumberField label="t" unit="mm" value={input.tHole} step="0.1" onChange={setN("tHole")} />
                    </div>
                </Card>
                <button type="button" onClick={() => setInput(DEFAULT_AXIAL_INPUT)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                    <RotateCcw size={15} /> Valori predefiniti
                </button>
            </div>
            <div className="space-y-4">
                <VerdictBanner ok={r.verified} title={r.verified ? "Sezione verificata" : "Sezione NON verificata"} subtitle={`${r.tension ? "Trazione" : "Compressione"} — N_Ed/N_Rd = ${fmt(r.utilization * 100, 0)}%`} />
                <Card><CardTitle>Sfruttamento</CardTitle><UtilBar label={r.tension ? "Trazione (N_t,Rd)" : "Compressione (N_c,Rd)"} u={r.utilization} /></Card>
                <Card>
                    <CardTitle>Resistenze</CardTitle>
                    <ResultGrid>
                        <ResultRow label="A" value={fmt(r.A, 0)} unit="mm²" />
                        <ResultRow label="A_net" value={fmt(r.Anet, 0)} unit="mm²" />
                        <ResultRow label="N_pl,Rd (sez. lorda)" value={fmt(r.NplRd, 0)} unit="kN" />
                        <ResultRow label="N_u,Rd (sez. netta)" value={fmt(r.NuRd, 0)} unit="kN" />
                        <ResultRow label="N_t,Rd = min" value={fmt(r.NtRd, 0)} unit="kN" strong />
                        <ResultRow label="N_c,Rd (compr.)" value={fmt(r.NcRd, 0)} unit="kN" strong />
                    </ResultGrid>
                </Card>
                <InfoBox>
                    NTC2018 §4.2.4.1.2. N_pl,Rd=A·f_yk/γ_M0; N_u,Rd=0,9·A_net·f_tk/γ_M2;
                    N_c,Rd=A·f_yk/γ_M0 (classe 1-3). L'instabilità a compressione va
                    verificata con lo strumento "Instabilità".
                </InfoBox>
            </div>
        </div>
    );
}
