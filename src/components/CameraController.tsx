import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { useRef, useEffect } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface CameraControllerProps {
  targetPosition: THREE.Vector3 | null;
  targetLookAt: THREE.Vector3 | null;
  orbitControlsRef: React.RefObject<OrbitControlsImpl | null>;
  isZoomed: boolean;
  onAnimationComplete?: () => void;
}

export const DEFAULT_CAMERA_POSITION = new THREE.Vector3(0, 0.8, 3.2);
export const DEFAULT_CAMERA_TARGET = new THREE.Vector3(0, 1.1, 0);

/**
 * Anima a câmera até a posição pedida orbitando em volta do alvo (coordenadas esféricas).
 * Assim, ir da frente para as costas dá a volta no corpo em vez de atravessá-lo.
 */
export function CameraController({
  targetPosition,
  targetLookAt,
  orbitControlsRef,
  isZoomed,
  onAnimationComplete,
}: CameraControllerProps) {
  const { camera } = useThree();
  const animating = useRef(false);
  const speed = 0.16;

  const cur = useRef(new THREE.Spherical());
  const goal = useRef(new THREE.Spherical());
  const offset = useRef(new THREE.Vector3());

  useEffect(() => {
    animating.current = true;
  }, [targetPosition, targetLookAt, isZoomed]);

  useFrame(() => {
    if (!animating.current) return;
    const ctrl = orbitControlsRef.current;

    const goalPos = targetPosition || DEFAULT_CAMERA_POSITION;
    const goalTarget = targetLookAt || DEFAULT_CAMERA_TARGET;

    const target = ctrl ? ctrl.target : goalTarget.clone();
    target.lerp(goalTarget, speed);

    cur.current.setFromVector3(offset.current.copy(camera.position).sub(target));
    goal.current.setFromVector3(offset.current.copy(goalPos).sub(goalTarget));

    let dTheta = goal.current.theta - cur.current.theta;
    if (dTheta > Math.PI) dTheta -= 2 * Math.PI;
    if (dTheta < -Math.PI) dTheta += 2 * Math.PI;

    cur.current.theta += dTheta * speed;
    cur.current.phi += (goal.current.phi - cur.current.phi) * speed;
    cur.current.radius += (goal.current.radius - cur.current.radius) * speed;
    cur.current.makeSafe();

    camera.position.copy(target).add(offset.current.setFromSpherical(cur.current));
    camera.lookAt(target);
    ctrl?.update();

    const posDist = camera.position.distanceTo(goalPos);
    const targetDist = target.distanceTo(goalTarget);

    if (posDist < 0.01 && targetDist < 0.01) {
      animating.current = false;
      camera.position.copy(goalPos);
      if (ctrl) {
        ctrl.target.copy(goalTarget);
        ctrl.update();
      }
      onAnimationComplete?.();
    }
  });

  return null;
}
