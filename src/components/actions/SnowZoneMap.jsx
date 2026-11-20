// src/components/actions/SnowZoneMap.jsx
//
// Mappa delle province italiane colorate secondo le zone di carico della neve
// (NTC 2018 §3.4.2). Passando il mouse una provincia si evidenzia e compare un
// box con nome, regione e zona; il clic la seleziona.
// Contorni: openpolis/geojson-italy (dati ISTAT), © Openpolis, CC BY 4.0.

import { useRef, useState } from "react";
import { MAP_H, MAP_W, PROVINCES } from "../../lib/actions/italyProvincesMap";
import { SNOW_ZONES, SNOW_ZONE_COLORS as ZONE_COLORS, zoneOfProvince } from "../../lib/actions/snowLoad";

export default function SnowZoneMap({ value, onChange }) {
    const wrapRef = useRef(null);
    const [hov, setHov] = useState(null);           // { p, x, y } provincia sotto il mouse
    const sel = PROVINCES.find((p) => p.sigla === value) ?? null;
    const move = (p) => (e) => {
        const r = wrapRef.current.getBoundingClientRect();
        setHov({ p, x: e.clientX - r.left, y: e.clientY - r.top, w: r.width });
    };
    const zoneLabel = (sg) => SNOW_ZONES.find((z) => z.id === zoneOfProvince(sg))?.label ?? "–";
    const counts = Object.fromEntries(SNOW_ZONES.map((z) => [z.id, PROVINCES.filter((p) => zoneOfProvince(p.sigla) === z.id).length]));
    return (
        <div>
            <div ref={wrapRef} className="relative mx-auto max-w-[560px]" onMouseLeave={() => setHov(null)}>
                <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} width="100%" role="img" aria-label="Mappa delle zone di carico della neve per provincia">
                    {PROVINCES.map((p) => {
                        const z = zoneOfProvince(p.sigla), on = hov?.p.sigla === p.sigla;
                        return (
                            <path key={p.sigla} d={p.d} fill={ZONE_COLORS[z]?.fill ?? "#e2e8f0"} fillRule="evenodd"
                                stroke="#ffffff" strokeWidth="0.7" strokeLinejoin="round"
                                className="cursor-pointer transition-[filter] duration-150"
                                style={on ? { filter: "brightness(0.88)" } : undefined}
                                onMouseMove={move(p)} onClick={() => onChange(p.sigla)}>
                                <title>{`${p.name} (${p.sigla})`}</title>
                            </path>
                        );
                    })}
                    {/* provincia sotto il mouse e provincia scelta: contorno marcato, disegnato sopra */}
                    {hov && hov.p.sigla !== value && <path d={hov.p.d} fill="none" stroke="#334155" strokeWidth="1.2" strokeLinejoin="round" pointerEvents="none" />}
                    {sel && (
                        <g pointerEvents="none">
                            <path d={sel.d} fill="none" stroke="#0f172a" strokeWidth="2.2" strokeLinejoin="round" />
                            <circle cx={sel.cx} cy={sel.cy} r="4" fill="#0f172a" stroke="#fff" strokeWidth="1.5" />
                        </g>
                    )}
                </svg>
                {/* box della provincia sotto il mouse */}
                {hov && (
                    <div key={hov.p.sigla} className="svg-pop pointer-events-none absolute z-10 rounded-lg border border-slate-200 bg-white/95 px-2.5 py-1.5 text-[11px] shadow-md"
                        style={{ left: Math.min(hov.x + 14, hov.w - 190), top: hov.y + 14, transformOrigin: "left top" }}>
                        <p className="font-bold text-slate-800">{hov.p.name} <span className="font-normal text-slate-400">({hov.p.sigla})</span></p>
                        <p className="text-slate-500">{hov.p.region}</p>
                        <p className="mt-0.5 flex items-center gap-1.5 font-semibold text-slate-700">
                            <span className="h-2.5 w-2.5 rounded-sm border border-slate-300" style={{ background: ZONE_COLORS[zoneOfProvince(hov.p.sigla)]?.fill }} />
                            {zoneLabel(hov.p.sigla)}
                        </p>
                    </div>
                )}
            </div>
            {/* legenda */}
            <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-[11px] text-slate-600">
                {SNOW_ZONES.map((z) => (
                    <span key={z.id} className="inline-flex items-center gap-1.5">
                        <span className="h-3 w-3 rounded-sm border border-slate-300" style={{ background: ZONE_COLORS[z.id].fill }} />
                        {z.label} <span className="text-slate-400">({counts[z.id]})</span>
                    </span>
                ))}
            </div>
            <p className="mt-2 text-center text-[10px] text-slate-400">
                Confini delle province: <a href="https://github.com/openpolis/geojson-italy" target="_blank" rel="noreferrer" className="underline hover:text-slate-600">openpolis/geojson-italy</a> (dati ISTAT), © Openpolis, CC BY 4.0.
            </p>
        </div>
    );
}
