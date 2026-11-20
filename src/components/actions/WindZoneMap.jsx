// src/components/actions/WindZoneMap.jsx
//
// Mappa delle province colorate secondo le zone del vento (NTC 2018 Tab. 3.3.I).
// In Sardegna la zona dipende dal lato della retta Capo Teulada – Isola della
// Maddalena (5 a oriente, 6 a occidente): le province sarde sono disegnate due
// volte, ritagliate sui due semipiani, e il clic legge il punto esatto.
// Contorni: openpolis/geojson-italy (dati ISTAT), © Openpolis, CC BY 4.0.

import { useRef, useState } from "react";
import { MAP_H, MAP_W, PROVINCES, SARDINIA_LINE } from "../../lib/actions/italyProvincesMap";
import { WIND_PROVINCE_ZONE, WIND_ZONES, WIND_ZONE_COLORS, isSardinia } from "../../lib/actions/windLoad";
import { sardiniaZoneAt } from "../../lib/actions/windMapZones";

const [X1, Y1, X2, Y2] = SARDINIA_LINE;
const DX = X2 - X1, DY = Y2 - Y1;
// semipiani per il ritaglio (retta prolungata ben oltre la mappa)
const K = 40, A = [X1 - K * DX, Y1 - K * DY], B = [X2 + K * DX, Y2 + K * DY], N = [-DY * K, DX * K];
const half = (s) => [A, B, [B[0] + s * N[0], B[1] + s * N[1]], [A[0] + s * N[0], A[1] + s * N[1]]].map((p) => p.join(",")).join(" ");

export default function WindZoneMap({ value, onChange }) {
    const wrapRef = useRef(null), svgRef = useRef(null);
    const [hov, setHov] = useState(null);           // { p, zone, x, y, w }
    const sel = PROVINCES.find((p) => p.sigla === value) ?? null;
    // punto del mouse in coordinate della mappa
    const toMap = (e) => {
        const pt = svgRef.current.createSVGPoint();
        pt.x = e.clientX; pt.y = e.clientY;
        return pt.matrixTransform(svgRef.current.getScreenCTM().inverse());
    };
    const zoneAt = (p, e) => (isSardinia(p.sigla) ? (() => { const q = toMap(e); return sardiniaZoneAt(q.x, q.y); })() : WIND_PROVINCE_ZONE[p.sigla]);
    const move = (p) => (e) => {
        const r = wrapRef.current.getBoundingClientRect();
        setHov({ p, zone: zoneAt(p, e), x: e.clientX - r.left, y: e.clientY - r.top, w: r.width });
    };
    const handlers = (p) => ({ onMouseMove: move(p), onClick: (e) => onChange(p.sigla, zoneAt(p, e)) });
    const zoneOf = (id) => WIND_ZONES.find((z) => z.id === id);
    const counts = WIND_ZONES.map((z) => [z.id, PROVINCES.filter((p) => WIND_PROVINCE_ZONE[p.sigla] === z.id).length]);
    return (
        <div>
            <div ref={wrapRef} className="relative mx-auto max-w-[560px]" onMouseLeave={() => setHov(null)}>
                <svg ref={svgRef} viewBox={`0 0 ${MAP_W} ${MAP_H}`} width="100%" role="img" aria-label="Mappa delle zone del vento per provincia">
                    <defs>
                        <clipPath id="wind-sard-east"><polygon points={half(1)} /></clipPath>
                        <clipPath id="wind-sard-west"><polygon points={half(-1)} /></clipPath>
                    </defs>
                    {PROVINCES.map((p) => {
                        const on = hov?.p.sigla === p.sigla, style = on ? { filter: "brightness(0.9)" } : undefined;
                        const common = { d: p.d, fillRule: "evenodd", stroke: "#ffffff", strokeWidth: 0.7, strokeLinejoin: "round", className: "cursor-pointer transition-[filter] duration-150", style, ...handlers(p) };
                        if (isSardinia(p.sigla)) {
                            return (
                                <g key={p.sigla}>
                                    <path {...common} fill={WIND_ZONE_COLORS[5]} clipPath="url(#wind-sard-east)"><title>{`${p.name} (${p.sigla})`}</title></path>
                                    <path {...common} fill={WIND_ZONE_COLORS[6]} clipPath="url(#wind-sard-west)"><title>{`${p.name} (${p.sigla})`}</title></path>
                                </g>
                            );
                        }
                        return <path key={p.sigla} {...common} fill={WIND_ZONE_COLORS[WIND_PROVINCE_ZONE[p.sigla]]}><title>{`${p.name} (${p.sigla})`}</title></path>;
                    })}
                    {/* retta Capo Teulada – Isola della Maddalena */}
                    <line x1={X1 - 0.08 * DX} y1={Y1 - 0.08 * DY} x2={X2 + 0.06 * DX} y2={Y2 + 0.06 * DY} stroke="#334155" strokeWidth="1" strokeDasharray="4 3" pointerEvents="none" />
                    {/* contorni marcati: provincia sotto il mouse e provincia scelta */}
                    {hov && hov.p.sigla !== value && <path d={hov.p.d} fill="none" stroke="#334155" strokeWidth="1.2" strokeLinejoin="round" pointerEvents="none" />}
                    {sel && (
                        <g pointerEvents="none">
                            <path d={sel.d} fill="none" stroke="#0f172a" strokeWidth="2.2" strokeLinejoin="round" />
                            <circle cx={sel.cx} cy={sel.cy} r="4" fill="#0f172a" stroke="#fff" strokeWidth="1.5" />
                        </g>
                    )}
                </svg>
                {hov && (
                    <div key={`${hov.p.sigla}${hov.zone}`} className="svg-pop pointer-events-none absolute z-10 max-w-[230px] rounded-lg border border-slate-200 bg-white/95 px-2.5 py-1.5 text-[11px] shadow-md"
                        style={{ left: Math.min(hov.x + 14, hov.w - 240), top: hov.y + 14, transformOrigin: "left top" }}>
                        <p className="font-bold text-slate-800">{hov.p.name} <span className="font-normal text-slate-400">({hov.p.sigla})</span></p>
                        <p className="text-slate-500">{hov.p.region}</p>
                        <p className="mt-0.5 flex items-center gap-1.5 font-semibold text-slate-700">
                            <span className="h-2.5 w-2.5 rounded-sm border border-slate-300" style={{ background: WIND_ZONE_COLORS[hov.zone] }} />
                            {zoneOf(hov.zone)?.label} · v<sub>b,0</sub> = {zoneOf(hov.zone)?.vb0} m/s
                        </p>
                        {isSardinia(hov.p.sigla) && <p className="text-[10px] text-slate-400">{hov.zone === "5" ? "a oriente" : "a occidente"} della retta Capo Teulada – Isola della Maddalena</p>}
                    </div>
                )}
            </div>
            <div className="mt-3 flex flex-wrap justify-center gap-x-3.5 gap-y-1.5 text-[11px] text-slate-600">
                {counts.map(([id, n]) => (
                    <span key={id} className="inline-flex items-center gap-1.5" title={zoneOf(id).where}>
                        <span className="h-3 w-3 rounded-sm border border-slate-300" style={{ background: WIND_ZONE_COLORS[id] }} />
                        {zoneOf(id).label}
                        {id !== "5" && id !== "6" && id !== "9" && <span className="text-slate-400">({n})</span>}
                    </span>
                ))}
            </div>
            <p className="mt-1 text-center text-[10px] text-slate-400">Zona 9 (isole minori e mare aperto): si sceglie nel pannello, le isole minori non sono disegnate.</p>
            <p className="mt-1 text-center text-[10px] text-slate-400">
                Confini delle province: <a href="https://github.com/openpolis/geojson-italy" target="_blank" rel="noreferrer" className="underline hover:text-slate-600">openpolis/geojson-italy</a> (dati ISTAT), © Openpolis, CC BY 4.0.
            </p>
        </div>
    );
}
