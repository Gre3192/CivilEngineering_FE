// src/components/steel/SteelBucklingTool.jsx
import { useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";
import { steelBuckling, DEFAULT_BUCKLING_INPUT } from "../../lib/steel/steelBuckling";
import { STEEL_GRADES, BUCKLING_CURVES } from "../../lib/steel/steelData";
import { STEEL_PROFILES } from "../../lib/steel/steelProfiles";
import { Card, CardTitle, ResultGrid, ResultRow, VerdictBanner, UtilBar, NumberField, SelectField, InfoBox, fmt } from "./kit";

export default function SteelBucklingTool() {
    const [input, setInput] = useState(DEFAULT_BUCKLING_INPUT);
    const r = useMemo(() => steelBuckling(input), [input]);
    const set = (f) => (v) => setInput((p) => ({ ...p, [f]: v }));
    const setN = (f) => (v) => setInput((p) => ({ ...p, [f]: Number(v) || 0 }));

    return (
        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
            <div className="space-y-4">
                <Card>
                    <CardTitle>Asta compressa</CardTitle>
                    <div className="space-y-3">
                        <SelectField label="Profilo" value={input.profile} onChange={set("profile")} options={STEEL_PROFILES.map((p) => ({ value: p.id, label: p.id }))} />
                        <SelectField label="Acciaio" value={input.grade} onChange={set("grade")} options={STEEL_GRADES.map((g) => ({ value: g.id, label: g.id }))} />
                        <div className="grid grid-cols-2 gap-3">
                            <SelectField label="Asse" value={input.axis} onChange={set("axis")} options={[{ value: "y", label: "Forte (y)" }, { value: "z", label: "Debole (z)" }]} />
                            <SelectField label="Curva" value={input.curve} onChange={set("curve")} options={BUCKLING_CURVES.map((c) => ({ value: c.id, label: `Curva ${c.label} (α=${c.alpha})` }))} />
                            <NumberField label="L_cr" unit="m" value={input.Lcr} step="0.1" onChange={setN("Lcr")} />
                            <NumberField label="N_Ed" unit="kN" value={input.NEd} onChange={setN("NEd")} />
                        </div>
                    </div>
                </Card>
                <button type="button" onClick={() => setInput(DEFAULT_BUCKLING_INPUT)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                    <RotateCcw size={15} /> Valori predefiniti
                </button>
            </div>
            <div className="space-y-4">
                <VerdictBanner ok={r.verified} title={r.verified ? "Stabilità verificata" : "Stabilità NON verificata"} subtitle={`N_Ed/N_b,Rd = ${fmt(r.utilization * 100, 0)}% · χ = ${fmt(r.chi, 3)}`} />
                <Card><CardTitle>Sfruttamento</CardTitle><UtilBar label="Carico di punta (N_b,Rd)" u={r.utilization} /></Card>
                <Card>
                    <CardTitle>Instabilità</CardTitle>
                    <ResultGrid>
                        <ResultRow label="i (raggio giratore)" value={fmt(r.i, 1)} unit="mm" />
                        <ResultRow label="λ₁" value={fmt(r.lambda1, 1)} />
                        <ResultRow label="λ̄ (snellezza adim.)" value={fmt(r.lambdaBar, 3)} strong />
                        <ResultRow label="N_cr (critico)" value={fmt(r.Ncr, 0)} unit="kN" />
                        <ResultRow label="Φ" value={fmt(r.Phi, 3)} />
                        <ResultRow label="χ (riduttivo)" value={fmt(r.chi, 3)} strong />
                        <ResultRow label="N_b,Rd" value={fmt(r.NbRd, 0)} unit="kN" strong />
                    </ResultGrid>
                </Card>
                <InfoBox>
                    NTC2018 §4.2.4.1.3.1 / EC3 6.3.1. λ̄=(L_cr/i)/λ₁, λ₁=π√(E/f_yk);
                    Φ=0,5[1+α(λ̄−0,2)+λ̄²]; χ=1/(Φ+√(Φ²−λ̄²))≤1; N_b,Rd=χ·A·f_yk/γ_M1.
                    Curva e α secondo tipo di sezione e asse.
                </InfoBox>
            </div>
        </div>
    );
}
