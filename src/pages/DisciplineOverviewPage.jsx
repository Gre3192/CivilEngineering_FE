// src/pages/DisciplineOverviewPage.jsx
//
// Pagina indice di una materia: mostra tutte le sezioni con le card degli
// strumenti. È la rotta index di /:disciplineId.

import { Link, useOutletContext } from "react-router-dom";
import { toolPath, FALLBACK_ICON } from "../config/disciplines";

export default function DisciplineOverviewPage() {
    const { discipline } = useOutletContext();

    return (
        <div className="mx-auto max-w-5xl">
            <header className="mb-8">
                <h1 className="text-2xl font-bold text-slate-900">
                    {discipline.name}
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                    {discipline.description}
                </p>
            </header>

            <div className="space-y-10">
                {discipline.sections.map((section) => (
                    <section key={section.title}>
                        <div className="mb-4 flex items-center gap-3">
                            <span
                                className={`h-2.5 w-2.5 rounded-full ${discipline.accent.dot}`}
                            />
                            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                                {section.title}
                            </h2>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {section.tools.map((tool) => (
                                <ToolCard
                                    key={tool.id}
                                    discipline={discipline}
                                    tool={tool}
                                />
                            ))}
                        </div>
                    </section>
                ))}
            </div>
        </div>
    );
}

function ToolCard({ discipline, tool }) {
    const Icon = tool.icon || FALLBACK_ICON;
    const isReady = tool.status === "ready";

    return (
        <Link
            to={toolPath(discipline.id, tool.id)}
            className="group relative flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
            <div className="flex items-center justify-between">
                <div
                    className={`flex h-11 w-11 items-center justify-center rounded-xl ${discipline.accent.bg} ${discipline.accent.text}`}
                >
                    <Icon size={20} />
                </div>

                <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        isReady
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-100 text-slate-400"
                    }`}
                >
                    {isReady ? "Pronto" : "In sviluppo"}
                </span>
            </div>

            <h3 className="mt-4 text-base font-semibold text-slate-900">
                {tool.name}
            </h3>

            <p className="mt-1 flex-1 text-sm leading-6 text-slate-500">
                {tool.description}
            </p>
        </Link>
    );
}
