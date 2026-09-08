// src/ui/layout/DisciplineNavbar.jsx
//
// Barra superiore del layout di materia: toggle sidebar, breadcrumb
// (Home / Materia / Strumento) e identità utente.

import { Link } from "react-router-dom";
import { Menu, X, ChevronRight, Home } from "lucide-react";
import { disciplinePath } from "../../config/disciplines";

export default function DisciplineNavbar({
    discipline,
    tool,
    isSidebarOpen,
    onToggleSidebar,
}) {
    return (
        <header
            className={`
                fixed right-0 top-0 z-30 h-16 border-b border-slate-200 bg-white
                transition-all duration-300
                ${isSidebarOpen ? "left-64" : "left-20"}
            `}
        >
            <div className="flex h-full items-center justify-between px-6">
                <div className="flex min-w-0 items-center gap-3">
                    <button
                        type="button"
                        onClick={onToggleSidebar}
                        className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                        aria-label="Attiva/disattiva sidebar"
                    >
                        {isSidebarOpen ? <X size={22} /> : <Menu size={22} />}
                    </button>

                    {/* Breadcrumb */}
                    <nav className="flex min-w-0 items-center gap-1.5 text-sm">
                        <Link
                            to="/"
                            className="flex items-center gap-1 text-slate-400 transition hover:text-slate-700"
                        >
                            <Home size={15} />
                            <span className="hidden sm:inline">Home</span>
                        </Link>

                        <ChevronRight size={14} className="text-slate-300" />

                        <Link
                            to={disciplinePath(discipline.id)}
                            className={`truncate font-semibold ${
                                tool ? "text-slate-500 hover:text-slate-800" : "text-slate-800"
                            }`}
                        >
                            {discipline.name}
                        </Link>

                        {tool && (
                            <>
                                <ChevronRight size={14} className="text-slate-300" />
                                <span className="truncate font-semibold text-slate-800">
                                    {tool.name}
                                </span>
                            </>
                        )}
                    </nav>
                </div>

                <div className="flex shrink-0 items-center gap-3">
                    <div className="hidden text-right sm:block">
                        <p className="text-sm font-semibold text-slate-800">
                            Gregorio
                        </p>
                        <p className="text-xs text-slate-500">Admin</p>
                    </div>

                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
                        G
                    </div>
                </div>
            </div>
        </header>
    );
}
