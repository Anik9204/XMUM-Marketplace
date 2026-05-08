import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../lib/firebase";
import { Loader2, ShieldCheck } from "lucide-react";
export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    async function handleLogin() {
        setError("");
        setLoading(true);
        try {
            await signInWithEmailAndPassword(auth, email, password);
        }
        catch (e) {
            setError("Invalid credentials or insufficient permissions.");
        }
        finally {
            setLoading(false);
        }
    }
    return (_jsx("div", { className: "min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4", children: _jsxs("div", { className: "w-full max-w-sm bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8", children: [_jsxs("div", { className: "flex items-center gap-3 mb-6", children: [_jsx("div", { className: "w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center", children: _jsx(ShieldCheck, { className: "w-5 h-5 text-white" }) }), _jsxs("div", { children: [_jsx("h1", { className: "text-base font-bold text-slate-800 dark:text-slate-200", children: "XMUM Admin Panel" }), _jsx("p", { className: "text-xs text-slate-400", children: "Authorized access only" })] })] }), error && (_jsx("div", { className: "bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 mb-4", children: _jsx("p", { className: "text-sm text-red-600 dark:text-red-400", children: error }) })), _jsxs("div", { className: "space-y-3", children: [_jsx("input", { type: "email", value: email, onChange: e => setEmail(e.target.value), placeholder: "admin@xmu.edu.my", className: "w-full bg-slate-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-2.5 text-sm min-h-[44px] focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-slate-200" }), _jsx("input", { type: "password", value: password, onChange: e => setPassword(e.target.value), placeholder: "Password", onKeyDown: e => e.key === "Enter" && handleLogin(), className: "w-full bg-slate-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-2.5 text-sm min-h-[44px] focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-slate-200" }), _jsx("button", { onClick: handleLogin, disabled: loading || !email || !password, className: "w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-xl min-h-[44px] flex items-center justify-center gap-2 text-sm", children: loading
                                ? _jsxs(_Fragment, { children: [_jsx(Loader2, { className: "w-4 h-4 animate-spin" }), " Signing in\u2026"] })
                                : "Sign In" })] }), _jsx("p", { className: "text-center text-xs text-slate-400 mt-5", children: "Only admins and editors can access this panel." })] }) }));
}
