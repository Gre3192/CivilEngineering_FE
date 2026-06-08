import { Menu, X } from "lucide-react";

export default function Navbar({ isSidebarOpen, onToggleSidebar }) {
    return (
        <header
            className={`
                fixed right-0 top-0 z-30 h-16 border-b border-slate-200 bg-white
                transition-all duration-300
                ${isSidebarOpen ? "left-64" : "left-20"}
            `}
        >
            <div className="flex h-full items-center justify-between px-6">
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={onToggleSidebar}
                        className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                    >
                        {isSidebarOpen ? <X size={22} /> : <Menu size={22} />}
                    </button>

                    <h2 className="text-lg font-semibold text-slate-800">
                        Dashboard
                    </h2>
                </div>

                <div className="flex items-center gap-3">
                    <div className="text-right">
                        <p className="text-sm font-semibold text-slate-800">
                            Gregorio
                        </p>
                        <p className="text-xs text-slate-500">
                            Admin
                        </p>
                    </div>

                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
                        G
                    </div>
                </div>
            </div>
        </header>
    );
}