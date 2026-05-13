import { useEffect, useState } from "react";

interface Props {
  onFinish: () => void;
}

export default function LoadingScreen({ onFinish }: Props) {
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFading(true), 2000);
    const doneTimer = setTimeout(() => onFinish(), 2350);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, [onFinish]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#003366",
        opacity: fading ? 0 : 1,
        transition: "opacity 0.35s ease",
        pointerEvents: fading ? "none" : "all",
      }}
    >
      <style>{`
        @keyframes xmm-bounce-in {
          0%   { transform: translateY(60px) scale(0.4); opacity: 0; }
          55%  { transform: translateY(-10px) scale(1.07); opacity: 1; }
          75%  { transform: translateY(5px) scale(0.97); }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes xmm-pulse {
          0%   { transform: scale(1); }
          50%  { transform: scale(1.04); }
          100% { transform: scale(1); }
        }
        @keyframes xmm-dot {
          0%, 100% { transform: translateY(0); opacity: 0.5; }
          50%       { transform: translateY(-10px); opacity: 1; }
        }
        .xmm-logo {
          animation:
            xmm-bounce-in 0.65s cubic-bezier(0.34, 1.56, 0.64, 1) 0.2s both,
            xmm-pulse     0.35s ease                                 1.1s both;
        }
        .xmm-dot-1 { animation: xmm-dot 0.55s ease 1.15s infinite; }
        .xmm-dot-2 { animation: xmm-dot 0.55s ease 1.37s infinite; }
        .xmm-dot-3 { animation: xmm-dot 0.55s ease 1.59s infinite; }
      `}</style>

      <div className="xmm-logo" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <img
          src="/xmum-market-logo.png"
          alt="XMUM Market"
          style={{ width: 260, height: "auto", objectFit: "contain" }}
          draggable={false}
        />
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 52 }}>
        <div className="xmm-dot-1" style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: "#F5A623" }} />
        <div className="xmm-dot-2" style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: "#F5A623" }} />
        <div className="xmm-dot-3" style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: "#F5A623" }} />
      </div>
    </div>
  );
}
