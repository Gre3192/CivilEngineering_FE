import { NavLink } from "react-router-dom";
import {
    ChevronLeft,
    ChevronRight,
    FileText,
    Home,
    Settings,
    User,
} from "lucide-react";

export default function Sidebar({ isOpen, onToggle }) {
    const menuItems = [
        {
            label: "Dashboard",
            path: "/dashboard",
            icon: Home,
        },
        {
            label: "Documenti",
            path: "/documents",
            icon: FileText,
        },
        {
            label: "Profilo",
            path: "/profile",
            icon: User,
        },
        {
            label: "Impostazioni",
            path: "/settings",
            icon: Settings,
        },
    ];

    return (
        <aside
            className={`
                fixed left-0 top-0 z-40 h-screen border-r border-slate-200 bg-white
                transition-all duration-300
                ${isOpen ? "w-64" : "w-20"}
            `}
        >
            <div className="flex h-16 items-center justify-between border-b border-slate-200 px-4">
                {isOpen && (
                    <h1 className="text-lg font-bold text-slate-800">
                        MyApp
                    </h1>
                )}

                <button
                    type="button"
                    onClick={onToggle}
                    className="ml-auto rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                >
                    {isOpen ? (
                        <ChevronLeft size={20} />
                    ) : (
                        <ChevronRight size={20} />
                    )}
                </button>
            </div>

            <nav className="mt-4 space-y-1 px-3">
                {menuItems.map((item) => {
                    const Icon = item.icon;

                    return (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={({ isActive }) => `
                                flex w-full items-center gap-3 rounded-xl px-3 py-2.5
                                text-sm font-medium transition
                                ${!isOpen ? "justify-center" : ""}
                                ${
                                    isActive
                                        ? "bg-slate-900 text-white"
                                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                                }
                            `}
                        >
                            <Icon size={20} className="shrink-0" />

                            {isOpen && <span>{item.label}</span>}
                        </NavLink>
                    );
                })}
            </nav>
        </aside>
    );
}