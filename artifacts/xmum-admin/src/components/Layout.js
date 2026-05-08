import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, Flag, Users, Megaphone, LogOut } from "lucide-react";
import { signOut } from "firebase/auth";
import { auth } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
const NAV = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/reports", label: "Reports", icon: Flag },
    { href: "/users", label: "Users", icon: Users },
    { href: "/ads", label: "Ads", icon: Megaphone },
];
export default function Layout({ children }) {
    const [location] = useLocation();
    const { adminUser } = useAuth();
    return (_jsxs("div", { className: "flex h-screen bg-slate-50 dark:bg-slate-900", children: [_jsxs("aside", { className: "w-60 flex-shrink-0 bg-white dark:bg-slate-800 border-r border-gray-200 dark:border-slate-700 flex flex-col", children: [_jsx("div", { className: "px-6 py-5 border-b border-gray-100 dark:border-slate-700", children: _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm", children: "X" }), _jsxs("div", { children: [_jsx("p", { className: "text-sm font-bold text-slate-800 dark:text-slate-200", children: "XMUM Admin" }), _jsx("p", { className: "text-[10px] text-slate-400 capitalize", children: adminUser?.role })] })] }) }), _jsx("nav", { className: "flex-1 px-3 py-4 space-y-1", children: NAV.map(({ href, label, icon: Icon }) => {
                            const active = location === href;
                            return (_jsx(Link, { href: href, children: _jsxs("a", { className: `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors min-h-[44px] ${active
                                        ? "bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400"
                                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50"}`, children: [_jsx(Icon, { className: "w-4 h-4" }), label] }) }, href));
                        }) }), _jsxs("div", { className: "px-3 py-4 border-t border-gray-100 dark:border-slate-700", children: [_jsxs("div", { className: "px-3 py-2 mb-2", children: [_jsx("p", { className: "text-xs font-medium text-slate-700 dark:text-slate-300 truncate", children: adminUser?.displayName }), _jsx("p", { className: "text-[10px] text-slate-400 truncate", children: adminUser?.email })] }), _jsxs("button", { onClick: () => signOut(auth), className: "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors min-h-[44px]", children: [_jsx(LogOut, { className: "w-4 h-4" }), "Sign out"] })] })] }), _jsx("main", { className: "flex-1 overflow-auto", children: children })] }));
}
