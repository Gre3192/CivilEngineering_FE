// src/components/steel/SteelBendingShearTool.jsx
import { useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";
import { steelBendingShear, DEFAULT_BENDING_INPUT } from "../../lib/steel/steelBendingShear";
import { STEEL_GRADES } from "../../lib/steel/steelData";
import { STEEL_PROFILES } from "../../lib/steel/steelProfiles";
import { Card, CardTitle, ResultGrid, ResultRow, VerdictBanner, UtilBar, NumberField, SelectField, InfoBox, fmt } from "./kit";

export default function SteelBendingShearTool() {
    const [input, setInput] = useState(DEFAULT_BENDING_INPUT);
    const r = useMemo(() => steelBendingShear(input), [input]);
    const set = (f) => (v) => setInput((p) => ({ ...p, [f]: v }));
    const setN = (f) => (v) => setInput((p) => ({ ...p, [f]: Number(v) || 0 }));

    return (
        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
            <div className="space-y-4">
                <Card>
                    <CardTitle>Profilo e sollecitazioni</CardTitle>
                    <div className="space-y-3">
                        <SelectField label="Profilo" value={input.profile} onChange={set("profile")} options={STEEL_PROFILES.map((p) => ({ value: p.id, label: p.id }))} />
                        <SelectField label="Acciaio" value={input.grade} onChange={set("grade")} options={STEEL_GRADES.map((g) => ({ value: g.id, label: g.id }))} />
                        <SelectField label="Classe della sezione" value={input.sectionClass} onChange={set("sectionClass")} options={[{ value: "12", label: "Classe 1-2 (plastica, W_pl)" }, { value: "3", label: "Classe 3 (elastica, W_el)" }]} />
                        <div className="grid grid-cols-2 gap-3">
                            <NumberField label="M_Ed" unit="kNm" value={input.M} onChange={setN("M")} />
                            <NumberField label="V_Ed" unit="kN" value={input.V} onChange={setN("V")} />
                        </div>
                    </div>
                </Card>
                <button type="button" onClick={() => setInput(DEFAULT_BENDING_INPUT)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                    <RotateCcw size={15} /> Valori predefiniti
                </button>
            </div>
            <div className="space-y-4">
                <VerdictBanner ok={r.verified} title={r.verified ? "Sezione verificata" : "Sezione NON verificata"} subtitle={`Sfruttamento max ${fmt(r.governing * 100, 0)}%${r.interaction ? " (interazione M-V attiva)" : ""}`} />
                <Card>
                    <CardTitle>Sfruttamenti</CardTitle>
                    <UtilBar label="Flessione (M/M_c,Rd)" u={r.uM} />
                    <UtilBar label="Taglio (V/V_pl,Rd)" u={r.uV} />
                    {r.interaction && <UtilBar label="Flessione ridotta (M/M_V,Rd)" u={r.uMV} />}
                </Card>
                <Card>
                    <CardTitle>Resistenze</CardTitle>
                    <ResultGrid>
                        <ResultRow label="W usato" value={fmt(r.W / 1e3, 0)} unit="cm³" />
                        <ResultRow label="M_c,Rd" value={fmt(r.McRd, 1)} unit="kNm" strong />
                        <ResultRow label="A_vz" value={fmt(r.Avz, 0)} unit="mm²" />
                        <ResultRow label="V_pl,Rd" value={fmt(r.VplRd, 0)} unit="kN" strong />
                        {r.interaction && <ResultRow label="ρ (rid. M-V)" value={fmt(r.rho, 3)} />}
                        {r.interaction && <ResultRow label="M_V,Rd" value={fmt(r.McRdRed, 1)} unit="kNm" />}
                    </ResultGrid>
                </Card>
                <InfoBox>
                    NTC2018 §4.2.4.1.2. M_c,Rd = W·f_yk/γ_M0 (W_pl classe 1-2, W_el classe
                    3); V_pl,Rd = A_vz·(f_yk/√3)/γ_M0. Se V_Ed &gt; 0,5·V_pl,Rd si applica
                    l'interazione M-V (riduzione della resistenza a flessione).
                </InfoBox>
            </div>
        </div>
    );
}
