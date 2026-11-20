// src/components/actions/ItalyMapPicker.jsx
//
// Scelta della provincia per gli strumenti neve e vento: nella pagina una piantina
// piccola dell'Italia con la provincia scelta e un punto; cliccandola si apre un
// modal con la mappa grande delle zone (e l'elenco delle province per regione).
// Scelta una provincia, il modal si chiude e la scelta si applica.

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Maximize2, X } from "lucide-react";
import { MAP_H, MAP_W, PROVINCES } from "../../lib/actions/italyProvincesMap";
import { modalBackdropCls, modalPanelCls, useModalTransition } from "../../ui/useModalTransition";

// province per regione (elenco di riserva alla mappa, utile per le province piccole)
const BY_REGION = Object.entries(PROVINCES.reduce((acc, p) => { (acc[p.region] ??= []).push(p); return acc; }, {}))
    .sort(([a], [b]) => a.localeCompare(b, "it"))
    .map(([region, list]) => [region, [...list].sort((a, b) => a.name.localeCompare(b.name, "it"))]);

// piantina piccola: provincia scelta evidenziata e punto sul suo baricentro
export function ItalyThumb({ province, onOpen }) {
    const sel = PROVINCES.find((p) => p.sigla === province) ?? null;
    return (
        <button type="button" onClick={onOpen} title="Apri la mappa per scegliere la provincia" aria-label="Apri la mappa per scegliere la provincia"
            className="group relative shrink-0 rounded-xl border border-slate-200 bg-slate-50 p-1.5 transition hover:border-emerald-300 hover:bg-emerald-50/60 hover:shadow-sm">
            <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} width="92" aria-hidden="true">
                {PROVINCES.map((p) => (
                    <path key={p.sigla} d={p.d} fillRule="evenodd" fill={p.sigla === province ? "#10b981" : "#cbd5e1"} stroke="#ffffff" strokeWidth="1.4" strokeLinejoin="round" />
                ))}
                {sel && <circle cx={sel.cx} cy={sel.cy} r="17" fill="#0f172a" stroke="#ffffff" strokeWidth="6" />}
            </svg>
            <span className="absolute right-1 top-1 rounded-md bg-white/90 p-0.5 text-slate-400 shadow-sm transition group-hover:text-emerald-600"><Maximize2 size={11} /></span>
        </button>
    );
}

// modal con la mappa grande: children(pick) disegna la mappa; pick(...) chiude e applica
export default function MapPickerModal({ title, province, onPick, onClose, children }) {
    const { isVisible, close, finishClose } = useModalTransition(onClose);
    useEffect(() => {
        const onKey = (e) => { if (e.key === "Escape") close(); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [close]);
    const pick = (...args) => close(() => { onPick(...args); onClose(); });
    return createPortal(
        <div className={`fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/30 p-4 ${modalBackdropCls(isVisible)}`} onTransitionEnd={finishClose}
            role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
            <div className={`flex max-h-[calc(100vh-2rem)] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl ${modalPanelCls(isVisible)}`}>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
                    <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-800">{title}</p>
                        <p className="text-[11px] text-slate-500">Clicca su una provincia per sceglierla, oppure usa l'elenco.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <select value={province ?? ""} onChange={(e) => pick(e.target.value)} aria-label="Provincia"
                            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100">
                            {BY_REGION.map(([region, list]) => (
                                <optgroup key={region} label={region}>
                                    {list.map((p) => <option key={p.sigla} value={p.sigla}>{p.name} ({p.sigla})</option>)}
                                </optgroup>
                            ))}
                        </select>
                        <button type="button" onClick={close} aria-label="Chiudi" title="Chiudi (Esc)" className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100"><X size={16} /></button>
                    </div>
                </div>
                {/* la mappa occupa l'altezza disponibile (proporzioni 600×788) */}
                <div className="scroll-thin min-h-0 flex-1 px-5 py-4">
                    <div className="mx-auto" style={{ width: "min(100%, 560px, calc((100vh - 19rem) * 0.76))" }}>
                        {children(pick)}
                    </div>
                </div>
            </div>
        </div>,
        document.getElementById("modal-root") ?? document.body,
    );
}
