import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";

export interface LesionPin {
  id: number;
  position: [number, number, number];
  localizacao: string;
  data?: string;
  risco?: string | null;
}

export const RISK_COLORS: Record<string, string> = {
  alto: "#dc2626",
  medio: "#f59e0b",
  baixo: "#10b981",
  indefinido: "#64748b",
};

function corDoRisco(risco?: string | null) {
  const r = (risco ?? "").toLowerCase();
  if (r.includes("alto")) return RISK_COLORS.alto;
  if (r.includes("med") || r.includes("méd")) return RISK_COLORS.medio;
  if (r.includes("baixo")) return RISK_COLORS.baixo;
  return RISK_COLORS.indefinido;
}

function Pin({ pin, onSelect }: { pin: LesionPin; onSelect?: (id: number) => void }) {
  const halo = useRef<THREE.Mesh>(null);
  const [hover, setHover] = useState(false);
  const cor = corDoRisco(pin.risco);

  useFrame(({ clock }) => {
    if (!halo.current) return;
    const s = 1 + 0.35 * (0.5 + 0.5 * Math.sin(clock.getElapsedTime() * 2.4 + pin.id));
    halo.current.scale.setScalar(s);
    (halo.current.material as THREE.MeshBasicMaterial).opacity = 0.45 - 0.25 * (s - 1);
  });

  return (
    <group position={pin.position}>
      <mesh
        renderOrder={1000}
        onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = onSelect ? "pointer" : "default"; }}
        onPointerOut={() => { setHover(false); document.body.style.cursor = "auto"; }}
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => { e.stopPropagation(); onSelect?.(pin.id); }}
      >
        <sphereGeometry args={[hover ? 0.022 : 0.016, 24, 24]} />
        <meshBasicMaterial color={cor} transparent opacity={0.95} />
      </mesh>
      <mesh ref={halo} renderOrder={999}>
        <sphereGeometry args={[0.03, 24, 24]} />
        <meshBasicMaterial color={cor} transparent opacity={0.35} depthWrite={false} />
      </mesh>
      {hover && (
        <Html position={[0, 0.05, 0]} center style={{ pointerEvents: "none" }}>
          <div className="whitespace-nowrap rounded-lg bg-slate-900/95 px-3 py-1.5 text-xs font-medium text-white shadow-lg">
            {pin.localizacao}
            {pin.data ? ` · ${pin.data}` : ""}
            {onSelect && <span className="block text-[10px] font-normal text-slate-300">Clique para abrir a análise</span>}
          </div>
        </Html>
      )}
    </group>
  );
}

export function LesionMarkers({ pins, onSelect }: { pins: LesionPin[]; onSelect?: (id: number) => void }) {
  return (
    <>
      {pins.map((p) => (
        <Pin key={p.id} pin={p} onSelect={onSelect} />
      ))}
    </>
  );
}

interface LesaoApi {
  id: number;
  posicao_x?: number | null;
  posicao_y?: number | null;
  posicao_z?: number | null;
  localizacao?: string;
  data?: string;
  risco?: string | null;
}

/** Converte as lesões vindas da API (/pacientes/{id}) em marcadores 3D. */
export function lesoesParaPins(lesoes?: LesaoApi[]): LesionPin[] {
  return (lesoes ?? [])
    .filter((l) => [l.posicao_x, l.posicao_y, l.posicao_z].every((v) => typeof v === "number"))
    .map((l) => ({
      id: l.id,
      position: [l.posicao_x as number, l.posicao_y as number, l.posicao_z as number],
      localizacao: l.localizacao ?? "Lesão",
      data: l.data,
      risco: l.risco,
    }));
}
