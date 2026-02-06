"use client";

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

type ToastVariant = "default" | "success" | "error" | "warning";

type ToastItem = {
  id: string;
  message: string;
  variant: ToastVariant;
  durationMs: number;
};

type ToastApi = {
  push: (message: string, opts?: { variant?: ToastVariant; durationMs?: number }) => void;
  success: (message: string, opts?: { durationMs?: number }) => void;
  error: (message: string, opts?: { durationMs?: number }) => void;
  warning: (message: string, opts?: { durationMs?: number }) => void;
  info: (message: string, opts?: { durationMs?: number }) => void;
};

type ToastContextValue = {
  toast: ToastApi;
  items: ToastItem[];
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timeoutsRef = useRef<Record<string, number>>({});

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
    const to = timeoutsRef.current[id];
    if (to) window.clearTimeout(to);
    delete timeoutsRef.current[id];
  }, []);

  const push = useCallback(
    (message: string, opts?: { variant?: ToastVariant; durationMs?: number }) => {
      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const durationMs = Math.max(1500, opts?.durationMs ?? 3500);
      const next: ToastItem = {
        id,
        message,
        variant: opts?.variant ?? "default",
        durationMs,
      };

      setItems((prev) => [next, ...prev].slice(0, 4));

      timeoutsRef.current[id] = window.setTimeout(() => {
        dismiss(id);
      }, durationMs);
    },
    [dismiss]
  );

  const toast: ToastApi = useMemo(
    () => ({
      push,
      success: (message, opts) => push(message, { ...opts, variant: "success" }),
      error: (message, opts) => push(message, { ...opts, variant: "error" }),
      warning: (message, opts) => push(message, { ...opts, variant: "warning" }),
      info: (message, opts) => push(message, { ...opts, variant: "default" }),
    }),
    [push]
  );

  const value = useMemo(() => ({ toast, items, dismiss }), [toast, items, dismiss]);

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return { toast: ctx.toast };
}

export function ToastViewport() {
  const ctx = useContext(ToastContext);
  if (!ctx) return null;

  const { items, dismiss } = ctx;

  return (
    <div className="fixed top-4 right-4 z-[9999] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2">
      {items.map((t) => {
        const base =
          "pointer-events-auto rounded-xl border px-3 py-2 shadow-lg backdrop-blur bg-white/90";
        const variantCls =
          t.variant === "success"
            ? "border-emerald-200 text-emerald-900"
            : t.variant === "error"
              ? "border-rose-200 text-rose-900"
              : t.variant === "warning"
                ? "border-amber-200 text-amber-900"
                : "border-slate-200 text-slate-900";

        return (
          <button
            key={t.id}
            type="button"
            onClick={() => dismiss(t.id)}
            className={`${base} ${variantCls} text-left`}
          >
            <div className="text-sm font-medium">{t.message}</div>
          </button>
        );
      })}
    </div>
  );
}
