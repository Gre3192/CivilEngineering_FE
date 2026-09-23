// src/components/actions/WindLoadTool.jsx
import { useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";
import { windLoad, DEFAULT_WIND_INPUT, WIND_ZONES, TERRAIN_CATEGORIES } from "../../lib/actions/windLoad";
import { Card, CardTitle, ResultGrid, ResultRow, BigResult, NumberField, SelectField, InfoBox, fmt } from "./kit";

export default function WindLoadTool() {
    const [input, setInput] = useState(DEFAULT_WIND_INPUT);
    const result = useMemo(() => windLoad(input), [input]);

    const set = (f) => (v) => setInput((p) => ({ ...p, [f]: v }));
    const setN = (f) => (v) => setInput((p) => ({ ...p, [f]: Number(v) || 0 }));

    return (
        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
            <div className="space-y-4">
                <Card>
                    <CardTitle>Sito</CardTitle>
                    <div className="space-y-3">
                        <SelectField label="Zona (Tab. 3.3.I)" value={input.zone} onChange={set("zone")} options={WIND_ZONES.map((z) => ({ value: z.id, label: z.label }))} />
                        <div className="grid grid-cols-2 gap-3">
                            <NumberField label="Altitudine a_s" unit="m" value={input.as} onChange={setN("as")} />
                            <NumberField label="Periodo ritorno T_R" unit="anni" value={input.Tr} onChange={setN("Tr")} />
                        </div>
                        <SelectField label="Categoria esposizione" value={input.terrain} onChange={set("terrain")} options={TERRAIN_CATEGORIES.map((t) => ({ value: t.id, label: t.label }))} />
                    </div>
                </Card>
                <Card>
                    <CardTitle>Quota e coefficienti</CardTitle>
                    <div className="grid grid-cols-2 gap-3">
                        <NumberField label="Quota z" unit="m" value={input.z} onChange={setN("z")} />
                        <NumberField label="c_t (topografia)" value={input.ct} step="0.1" onChange={setN("ct")} />
                        <NumberField label="c_p (pressione)" value={input.cp} step="0.1" onChange={setN("cp")} />
                        <NumberField label="c_d (dinamico)" value={input.cd} step="0.1" onChange={setN("cd")} />
                    </div>
                </Card>
                <button type="button" onClick={() => setInput(DEFAULT_WIND_INPUT)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">
                    <RotateCcw size={15} /> Valori predefiniti
                </button>
            </div>

            <div className="space-y-4">
                <BigResult title="Pressione del vento p" value={fmt(result.p, 0)} unit="N/m²" note={`= ${fmt(result.p / 1000, 3)} kN/m² · p = q_b · c_e · c_p · c_d`} />
                <div className="grid gap-4 md:grid-cols-2">
                    <Card>
                        <CardTitle>Velocità e pressione cinetica</CardTitle>
                        <ResultGrid>
                            <ResultRow label="c_a (altitudine)" value={fmt(result.ca, 3)} />
                            <ResultRow label="v_b (base)" value={fmt(result.vb, 1)} unit="m/s" />
                            <ResultRow label="c_r (ritorno)" value={fmt(result.cr, 3)} />
                            <ResultRow label="v_r (riferimento)" value={fmt(result.vr, 1)} unit="m/s" />
                            <ResultRow label="q_b" value={fmt(result.qb, 0)} unit="N/m²" strong />
                        </ResultGrid>
                    </Card>
                    <Card>
                        <CardTitle>Esposizione</CardTitle>
                        <ResultGrid>
                            <ResultRow label="k_r" value={fmt(result.kr, 2)} />
                            <ResultRow label="z₀" value={fmt(result.z0, 2)} unit="m" />
                            <ResultRow label="z_min" value={fmt(result.zmin, 0)} unit="m" />
                            <ResultRow label="z (efficace)" value={fmt(result.zEff, 1)} unit="m" />
                            <ResultRow label="c_e(z)" value={fmt(result.ce, 3)} strong />
                        </ResultGrid>
                    </Card>
                </div>
                <InfoBox>
                    NTC2018 §3.3. v_b = v_b,0·c_a; q_b = ½·ρ·v_r² (ρ=1,25 kg/m³);
                    c_e(z) = k_r²·c_t·ln(z/z₀)·[7+c_t·ln(z/z₀)] per z≥z_min;
                    p = q_b·c_e·c_p·c_d. c_p e c_d dipendono dalla forma/dinamica.
                </InfoBox>
            </div>
        </div>
    );
}
