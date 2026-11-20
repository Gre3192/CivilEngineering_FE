// src/components/actions/kit.jsx
//
// Primitivi UI condivisi dagli strumenti della materia "Azioni sulle
// strutture" (accento verde, coerente con la materia).

import { useState } from "react";
import { CheckCircle2, XCircle, Info, ChevronDown, RotateCcw } from "lucide-react";

export function fmt(v, dec = 2) {
    if (v === undefined || v === null || Number.isNaN(v) || !Number.isFinite(v)) return "-";
    return Number(v).toLocaleString("it-IT", {
        minimumFractionDigits: dec,
        maximumFractionDigits: dec,
    });
}

export function Card({ children, className = "" }) {
    return (
        <div className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>
            {children}
        </div>
    );
}

export function CardTitle({ children }) {
    return <h3 className="mb-3 text-sm font-bold text-slate-800">{children}</h3>;
}

export function ResultGrid({ children, cols = 1 }) {
    return <div className={`grid gap-x-4 gap-y-1 ${cols === 2 ? "grid-cols-2" : "grid-cols-1"}`}>{children}</div>;
}

export function ResultRow({ label, value, unit, strong, highlight }) {
    return (
        <div className={`flex items-baseline justify-between border-b border-slate-100 py-1 ${highlight ? "rounded-md bg-emerald-50 px-2" : ""}`}>
            <span className="text-xs text-slate-500">{label}</span>
            <span className={`text-sm tabular-nums ${strong ? "font-bold text-slate-900" : "font-semibold text-slate-700"}`}>
                {value}
                {unit && <span className="ml-1 text-xs text-slate-400">{unit}</span>}
            </span>
        </div>
    );
}

export function BigResult({ title, value, unit, note }) {
    return (
        <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">{title}</p>
            <div className="mt-1 flex items-end gap-2">
                <span className="text-4xl font-bold text-slate-900">{value}</span>
                {unit && <span className="mb-1 text-base font-semibold text-slate-400">{unit}</span>}
            </div>
            {note && <p className="mt-1 text-sm text-slate-500">{note}</p>}
        </div>
    );
}

export function NumberField({ label, unit, value, onChange, step = "1", placeholder }) {
    return (
        <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-500">
                {label}
                {unit && <span className="ml-1 text-slate-400">[{unit}]</span>}
            </span>
            <input
                type="number"
                value={value}
                step={step}
                placeholder={placeholder}
                onChange={(e) => onChange(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            />
        </label>
    );
}

export function SelectField({ label, value, onChange, options }) {
    return (
        <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-500">{label}</span>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            >
                {options.map((opt) => (
                    <option key={String(opt.value) + opt.label} value={opt.value}>
                        {opt.label}
                    </option>
                ))}
            </select>
        </label>
    );
}

export function InfoBox({ title = "Riferimenti e ipotesi", children }) {
    return (
        <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
            <Info size={18} className="mt-0.5 shrink-0 text-slate-400" />
            <div>
                <p className="font-semibold text-slate-600">{title}</p>
                <p className="mt-1 leading-6">{children}</p>
            </div>
        </div>
    );
}

export function VerdictBanner({ ok, title, subtitle }) {
    return (
        <div className={`flex items-center gap-4 rounded-2xl border p-4 ${ok ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
            {ok ? <CheckCircle2 size={26} className="shrink-0 text-emerald-600" /> : <XCircle size={26} className="shrink-0 text-red-600" />}
            <div>
                <p className="text-base font-bold text-slate-800">{title}</p>
                {subtitle && <p className="mt-0.5 text-sm text-slate-600">{subtitle}</p>}
            </div>
        </div>
    );
}

// sezione richiudibile (come nel calcestruzzo): apertura animata con una griglia CSS;
// a sezione aperta il contenuto può sporgere (es. menu a tendina della ricerca)
export function Section({ title, open, onToggle, right = null, children }) {
    const [settled, setSettled] = useState(true);
    const [prevOpen, setPrevOpen] = useState(open);
    if (prevOpen !== open) { setPrevOpen(open); setSettled(false); }
    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
                <button type="button" aria-expanded={open} onClick={onToggle}
                    className="flex flex-1 cursor-pointer items-center justify-between gap-2 text-left text-sm font-bold text-slate-800">
                    {title}
                    <ChevronDown size={16} aria-hidden="true" className={`text-slate-400 transition-transform duration-300 ${open ? "" : "-rotate-90"}`} />
                </button>
                {right}
            </div>
            <div aria-hidden={!open} inert={!open} onTransitionEnd={(e) => { if (e.target === e.currentTarget) setSettled(true); }}
                className={`grid transition-[grid-template-rows] duration-300 ease-in-out motion-reduce:transition-none ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                <div className={`min-h-0 ${open && settled ? "overflow-visible" : "overflow-hidden"}`}>
                    <div className="pt-3">{children}</div>
                </div>
            </div>
        </section>
    );
}

// barra sopra le sezioni: valori predefiniti, apri tutti, collassa tutti
export function SectionsToolbar({ onReset, onAll }) {
    const btn = "rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50";
    return (
        <div className="flex items-center justify-between gap-2">
            <button type="button" onClick={onReset} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50">
                <RotateCcw size={14} /> Valori predefiniti
            </button>
            <div className="flex gap-2">
                <button type="button" onClick={() => onAll(true)} className={btn}>Apri tutti</button>
                <button type="button" onClick={() => onAll(false)} className={btn}>Collassa tutti</button>
            </div>
        </div>
    );
}
