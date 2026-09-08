// src/pages/HomePage.jsx
//
// Schermata iniziale dell'hub: selezione della materia. Le card sono generate
// automaticamente dalla configurazione in src/config/disciplines.js.

import { Link } from "react-router-dom";
import { ArrowRight, Hammer } from "lucide-react";
import {
    getDisciplines,
    disciplinePath,
    countTools,
    FALLBACK_ICON,
} from "../config/disciplines";

export default function HomePage() {
    const disciplines = getDisciplines();

    return (
        <div className="min-h-screen bg-slate-100">
            <div className="mx-auto max-w-6xl px-6 py-14">
                <header className="mb-12 text-center">
                    <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg">
                        <Hammer size={26} />
                    </div>

                    <h1 className="text-4xl font-bold tracking-tight text-slate-900">
                        Ingegneria Civile Strutturale
                    </h1>

                    <p className="mx-auto mt-3 max-w-2xl text-base leading-7 text-slate-500">
                        Seleziona una materia per accedere agli strumenti di
                        progetto e verifica dedicati.
                    </p>
                </header>

                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-2">
                    {disciplines.map((discipline) => (
                        <DisciplineCard
                            key={discipline.id}
                            discipline={discipline}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}

function DisciplineCard({ discipline }) {
    const Icon = discipline.icon || FALLBACK_ICON;
    const total = countTools(discipline);

    return (
        <Link
            to={disciplinePath(discipline.id)}
            className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
        >
            <div className="flex items-start gap-4">
                <div
                    className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-md ${discipline.accent.gradient}`}
                >
                    <Icon size={26} />
                </div>

                <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                        <h2 className="text-xl font-bold text-slate-900">
                            {discipline.name}
                        </h2>

                        <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${discipline.accent.bg} ${discipline.accent.text}`}
                        >
                            {total} strumenti
                        </span>
                    </div>

                    <p className="mt-1 text-sm font-medium text-slate-500">
                        {discipline.tagline}
                    </p>
                </div>
            </div>

            <p className="mt-4 text-sm leading-6 text-slate-500">
                {discipline.description}
            </p>

            <div
                className={`mt-5 inline-flex items-center gap-2 text-sm font-semibold ${discipline.accent.text}`}
            >
                Apri materia
                <ArrowRight
                    size={16}
                    className="transition-transform group-hover:translate-x-1"
                />
            </div>
        </Link>
    );
}
