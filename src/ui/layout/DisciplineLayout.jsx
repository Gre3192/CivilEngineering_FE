// src/ui/layout/DisciplineLayout.jsx
//
// Layout delle rotte di materia: sidebar dinamica + navbar + area contenuto.
// Se la materia in URL non esiste, reindirizza alla home.
//
// Da desktop (>= lg) la sidebar è fissa a sinistra (estesa o compressa a
// icone); sotto lg diventa un pannello a scomparsa sopra al contenuto, chiuso
// di default e richiuso automaticamente al cambio di pagina.

import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation, useParams } from "react-router-dom";
import DisciplineSidebar from "./DisciplineSidebar";
import DisciplineNavbar from "./DisciplineNavbar";
import { getDiscipline, getTool } from "../../config/disciplines";

const isDesktop = () => typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches;

export default function DisciplineLayout() {
    // useParams espone anche i parametri delle rotte figlie (toolId).
    const { disciplineId, toolId } = useParams();
    const { pathname } = useLocation();
    const [isSidebarOpen, setIsSidebarOpen] = useState(isDesktop);

    // su schermi stretti la sidebar si chiude quando si cambia pagina
    useEffect(() => {
        if (!isDesktop()) setIsSidebarOpen(false);
    }, [pathname]);

    const discipline = getDiscipline(disciplineId);

    if (!discipline) {
        return <Navigate to="/" replace />;
    }

    const tool = toolId ? getTool(disciplineId, toolId) : null;

    function handleToggleSidebar() {
        setIsSidebarOpen((prev) => !prev);
    }

    return (
        <div className="min-h-screen bg-slate-100">
            <DisciplineSidebar
                discipline={discipline}
                isOpen={isSidebarOpen}
                onToggle={handleToggleSidebar}
            />

            {/* sfondo che chiude la sidebar aperta sopra il contenuto (solo schermi stretti) */}
            {isSidebarOpen && (
                <button
                    type="button"
                    aria-label="Chiudi menu"
                    onClick={() => setIsSidebarOpen(false)}
                    className="fixed inset-0 z-30 bg-slate-900/30 lg:hidden"
                />
            )}

            <DisciplineNavbar
                discipline={discipline}
                tool={tool}
                isSidebarOpen={isSidebarOpen}
                onToggleSidebar={handleToggleSidebar}
            />

            <main
                className={`
                    min-h-screen pt-16 transition-all duration-300
                    ${isSidebarOpen ? "lg:pl-64" : "lg:pl-20"}
                `}
            >
                <div className="p-4 sm:p-6">
                    {/* Le pagine figlie ricevono materia via context dell'Outlet. */}
                    <Outlet context={{ discipline }} />
                </div>
            </main>
        </div>
    );
}
