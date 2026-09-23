// src/components/actions/LoadAnalysisTool.jsx
import { useMemo, useState } from "react";
import { Plus, Trash2, RotateCcw } from "lucide-react";
import { USE_CATEGORIES, getCategory } from "../../lib/actions/loadData";
import { Card, CardTitle, ResultGrid, ResultRow, BigResult, SelectField, InfoBox, fmt } from "./kit";

const DEFAULT = {
    layers: [
        { name: "Soletta c.a.", s: 0.24, gamma: 25 },
        { name: "Massetto", s: 0.06, gamma: 20 },
        { name: "Pavimento", s: 0.02, gamma: 24 },
    ],
    extraG: [
        { name: "Tramezzi", q: 1.2 },
        { name: "Intonaco + impianti", q: 0.5 },
    ],
    category: "A",
};

export default function LoadAnalysisTool() {
    const [st, setSt] = useState(DEFAULT);

    const totals = useMemo(() => {
        const G1 = st.layers.reduce((s, l) => s + (Number(l.s) || 0) * (Number(l.gamma) || 0), 0);
        const G2 = st.extraG.reduce((s, e) => s + (Number(e.q) || 0), 0);
        const cat = getCategory(st.category);
        return { G1, G2, Gtot: G1 + G2, cat };
    }, [st]);

    function updLayer(i, field, value) {
        setSt((p) => ({ ...p, layers: p.layers.map((l, j) => (j === i ? { ...l, [field]: value } : l)) }));
    }
    function updExtra(i, field, value) {
        setSt((p) => ({ ...p, extraG: p.extraG.map((e, j) => (j === i ? { ...e, [field]: value } : e)) }));
    }

    return (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <div className="space-y-4">
                <Card>
                    <div className="mb-3 flex items-center justify-between">
                        <CardTitle>Stratigrafia (permanenti strutturali G₁)</CardTitle>
                        <IconBtn onClick={() => setSt((p) => ({ ...p, layers: [...p.layers, { name: "Strato", s: 0.05, gamma: 20 }] }))}><Plus size={15} /></IconBtn>
                    </div>
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-xs text-slate-400">
                                <th className="pb-1">Strato</th>
                                <th className="pb-1 w-24">s [m]</th>
                                <th className="pb-1 w-28">γ [kN/m³]</th>
                                <th className="pb-1 w-24 text-right">g [kN/m²]</th>
                                <th className="w-8" />
                            </tr>
                        </thead>
                        <tbody>
                            {st.layers.map((l, i) => (
                                <tr key={i} className="border-t border-slate-100">
                                    <td className="py-1"><Inp value={l.name} onChange={(v) => updLayer(i, "name", v)} /></td>
                                    <td><Inp type="number" value={l.s} onChange={(v) => updLayer(i, "s", v)} /></td>
                                    <td><Inp type="number" value={l.gamma} onChange={(v) => updLayer(i, "gamma", v)} /></td>
                                    <td className="text-right font-semibold tabular-nums text-slate-700">{fmt((Number(l.s) || 0) * (Number(l.gamma) || 0), 2)}</td>
                                    <td className="text-right"><IconBtn danger onClick={() => setSt((p) => ({ ...p, layers: p.layers.filter((_, j) => j !== i) }))}><Trash2 size={14} /></IconBtn></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </Card>

                <Card>
                    <div className="mb-3 flex items-center justify-between">
                        <CardTitle>Permanenti non strutturali G₂ [kN/m²]</CardTitle>
                        <IconBtn onClick={() => setSt((p) => ({ ...p, extraG: [...p.extraG, { name: "Carico", q: 0.5 }] }))}><Plus size={15} /></IconBtn>
                    </div>
                    <table className="w-full text-sm">
                        <tbody>
                            {st.extraG.map((e, i) => (
                                <tr key={i} className="border-t border-slate-100">
                                    <td className="py-1"><Inp value={e.name} onChange={(v) => updExtra(i, "name", v)} /></td>
                                    <td className="w-28"><Inp type="number" value={e.q} onChange={(v) => updExtra(i, "q", v)} /></td>
                                    <td className="w-8 text-right"><IconBtn danger onClick={() => setSt((p) => ({ ...p, extraG: p.extraG.filter((_, j) => j !== i) }))}><Trash2 size={14} /></IconBtn></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </Card>

                <Card>
                    <CardTitle>Carico variabile (categoria d'uso)</CardTitle>
                    <SelectField label="Categoria (Tab. 3.1.II)" value={st.category} onChange={(v) => setSt((p) => ({ ...p, category: v }))} options={USE_CATEGORIES.map((c) => ({ value: c.id, label: `${c.label} — q_k ${c.qk.toString().replace(".", ",")}` }))} />
                </Card>

                <button type="button" onClick={() => setSt(DEFAULT)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">
                    <RotateCcw size={15} /> Valori predefiniti
                </button>
            </div>

            <div className="space-y-4">
                <BigResult title="Permanente totale G" value={fmt(totals.Gtot, 2)} unit="kN/m²" note={`G₁ + G₂`} />
                <Card>
                    <CardTitle>Riepilogo</CardTitle>
                    <ResultGrid>
                        <ResultRow label="G₁ (strutturali)" value={fmt(totals.G1, 2)} unit="kN/m²" />
                        <ResultRow label="G₂ (non strutt.)" value={fmt(totals.G2, 2)} unit="kN/m²" />
                        <ResultRow label="G totale" value={fmt(totals.Gtot, 2)} unit="kN/m²" strong />
                        <ResultRow label="q_k (variabile)" value={fmt(totals.cat.qk, 2)} unit="kN/m²" strong />
                        <ResultRow label="ψ₀ / ψ₁ / ψ₂" value={`${fmt(totals.cat.psi0, 1)} / ${fmt(totals.cat.psi1, 1)} / ${fmt(totals.cat.psi2, 1)}`} />
                    </ResultGrid>
                </Card>
                <InfoBox>
                    Carichi permanenti g = s·γ per strato. q_k e ψ dalla categoria d'uso
                    (NTC2018 Tab. 3.1.II e 2.5.I). Usa questi valori nello strumento
                    "Combinazioni di carico".
                </InfoBox>
            </div>
        </div>
    );
}

function Inp({ value, onChange, type = "text" }) {
    return (
        <input
            type={type}
            value={value}
            step="any"
            onChange={(e) => onChange(type === "number" ? Number(e.target.value) : e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-2 py-1 text-sm outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-100"
        />
    );
}

function IconBtn({ children, onClick, danger }) {
    return (
        <button type="button" onClick={onClick} className={`rounded-lg p-1.5 transition ${danger ? "text-red-500 hover:bg-red-50" : "text-emerald-600 hover:bg-emerald-50"}`}>
            {children}
        </button>
    );
}
