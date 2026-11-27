import { useState, useRef } from "react";
import { Html } from "@react-three/drei";
import * as THREE from "three";

interface BodyPartMeshProps {
  name: string;
  position: [number, number, number];
  args: number[];
  onSelect: (name: string) => void;
  active: boolean;
  rotation?: [number, number, number];
  geometry?: "capsule" | "sphere" | "cylinder" | "box";
  scale?: [number, number, number];
}

export function BodyPartMesh({
  name,
  position,
  args,
  onSelect,
  active,
  rotation = [0, 0, 0],
  geometry = "capsule",
  scale,
}: BodyPartMeshProps) {
  const [hovered, setHovered] = useState(false);
  const meshRef = useRef<THREE.Mesh>(null);

  const baseColor = "#dce4ed";
  const hoverColor = "#93c5fd";
  const activeColor = "#2563eb";

  const color = active ? activeColor : hovered ? hoverColor : baseColor;

  const renderGeometry = () => {
    const a = args as number[];
    switch (geometry) {
      case "sphere":
        return <sphereGeometry args={[a[0], a[2] || 16, a[3] || 16]} />;
      case "cylinder":
        return <cylinderGeometry args={[a[0], a[1], a[2], a[3] || 16]} />;
      case "box":
        return <boxGeometry args={[a[0], a[1], a[2]]} />;
      case "capsule":
      default:
        return <capsuleGeometry args={[a[0], a[1], a[2], a[3]]} />;
    }
  };

  return (
    <mesh
      ref={meshRef}
      position={position}
      rotation={rotation}
      scale={scale}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(name);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = "auto";
      }}
    >
      {renderGeometry()}
      <meshStandardMaterial
        color={color}
        roughness={0.4}
        metalness={0.05}
        transparent
        opacity={active ? 1 : hovered ? 0.95 : 0.85}
      />
      {hovered && (
        <Html distanceFactor={8} style={{ pointerEvents: "none" }}>
          <div
            style={{
              background: "#0f172a",
              color: "#f8fafc",
              padding: "4px 10px",
              borderRadius: "6px",
              fontSize: "11px",
              fontWeight: 600,
              whiteSpace: "nowrap",
              boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
              fontFamily: "Inter, system-ui, sans-serif",
            }}
          >
            {name}
          </div>
        </Html>
      )}
    </mesh>
  );
}
