import { createContext, useCallback, useContext, useRef, useState } from "react";
import type { ReactNode } from "react";
import { CheckCircle, AlertCircle, Info, AlertTriangle, X } from "lucide-react";

export type ToastKind = "success" | "error" | "info" | "warning";

interface ToastItem { id: number; message: string; kind: ToastKind; exiting?: boolean; }

const ToastCtx = createContext<(msg: string, kind?: ToastKind) => void>(() => {});

let counter = 0;

const ICONS = {
  success: <CheckCircle size={15} />,
  error:   <AlertCircle size={15} />,
  info:    <Info size={15} />,
  warning: <AlertTriangle size={15} />,
};

const COLORS: Record<ToastKind, string> = {
  success: "var(--ok)",
  error:   "var(--critical)",
  info:    "var(--accent)",
  warning: "var(--medium)",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.map((t) => t.id === id ? { ...t, exiting: true } : t));
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 200);
  }, []);

  const push = useCallback((message: string, kind: ToastKind = "info") => {
    const id = ++counter;
    setToasts((prev) => [...prev.slice(-4), { id, message, kind }]);
    const t = setTimeout(() => dismiss(id), 3800);
    timers.current.set(id, t);
  }, [dismiss]);

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}${t.exiting ? " exiting" : ""}`}>
            <span style={{ color: COLORS[t.kind], flexShrink: 0, marginTop: 1 }}>{ICONS[t.kind]}</span>
            <span style={{ flex: 1, fontSize: 13 }}>{t.message}</span>
            <button
              onClick={() => dismiss(t.id)}
              style={{ background: "none", border: "none", color: "rgba(255,255,255,.5)", cursor: "pointer", padding: 2, display: "flex", flexShrink: 0 }}
            >
              <X size={13} />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() { return useContext(ToastCtx); }
