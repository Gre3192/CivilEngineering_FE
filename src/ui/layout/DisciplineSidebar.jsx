// src/ui/layout/DisciplineSidebar.jsx
//
// Sidebar generata dalla materia attiva: mostra le sezioni e i relativi
// strumenti presi da src/config/disciplines.js.

import { NavLink, Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, LayoutGrid } from "lucide-react";
import { toolPath, disciplinePath, FALLBACK_ICON } from "../../config/disciplines";

export default function DisciplineSidebar({ discipline, isOpen, onToggle }) {
    const DisciplineIcon = discipline.icon || FALLBACK_ICON;

    return (
        <aside
            className={`
                fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-slate-200 bg-white
                transition-all duration-300
                ${isOpen ? "w-64" : "w-20"}
            `}
        >
            {/* Intestazione materia */}
            <div className="flex h-16 items-center gap-3 border-b border-slate-200 px-4">
                <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white ${discipline.accent.gradient}`}
                >
                    <DisciplineIcon size={18} />
                </div>

                {isOpen && (
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-slate-800">
                            {discipline.name}
                        </p>
                        <p className="truncate text-xs text-slate-400">
                            Strumenti
                        </p>
                    </div>
                )}

                <button
                    type="button"
                    onClick={onToggle}
                    className="ml-auto rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                    aria-label={isOpen ? "Comprimi sidebar" : "Espandi sidebar"}
                >
                    {isOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
                </button>
            </div>

            {/* Voci */}
            <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
                {/* Panoramica materia */}
                <NavLink
                    to={disciplinePath(discipline.id)}
                    end
                    className={({ isActive }) => `
                        flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition
                        ${!isOpen ? "justify-center" : ""}
                        ${
                            isActive
                                ? "bg-slate-900 text-white"
                                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                        }
                    `}
                    title="Panoramica"
                >
                    <LayoutGrid size={18} className="shrink-0" />
                    {isOpen && <span>Panoramica</span>}
                </NavLink>

                {discipline.sections.map((section) => (
                    <div key={section.title}>
                        {isOpen && (
                            <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                                {section.title}
                            </p>
                        )}

                        <div className="space-y-1">
                            {section.tools.map((tool) => {
                                const Icon = tool.icon || FALLBACK_ICON;

                                return (
                                    <NavLink
                                        key={tool.id}
                                        to={toolPath(discipline.id, tool.id)}
                                        className={({ isActive }) => `
                                            group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition
                                            ${!isOpen ? "justify-center" : ""}
                                            ${
                                                isActive
                                                    ? `${discipline.accent.bg} ${discipline.accent.text}`
                                                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                                            }
                                        `}
                                        title={tool.name}
                                    >
                                        <Icon size={18} className="shrink-0" />

                                        {isOpen && (
                                            <span className="flex-1 truncate">
                                                {tool.name}
                                            </span>
                                        )}

                                        {isOpen && tool.status === "wip" && (
                                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-400">
                                                WIP
                                            </span>
                                        )}
                                    </NavLink>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </nav>

            {/* Torna alla home */}
            <div className="border-t border-slate-200 p-3">
                <Link
                    to="/"
                    className={`
                        flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800
                        ${!isOpen ? "justify-center" : ""}
                    `}
                    title="Tutte le materie"
                >
                    <ChevronLeft size={18} className="shrink-0" />
                    {isOpen && <span>Tutte le materie</span>}
                </Link>
            </div>
        </aside>
    );
}
