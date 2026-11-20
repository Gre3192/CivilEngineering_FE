// src/components/actions/SnowLoadTool.jsx
//
// Carico da neve (NTC 2018 §3.4): la provincia si sceglie dalla mappa delle zone
// (in un modal, aperto dalla piantina) o con il comune; la zona viene dalla norma;
// poi altitudine, copertura, esposizione e coefficiente termico.
import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { snowLoad, DEFAULT_SNOW_INPUT, SNOW_ZONES, SNOW_EXPOSURE, SNOW_ZONE_COLORS as ZONE_COLORS, zoneOfProvince } from "../../lib/actions/snowLoad";
import { PROVINCES } from "../../lib/actions/italyProvincesMap";
import { Card, CardTitle, ResultGrid, ResultRow, BigResult, NumberField, SelectField, InfoBox, Section, SectionsToolbar, fmt } from "./kit";
import SnowZoneMap from "./SnowZoneMap";
import ComuneSearch from "./ComuneSearch";
import MapPickerModal, { ItalyThumb } from "./ItalyMapPicker";
import Tex from "../Tex";

const DEFAULT_INPUT = { ...DEFAULT_SNOW_INPUT, province: "MI", comune: null };
const texN = (v, d = 2) => fmt(v, d).replace(",", "{,}");

export default function SnowLoadTool() {
    const [input, setInput] = useState(DEFAULT_INPUT);
    const [mapOpen, setMapOpen] = useState(false);
    // sezioni richiudibili (come nel calcestruzzo)
    const [open, setOpen] = useState({ sito: true, copertura: true });
    const toggle = (k) => () => setOpen((o) => ({ ...o, [k]: !o[k] }));
    const setAll = (v) => setOpen((o) => Object.fromEntries(Object.keys(o).map((k) => [k, v])));
    const prov = PROVINCES.find((p) => p.sigla === input.province) ?? null;
    const zoneId = zoneOfProvince(input.province) ?? input.zone;
    const zone = SNOW_ZONES.find((z) => z.id === zoneId);
    const result = useMemo(() => snowLoad({ ...input, zone: zoneId }), [input, zoneId]);

    const set = (f) => (v) => setInput((p) => ({ ...p, [f]: v }));
    // provincia dalla mappa o dall'elenco: il comune scelto resta solo se le appartiene
    const pickProvince = (sigla) => setInput((p) => {
        const keep = p.comune?.sigla === sigla;
        // cambiando provincia l'altitudine resta quella del comune precedente: avviso
        return { ...p, province: sigla, comune: keep ? p.comune : null, staleFrom: keep ? p.staleFrom : (p.comune?.name ?? p.staleFrom ?? null) };
    });
    // comune: provincia e altitudine del centro comunale
    const pickComune = (c) => setInput((p) => ({ ...p, comune: c, province: c.sigla, as: c.alt ?? p.as, staleFrom: null }));
    const setN = (f) => (v) => setInput((p) => ({ ...p, [f]: Number(v) || 0 }));

    // q_sk con i numeri della zona
    const qskTex = !zone ? "" : input.as <= 200
        ? String.raw`q_{sk}=${texN(zone.base)}\ \text{kN/m}^2\quad(a_s\le 200\ \text{m})`
        : String.raw`q_{sk}=${texN(zone.k)}\left[1+\left(\frac{${texN(input.as, 0)}}{${zone.den}}\right)^2\right]=${texN(result.qsk, 3)}\ \text{kN/m}^2`;

    return (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[400px_minmax(0,1fr)]">
            {/* -------- dati, a sezioni -------- */}
            <div className="space-y-4">
                <SectionsToolbar onReset={() => setInput(DEFAULT_INPUT)} onAll={setAll} />
                <Section title="Sito" open={open.sito} onToggle={toggle("sito")}>
                        <div className="mb-3 flex items-start gap-3 rounded-xl bg-slate-50 p-3">
                            <ItalyThumb province={input.province} onOpen={() => setMapOpen(true)} />
                            <div className="min-w-0 flex-1 space-y-2">
                                {prov && zone ? (
                                    <div>
                                        <p className="text-sm font-bold text-slate-800">{prov.name} <span className="font-normal text-slate-400">({prov.sigla}) · {prov.region}</span></p>
                                        <p className="mt-1 inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold"
                                            style={{ background: ZONE_COLORS[zone.id].fill, color: ZONE_COLORS[zone.id].text }}>
                                            {zone.label}
                                        </p>
                                    </div>
                                ) : <p className="text-sm text-slate-500">Scegli una provincia sulla mappa.</p>}
                                <ComuneSearch province={input.province} value={input.comune} onPick={pickComune} onClear={() => set("comune")(null)} />
                                <p className="text-[10px] text-slate-400">Clicca la piantina per aprire la mappa delle zone neve (NTC 2018 §3.4.2).</p>
                            </div>
                        </div>
                        {input.comune && (
                            <p className="-mt-1 mb-3 text-[11px] leading-4 text-slate-500">
                                {input.comune.alt !== null
                                    ? `Altitudine del centro comunale (ISTAT): ${input.comune.alt} m s.l.m. · territorio fra ${input.comune.altMin} e ${input.comune.altMax} m.`
                                    : "Comune nato da fusioni recenti: altitudine non disponibile, inseriscila a mano."}
                            </p>
                        )}
                        {input.staleFrom && (
                            <p className="-mt-1 mb-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-4 text-amber-800">
                                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                                {`L'altitudine e i dati del sito vengono dal comune di ${input.staleFrom}: scegli un comune della provincia o correggili a mano.`}
                            </p>
                        )}
                    <NumberField label="Altitudine del sito a_s" unit="m s.l.m." value={input.as} onChange={(v) => setInput((p) => ({ ...p, as: Number(v) || 0, staleFrom: null }))} />
                        {input.as > 1500 && (
                            <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-4 text-amber-800">
                                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                                Oltre 1500 m la norma rimanda alle condizioni locali di clima ed esposizione, con valori comunque non inferiori a quelli a 1500 m.
                            </p>
                        )}
                </Section>
                <Section title="Copertura" open={open.copertura} onToggle={toggle("copertura")}>
                    <div className="grid grid-cols-2 gap-3">
                        <NumberField label="Inclinazione falda α" unit="°" value={input.alpha} onChange={setN("alpha")} />
                        <NumberField label="Coeff. termico C_t" value={input.Ct} step="0.1" onChange={setN("Ct")} />
                    </div>
                    <div className="mt-3">
                        <SelectField label="Esposizione C_E" value={input.exposure} onChange={set("exposure")} options={SNOW_EXPOSURE.map((e) => ({ value: e.id, label: `${e.label} (${e.CE.toString().replace(".", ",")})` }))} />
                    </div>
                </Section>
            </div>

            {/* -------- risultati -------- */}
            <div className="space-y-4">
                <BigResult title="Carico da neve q_s" value={fmt(result.qs, 3)} unit="kN/m²" note="q_s = μ₁ · q_sk · C_E · C_t" />
                <Card>
                    <CardTitle>Grandezze</CardTitle>
                    <ResultGrid>
                        <ResultRow label="Zona" value={zone?.label ?? "–"} />
                        <ResultRow label="q_sk (al suolo)" value={fmt(result.qsk, 3)} unit="kN/m²" strong />
                        <ResultRow label="μ₁ (forma)" value={fmt(result.mu, 2)} />
                        <ResultRow label="C_E (esposizione)" value={fmt(result.CE, 2)} />
                        <ResultRow label="C_t (termico)" value={fmt(result.Ct, 2)} />
                    </ResultGrid>
                    {zone && (
                        <div className="mt-3 space-y-1 overflow-x-auto rounded-xl bg-slate-50 px-3 py-2 text-[13px]">
                            <Tex display>{qskTex}</Tex>
                            <Tex display>{String.raw`q_s=${texN(result.mu)}\cdot${texN(result.qsk, 3)}\cdot${texN(result.CE)}\cdot${texN(result.Ct)}=${texN(result.qs, 3)}\ \text{kN/m}^2`}</Tex>
                        </div>
                    )}
                </Card>
                <InfoBox>
                    NTC 2018 §3.4. Zona dalla provincia (§3.4.2), q_sk da Tab. 3.4.I in funzione
                    di zona e altitudine; μ₁ = 0,8 per 0≤α≤30°, poi 0,8·(60−α)/30 fino a 60°,
                    0 oltre. C_E da Tab. 3.4.II, C_t = 1 salvo dispersioni termiche.
                </InfoBox>
            </div>

            {mapOpen && (
                <MapPickerModal title="Zone di carico della neve — NTC 2018 §3.4.2" province={input.province} onPick={pickProvince} onClose={() => setMapOpen(false)}>
                    {(pick) => <SnowZoneMap value={input.province} onChange={pick} />}
                </MapPickerModal>
            )}
        </div>
    );
}
