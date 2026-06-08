import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import MainLayout from "./ui/layout/layout";
import DashboardPage from "./pages/DashboardPage";
import NotFoundPage from "./pages/NotFoundPAge"

export default function AppRoutes() {
    return (
        <BrowserRouter>
            <Routes>
                <Route element={<MainLayout />}>
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    <Route path="/dashboard" element={<DashboardPage />} />

                    <Route path="*" element={<NotFoundPage />} />
                </Route>
            </Routes>
        </BrowserRouter>
    );
}