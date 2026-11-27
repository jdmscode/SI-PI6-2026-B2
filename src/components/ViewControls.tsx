import { RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import * as THREE from "three";
import { DEFAULT_CAMERA_TARGET } from "@/components/CameraController";

export type VistaCorpo = "frente" | "costas" | "direita" | "esquerda";

const DIST = 3.2;
const ALTURA = 0.8;

/** Posições de câmera para cada vista. O paciente olha para +z; o lado esquerdo dele fica em +x. */
export const VISTAS: Record<VistaCorpo, { label: string; pos: THREE.Vector3 }> = {
  frente: { label: "Frente", pos: new THREE.Vector3(0, ALTURA, DIST) },
  costas: { label: "Costas", pos: new THREE.Vector3(0, ALTURA, -DIST) },
  direita: { label: "Lado D", pos: new THREE.Vector3(-DIST, ALTURA, 0) },
  esquerda: { label: "Lado E", pos: new THREE.Vector3(DIST, ALTURA, 0) },
};

interface ViewControlsProps {
  vista: VistaCorpo | null;
  onVista: (v: VistaCorpo) => void;
  onZoom: (fator: number) => void;
  onReset: () => void;
  className?: string;
  vertical?: boolean;
}

export function ViewControls({ vista, onVista, onZoom, onReset, className = "", vertical = false }: ViewControlsProps) {
  const btn = "h-8 px-2.5 rounded-md text-xs font-medium transition-colors";
  return (
    <div className={`flex ${vertical ? "flex-col items-stretch" : "items-center"} gap-1 rounded-xl bg-card/95 backdrop-blur p-1 shadow-surface border border-border ${className}`} role="toolbar" aria-label="Vistas do corpo">
      {(Object.keys(VISTAS) as VistaCorpo[]).map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onVista(v)}
          aria-pressed={vista === v}
          className={`${btn} ${vista === v ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"}`}
          title={v === "direita" ? "Lado direito do paciente" : v === "esquerda" ? "Lado esquerdo do paciente" : VISTAS[v].label}
        >
          {VISTAS[v].label}
        </button>
      ))}
      <span className={vertical ? "h-px w-full bg-border my-1" : "w-px h-5 bg-border mx-1"} />
      <div className={vertical ? "flex justify-between" : "contents"}>
        <button type="button" onClick={() => onZoom(0.8)} className={`${btn} text-foreground hover:bg-muted`} aria-label="Aproximar"><ZoomIn className="w-4 h-4" /></button>
      <button type="button" onClick={() => onZoom(1.25)} className={`${btn} text-foreground hover:bg-muted`} aria-label="Afastar"><ZoomOut className="w-4 h-4" /></button>
      <button type="button" onClick={onReset} className={`${btn} text-foreground hover:bg-muted`} aria-label="Voltar à vista inicial"><RotateCcw className="w-4 h-4" /></button>
      </div>
    </div>
  );
}

/** Calcula a nova posição de câmera para aproximar/afastar mantendo a direção atual. */
export function zoomCamera(camera: THREE.Camera, target: THREE.Vector3 | undefined, fator: number) {
  const alvo = target ?? DEFAULT_CAMERA_TARGET;
  const dir = camera.position.clone().sub(alvo);
  const dist = THREE.MathUtils.clamp(dir.length() * fator, 0.25, 6);
  return { pos: alvo.clone().add(dir.setLength(dist)), target: alvo.clone() };
}
