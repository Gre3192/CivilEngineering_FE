// src/components/actions/LoadCombosTool.jsx
import { useMemo, useState } from "react";
import { Plus, Trash2, RotateCcw } from "lucide-react";
import { loadCombos, DEFAULT_COMBO_INPUT } from "../../lib/actions/loadCombos";
import { USE_CATEGORIES } from "../../lib/actions/loadData";
import { Card, CardTitle, ResultRow, NumberField, InfoBox, fmt } from "./kit";

export default function LoadCombosTool() {
    const [input, setInput] = useState(DEFAULT_COMBO_INPUT);
    const result = useMemo(() => loadCombos(input), [input]);

    const setN = (f) => (v) => setInput((p) => ({ ...p, [f]: Number(v) || 0 }));

    function updAction(i, field, value) {
        setInput((p) => ({ ...p, actions: p.actions.map((a, j) => (j === i ? { ...a, [field]: field === "name" ? value : Number(value) || 0 } : a)) }));
    }
    function addAction() {
        const c = USE_CATEGORIES[0];
        setInput((p) => ({ ...p, actions: [...p.actions, { name: c.label.split(" ")[0], Qk: c.qk, psi0: c.psi0, psi1: c.psi1, psi2: c.psi2 }] }));
    }
    function addFromCategory(id) {
        const c = USE_CATEGORIES.find((x) => x.id === id);
        if (!c) return;
        setInput((p) => ({ ...p, actions: [...p.actions, { name: c.label.split(" – ")[0] || c.id, Qk: c.qk, psi0: c.psi0, psi1: c.psi1, psi2: c.psi2 }] }));
    }

    return (
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
            <div className="space-y-4">
                <Card>
                    <CardTitle>Azioni permanenti</CardTitle>
                    <div className="grid grid-cols-2 gap-3">
                        <NumberField label="G₁ (strutturali)" unit="kN/m²" value={input.G1} step="0.1" onChange={setN("G1")} />
                        <NumberField label="G₂ (non strutt.)" unit="kN/m²" value={input.G2} step="0.1" onChange={setN("G2")} />
                    </div>
                </Card>

                <Card>
                    <div className="mb-3 flex items-center justify-between gap-2">
                        <CardTitle>Azioni variabili</CardTitle>
                        <div className="flex items-center gap-2">
                            <select onChange={(e) => { addFromCategory(e.target.value); e.target.value = ""; }} value="" className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs">
                                <option value="">+ da categoria…</option>
                                {USE_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                            </select>
                            <button type="button" onClick={addAction} className="rounded-lg p-1.5 text-emerald-600 transition hover:bg-emerald-50"><Plus size={15} /></button>
                        </div>
                    </div>
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-xs text-slate-400">
                                <th className="pb-1">Azione</th>
                                <th className="pb-1 w-20">Q_k</th>
                                <th className="pb-1 w-16">ψ₀</th>
                                <th className="pb-1 w-16">ψ₁</th>
                                <th className="pb-1 w-16">ψ₂</th>
                                <th className="w-8" />
                            </tr>
                        </thead>
                        <tbody>
                            {input.actions.map((a, i) => (
                                <tr key={i} className="border-t border-slate-100">
                                    <td className="py-1"><Inp value={a.name} onChange={(v) => updAction(i, "name", v)} /></td>
                                    <td><Inp type="number" value={a.Qk} onChange={(v) => updAction(i, "Qk", v)} /></td>
                                    <td><Inp type="number" value={a.psi0} onChange={(v) => updAction(i, "psi0", v)} /></td>
                                    <td><Inp type="number" value={a.psi1} onChange={(v) => updAction(i, "psi1", v)} /></td>
                                    <td><Inp type="number" value={a.psi2} onChange={(v) => updAction(i, "psi2", v)} /></td>
                                    <td className="text-right"><button type="button" onClick={() => setInput((p) => ({ ...p, actions: p.actions.filter((_, j) => j !== i) }))} className="rounded-lg p-1.5 text-red-500 transition hover:bg-red-50"><Trash2 size={14} /></button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </Card>

                <Card>
                    <CardTitle>Coefficienti parziali (SLU)</CardTitle>
                    <div className="grid grid-cols-3 gap-3">
                        <NumberField label="γ_G1" value={input.gammaG1} step="0.1" onChange={setN("gammaG1")} />
                        <NumberField label="γ_G2" value={input.gammaG2} step="0.1" onChange={setN("gammaG2")} />
                        <NumberField label="γ_Q" value={input.gammaQ} step="0.1" onChange={setN("gammaQ")} />
                    </div>
                </Card>

                <button type="button" onClick={() => setInput(DEFAULT_COMBO_INPUT)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">
                    <RotateCcw size={15} /> Valori predefiniti
                </button>
            </div>

            <div className="space-y-4">
                <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">SLU — fondamentale</p>
                    <div className="mt-1 flex items-end gap-2">
                        <span className="text-4xl font-bold text-slate-900">{fmt(result.slu, 2)}</span>
                        <span className="mb-1 text-base font-semibold text-slate-400">kN/m²</span>
                    </div>
                    {result.sluLeading && <p className="mt-1 text-sm text-slate-500">dominante: {result.sluLeading}</p>}
                </div>
                <Card>
                    <CardTitle>Combinazioni SLE</CardTitle>
                    <ResultRow label="Rara (caratteristica)" value={fmt(result.sleRara, 2)} unit="kN/m²" strong />
                    <ResultRow label="Frequente" value={fmt(result.sleFreq, 2)} unit="kN/m²" />
                    <ResultRow label="Quasi permanente" value={fmt(result.sleQP, 2)} unit="kN/m²" />
                    <ResultRow label="Sismica (parte grav.)" value={fmt(result.sismica, 2)} unit="kN/m²" />
                </Card>
                <InfoBox>
                    NTC2018 §2.5.3. SLU: γ_G1·G₁+γ_G2·G₂+γ_Q·Q_k1+Σγ_Q·ψ₀ᵢ·Q_kᵢ.
                    L'azione dominante è quella che massimizza la combinazione. SLE
                    rara/frequente/quasi permanente con ψ₀/ψ₁/ψ₂. La sismica va
                    sommata all'azione E.
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
            onChange={(e) => onChange(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-2 py-1 text-sm outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-100"
        />
    );
}
