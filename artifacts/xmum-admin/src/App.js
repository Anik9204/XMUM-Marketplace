import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Switch, Route, Redirect } from "wouter";
import { useAuth } from "./contexts/AuthContext";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import ReportsPage from "./pages/ReportsPage";
import UsersPage from "./pages/UsersPage";
import AdsPage from "./pages/AdsPage";
import RentalAuditPage from "./pages/RentalAuditPage";
import VerificationPage from "./pages/VerificationPage";
import ReviewsPage from "./pages/ReviewsPage";
import ListingsPage from "./pages/ListingsPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import ShopsPage from "./pages/ShopsPage";
import ShopAdsPage from "./pages/ShopAdsPage";
import AuditLogPage from "./pages/AuditLogPage";
import ShopApprovalsPage from "./pages/ShopApprovalsPage";
import Layout from "./components/Layout";
export default function App() {
    const { user, isEditor, loading } = useAuth();
    if (loading) {
        return (_jsx("div", { className: "flex items-center justify-center h-screen bg-slate-50 dark:bg-slate-900", children: _jsx("div", { className: "w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" }) }));
    }
    if (!user || !isEditor) {
        return _jsx(LoginPage, {});
    }
    return (_jsx(Layout, { children: _jsxs(Switch, { children: [_jsx(Route, { path: "/", component: DashboardPage }), _jsx(Route, { path: "/listings", component: ListingsPage }), _jsx(Route, { path: "/users", component: UsersPage }), _jsx(Route, { path: "/reports", component: ReportsPage }), _jsx(Route, { path: "/reviews", component: ReviewsPage }), _jsx(Route, { path: "/verifications", component: VerificationPage }), _jsx(Route, { path: "/rental-audit", component: RentalAuditPage }), _jsx(Route, { path: "/ads", component: AdsPage }), _jsx(Route, { path: "/analytics", component: AnalyticsPage }), _jsx(Route, { path: "/shops", component: ShopsPage }), _jsx(Route, { path: "/shop-ads", component: ShopAdsPage }), _jsx(Route, { path: "/audit-log", component: AuditLogPage }), _jsx(Route, { path: "/shop-approvals", component: ShopApprovalsPage }), _jsx(Route, { children: _jsx(Redirect, { to: "/" }) })] }) }));
}
