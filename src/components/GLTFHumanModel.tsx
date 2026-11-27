import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useLoader, ThreeEvent } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { CircleMarker } from "./CircleMarker";

export interface CircleData {
  position: THREE.Vector3;
  normal: THREE.Vector3;
  radius: number;
  meshName: string;
  zoneName: string;
}

export type CombinedPartsMap = Record<string, { left: string; right: string }>;

export const SKIN_TONE = "#e8cbb4";

/**
 * Copia a geometria mantendo só os triângulos cujo centro (em coordenadas do mundo)
 * fica do lado pedido: esquerdo do paciente = x >= 0, direito = x < 0.
 */
function splitGeometry(geom: THREE.BufferGeometry, matrixWorld: THREE.Matrix4, ladoEsquerdo: boolean) {
  const pos = geom.getAttribute("position");
  const index = geom.getIndex();
  const total = index ? index.count : pos.count;
  const kept: number[] = [];
  const v = new THREE.Vector3();

  for (let i = 0; i < total; i += 3) {
    let somaX = 0;
    for (let k = 0; k < 3; k++) {
      const vi = index ? index.getX(i + k) : i + k;
      somaX += v.fromBufferAttribute(pos, vi).applyMatrix4(matrixWorld).x;
    }
    if (somaX >= 0 === ladoEsquerdo) {
      for (let k = 0; k < 3; k++) kept.push(index ? index.getX(i + k) : i + k);
    }
  }

  const g = geom.clone();
  g.setIndex(kept);
  g.clearGroups();
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}

interface GLTFHumanModelProps {
  modelPath: string;
  selectedZone: string | null;
  onSelectZone: (name: string) => void;
  meshNameMap?: Record<string, string>;
  combinedParts?: CombinedPartsMap;
  isZoomed: boolean;
  circles: CircleData[];
  activeCircleIndex: number | null;
  onStartCircle?: (
    position: THREE.Vector3,
    normal: THREE.Vector3,
    meshName: string,
    zoneName: string
  ) => void;
  onResizeCircle?: (radius: number) => void;
  onFinishCircle?: () => void;
  onMeshCenterFound?: (
    center: THREE.Vector3,
    meshName: string,
    direction: THREE.Vector3,
    meshSize?: number,
    bboxSize?: THREE.Vector3
  ) => void;
}

export function GLTFHumanModel({
  modelPath,
  selectedZone,
  onSelectZone,
  meshNameMap = {},
  combinedParts = {},
  isZoomed,
  circles = [],
  activeCircleIndex = null,
  onStartCircle,
  onMeshCenterFound,
}: GLTFHumanModelProps) {
  const gltf = useLoader(GLTFLoader, modelPath, (loader) => {
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.7/");
    (loader as GLTFLoader).setDRACOLoader(dracoLoader);
  });

  const groupRef = useRef<THREE.Group>(null);
  const [hoveredMesh, setHoveredMesh] = useState<string | null>(null);
  const [hoveredPosition, setHoveredPosition] = useState<THREE.Vector3 | null>(null);

  const hoverColor = new THREE.Color("#93c5fd");
  const activeColor = new THREE.Color("#2563eb");

  const originalMaterials = useRef<Map<string, THREE.Material | THREE.Material[]>>(new Map());

  const getDisplayName = useCallback(
    (meshName: string) => meshNameMap[meshName] || meshName,
    [meshNameMap]
  );

  // As metades _L/_R compartilham a geometria inteira; o recorte só existe na renderização.
  // Por isso o raycast pode devolver a metade errada. O lado real vem da posição do clique.
  const resolveMeshName = useCallback((mesh: THREE.Object3D, point: THREE.Vector3) => {
    const isSplit = mesh.parent?.name.endsWith("_split") && /_(L|R)$/.test(mesh.name);
    if (!isSplit) return mesh.name;
    const base = mesh.name.slice(0, -2);
    return point.x >= 0 ? `${base}_L` : `${base}_R`;
  }, []);

  const reverseMap = useMemo(() => {
    const map: Record<string, string> = {};

    Object.entries(meshNameMap).forEach(([mesh, display]) => {
      map[display] = mesh;
    });

    return map;
  }, [meshNameMap]);

  const modelScene = useMemo(() => {
    const scene = gltf.scene.clone(true);

    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 2.5 / maxDim;

    scene.scale.setScalar(scale);

    const scaledBox = new THREE.Box3().setFromObject(scene);
    const scaledCenter = scaledBox.getCenter(new THREE.Vector3());

    scene.position.sub(scaledCenter);
    scene.position.y += scaledBox.getSize(new THREE.Vector3()).y / 2;

    const toSplit: THREE.Mesh[] = [];

    // Material de pele: tom neutro, fosco, para a lesão marcada e o realce azul se destacarem.
    const skin = (m: THREE.Material) => {
      const c = m.clone() as THREE.MeshStandardMaterial;
      c.color = new THREE.Color(SKIN_TONE);
      c.roughness = 0.62;
      c.metalness = 0.0;
      c.envMapIntensity = 0.9;
      return c;
    };

    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        if (Array.isArray(mesh.material)) {
          const cloned = mesh.material.map(skin);
          originalMaterials.current.set(mesh.name, cloned.map((m) => m.clone()));
          mesh.material = cloned;
        } else {
          const c = skin(mesh.material);
          originalMaterials.current.set(mesh.name, c.clone());
          mesh.material = c;
        }

        if (combinedParts[mesh.name]) {
          toSplit.push(mesh);
        }
      }
    });

    // O modelo está de frente para a câmera (+z): o lado ESQUERDO do paciente fica em x > 0
    // e o DIREITO em x < 0. Cada plano mantém só a metade do seu lado.
    const planeL = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0);
    const planeR = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0);

    scene.updateMatrixWorld(true);

    for (const mesh of toSplit) {
      const baseName = mesh.name;
      const parent = mesh.parent;

      if (!parent) continue;

      originalMaterials.current.delete(baseName);

      const cloneMat = (m: THREE.Material) => m.clone();

      // Cada metade recebe só os triângulos do seu lado. Assim o raycast do clique
      // acerta a metade certa (antes as duas tinham a geometria inteira e o clique se perdia).
      const geomL = splitGeometry(mesh.geometry, mesh.matrixWorld, true);
      const geomR = splitGeometry(mesh.geometry, mesh.matrixWorld, false);
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

      const matL = cloneMat(mats[0]);
      const matR = cloneMat(mats[0]);

      const setClip = (m: THREE.Material, plane: THREE.Plane) => {
        (m as THREE.MeshStandardMaterial).clippingPlanes = [plane];
      };

      if (Array.isArray(matL)) {
        matL.forEach((m) => setClip(m, planeL));
      } else {
        setClip(matL, planeL);
      }

      if (Array.isArray(matR)) {
        matR.forEach((m) => setClip(m, planeR));
      } else {
        setClip(matR, planeR);
      }

      const meshL = new THREE.Mesh(geomL, matL);
      const meshR = new THREE.Mesh(geomR, matR);

      meshL.name = `${baseName}_L`;
      meshR.name = `${baseName}_R`;

      originalMaterials.current.set(
        meshL.name,
        Array.isArray(matL) ? matL.map((m) => m.clone()) : (matL as THREE.Material).clone()
      );

      originalMaterials.current.set(
        meshR.name,
        Array.isArray(matR) ? matR.map((m) => m.clone()) : (matR as THREE.Material).clone()
      );

      const group = new THREE.Group();

      group.name = `${baseName}_split`;
      group.position.copy(mesh.position);
      group.quaternion.copy(mesh.quaternion);
      group.scale.copy(mesh.scale);

      group.add(meshL);
      group.add(meshR);

      parent.remove(mesh);
      parent.add(group);
    }

    return scene;
  }, [gltf.scene, combinedParts]);

  useEffect(() => {
    if (!selectedZone || !modelScene || !onMeshCenterFound) return;

    const meshName = reverseMap[selectedZone] || selectedZone;
    const combinedBox = new THREE.Box3();
    let hasMatch = false;

    modelScene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const matches = mesh.name === meshName || getDisplayName(mesh.name) === selectedZone;

        if (matches) {
          const box = new THREE.Box3().setFromObject(mesh);
          // Metades recortadas: limita a caixa ao lado visível, senão a câmera mira o meio do corpo.
          if (mesh.parent?.name.endsWith("_split")) {
            if (mesh.name.endsWith("_L")) box.min.x = Math.max(box.min.x, 0);
            if (mesh.name.endsWith("_R")) box.max.x = Math.min(box.max.x, 0);
          }
          combinedBox.union(box);
          hasMatch = true;
        }
      }
    });

    if (!hasMatch) return;

    const center = combinedBox.getCenter(new THREE.Vector3());
    const size = combinedBox.getSize(new THREE.Vector3());
    const meshSize = Math.max(size.x, size.y, size.z);

    const modelBox = new THREE.Box3().setFromObject(modelScene);
    const modelCenter = modelBox.getCenter(new THREE.Vector3());

    const dir = new THREE.Vector3(
      center.x - modelCenter.x,
      0,
      center.z - modelCenter.z
    );

    if (dir.length() < 0.01) {
      dir.set(0, 0, 1);
    }

    dir.normalize();

    onMeshCenterFound(center, meshName, dir, meshSize, size);
  }, [selectedZone, modelScene, reverseMap, getDisplayName, onMeshCenterFound]);

  useEffect(() => {
    if (!modelScene) return;

    modelScene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;

        const isHovered = mesh.name === hoveredMesh;
        const displayName = getDisplayName(mesh.name);
        const isActive = displayName === selectedZone;

        const orig = originalMaterials.current.get(mesh.name);
        const origMats = orig ? (Array.isArray(orig) ? orig : [orig]) : null;
        const currMats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

        const applyColor = (mat: THREE.Material, index: number) => {
          const stdMat = mat as THREE.MeshStandardMaterial;

          if (!stdMat.color) return;

          if (isActive) {
            stdMat.color.copy(activeColor);
            stdMat.emissive?.set(0x1d4ed8);
            stdMat.emissiveIntensity = 0.2;
          } else if (isHovered) {
            stdMat.color.copy(hoverColor);
            stdMat.emissive?.set(0x3b82f6);
            stdMat.emissiveIntensity = 0.08;
          } else if (origMats && origMats[index]) {
            const o = origMats[index] as THREE.MeshStandardMaterial;

            stdMat.color.copy(o.color);
            stdMat.emissive?.copy(o.emissive || new THREE.Color(0x000000));
            stdMat.emissiveIntensity = o.emissiveIntensity ?? 0;
          }
        };

        currMats.forEach((mat, i) => applyColor(mat, i));
      }
    });
  }, [selectedZone, hoveredMesh, modelScene, getDisplayName]);

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();

    const mesh = e.object as THREE.Mesh;

    if (mesh.isMesh && mesh.name) {
      setHoveredMesh(resolveMeshName(mesh, e.point));
      setHoveredPosition(e.point.clone());
      document.body.style.cursor = isZoomed ? "crosshair" : "pointer";
    }
  };

  // Clique próprio: pointerdown + pointerup quase no mesmo pixel e em pouco tempo.
  // O onClick do R3F descartava cliques nas partes pareadas (superfícies sobrepostas)
  // e um arrasto para girar o modelo não deve virar seleção.
  const pressRef = useRef<{ x: number; y: number; t: number } | null>(null);

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    // timeStamp do próprio evento: não depende de quanto o navegador demorou para entregá-lo
    pressRef.current = { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY, t: e.nativeEvent.timeStamp };
  };

  const handlePointerUp = (e: ThreeEvent<PointerEvent>) => {
    const press = pressRef.current;
    pressRef.current = null;
    if (!press) return;
    const moved = Math.hypot(e.nativeEvent.clientX - press.x, e.nativeEvent.clientY - press.y);
    if (moved > 6 || e.nativeEvent.timeStamp - press.t > 800) return;
    handleClick(e);
  };

  const handleClick = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();

    const mesh = e.object as THREE.Mesh;

    if (!mesh.isMesh || !mesh.name) return;

    const meshName = resolveMeshName(mesh, e.point);
    const displayName = getDisplayName(meshName);

    if (!isZoomed || selectedZone !== displayName) {
      onSelectZone(displayName);
      return;
    }

    if (isZoomed && selectedZone === displayName && onStartCircle) {
      const normal = e.face?.normal.clone() || new THREE.Vector3(0, 1, 0);

      const normalMatrix = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
      normal.applyMatrix3(normalMatrix).normalize();

      onStartCircle(e.point.clone(), normal, meshName, displayName);
    }
  };

  const handlePointerOut = () => {
    setHoveredMesh(null);
    setHoveredPosition(null);
    document.body.style.cursor = "auto";
  };

  return (
    <group ref={groupRef}>
      <primitive
        object={modelScene}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerMove={handlePointerMove}
        onPointerOver={handlePointerMove}
        onPointerOut={handlePointerOut}
      />

      {circles.map((circle, i) => (
        <CircleMarker
          key={i}
          position={circle.position}
          normal={circle.normal}
          radius={circle.radius}
          isActive={i === activeCircleIndex}
        />
      ))}

      {hoveredMesh && hoveredPosition && (
        <Html position={hoveredPosition} style={{ pointerEvents: "none" }}>
          <div
            style={{
              background: isZoomed ? "rgba(220, 38, 38, 0.92)" : "rgba(15, 23, 42, 0.95)",
              color: "#f8fafc",
              padding: "5px 12px",
              borderRadius: "8px",
              fontSize: "12px",
              fontWeight: 600,
              whiteSpace: "nowrap",
              boxShadow: "0 4px 16px rgba(0,0,0,0.35)",
              fontFamily: "Inter, system-ui, sans-serif",
              transform: "translate(-50%, -140%)",
              border: isZoomed
                ? "1px solid rgba(252, 165, 165, 0.4)"
                : "1px solid rgba(148, 163, 184, 0.2)",
            }}
          >
            {isZoomed ? "Clique para marcar o ponto" : getDisplayName(hoveredMesh)}
          </div>
        </Html>
      )}
    </group>
  );
}