import { ContactShadows, Environment } from "@react-three/drei";
import * as THREE from "three";

/** Iluminação de estúdio, piso circular e sombras. Compartilhado entre o mapeamento e o prontuário. */
export function BodyStage() {
  return (
    <>
      <hemisphereLight args={["#f8fafc", "#334155", 0.55]} />
      <directionalLight
        position={[2.5, 4, 3]}
        intensity={1.15}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-2}
        shadow-camera-right={2}
        shadow-camera-top={3}
        shadow-camera-bottom={-1}
      />
      <directionalLight position={[-3, 2.5, -2]} intensity={0.45} color="#c7d2fe" />
      <directionalLight position={[0, 1.5, -4]} intensity={0.35} color="#e0f2fe" />

      <mesh rotation-x={-Math.PI / 2} position={[0, -0.002, 0]} receiveShadow>
        <circleGeometry args={[1.1, 96]} />
        <meshStandardMaterial color="#1e293b" roughness={0.9} transparent opacity={0.55} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.001, 0]}>
        <ringGeometry args={[1.08, 1.12, 96]} />
        <meshBasicMaterial color="#60a5fa" transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.001, 0]}>
        <ringGeometry args={[0.55, 0.565, 96]} />
        <meshBasicMaterial color="#93c5fd" transparent opacity={0.25} side={THREE.DoubleSide} />
      </mesh>

      <ContactShadows opacity={0.45} scale={4} blur={2.2} far={2.5} position={[0, 0.002, 0]} />
      <Environment preset="studio" />
    </>
  );
}
