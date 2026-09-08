// src/pages/ToolPage.jsx
//
// Pagina di un singolo strumento. Se lo strumento definisce un `component`
// (es. l'editor CAD), lo renderizza; altrimenti mostra un segnaposto
// "in sviluppo" coerente col resto dell'hub.

import { Navigate, useOutletContext, useParams } from "react-router-dom";
import { Construction } from "lucide-react";
import { getTool, FALLBACK_ICON } from "../config/disciplines";

export default function ToolPage() {
    const { discipline } = useOutletContext();
    const { toolId } = useParams();

    const tool = getTool(discipline.id, toolId);

    if (!tool) {
        return <Navigate to={`/${discipline.id}`} replace />;
    }

    const Icon = tool.icon || FALLBACK_ICON;

    return (
        <div className="mx-auto max-w-6xl">
            <header className="mb-6 flex items-start gap-4">
                <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${discipline.accent.bg} ${discipline.accent.text}`}
                >
                    <Icon size={24} />
                </div>

                <div>
                    <h1 className="text-2xl font-bold text-slate-900">
                        {tool.name}
                    </h1>
                    <p className="mt-1 text-sm text-slate-500">
                        {tool.description}
                    </p>
                </div>
            </header>

            {tool.component ? (
                <tool.component />
            ) : (
                <PlaceholderTool discipline={discipline} tool={tool} />
            )}
        </div>
    );
}

function PlaceholderTool({ discipline, tool }) {
    return (
        <div className="flex min-h-[50vh] items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <div className="max-w-md">
                <div
                    className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${discipline.accent.bg} ${discipline.accent.text}`}
                >
                    <Construction size={30} />
                </div>

                <h2 className="mt-6 text-xl font-semibold text-slate-800">
                    Strumento in sviluppo
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                    "{tool.name}" fa parte della materia {discipline.name} ma non
                    è ancora stato implementato. La struttura è pronta: qui verrà
                    inserito il modulo di calcolo.
                </p>
            </div>
        </div>
    );
}
