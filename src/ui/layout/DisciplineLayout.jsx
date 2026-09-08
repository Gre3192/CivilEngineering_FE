// src/ui/layout/DisciplineLayout.jsx
//
// Layout delle rotte di materia: sidebar dinamica + navbar + area contenuto.
// Se la materia in URL non esiste, reindirizza alla home.

import { useState } from "react";
import { Navigate, Outlet, useParams } from "react-router-dom";
import DisciplineSidebar from "./DisciplineSidebar";
import DisciplineNavbar from "./DisciplineNavbar";
import { getDiscipline, getTool } from "../../config/disciplines";

export default function DisciplineLayout() {
    // useParams espone anche i parametri delle rotte figlie (toolId).
    const { disciplineId, toolId } = useParams();
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

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

            <DisciplineNavbar
                discipline={discipline}
                tool={tool}
                isSidebarOpen={isSidebarOpen}
                onToggleSidebar={handleToggleSidebar}
            />

            <main
                className={`
                    min-h-screen pt-16 transition-all duration-300
                    ${isSidebarOpen ? "pl-64" : "pl-20"}
                `}
            >
                <div className="p-6">
                    {/* Le pagine figlie ricevono materia via context dell'Outlet. */}
                    <Outlet context={{ discipline }} />
                </div>
            </main>
        </div>
    );
}
