// src/components/actions/SnowLoadTool.jsx
import { useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";
import { snowLoad, DEFAULT_SNOW_INPUT, SNOW_ZONES, SNOW_EXPOSURE } from "../../lib/actions/snowLoad";
import { Card, CardTitle, ResultGrid, ResultRow, BigResult, NumberField, SelectField, InfoBox, fmt } from "./kit";

export default function SnowLoadTool() {
    const [input, setInput] = useState(DEFAULT_SNOW_INPUT);
    const result = useMemo(() => snowLoad(input), [input]);

    const set = (f) => (v) => setInput((p) => ({ ...p, [f]: v }));
    const setN = (f) => (v) => setInput((p) => ({ ...p, [f]: Number(v) || 0 }));

    return (
        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
            <div className="space-y-4">
                <Card>
                    <CardTitle>Sito e copertura</CardTitle>
                    <div className="space-y-3">
                        <SelectField label="Zona" value={input.zone} onChange={set("zone")} options={SNOW_ZONES.map((z) => ({ value: z.id, label: z.label }))} />
                        <div className="grid grid-cols-2 gap-3">
                            <NumberField label="Altitudine a_s" unit="m" value={input.as} onChange={setN("as")} />
                            <NumberField label="Inclinazione α" unit="°" value={input.alpha} onChange={setN("alpha")} />
                        </div>
                        <SelectField label="Esposizione C_E" value={input.exposure} onChange={set("exposure")} options={SNOW_EXPOSURE.map((e) => ({ value: e.id, label: `${e.label} (${e.CE.toString().replace(".", ",")})` }))} />
                        <NumberField label="Coeff. termico C_t" value={input.Ct} step="0.1" onChange={setN("Ct")} />
                    </div>
                </Card>
                <button type="button" onClick={() => setInput(DEFAULT_SNOW_INPUT)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">
                    <RotateCcw size={15} /> Valori predefiniti
                </button>
            </div>

            <div className="space-y-4">
                <BigResult title="Carico da neve q_s" value={fmt(result.qs, 3)} unit="kN/m²" note={`q_s = μ₁ · q_sk · C_E · C_t`} />
                <Card>
                    <CardTitle>Grandezze</CardTitle>
                    <ResultGrid>
                        <ResultRow label="q_sk (al suolo)" value={fmt(result.qsk, 3)} unit="kN/m²" strong />
                        <ResultRow label="μ₁ (forma)" value={fmt(result.mu, 2)} />
                        <ResultRow label="C_E (esposizione)" value={fmt(result.CE, 2)} />
                        <ResultRow label="C_t (termico)" value={fmt(result.Ct, 2)} />
                    </ResultGrid>
                </Card>
                <InfoBox>
                    NTC2018 §3.4. q_sk da Tab. 3.4.I (zona/altitudine); μ₁ = 0,8 per
                    0≤α≤30°, poi 0,8·(60−α)/30 fino a 60°, 0 oltre. C_E da Tab. 3.4.II,
                    C_t = 1 salvo dispersioni termiche.
                </InfoBox>
            </div>
        </div>
    );
}
