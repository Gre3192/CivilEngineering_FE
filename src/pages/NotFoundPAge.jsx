import { Link } from "react-router-dom";
import { Home, AlertTriangle } from "lucide-react";

export default function NotFoundPage() {
    return (
        <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
            <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-500">
                    <AlertTriangle size={32} />
                </div>

                <h1 className="mt-6 text-6xl font-bold text-slate-900">
                    404
                </h1>

                <h2 className="mt-3 text-2xl font-semibold text-slate-800">
                    Pagina non trovata
                </h2>

                <p className="mt-3 text-sm leading-6 text-slate-500">
                    La pagina che stai cercando non esiste oppure è stata spostata.
                </p>

                <Link
                    to="/dashboard"
                    className="mt-8 inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
                >
                    <Home size={18} />
                    Torna alla dashboard
                </Link>
            </div>
        </div>
    );
}