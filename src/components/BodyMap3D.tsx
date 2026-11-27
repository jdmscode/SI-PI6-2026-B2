import { Suspense, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";
import { GLTFHumanModel } from "@/components/GLTFHumanModel";
import { meshNameMap, COMBINED_PARTS } from "@/lib/anatomia";
import { CameraController, DEFAULT_CAMERA_TARGET } from "@/components/CameraController";
import { BodyStage } from "@/components/BodyStage";
import { LesionMarkers, type LesionPin } from "@/components/LesionMarkers";
import { ViewControls, VISTAS, zoomCamera, type VistaCorpo } from "@/components/ViewControls";

/** Mapa corporal somente leitura: mostra as lesões do paciente sobre o modelo 3D. */
export function BodyMap3D({ pins, onSelect }: { pins: LesionPin[]; onSelect?: (id: number) => void }) {
  const orbitRef = useRef<OrbitControlsImpl | null>(null);
  const [vista, setVista] = useState<VistaCorpo | null>("frente");
  const [pos, setPos] = useState<THREE.Vector3 | null>(null);
  const [alvo, setAlvo] = useState<THREE.Vector3 | null>(null);
  const [animando, setAnimando] = useState(false);

  const irPara = (v: VistaCorpo) => {
    setVista(v);
    setAnimando(true);
    setAlvo(DEFAULT_CAMERA_TARGET.clone());
    setPos(VISTAS[v].pos.clone());
  };

  const zoom = (fator: number) => {
    const ctrl = orbitRef.current;
    if (!ctrl) return;
    const z = zoomCamera(ctrl.object, ctrl.target, fator);
    setVista(null);
    setAnimando(true);
    setAlvo(z.target);
    setPos(z.pos);
  };

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden" style={{ background: "linear-gradient(160deg, #64748b 0%, #334155 55%, #1e293b 100%)" }}>
      <ViewControls className="absolute top-3 left-3 z-10" vista={vista} onVista={irPara} onZoom={zoom} onReset={() => irPara("frente")} />
      <div className="absolute bottom-3 left-3 z-10 rounded-lg bg-card/95 border border-border px-3 py-2 text-[11px] text-muted-foreground shadow-surface">
        <span className="font-semibold text-foreground">{pins.length}</span> {pins.length === 1 ? "lesão" : "lesões"} no corpo ·
        <span className="inline-flex items-center gap-1 ml-2"><span className="w-2 h-2 rounded-full bg-red-600" />alto</span>
        <span className="inline-flex items-center gap-1 ml-2"><span className="w-2 h-2 rounded-full bg-amber-500" />médio</span>
        <span className="inline-flex items-center gap-1 ml-2"><span className="w-2 h-2 rounded-full bg-emerald-500" />baixo</span>
      </div>
      <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 0.8, 3.2], fov: 50 }} gl={{ localClippingEnabled: true, antialias: true }}>
        <CameraController targetPosition={pos} targetLookAt={alvo} orbitControlsRef={orbitRef} isZoomed={false} onAnimationComplete={() => setAnimando(false)} />
        <Suspense fallback={null}>
          <GLTFHumanModel
            modelPath="/models/human-body.glb"
            selectedZone={null}
            onSelectZone={() => undefined}
            meshNameMap={meshNameMap}
            combinedParts={COMBINED_PARTS}
            isZoomed={false}
            circles={[]}
            activeCircleIndex={null}
          />
          <LesionMarkers pins={pins} onSelect={onSelect} />
          <BodyStage />
        </Suspense>
        <OrbitControls ref={orbitRef} enabled={!animando} enablePan={false} enableDamping dampingFactor={0.08} minDistance={0.4} maxDistance={5} target={[0, 1.1, 0]} rotateSpeed={0.8} />
      </Canvas>
    </div>
  );
}
