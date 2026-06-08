import { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Navbar from "./Navbar";

export default function MainLayout() {
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    function handleToggleSidebar() {
        setIsSidebarOpen((prev) => !prev);
    }

    return (
        <div className="min-h-screen bg-slate-100">
            <Sidebar
                isOpen={isSidebarOpen}
                onToggle={handleToggleSidebar}
            />

            <Navbar
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
                    <Outlet />
                </div>
            </main>
        </div>
    );
}