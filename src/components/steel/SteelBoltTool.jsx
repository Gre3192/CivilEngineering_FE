// src/components/steel/SteelBoltTool.jsx
import { useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";
import { steelBolt, DEFAULT_BOLT_INPUT } from "../../lib/steel/steelBolt";
import { STEEL_GRADES, BOLT_CLASSES, BOLT_SIZES } from "../../lib/steel/steelData";
import { Card, CardTitle, ResultGrid, ResultRow, BigResult, VerdictBanner, UtilBar, NumberField, SelectField, InfoBox, fmt } from "./kit";

export default function SteelBoltTool() {
    const [input, setInput] = useState(DEFAULT_BOLT_INPUT);
    const r = useMemo(() => steelBolt(input), [input]);
    const set = (f) => (v) => setInput((p) => ({ ...p, [f]: v }));
    const setN = (f) => (v) => setInput((p) => ({ ...p, [f]: Number(v) || 0 }));

    return (
        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
            <div className="space-y-4">
                <Card>
                    <CardTitle>Bullone</CardTitle>
                    <div className="grid grid-cols-2 gap-3">
                        <SelectField label="Diametro" value={input.d} onChange={setN("d")} options={BOLT_SIZES.map((b) => ({ value: b.d, label: `M${b.d}` }))} />
                        <SelectField label="Classe" value={input.boltClass} onChange={set("boltClass")} options={BOLT_CLASSES.map((b) => ({ value: b.id, label: b.id }))} />
                        <SelectField label="Piani di taglio" value={input.planes} onChange={setN("planes")} options={[{ value: 1, label: "1" }, { value: 2, label: "2" }]} />
                        <SelectField label="Acciaio piastra" value={input.grade} onChange={set("grade")} options={STEEL_GRADES.map((g) => ({ value: g.id, label: g.id }))} />
                        <NumberField label="Spessore t" unit="mm" value={input.t} onChange={setN("t")} />
                        <NumberField label="Gioco foro" unit="mm" value={input.clearance} onChange={setN("clearance")} />
                    </div>
                </Card>
                <Card>
                    <CardTitle>Geometria e carico</CardTitle>
                    <div className="grid grid-cols-2 gap-3">
                        <NumberField label="e₁" unit="mm" value={input.e1} onChange={setN("e1")} />
                        <NumberField label="p₁" unit="mm" value={input.p1} onChange={setN("p1")} />
                        <NumberField label="e₂" unit="mm" value={input.e2} onChange={setN("e2")} />
                        <NumberField label="p₂" unit="mm" value={input.p2} onChange={setN("p2")} />
                        <NumberField label="n° bulloni" value={input.nBolts} onChange={setN("nBolts")} />
                        <NumberField label="N_Ed" unit="kN" value={input.NEd} onChange={setN("NEd")} />
                    </div>
                </Card>
                <button type="button" onClick={() => setInput(DEFAULT_BOLT_INPUT)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                    <RotateCcw size={15} /> Valori predefiniti
                </button>
            </div>
            <div className="space-y-4">
                <VerdictBanner ok={r.verified} title={r.verified ? "Unione verificata" : "Unione NON verificata"} subtitle={`N_Ed/F_Rd = ${fmt(r.utilization * 100, 0)}% · governa ${r.governing}`} />
                <div className="grid gap-4 sm:grid-cols-2">
                    <BigResult title="Resistenza per bullone" value={fmt(r.FperBolt, 1)} unit="kN" note={`min(taglio, rifollamento) — ${r.governing}`} />
                    <BigResult title="Resistenza unione" value={fmt(r.FjointRd, 1)} unit="kN" note={`${r.nBolts} bulloni`} />
                </div>
                <Card>
                    <CardTitle>Resistenze del singolo bullone</CardTitle>
                    <ResultGrid>
                        <ResultRow label="A_s" value={fmt(r.As, 1)} unit="mm²" />
                        <ResultRow label="F_v,Rd (taglio)" value={fmt(r.FvRd, 1)} unit="kN" highlight={r.governing === "taglio"} />
                        <ResultRow label="α_b" value={fmt(r.alphaB, 3)} />
                        <ResultRow label="k₁" value={fmt(r.k1, 3)} />
                        <ResultRow label="F_b,Rd (rifollamento)" value={fmt(r.FbRd, 1)} unit="kN" highlight={r.governing === "rifollamento"} />
                        <ResultRow label="F_t,Rd (trazione)" value={fmt(r.FtRd, 1)} unit="kN" />
                    </ResultGrid>
                </Card>
                <InfoBox>
                    NTC2018 §4.2.8.1.1 / EC3 Tab. 3.4. F_v,Rd=α_v·f_ub·A_s/γ_M2 (per piano);
                    F_b,Rd=k₁·α_b·f_u·d·t/γ_M2; F_t,Rd=0,9·f_ub·A_s/γ_M2. Verificare
                    distanze minime e resistenza a punzonamento/rottura del blocco.
                </InfoBox>
            </div>
        </div>
    );
}
