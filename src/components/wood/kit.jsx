// src/components/wood/kit.jsx
// Primitivi UI condivisi per la materia "Legno" (accento ambra).

import { CheckCircle2, XCircle, Info } from "lucide-react";

export function fmt(v, dec = 2) {
    if (v === undefined || v === null || Number.isNaN(v) || !Number.isFinite(v)) return "-";
    return Number(v).toLocaleString("it-IT", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

export function Card({ children, className = "" }) {
    return <div className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>{children}</div>;
}
export function CardTitle({ children }) {
    return <h3 className="mb-3 text-sm font-bold text-slate-800">{children}</h3>;
}
export function ResultGrid({ children }) {
    return <div className="grid grid-cols-1 gap-y-1">{children}</div>;
}
export function ResultRow({ label, value, unit, strong, highlight }) {
    return (
        <div className={`flex items-baseline justify-between border-b border-slate-100 py-1 ${highlight ? "rounded-md bg-amber-50 px-2" : ""}`}>
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
        <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">{title}</p>
            <div className="mt-1 flex items-end gap-2">
                <span className="text-4xl font-bold text-slate-900">{value}</span>
                {unit && <span className="mb-1 text-base font-semibold text-slate-400">{unit}</span>}
            </div>
            {note && <p className="mt-1 text-sm text-slate-500">{note}</p>}
        </div>
    );
}
export function UtilBar({ label, u }) {
    const ok = u <= 1;
    return (
        <div className="py-1">
            <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">{label}</span>
                <span className={`font-bold tabular-nums ${ok ? "text-emerald-600" : "text-red-600"}`}>{fmt(u * 100, 0)}%</span>
            </div>
            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div className={`h-full rounded-full ${ok ? "bg-emerald-500" : "bg-red-500"}`} style={{ width: `${Math.min(u * 100, 100)}%` }} />
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
export function NumberField({ label, unit, value, onChange, step = "1", placeholder }) {
    return (
        <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-500">
                {label}{unit && <span className="ml-1 text-slate-400">[{unit}]</span>}
            </span>
            <input type="number" value={value} step={step} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100" />
        </label>
    );
}
export function SelectField({ label, value, onChange, options }) {
    return (
        <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-500">{label}</span>
            <select value={value} onChange={(e) => onChange(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100">
                {options.map((opt) => <option key={String(opt.value) + opt.label} value={opt.value}>{opt.label}</option>)}
            </select>
        </label>
    );
}
