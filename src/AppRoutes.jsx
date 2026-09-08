import { BrowserRouter, Route, Routes } from "react-router-dom";
import DisciplineLayout from "./ui/layout/DisciplineLayout";
import HomePage from "./pages/HomePage";
import DisciplineOverviewPage from "./pages/DisciplineOverviewPage";
import ToolPage from "./pages/ToolPage";
import NotFoundPage from "./pages/NotFoundPAge";

export default function AppRoutes() {
    return (
        <BrowserRouter>
            <Routes>
                {/* Home: selezione della materia */}
                <Route path="/" element={<HomePage />} />

                {/* Materia: layout con sidebar dinamica */}
                <Route path="/:disciplineId" element={<DisciplineLayout />}>
                    <Route index element={<DisciplineOverviewPage />} />
                    <Route path=":toolId" element={<ToolPage />} />
                </Route>

                <Route path="*" element={<NotFoundPage />} />
            </Routes>
        </BrowserRouter>
    );
}
