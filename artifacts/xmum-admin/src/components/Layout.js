import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, Flag, Users, Megaphone, FileText, Star, GraduationCap, List, BarChart2, LogOut, Store, Newspaper, Moon, Sun, Menu, X, ShieldAlert, } from "lucide-react";
import { signOut } from "firebase/auth";
import { auth, db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { useDarkMode } from "../contexts/DarkModeContext";
import { collection, query, where, onSnapshot } from "firebase/firestore";
export default function Layout({ children }) {
    const [location] = useLocation();
    const { adminUser, isAdmin } = useAuth();
    const [pendingReports, setPendingReports] = useState(0);
    const [pendingVerifications, setPendingVerifications] = useState(0);
    const { dark, toggle } = useDarkMode();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    useEffect(() => {
        const q = query(collection(db, "reports"), where("status", "==", "pending"));
        const unsub = onSnapshot(q, (snap) => setPendingReports(snap.size), () => { });
        return unsub;
    }, []);
    useEffect(() => {
        const q = query(collection(db, "users"), where("verificationStatus", "==", "pending"));
        const unsub = onSnapshot(q, (snap) => setPendingVerifications(snap.size), () => { });
        return unsub;
    }, []);
    const NAV = [
        { href: "/", label: "Dashboard", icon: LayoutDashboard },
        { href: "/listings", label: "Listings", icon: List },
        { href: "/users", label: "Users", icon: Users },
        { href: "/reports", label: "Reports", icon: Flag },
        { href: "/reviews", label: "Reviews", icon: Star },
        { href: "/verifications", label: "Verifications", icon: GraduationCap },
        { href: "/rental-audit", label: "Rental Audit", icon: FileText },
        { href: "/ads", label: "Ads", icon: Megaphone },
        { href: "/analytics", label: "Analytics", icon: BarChart2 },
        { href: "/shops", label: "Shops", icon: Store },
        { href: "/shop-ads", label: "Shop Ads", icon: Newspaper },
        { href: "/audit-log", label: "Audit Log", icon: ShieldAlert },
    ];
    return (_jsxs("div", { className: "flex h-screen bg-slate-50 dark:bg-slate-900 overflow-hidden", children: [sidebarOpen && (_jsx("div", { className: "fixed inset-0 z-20 bg-black/40 lg:hidden", onClick: () => setSidebarOpen(false) })), _jsxs("aside", { className: `
        fixed inset-y-0 left-0 z-30 w-60 flex-shrink-0
        bg-white dark:bg-slate-800 border-r border-gray-200 dark:border-slate-700
        flex flex-col transition-transform duration-200
        lg:static lg:translate-x-0
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
      `, children: [_jsx("div", { className: "px-6 py-5 border-b border-gray-100 dark:border-slate-700", children: _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0", children: "X" }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("p", { className: "text-sm font-bold text-slate-800 dark:text-slate-200", children: "XMUM Admin" }), _jsx("p", { className: "text-[10px] text-slate-400 capitalize", children: adminUser?.role })] }), _jsx("button", { onClick: () => setSidebarOpen(false), className: "lg:hidden p-1.5 text-slate-400 hover:text-slate-700\n                         dark:hover:text-slate-200 rounded-lg transition-colors flex-shrink-0", children: _jsx(X, { className: "w-4 h-4" }) })] }) }), _jsx("nav", { className: "flex-1 px-3 py-4 space-y-1 overflow-y-auto", children: NAV.map(({ href, label, icon: Icon }) => {
                            if (label === "Audit Log" && !isAdmin)
                                return null;
                            const active = location === href;
                            return (_jsx(Link, { href: href, onClick: () => setSidebarOpen(false), children: _jsxs("a", { className: `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors min-h-[44px] ${active
                                        ? "bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400"
                                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50"}`, children: [_jsx(Icon, { className: "w-4 h-4 shrink-0" }), _jsx("span", { className: "flex-1", children: label }), label === "Reports" && pendingReports > 0 && (_jsx("span", { className: "ml-auto bg-red-500 text-white text-[9px] font-bold\n                                     rounded-full min-w-[18px] h-[18px] flex items-center\n                                     justify-center px-1", children: pendingReports > 99 ? "99+" : pendingReports })), label === "Verifications" && pendingVerifications > 0 && (_jsx("span", { className: "ml-auto bg-red-500 text-white text-[9px] font-bold\n                                     rounded-full min-w-[18px] h-[18px] flex items-center\n                                     justify-center px-1", children: pendingVerifications > 99 ? "99+" : pendingVerifications }))] }) }, href));
                        }) }), _jsxs("div", { className: "px-3 py-4 border-t border-gray-100 dark:border-slate-700", children: [_jsxs("div", { className: "px-3 py-2 mb-2", children: [_jsx("p", { className: "text-xs font-medium text-slate-700 dark:text-slate-300 truncate", children: adminUser?.displayName }), _jsx("p", { className: "text-[10px] text-slate-400 truncate", children: adminUser?.email })] }), _jsxs("button", { onClick: toggle, className: "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm\n                       text-slate-600 dark:text-slate-400 hover:bg-slate-50\n                       dark:hover:bg-slate-700/50 transition-colors min-h-[44px] mb-1", children: [dark
                                        ? _jsx(Sun, { className: "w-4 h-4 text-amber-400" })
                                        : _jsx(Moon, { className: "w-4 h-4" }), dark ? "Light Mode" : "Dark Mode"] }), _jsxs("button", { onClick: () => signOut(auth), className: "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors min-h-[44px]", children: [_jsx(LogOut, { className: "w-4 h-4" }), "Sign out"] })] })] }), _jsxs("main", { className: "flex-1 overflow-auto flex flex-col min-w-0", children: [_jsxs("div", { className: "lg:hidden flex items-center gap-3 px-4 py-3 bg-white\n                        dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700\n                        flex-shrink-0", children: [_jsx("button", { onClick: () => setSidebarOpen(true), className: "p-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200\n                       rounded-lg transition-colors", children: _jsx(Menu, { className: "w-5 h-5" }) }), _jsx("p", { className: "text-sm font-bold text-slate-800 dark:text-slate-200", children: "XMUM Admin" })] }), _jsx("div", { className: "flex-1 overflow-auto", children: children })] })] }));
}
