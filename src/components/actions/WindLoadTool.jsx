// src/components/actions/WindLoadTool.jsx
//
// Azione del vento (NTC 2018 §3.3): la provincia si sceglie sulla mappa delle
// zone (o dall'elenco); in Sardegna la zona viene dal punto cliccato rispetto
// alla retta Capo Teulada – Isola della Maddalena; la zona 9 (isole minori e
// mare aperto) si sceglie nel pannello.
import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { windLoad, DEFAULT_WIND_INPUT, WIND_ZONES, WIND_ZONE_COLORS, TERRAIN_CATEGORIES, ROUGHNESS_CLASSES, allowedWindZones, exposureCategory, exposureFigure, figureCell } from "../../lib/actions/windLoad";
import { defaultWindZone } from "../../lib/actions/windMapZones";
import { PROVINCES } from "../../lib/actions/italyProvincesMap";
import { Card, CardTitle, ResultGrid, ResultRow, BigResult, NumberField, SelectField, InfoBox, Section, SectionsToolbar, fmt } from "./kit";
import WindZoneMap from "./WindZoneMap";
import MapPickerModal, { ItalyThumb } from "./ItalyMapPicker";
import ComuneSearch from "./ComuneSearch";
import Tex from "../Tex";

const texN = (v, d = 2) => fmt(v, d).replace(",", "{,}");
// la tabella della Fig. 3.3.2 per la zona del sito, con la casella usata
function ExposureFigure({ zone, roughness, band }) {
    const fig = exposureFigure(zone);
    return (
        <div className="overflow-x-auto">
            <table className="w-full border-collapse text-center text-[10px] tabular-nums">
                <thead>
                    <tr className="text-slate-500">
                        <th className="border border-slate-200 bg-slate-50 px-1 py-1 font-semibold">Fig. 3.3.2</th>
                        {fig.bands.map((b, i) => (
                            <th key={b} className={`border border-slate-200 px-1 py-1 font-semibold leading-3 ${i === band ? "bg-sky-50 text-sky-800" : "bg-slate-50"}`}>{b}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {["A", "B", "C", "D"].map((c) => (
                        <tr key={c}>
                            <td className={`border border-slate-200 px-1 py-0.5 font-bold ${c === roughness ? "bg-sky-50 text-sky-800" : "text-slate-600"}`}>{c}</td>
                            {fig.bands.map((b, i) => {
                                const v = figureCell(zone, c, i), on = c === roughness && i === band;
                                return (
                                    <td key={b} className={`border border-slate-200 px-1 py-0.5 ${on ? "bg-sky-600 font-bold text-white" : c === roughness || i === band ? "bg-sky-50 text-slate-700" : "text-slate-600"}`}>
                                        {v ?? "–"}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
            <p className="mt-1 text-[10px] leading-3 text-slate-400">Fasce di 2, 10 e 30 km dalla costa come nella figura (cumulate: 2, 12, 42 km); entro circa 40 km la categoria non dipende dall'altitudine.</p>
        </div>
    );
}

export default function WindLoadTool() {
    const [input, setInput] = useState(DEFAULT_WIND_INPUT);
    const [mapOpen, setMapOpen] = useState(false);
    // sezioni richiudibili (come nel calcestruzzo)
    const [open, setOpen] = useState({ sito: true, esposizione: true, coefficienti: true });
    const toggle = (k) => () => setOpen((o) => ({ ...o, [k]: !o[k] }));
    const setAll = (v) => setOpen((o) => Object.fromEntries(Object.keys(o).map((k) => [k, v])));
    // categoria di esposizione: dalla Fig. 3.3.2 (zona, rugosità, distanza dalla
    // costa, altitudine) oppure scelta a mano
    const auto = input.catMode !== "manual";
    const ex = exposureCategory({ zone: input.zone, roughness: input.roughness, dist: input.dist, as: input.as });
    const exCat = ex.cat ?? figureCell(input.zone, "D", ex.band);       // classe non ammessa: entro 2 km vale la D
    const terrain = auto ? exCat : input.terrain;
    const result = useMemo(() => windLoad({ ...input, terrain }), [input, terrain]);
    const prov = PROVINCES.find((p) => p.sigla === input.province) ?? null;
    const zone = WIND_ZONES.find((z) => z.id === input.zone);

    const set = (f) => (v) => setInput((p) => ({ ...p, [f]: v }));
    const setN = (f) => (v) => setInput((p) => ({ ...p, [f]: Number(v) || 0 }));
    // provincia dalla mappa o dall'elenco: il comune scelto resta solo se le appartiene
    const pickProvince = (sigla, z = null) => setInput((p) => {
        const keep = p.comune?.sigla === sigla;
        return {
            ...p, province: sigla, comune: keep ? p.comune : null, zone: z ?? (keep && p.comune.windZone) ?? defaultWindZone(sigla),
            // altitudine e distanza restano quelle del comune precedente: avviso
            staleFrom: keep ? p.staleFrom : (p.comune?.name ?? p.staleFrom ?? null),
        };
    });
    // comune: provincia, zona (in Sardegna quella del comune), altitudine e distanza dalla costa
    const pickComune = (c) => setInput((p) => ({
        ...p, comune: c, province: c.sigla, zone: c.windZone ?? defaultWindZone(c.sigla),
        as: c.alt ?? p.as, dist: c.dist, distRef: "centro", staleFrom: null,
    }));
    const applyDist = (ref) => setInput((p) => ({ ...p, distRef: ref, dist: ref === "min" ? p.comune.distMin : p.comune.dist }));

    const caTex = !zone ? "" : input.as <= zone.a0
        ? String.raw`c_a=1\quad(a_s\le a_0=${zone.a0}\ \text{m})`
        : String.raw`c_a=1+k_s\left(\frac{a_s}{a_0}-1\right)=1+${texN(zone.ks)}\left(\frac{${texN(input.as, 0)}}{${zone.a0}}-1\right)=${texN(result.ca, 3)}`;

    return (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
            {/* -------- dati, a sezioni -------- */}
            <div className="space-y-4">
                <SectionsToolbar onReset={() => setInput(DEFAULT_WIND_INPUT)} onAll={setAll} />
                <Section title="Sito" open={open.sito} onToggle={toggle("sito")}>
                        <div className="mb-3 flex items-start gap-3 rounded-xl bg-slate-50 p-3">
                            <ItalyThumb province={input.province} onOpen={() => setMapOpen(true)} />
                            <div className="min-w-0 flex-1 space-y-2">
                                {prov && zone && (
                                    <div>
                                        <p className="text-sm font-bold text-slate-800">{prov.name} <span className="font-normal text-slate-400">({prov.sigla}) · {prov.region}</span></p>
                                        <p className="mt-1 inline-flex flex-wrap items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold text-slate-800" style={{ background: WIND_ZONE_COLORS[zone.id] }}>
                                            {zone.label} · v<sub>b,0</sub> = {zone.vb0} m/s
                                        </p>
                                    </div>
                                )}
                                <ComuneSearch province={input.province} value={input.comune} onPick={pickComune} onClear={() => set("comune")(null)} />
                                <p className="text-[10px] text-slate-400">Clicca la piantina per aprire la mappa delle zone del vento (NTC 2018 Tab. 3.3.I).</p>
                            </div>
                        </div>
                        {input.comune && (
                            <p className="-mt-1 mb-3 text-[11px] leading-4 text-slate-500">
                                {input.comune.alt !== null
                                    ? `Altitudine del centro comunale (ISTAT): ${input.comune.alt} m s.l.m. · territorio fra ${input.comune.altMin} e ${input.comune.altMax} m.`
                                    : "Comune nato da fusioni recenti: altitudine non disponibile, inseriscila a mano."}
                            </p>
                        )}
                        {input.comune && (
                            <div className="-mt-1 mb-3 rounded-lg bg-slate-50 px-3 py-2 text-[11px] leading-4 text-slate-600">
                                <p className="font-semibold text-slate-700">Distanza dalla costa (linea di costa ISTAT)</p>
                                <div className="mt-1 flex flex-wrap gap-1.5">
                                    {[["centro", `baricentro del comune: ${fmt(input.comune.dist, 1)} km`], ["min", `punto del territorio più vicino: ${fmt(input.comune.distMin, 1)} km`]].map(([ref, l]) => (
                                        <button key={ref} type="button" onClick={() => applyDist(ref)}
                                            className={`rounded-md border px-2 py-0.5 ${input.distRef === ref && input.dist === (ref === "min" ? input.comune.distMin : input.comune.dist) ? "border-emerald-300 bg-emerald-50 font-semibold text-emerald-800" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"}`}>{l}</button>
                                    ))}
                                </div>
                                <p className="mt-1 text-slate-400">Per i comuni grandi o affacciati sul mare il cantiere può stare lontano dal baricentro: scegli il valore adatto o scrivi la distanza del sito.</p>
                            </div>
                        )}
                        {input.staleFrom && (
                            <p className="-mt-1 mb-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-4 text-amber-800">
                                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                                {`Altitudine e distanza dalla costa vengono dal comune di ${input.staleFrom}: scegli un comune della provincia o correggili a mano.`}
                            </p>
                        )}
                    <div className="space-y-3">
                        {/* zone ammesse per la provincia: quella della regione (5/6 in Sardegna) e la 9 */}
                        <SelectField label="Zona" value={input.zone} onChange={set("zone")}
                            options={allowedWindZones(input.province).map((id) => {
                                const z = WIND_ZONES.find((q) => q.id === id);
                                return { value: id, label: `${z.label} – ${id === "9" ? "isola minore o mare aperto" : id === "5" ? "Sardegna, a oriente della retta" : id === "6" ? "Sardegna, a occidente della retta" : "dalla provincia"}` };
                            })} />
                        {zone && <p className="-mt-2 text-[10px] leading-4 text-slate-400">v<sub>b,0</sub> = {zone.vb0} m/s · a<sub>0</sub> = {zone.a0} m · k<sub>s</sub> = {fmt(zone.ks, 2)} — {zone.where}</p>}
                        <div className="grid grid-cols-2 gap-3">
                            <NumberField label="Altitudine del sito a_s" unit="m s.l.m." value={input.as} onChange={(v) => setInput((p) => ({ ...p, as: Number(v) || 0, staleFrom: null }))} />
                            <NumberField label="Periodo di ritorno T_R" unit="anni" value={input.Tr} onChange={setN("Tr")} />
                        </div>
                    </div>
                        {input.as > 1500 && (
                            <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-4 text-amber-800">
                                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                                Oltre 1500 m la norma rimanda a valutazioni sulle condizioni locali, con valori comunque non inferiori a quelli a 1500 m.
                            </p>
                        )}
                </Section>

                <Section title="Categoria di esposizione" open={open.esposizione} onToggle={toggle("esposizione")}
                    right={
                            <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-[11px] font-semibold">
                                {[["auto", "Da Fig. 3.3.2"], ["manual", "Manuale"]].map(([v, l]) => (
                                    <button key={v} type="button" onClick={() => set("catMode")(v)}
                                        className={`rounded-md px-2 py-1 ${(v === "auto") === auto ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>{l}</button>
                                ))}
                            </div>
                    }>
                    {auto ? (
                        <div className="space-y-3">
                            <SelectField label="Classe di rugosità (Tab. 3.3.III)" value={input.roughness} onChange={set("roughness")}
                                options={ROUGHNESS_CLASSES.map((c) => ({ value: c.id, label: c.label.length > 70 ? `${c.label.slice(0, 68)}…` : c.label }))} />
                            <p className="-mt-2 text-[10px] leading-4 text-slate-400">{ROUGHNESS_CLASSES.find((c) => c.id === input.roughness)?.label}</p>
                            <NumberField label="Distanza dalla costa" unit="km" value={input.dist} step="0.5" onChange={(v) => setInput((p) => ({ ...p, dist: Number(v) || 0, staleFrom: null }))} />
                            <ExposureFigure zone={input.zone} roughness={input.roughness} band={ex.band} />
                            {ex.cat === null && (
                                <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-4 text-amber-800">
                                    <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                                    {`${ex.bandLabel}: la classe ${input.roughness} non è ammessa, la fascia costiera è di classe D (Tab. 3.3.III). Si usa la classe D → categoria ${exCat}.`}
                                </p>
                            )}
                            <p className="text-sm font-bold text-slate-800">Categoria {exCat}
                                <span className="ml-1 text-xs font-normal text-slate-500">· zona {input.zone}, classe {ex.cat === null ? "D" : input.roughness}, {ex.bandLabel}</span>
                            </p>
                        </div>
                    ) : (
                        <SelectField label="Categoria (Tab. 3.3.II)" value={input.terrain} onChange={set("terrain")} options={TERRAIN_CATEGORIES.map((t) => ({ value: t.id, label: t.label }))} />
                    )}
                </Section>

                <Section title="Quota e coefficienti" open={open.coefficienti} onToggle={toggle("coefficienti")}>
                    <div className="grid grid-cols-2 gap-3">
                        <NumberField label="Quota z" unit="m" value={input.z} onChange={setN("z")} />
                        <NumberField label="c_t (topografia)" value={input.ct} step="0.1" onChange={setN("ct")} />
                        <NumberField label="c_p (pressione)" value={input.cp} step="0.1" onChange={setN("cp")} />
                        <NumberField label="c_d (dinamico)" value={input.cd} step="0.1" onChange={setN("cd")} />
                    </div>
                </Section>
            </div>

            {/* -------- risultati -------- */}
            <div className="space-y-4">
                <BigResult title="Pressione del vento p" value={fmt(result.p, 0)} unit="N/m²" note={`= ${fmt(result.p / 1000, 3)} kN/m² · p = q_r · c_e · c_p · c_d`} />
                <Card>
                    <CardTitle>Velocità e pressione cinetica</CardTitle>
                    <ResultGrid>
                        <ResultRow label="c_a (altitudine)" value={fmt(result.ca, 3)} />
                        <ResultRow label="v_b (base)" value={fmt(result.vb, 2)} unit="m/s" />
                        <ResultRow label="c_r (ritorno)" value={fmt(result.cr, 3)} />
                        <ResultRow label="v_r (riferimento)" value={fmt(result.vr, 2)} unit="m/s" />
                        <ResultRow label="q_r" value={fmt(result.qb, 0)} unit="N/m²" strong />
                        <ResultRow label="c_e(z)" value={fmt(result.ce, 3)} strong />
                    </ResultGrid>
                    {zone && result.ok && (
                        <div className="mt-3 space-y-1 overflow-x-auto rounded-xl bg-slate-50 px-3 py-2 text-[13px]">
                            <Tex display>{caTex}</Tex>
                            <Tex display>{String.raw`v_b=v_{b,0}\,c_a=${zone.vb0}\cdot${texN(result.ca, 3)}=${texN(result.vb, 2)}\ \text{m/s}`}</Tex>
                            <Tex display>{String.raw`q_r=\tfrac12\,\rho\,v_r^2=\tfrac12\cdot1{,}25\cdot${texN(result.vr, 2)}^2=${texN(result.qb, 0)}\ \text{N/m}^2`}</Tex>
                            <Tex display>{String.raw`p=q_r\,c_e\,c_p\,c_d=${texN(result.qb, 0)}\cdot${texN(result.ce, 3)}\cdot${texN(input.cp)}\cdot${texN(input.cd)}=${texN(result.p, 0)}\ \text{N/m}^2`}</Tex>
                        </div>
                    )}
                </Card>
                <InfoBox>
                    NTC 2018 §3.3. Zona dalla provincia (Tab. 3.3.I); v_b = v_b,0·c_a;
                    v_r = v_b·c_r; q_r = ½·ρ·v_r² (ρ = 1,25 kg/m³); c_e(z) = k_r²·c_t·ln(z/z₀)·[7 + c_t·ln(z/z₀)]
                    per z ≥ z_min (Tab. 3.3.II); p = q_r·c_e·c_p·c_d. La categoria di esposizione dipende
                    da zona, classe di rugosità (Tab. 3.3.III), distanza dalla costa e altitudine (Fig. 3.3.2).
                </InfoBox>
            </div>

            {mapOpen && (
                <MapPickerModal title="Zone del vento — NTC 2018 Tab. 3.3.I" province={input.province} onPick={pickProvince} onClose={() => setMapOpen(false)}>
                    {(pick) => <WindZoneMap value={input.province} onChange={pick} />}
                </MapPickerModal>
            )}
        </div>
    );
}
