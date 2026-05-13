import { useLocation } from "wouter";

export default function NotFound() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 text-center animate-in fade-in duration-300">
      <div className="w-24 h-24 rounded-3xl bg-[#003366]/5 dark:bg-blue-900/20 flex items-center justify-center mb-6">
        <span className="text-4xl">🔍</span>
      </div>
      <h1 className="text-3xl font-display font-bold text-gray-900 dark:text-slate-100 mb-2">Page not found</h1>
      <p className="text-gray-500 dark:text-slate-400 text-sm max-w-xs mb-8">
        This page doesn&apos;t exist — it may have been removed or the link is incorrect.
      </p>
      <button
        onClick={() => navigate("/")}
        className="btn-primary px-8"
      >
        Back to Marketplace
      </button>
    </div>
  );
}
