import { useEffect, useRef, useState, useCallback } from "react";
import { X, Loader2 } from "lucide-react";
import { uploadAvatar } from "@/lib/userProfile";

interface Props {
  file: File;
  uid: string;
  onSuccess: (url: string) => void;
  onCancel: () => void;
}

export default function AvatarCropModal({ file, uid, onSuccess, onCancel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offscreenRef = useRef<HTMLImageElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  // Image draw state
  const imgRef = useRef<HTMLImageElement | null>(null);
  const offsetRef = useRef({ x: 0, y: 0 });
  const scaleRef = useRef(1);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const pinchRef = useRef<{ startDist: number; origScale: number } | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const radius = Math.min(W, H) * 0.85 / 2;
    const cx = W / 2;
    const cy = H / 2;

    ctx.clearRect(0, 0, W, H);

    // Draw the image
    const scale = scaleRef.current;
    const ox = offsetRef.current.x;
    const oy = offsetRef.current.y;
    const drawW = img.naturalWidth * scale;
    const drawH = img.naturalHeight * scale;
    ctx.drawImage(img, cx - drawW / 2 + ox, cy - drawH / 2 + oy, drawW, drawH);

    // Draw circular overlay
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Draw circle border
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }, []);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      // Fit image to canvas initially
      const canvas = canvasRef.current;
      if (!canvas) return;
      const scale = Math.max(canvas.width / img.naturalWidth, canvas.height / img.naturalHeight);
      scaleRef.current = Math.max(1, scale);
      offsetRef.current = { x: 0, y: 0 };
      draw();
    };
    img.src = url;
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file, draw]);

  // Pointer drag
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: offsetRef.current.x,
      origY: offsetRef.current.y,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current) return;
    offsetRef.current = {
      x: dragRef.current.origX + (e.clientX - dragRef.current.startX),
      y: dragRef.current.origY + (e.clientY - dragRef.current.startY),
    };
    draw();
  };

  const handlePointerUp = () => {
    dragRef.current = null;
  };

  // Scroll to zoom
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.1 : -0.1;
    scaleRef.current = Math.min(4, Math.max(1, scaleRef.current + delta));
    draw();
  };

  // Touch pinch
  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (pinchRef.current) {
        const ratio = dist / pinchRef.current.startDist;
        scaleRef.current = Math.min(4, Math.max(1, pinchRef.current.origScale * ratio));
        draw();
      } else {
        pinchRef.current = { startDist: dist, origScale: scaleRef.current };
      }
    }
  };

  const handleTouchEnd = () => {
    pinchRef.current = null;
  };

  const handleSave = async () => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    setError("");
    setUploading(true);

    const W = canvas.width;
    const H = canvas.height;
    const cx = W / 2;
    const cy = H / 2;
    const scale = scaleRef.current;
    const ox = offsetRef.current.x;
    const oy = offsetRef.current.y;

    const out = document.createElement("canvas");
    out.width = 256;
    out.height = 256;
    const ctx = out.getContext("2d");
    if (!ctx) return;

    ctx.beginPath();
    ctx.arc(128, 128, 128, 0, Math.PI * 2);
    ctx.clip();

    // Map from display canvas to output canvas
    const drawW = img.naturalWidth * scale;
    const drawH = img.naturalHeight * scale;
    const srcX = cx - drawW / 2 + ox;
    const srcY = cy - drawH / 2 + oy;
    const scaleToOut = 256 / Math.min(W, H) / 0.85;
    ctx.drawImage(
      img,
      (cx - drawW / 2 + ox - (cx - Math.min(W, H) * 0.85 / 2)) * scaleToOut,
      (cy - drawH / 2 + oy - (cy - Math.min(W, H) * 0.85 / 2)) * scaleToOut,
      drawW * scaleToOut,
      drawH * scaleToOut
    );

    out.toBlob(async (blob) => {
      if (!blob) { setError("Failed to process image."); setUploading(false); return; }
      const croppedFile = new File([blob], "avatar.jpg", { type: "image/jpeg" });
      try {
        const url = await uploadAvatar(croppedFile, uid);
        onSuccess(url);
      } catch (err: any) {
        const code: string = err?.code ?? "";
        if (code === "storage/unauthorized" || code === "permission-denied") {
          setError("Upload blocked. Ensure you are signed in with your XMUM email.");
        } else {
          setError("Upload failed. Please try again.");
        }
        setUploading(false);
      }
    }, "image/jpeg", 0.82);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-slate-700">
          <h2 className="text-base font-bold text-gray-900 dark:text-slate-100">Crop Profile Photo</h2>
          <button
            onClick={onCancel}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-400 dark:text-slate-500 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4">
          <canvas
            ref={canvasRef}
            width={320}
            height={320}
            className="w-full rounded-xl touch-none cursor-grab active:cursor-grabbing bg-gray-900"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onWheel={handleWheel}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          />
          <p className="text-xs text-center text-gray-400 dark:text-slate-500 mt-2">
            Drag to reposition · Pinch or scroll to zoom
          </p>

          {error && (
            <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-3 py-2 mt-3">
              {error}
            </p>
          )}

          <button
            onClick={handleSave}
            disabled={uploading}
            className="mt-4 w-full min-h-[52px] bg-[#003366] dark:bg-blue-600 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[#002244] dark:hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {uploading ? <><Loader2 size={16} className="animate-spin" /> Uploading…</> : "Use This Photo"}
          </button>
          <button
            onClick={onCancel}
            className="mt-2 w-full text-sm text-slate-400 dark:text-slate-500 py-2 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
