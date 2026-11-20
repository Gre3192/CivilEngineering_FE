// src/components/actions/ComuneSearch.jsx
//
// Ricerca del comune (solo dati, nessun confine disegnato): scrivendo si cerca in
// tutta Italia, con i comuni della provincia scelta per primi; a campo vuoto
// l'elenco mostra i comuni della provincia selezionata sulla mappa. Scegliendo un
// comune si passano provincia, altitudine e distanza dalla costa (italyComuni.js,
// caricato solo quando serve).

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";

const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’'`\-\s/]+/g, " ").trim();
const fmt1 = (v) => (v === null || v === undefined ? "–" : Number(v).toLocaleString("it-IT", { maximumFractionDigits: 1 }));

// riga dei dati → oggetto
const toComune = (r) => ({ name: r[0], sigla: r[1], alt: r[2], dist: r[3], distMin: r[4], altMin: r[5], altMax: r[6], windZone: r[7] ?? null });

export default function ComuneSearch({ province, value, onPick, onClear }) {
    const [rows, setRows] = useState(null);         // tabella dei comuni (caricata in differita)
    const [q, setQ] = useState("");
    const [open, setOpen] = useState(false);
    const [hi, setHi] = useState(0);
    const boxRef = useRef(null), listRef = useRef(null);

    useEffect(() => {
        let alive = true;
        import("../../lib/actions/italyComuni").then((m) => { if (alive) setRows(m.COMUNI.map((r) => ({ r, key: norm(r[0]) }))); });
        return () => { alive = false; };
    }, []);
    // chiusura cliccando fuori
    useEffect(() => {
        const close = (e) => { if (!boxRef.current?.contains(e.target)) setOpen(false); };
        document.addEventListener("mousedown", close);
        return () => document.removeEventListener("mousedown", close);
    }, []);

    const list = useMemo(() => {
        if (!rows) return [];
        const nq = norm(q);
        if (!nq) return rows.filter((x) => x.r[1] === province).map((x) => x.r);
        const starts = [], contains = [];
        for (const x of rows) {
            if (x.key.startsWith(nq) || x.key.split(" ").some((w) => w.startsWith(nq))) starts.push(x.r);
            else if (x.key.includes(nq)) contains.push(x.r);
        }
        // prima i comuni della provincia scelta, poi gli altri
        const byProv = (a, b) => (a[1] === province ? 0 : 1) - (b[1] === province ? 0 : 1);
        return [...starts.sort(byProv), ...contains.sort(byProv)].slice(0, 80);
    }, [rows, q, province]);

    const pick = (r) => { onPick(toComune(r)); setQ(""); setOpen(false); };
    const onKey = (e) => {
        if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setHi((h) => Math.min(list.length - 1, h + 1)); }
        else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(0, h - 1)); }
        else if (e.key === "Enter" && open && list[hi]) { e.preventDefault(); pick(list[hi]); }
        else if (e.key === "Escape") setOpen(false);
    };
    useEffect(() => { listRef.current?.children[hi]?.scrollIntoView({ block: "nearest" }); }, [hi]);

    return (
        <div ref={boxRef} className="relative">
            <span className="mb-1 block text-xs font-semibold text-slate-500">Comune</span>
            <div className="relative">
                <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); setHi(0); }} onFocus={() => { setOpen(true); setHi(0); }} onKeyDown={onKey}
                    placeholder={!rows ? "Caricamento dei comuni…" : value ? value.name : province ? "Cerca un comune (o scegli dall'elenco della provincia)" : "Cerca un comune"}
                    aria-label="Cerca un comune" role="combobox" aria-expanded={open} aria-autocomplete="list"
                    className={`w-full rounded-xl border border-slate-200 py-2 pl-8 pr-8 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 ${value && !q ? "placeholder:font-semibold placeholder:text-slate-800" : ""}`} />
                {value && (
                    <button type="button" onClick={() => { onClear(); setQ(""); }} aria-label="Togli il comune" title="Togli il comune"
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={13} /></button>
                )}
            </div>
            {open && rows && (
                <ul ref={listRef} role="listbox" className="svg-pop scroll-thin absolute z-20 mt-1 max-h-72 w-full rounded-xl border border-slate-200 bg-white py-1 text-sm shadow-lg" style={{ transformOrigin: "center top" }}>
                    {list.length === 0 && <li className="px-3 py-2 text-xs text-slate-400">{q ? "Nessun comune trovato." : "Scegli una provincia sulla mappa o scrivi il nome del comune."}</li>}
                    {list.map((r, i) => (
                        <li key={`${r[0]}|${r[1]}`} role="option" aria-selected={i === hi} onMouseDown={(e) => { e.preventDefault(); pick(r); }} onMouseEnter={() => setHi(i)}
                            className={`flex cursor-pointer items-baseline justify-between gap-2 px-3 py-1.5 ${i === hi ? "bg-emerald-50" : ""}`}>
                            <span className="truncate text-slate-800">{r[0]} <span className="text-xs text-slate-400">({r[1]})</span></span>
                            <span className="shrink-0 text-[11px] tabular-nums text-slate-400">{r[2] ?? "–"} m · {fmt1(r[3])} km</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
