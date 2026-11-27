import { AlertTriangle, CheckCircle2, CircleDashed, HelpCircle, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

type Nivel = "alto" | "medio" | "baixo" | "indefinido" | "pendente";

const CONFIG: Record<Nivel, { label: string; className: string; icon: typeof AlertTriangle }> = {
  alto: { label: "Risco alto", className: "bg-red-50 text-red-700 ring-red-200", icon: ShieldAlert },
  medio: { label: "Risco médio", className: "bg-amber-50 text-amber-800 ring-amber-200", icon: AlertTriangle },
  baixo: { label: "Risco baixo", className: "bg-emerald-50 text-emerald-700 ring-emerald-200", icon: CheckCircle2 },
  indefinido: { label: "Inconclusivo", className: "bg-slate-100 text-slate-700 ring-slate-200", icon: HelpCircle },
  pendente: { label: "Sem análise", className: "bg-slate-100 text-slate-600 ring-slate-200", icon: CircleDashed },
};

/** Normaliza os formatos usados pela API ("alto", "ALTO RISCO", "BAIXO RISCO", "médio"...). */
export function normalizarRisco(valor?: string | null): Nivel {
  const v = (valor ?? "").toLowerCase();
  if (v.includes("alto")) return "alto";
  if (v.includes("med") || v.includes("méd")) return "medio";
  if (v.includes("baixo")) return "baixo";
  if (v.includes("indef")) return "indefinido";
  return "pendente";
}

export function RiskBadge({ risco, className, size = "sm" }: { risco?: string | null; className?: string; size?: "sm" | "md" }) {
  const nivel = normalizarRisco(risco);
  const { label, className: cor, icon: Icon } = CONFIG[nivel];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-semibold ring-1 ring-inset whitespace-nowrap",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-3 py-1 text-xs",
        cor,
        className,
      )}
    >
      <Icon className={size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"} aria-hidden />
      {label}
    </span>
  );
}
