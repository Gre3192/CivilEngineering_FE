// src/config/disciplines.js
//
// Configurazione centrale dell'hub di ingegneria civile.
//
// Ogni "materia" (discipline) contiene una lista di "sezioni", ciascuna con i
// propri "strumenti" (tool). Home, sidebar, navbar e pagine si generano
// automaticamente da questa struttura: per aggiungere uno strumento basta
// aggiungere un oggetto qui sotto.
//
// NB sui colori: Tailwind analizza le classi staticamente, quindi gli accenti
// sono scritti come stringhe complete (niente `bg-${color}-500` dinamici).

import {
    Building2,
    Frame,
    TreePine,
    Wind,
    Shapes,
    SquarePen,
    Ruler,
    Anchor,
    Scissors,
    Layers,
    Combine,
    Wrench,
    Hammer,
    Snowflake,
    Activity,
    Calculator,
    Grid3x3,
    Columns3,
    Box,
    FileText,
} from "lucide-react";

import CadGeometryCanvas from "../components/CadGeometryCanvas";
import SectionDesignTool from "../components/concrete/SectionDesignTool";
import CoverCalcTool from "../components/concrete/CoverCalcTool";
import VerifySectionTool from "../components/concrete/VerifySectionTool";
import VerifyShearTool from "../components/concrete/VerifyShearTool";
import VerifyCrackTool from "../components/concrete/VerifyCrackTool";
import AnchorLapTool from "../components/concrete/AnchorLapTool";
import LoadAnalysisTool from "../components/actions/LoadAnalysisTool";
import LoadCombosTool from "../components/actions/LoadCombosTool";
import SnowLoadTool from "../components/actions/SnowLoadTool";
import WindLoadTool from "../components/actions/WindLoadTool";
import SeismicSpectrumTool from "../components/actions/SeismicSpectrumTool";

// Icona di riserva usata se una voce non ne specifica una valida.
export const FALLBACK_ICON = Box;

export const DISCIPLINES = [
    {
        id: "calcestruzzo",
        name: "Calcestruzzo",
        tagline: "Progetto e verifica di sezioni in c.a.",
        description:
            "Strumenti per il progetto e la verifica di sezioni in cemento armato: geometria, armature, copriferri e stati limite.",
        icon: Building2,
        accent: {
            text: "text-sky-700",
            bg: "bg-sky-50",
            border: "border-sky-200",
            ring: "ring-sky-500",
            dot: "bg-sky-500",
            gradient: "from-sky-500 to-sky-700",
            softBg: "bg-sky-100",
        },
        sections: [
            {
                title: "Sezioni",
                tools: [
                    {
                        id: "editor-geometria",
                        name: "Editor geometria",
                        description:
                            "Disegna la geometria della sezione (rettangoli, cerchi, poligoni) con snap, ortho e fori.",
                        icon: Shapes,
                        status: "ready",
                        component: CadGeometryCanvas,
                    },
                    {
                        id: "progetto-sezione",
                        name: "Progetto sezione",
                        description:
                            "Dimensionamento dell'armatura a flessione (SLU) di una sezione rettangolare in c.a.",
                        icon: SquarePen,
                        status: "ready",
                        component: SectionDesignTool,
                    },
                    {
                        id: "verifica-sezione",
                        name: "Verifica sezione",
                        description:
                            "Verifica a pressoflessione retta con dominio di resistenza M-N.",
                        icon: Grid3x3,
                        status: "ready",
                        component: VerifySectionTool,
                    },
                ],
            },
            {
                title: "Dettagli costruttivi",
                tools: [
                    {
                        id: "copriferro",
                        name: "Calcolo copriferro",
                        description:
                            "Determinazione del copriferro nominale in funzione di classe di esposizione e durabilità.",
                        icon: Ruler,
                        status: "ready",
                        component: CoverCalcTool,
                    },
                    {
                        id: "ancoraggi",
                        name: "Ancoraggi e sovrapposizioni",
                        description:
                            "Lunghezze di ancoraggio e di sovrapposizione delle barre.",
                        icon: Anchor,
                        status: "ready",
                        component: AnchorLapTool,
                    },
                ],
            },
            {
                title: "Stati limite di esercizio",
                tools: [
                    {
                        id: "fessurazione",
                        name: "Verifica a fessurazione",
                        description:
                            "Controllo dell'ampiezza delle fessure w_k (SLE) secondo NTC2018/EC2.",
                        icon: Activity,
                        status: "ready",
                        component: VerifyCrackTool,
                    },
                    {
                        id: "taglio",
                        name: "Verifica a taglio",
                        description:
                            "Verifica a taglio con traliccio ad inclinazione variabile (staffe e bielle).",
                        icon: Scissors,
                        status: "ready",
                        component: VerifyShearTool,
                    },
                ],
            },
        ],
    },
    {
        id: "acciaio",
        name: "Acciaio",
        tagline: "Verifiche di membrature e unioni",
        description:
            "Verifiche di resistenza e stabilità delle membrature in acciaio e progetto delle unioni bullonate e saldate.",
        icon: Frame,
        accent: {
            text: "text-slate-700",
            bg: "bg-slate-50",
            border: "border-slate-300",
            ring: "ring-slate-500",
            dot: "bg-slate-500",
            gradient: "from-slate-500 to-slate-700",
            softBg: "bg-slate-100",
        },
        sections: [
            {
                title: "Membrature",
                tools: [
                    {
                        id: "trazione-compressione",
                        name: "Trazione e compressione",
                        description:
                            "Verifica di resistenza di aste tese e compresse.",
                        icon: Columns3,
                        status: "wip",
                    },
                    {
                        id: "flessione-taglio",
                        name: "Flessione e taglio",
                        description:
                            "Verifica di resistenza a flessione e taglio delle travi.",
                        icon: Activity,
                        status: "wip",
                    },
                    {
                        id: "instabilita",
                        name: "Instabilità",
                        description:
                            "Verifica di stabilità: aste compresse e svergolamento (LTB).",
                        icon: Layers,
                        status: "wip",
                    },
                ],
            },
            {
                title: "Unioni",
                tools: [
                    {
                        id: "unioni-bullonate",
                        name: "Unioni bullonate",
                        description:
                            "Progetto e verifica di collegamenti bullonati.",
                        icon: Wrench,
                        status: "wip",
                    },
                    {
                        id: "unioni-saldate",
                        name: "Unioni saldate",
                        description:
                            "Progetto e verifica dei cordoni di saldatura.",
                        icon: Combine,
                        status: "wip",
                    },
                ],
            },
        ],
    },
    {
        id: "legno",
        name: "Legno",
        tagline: "Verifiche SLU/SLE, unioni ed elementi speciali",
        description:
            "Verifiche agli stati limite di elementi in legno, progetto delle unioni e degli elementi speciali (travi rastremate, intagli, appoggi).",
        icon: TreePine,
        accent: {
            text: "text-amber-700",
            bg: "bg-amber-50",
            border: "border-amber-200",
            ring: "ring-amber-500",
            dot: "bg-amber-500",
            gradient: "from-amber-500 to-amber-700",
            softBg: "bg-amber-100",
        },
        sections: [
            {
                title: "Verifiche",
                tools: [
                    {
                        id: "verifiche-slu",
                        name: "Verifiche SLU",
                        description:
                            "Verifiche di resistenza agli stati limite ultimi.",
                        icon: Activity,
                        status: "wip",
                    },
                    {
                        id: "verifiche-sle",
                        name: "Verifiche SLE",
                        description:
                            "Verifiche di deformabilità e vibrazioni (esercizio).",
                        icon: Ruler,
                        status: "wip",
                    },
                ],
            },
            {
                title: "Unioni",
                tools: [
                    {
                        id: "unioni",
                        name: "Unioni",
                        description:
                            "Progetto e verifica di unioni con connettori metallici.",
                        icon: Wrench,
                        status: "wip",
                    },
                ],
            },
            {
                title: "Elementi speciali",
                tools: [
                    {
                        id: "travi-speciali",
                        name: "Travi speciali",
                        description:
                            "Travi rastremate, curve e con altezza variabile.",
                        icon: Layers,
                        status: "wip",
                    },
                    {
                        id: "intaglio-appoggio",
                        name: "Intaglio e appoggio",
                        description:
                            "Verifica di travi con intaglio e delle zone di appoggio.",
                        icon: Scissors,
                        status: "wip",
                    },
                ],
            },
        ],
    },
    {
        id: "azioni",
        name: "Azioni sulle strutture",
        tagline: "Carichi, combinazioni e azioni ambientali",
        description:
            "Definizione dei carichi, combinazioni agli stati limite e valutazione delle azioni ambientali (neve, vento, sisma).",
        icon: Wind,
        accent: {
            text: "text-emerald-700",
            bg: "bg-emerald-50",
            border: "border-emerald-200",
            ring: "ring-emerald-500",
            dot: "bg-emerald-500",
            gradient: "from-emerald-500 to-emerald-700",
            softBg: "bg-emerald-100",
        },
        sections: [
            {
                title: "Carichi",
                tools: [
                    {
                        id: "analisi-carichi",
                        name: "Analisi dei carichi",
                        description:
                            "Carichi permanenti e variabili per destinazione d'uso.",
                        icon: FileText,
                        status: "ready",
                        component: LoadAnalysisTool,
                    },
                    {
                        id: "combinazioni",
                        name: "Combinazioni di carico",
                        description:
                            "Generazione delle combinazioni SLU/SLE con i coefficienti.",
                        icon: Calculator,
                        status: "ready",
                        component: LoadCombosTool,
                    },
                ],
            },
            {
                title: "Azioni ambientali",
                tools: [
                    {
                        id: "neve",
                        name: "Carico da neve",
                        description:
                            "Valutazione del carico da neve in funzione di zona e altitudine.",
                        icon: Snowflake,
                        status: "ready",
                        component: SnowLoadTool,
                    },
                    {
                        id: "vento",
                        name: "Azione del vento",
                        description:
                            "Pressione del vento e coefficienti aerodinamici.",
                        icon: Wind,
                        status: "ready",
                        component: WindLoadTool,
                    },
                    {
                        id: "sisma",
                        name: "Azione sismica",
                        description:
                            "Spettri di risposta e definizione dell'azione sismica.",
                        icon: Activity,
                        status: "ready",
                        component: SeismicSpectrumTool,
                    },
                ],
            },
        ],
    },
];

// --- Helper di lookup -------------------------------------------------------

export function getDisciplines() {
    return DISCIPLINES;
}

export function getDiscipline(disciplineId) {
    return DISCIPLINES.find((d) => d.id === disciplineId) || null;
}

/** Restituisce tutti gli strumenti di una materia in un unico array. */
export function getDisciplineTools(disciplineId) {
    const discipline = getDiscipline(disciplineId);

    if (!discipline) return [];

    return discipline.sections.flatMap((section) =>
        section.tools.map((tool) => ({ ...tool, section: section.title }))
    );
}

export function getTool(disciplineId, toolId) {
    return getDisciplineTools(disciplineId).find((tool) => tool.id === toolId) || null;
}

/** Path assoluto di uno strumento, usato da NavLink e redirect. */
export function toolPath(disciplineId, toolId) {
    return `/${disciplineId}/${toolId}`;
}

export function disciplinePath(disciplineId) {
    return `/${disciplineId}`;
}

/** Numero totale di strumenti di una materia (per le card della home). */
export function countTools(discipline) {
    return discipline.sections.reduce(
        (total, section) => total + section.tools.length,
        0
    );
}
