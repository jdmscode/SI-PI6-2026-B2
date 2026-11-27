import { useState, useRef, Suspense, useCallback, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Upload, BrainCircuit, ZoomOut, Circle, Trash2, Check, Loader2, ImageIcon, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { API_URL, authHeaders } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useNavigate, useParams } from "react-router-dom";
import { GLTFHumanModel, CircleData } from "@/components/GLTFHumanModel";
import { CameraController, DEFAULT_CAMERA_TARGET } from "@/components/CameraController";
import { BodyStage } from "@/components/BodyStage";
import { LesionMarkers, lesoesParaPins, type LesionPin } from "@/components/LesionMarkers";
import { ViewControls, VISTAS, zoomCamera, type VistaCorpo } from "@/components/ViewControls";
import * as THREE from "three";
import { meshNameMap, COMBINED_PARTS } from "@/lib/anatomia";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";


// Só regiões que existem no modelo 3D, para que a escolha na lista possa ser marcada no corpo.
const anatomyTree = [
  { group: "Cabeça e pescoço", parts: ["Couro Cabeludo", "Testa", "Têmporas", "Face", "Bochechas", "Nariz", "Lábios", "Mandíbula", "Orelha Direita", "Orelha Esquerda", "Pescoço"] },
  { group: "Tronco", parts: ["Tórax", "Abdômen", "Baixo Ventre", "Axilas", "Costas", "Lombar", "Glúteos", "Região Íntima"] },
  { group: "Membros Superiores", parts: ["Ombro Direito", "Ombro Esquerdo", "Braço Direito", "Braço Esquerdo", "Cotovelo Direito", "Cotovelo Esquerdo", "Antebraço Direito", "Antebraço Esquerdo", "Mão Direita", "Mão Esquerda"] },
  { group: "Membros Inferiores", parts: ["Coxa Direita", "Coxa Esquerda", "Joelho Direito", "Joelho Esquerdo", "Panturrilha Direita", "Panturrilha Esquerda", "Tornozelo Direito", "Tornozelo Esquerdo", "Pé Direito", "Pé Esquerdo"] },
];



export default function AnatomicMapper() {
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [is3D, setIs3D] = useState(true);
  const [isZoomed, setIsZoomed] = useState(false);
  const [points, setPoints] = useState<CircleData[]>([]);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [descricao, setDescricao] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cameraTarget, setCameraTarget] = useState<THREE.Vector3 | null>(null);
  const [cameraPosition, setCameraPosition] = useState<THREE.Vector3 | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  const orbitRef = useRef<OrbitControlsImpl | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const navigate = useNavigate();
  const { id } = useParams();

  const pacienteId = id;
  const selectedPoint = points[0];
  const [pacienteNome, setPacienteNome] = useState<string>("");
  const [lesoesAnteriores, setLesoesAnteriores] = useState<LesionPin[]>([]);
  const [vista, setVista] = useState<VistaCorpo | null>("frente");

  useEffect(() => {
    fetch(`${API_URL}/pacientes/${id}`, { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        if (d.paciente?.nome) setPacienteNome(d.paciente.nome);
        setLesoesAnteriores(lesoesParaPins(d.lesoes));
      })
      .catch(() => undefined);
  }, [id]);

  const irParaVista = (v: VistaCorpo) => {
    setVista(v);
    setIsZoomed(false);
    setSelectedZone(null);
    setPoints([]);
    setIsAnimating(true);
    setCameraTarget(DEFAULT_CAMERA_TARGET.clone());
    setCameraPosition(VISTAS[v].pos.clone());
  };

  const zoom = (fator: number) => {
    const ctrl = orbitRef.current;
    if (!ctrl) return;
    const { pos, target } = zoomCamera(ctrl.object, ctrl.target, fator);
    setIsAnimating(true);
    setCameraTarget(target);
    setCameraPosition(pos);
  };

  const etapas = [
    { label: "Região", ok: !!selectedZone },
    { label: "Ponto", ok: !!selectedPoint },
    { label: "Imagem", ok: !!selectedFile },
  ];
  const faltando = etapas.find((e) => !e.ok);

  const handleSelectZone = useCallback((name: string) => {
    if (selectedZone === name && isZoomed) return;

    setSelectedZone(name);
    setIsZoomed(true);
    setVista(null);
    setPoints([]);
  }, [selectedZone, isZoomed]);

  const handleSelectFromList = (name: string) => {
    handleSelectZone(name);
    setIs3D(true);
    toast.info(`${name} selecionada. Agora clique no ponto exato da lesão.`);
  };

  const handleZoomOut = useCallback(() => {
    setVista("frente");
    setCameraTarget(null);
    setCameraPosition(null);
    setIsAnimating(true);
    setIsZoomed(false);
    setSelectedZone(null);
    setPoints([]);
  }, []);

  const handleMeshCenterFound = useCallback((
    center: THREE.Vector3,
    _meshName: string,
    direction: THREE.Vector3,
    meshSize?: number,
    bboxSize?: THREE.Vector3
  ) => {
    setIsAnimating(true);

    const FOV_FACTOR = 0.48;
    const width = bboxSize ? Math.max(bboxSize.x, bboxSize.z) : meshSize ?? 0.5;
    const height = bboxSize?.y ?? meshSize ?? 0.5;
    const frameSize = Math.max(width, height * 1.3);
    const baseDist = Math.max(0.5, Math.min(frameSize / FOV_FACTOR, 2.5));

    const cameraOffset = direction.clone().multiplyScalar(baseDist);
    cameraOffset.y += 0.03;

    const lateralBias = 0.45;
    if (Math.abs(center.x) > 0.08) {
      cameraOffset.x += Math.sign(center.x) * lateralBias;
    }

    setCameraTarget(center.clone());
    setCameraPosition(center.clone().add(cameraOffset));
  }, []);

  const handleSelectPoint = useCallback((
    position: THREE.Vector3,
    normal: THREE.Vector3,
    meshName: string,
    zoneName: string
  ) => {
    const newPoint: CircleData = {
      position: position.clone(),
      normal: normal.clone(),
      radius: 0.018,
      meshName,
      zoneName,
    };

    setPoints([newPoint]);

    if (orbitRef.current) {
      orbitRef.current.enabled = true;
    }

  }, []);

  const handleResizePoint = useCallback((_radius: number) => {
    return;
  }, []);

  const handleFinishPoint = useCallback(() => {
    if (orbitRef.current) {
      orbitRef.current.enabled = true;
    }
  }, []);

  const handleRemovePoint = useCallback((index: number) => {
    setPoints((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const aceitarArquivo = (file?: File) => {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      toast.error("Formato não suportado. Envie uma imagem JPG, PNG ou WEBP.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Imagem maior que 10 MB. Reduza o tamanho e tente de novo.");
      return;
    }
    setSelectedFile(file);
    setUploadedImage(URL.createObjectURL(file));
  };

  const removerImagem = () => {
    setSelectedFile(null);
    setUploadedImage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => aceitarArquivo(e.target.files?.[0]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    aceitarArquivo(e.dataTransfer.files?.[0]);
  };

  const handleSubmitAnalysis = async () => {
    if (!pacienteId) {
      toast.error("Paciente inválido.");
      return;
    }

    if (!selectedZone || !selectedPoint || !selectedFile) {
      toast.error("Selecione a região, marque o ponto e envie a imagem.");
      return;
    }

    try {
      setIsSubmitting(true);

      const formData = new FormData();

      formData.append("paciente_id", pacienteId);
      formData.append("data", new Date().toISOString().split("T")[0]);
      formData.append("descricao", descricao);
      formData.append("localizacao", selectedZone);
      formData.append("posicao_x", String(selectedPoint.position.x));
      formData.append("posicao_y", String(selectedPoint.position.y));
      formData.append("posicao_z", String(selectedPoint.position.z));
      formData.append("imagem", selectedFile);

      const response = await fetch(`${API_URL}/lesoes/analisar`, {
        method: "POST",
        headers: authHeaders(),
        body: formData,
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error);
      }

      const result = await response.json();

      toast.success("Lesão registrada e analisada.");
      navigate(`/analysis/${result.id}`, {
        state: {
          analysisResult: result,
          imagemPreview: uploadedImage,
          pacienteId,
          pacienteNome,
        },
      });
    } catch {
      toast.error("Não foi possível analisar a imagem. Verifique a conexão com a API e tente de novo.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        crumbs={[
          { label: "Pacientes", to: "/patients" },
          { label: pacienteNome || "Paciente", to: `/patients/${pacienteId}` },
          { label: "Nova lesão" },
        ]}
        title="Registrar lesão"
        description={pacienteNome ? `Paciente: ${pacienteNome}` : "Marque a lesão no corpo e envie a imagem"}
        actions={
          <ol className="flex items-center gap-2" aria-label="Etapas">
            {etapas.map((e, i) => (
              <li key={e.label} className="flex items-center gap-2">
                <span
                  className={`flex items-center gap-1.5 rounded-full pl-1 pr-3 py-1 text-xs font-medium ring-1 ring-inset ${
                    e.ok ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : faltando === e ? "bg-primary/10 text-primary ring-primary/30" : "bg-card text-muted-foreground ring-border"
                  }`}
                >
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${e.ok ? "bg-emerald-500 text-white" : faltando === e ? "bg-primary text-white" : "bg-muted"}`}>
                    {e.ok ? <Check className="w-3 h-3" /> : i + 1}
                  </span>
                  {e.label}
                </span>
                {i < etapas.length - 1 && <span className="w-4 h-px bg-border" />}
              </li>
            ))}
          </ol>
        }
      />

      <div className="flex h-[calc(100vh-230px)] min-h-[560px] overflow-hidden rounded-2xl bg-card shadow-soft border border-border">
        <div
          className="w-3/5 relative border-r border-border"
          style={{ background: "linear-gradient(145deg, #64748b 0%, #475569 50%, #334155 100%)" }}
        >
          <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
            <div className="flex items-center gap-3 bg-card p-2 px-3 rounded-lg shadow-surface border border-border">
              <span className={`text-xs font-medium ${!is3D ? "text-primary" : "text-muted-foreground"}`}>Lista</span>
              <Switch checked={is3D} onCheckedChange={setIs3D} />
              <span className={`text-xs font-medium ${is3D ? "text-primary" : "text-muted-foreground"}`}>3D</span>
            </div>

            {isZoomed && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleZoomOut}
                className="gap-1.5 shadow-surface border border-border"
              >
                <ZoomOut className="w-3.5 h-3.5" />
                Corpo inteiro
              </Button>
            )}
          </div>

          {is3D && (
            <ViewControls
              vertical
              className="absolute top-4 right-4 z-10"
              vista={vista}
              onVista={irParaVista}
              onZoom={zoom}
              onReset={() => irParaVista("frente")}
            />
          )}

          {is3D && !isZoomed && lesoesAnteriores.length > 0 && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 rounded-lg bg-card/95 border border-border shadow-surface px-3 py-2 text-[11px] text-muted-foreground">
              <p className="font-semibold text-foreground mb-1">{lesoesAnteriores.length} {lesoesAnteriores.length === 1 ? "lesão já registrada" : "lesões já registradas"}</p>
              <p className="flex items-center gap-3">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-600" />alto</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" />médio</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />baixo</span>
              </p>
            </div>
          )}

          {is3D && !isZoomed && vista === "frente" && (
            <>
              <span className="absolute top-[62%] left-4 z-10 -translate-y-1/2 rounded-md bg-slate-900/60 px-2 py-1 text-[11px] font-semibold text-white" title="Lado direito do paciente">
                D
              </span>
              <span className="absolute top-[62%] right-4 z-10 -translate-y-1/2 rounded-md bg-slate-900/60 px-2 py-1 text-[11px] font-semibold text-white" title="Lado esquerdo do paciente">
                E
              </span>
            </>
          )}

          {is3D && (
            <div className="absolute bottom-4 left-4 right-4 z-10 flex justify-between items-end gap-3 pointer-events-none">
              <div className="bg-card/95 backdrop-blur-sm px-3 py-2 rounded-lg shadow-surface border border-border">
                {isZoomed ? (
                  <div className="flex items-center gap-2">
                    <Circle className="w-3.5 h-3.5 text-destructive" />
                    <span className="text-xs font-medium text-foreground">
                      {selectedPoint ? "Ponto marcado. Clique de novo para ajustar." : "Clique no ponto exato da lesão"}
                    </span>
                  </div>
                ) : (
                  <span className="text-xs text-foreground">
                    Clique na região · arraste para girar · D/E = lado do paciente
                  </span>
                )}
              </div>
            </div>
          )}

          {is3D ? (
            <div className="w-full h-full">
              <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 0.8, 3.2], fov: 50 }} gl={{ localClippingEnabled: true, antialias: true }}>

                <CameraController
                  targetPosition={cameraPosition}
                  targetLookAt={cameraTarget}
                  orbitControlsRef={orbitRef}
                  isZoomed={isZoomed}
                  onAnimationComplete={() => setIsAnimating(false)}
                />

                <Suspense
                  fallback={
                    <mesh>
                      <sphereGeometry args={[0.5, 16, 16]} />
                      <meshStandardMaterial color="#dce4ed" wireframe />
                    </mesh>
                  }
                >
                  <GLTFHumanModel
                    modelPath="/models/human-body.glb"
                    selectedZone={selectedZone}
                    onSelectZone={handleSelectZone}
                    meshNameMap={meshNameMap}
                    combinedParts={COMBINED_PARTS}
                    isZoomed={isZoomed}
                    circles={points}
                    activeCircleIndex={null}
                    onStartCircle={handleSelectPoint}
                    onResizeCircle={handleResizePoint}
                    onFinishCircle={handleFinishPoint}
                    onMeshCenterFound={handleMeshCenterFound}
                  />

                  <LesionMarkers pins={lesoesAnteriores} onSelect={(lesaoId) => navigate(`/analysis/${lesaoId}`)} />
                  <BodyStage />
                </Suspense>

                <OrbitControls
                  ref={orbitRef}
                  enabled={!isAnimating}
                  enablePan={true}
                  enableDamping
                  dampingFactor={0.08}
                  minDistance={0.12}
                  maxDistance={6}
                  target={[0, 1.1, 0]}
                  rotateSpeed={0.8}
                />
              </Canvas>
            </div>
          ) : (
            <div className="p-6 pt-16 overflow-y-auto h-full">
              <Accordion type="multiple" className="space-y-2">
                {anatomyTree.map((group) => (
                  <AccordionItem
                    key={group.group}
                    value={group.group}
                    className="border border-border rounded-lg overflow-hidden bg-card"
                  >
                    <AccordionTrigger className="px-4 py-3 text-sm font-semibold text-foreground hover:no-underline hover:bg-accent/50">
                      {group.group}
                    </AccordionTrigger>

                    <AccordionContent>
                      <div className="grid grid-cols-2 gap-1 p-2">
                        {group.parts.map((part) => (
                          <button
                            key={part}
                            onClick={() => handleSelectFromList(part)}
                            className={`text-left px-3 py-2 rounded-md text-sm transition-colors ${
                              selectedZone === part
                                ? "bg-primary text-primary-foreground font-medium"
                                : "text-foreground hover:bg-accent"
                            }`}
                          >
                            {part}
                          </button>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          )}
        </div>

        <div className="w-2/5 p-6 flex flex-col bg-card overflow-y-auto relative">
          {isSubmitting && (
            <div className="absolute inset-0 z-20 bg-card/95 backdrop-blur-sm flex flex-col items-center justify-center text-center p-8" role="status" aria-live="polite">
              <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
              <p className="font-semibold text-foreground">Analisando a imagem</p>
              <p className="text-sm text-muted-foreground mt-1">EfficientNet-B3, ResNet50 e Swin-T estão avaliando a lesão. Leva poucos segundos.</p>
            </div>
          )}
          <header className="mb-5">
            <h2 className="text-lg font-semibold text-foreground">Dados da lesão</h2>
            <div className="mt-2 flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Região:</span>
              {selectedZone ? (
                <span className="font-semibold text-primary">{selectedZone}</span>
              ) : (
                <span className="text-muted-foreground italic">clique no corpo ou escolha na lista</span>
              )}
            </div>
          </header>

          {points.length > 0 && (
            <div className="mb-4 space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Ponto Marcado
              </Label>

              <div className="space-y-1">
                {points.map((point, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between bg-destructive/10 rounded-lg px-3 py-2 border border-destructive/20"
                  >
                    <div className="flex items-center gap-2">
                      <Circle className="w-3.5 h-3.5 text-destructive" />

                      <span className="text-xs font-medium text-foreground">
                        Ponto #{i + 1} em {point.zoneName}
                      </span>

                      <span className="text-xs text-muted-foreground">
                        x: {point.position.x.toFixed(3)}, y: {point.position.y.toFixed(3)}, z: {point.position.z.toFixed(3)}
                      </span>
                    </div>

                    <button
                      onClick={() => handleRemovePoint(i)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex-1 space-y-5">
            <div
              className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-primary/40 transition-colors cursor-pointer bg-muted/30 group"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />

              {uploadedImage ? (
                <div className="relative">
                  <img
                    src={uploadedImage}
                    alt="Pré-visualização da lesão"
                    className="w-full h-44 object-cover rounded-lg"
                  />
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/70 to-transparent rounded-b-lg px-3 py-2 text-left">
                    <span className="text-xs text-white truncate flex items-center gap-1.5"><ImageIcon className="w-3.5 h-3.5" />{selectedFile?.name}</span>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); removerImagem(); }}
                      className="text-white/90 hover:text-white bg-black/40 rounded-full p-1"
                      aria-label="Remover imagem"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="mx-auto w-11 h-11 rounded-full bg-card shadow-surface flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <Upload className="w-5 h-5 text-muted-foreground" />
                  </div>

                  <p className="text-sm font-medium text-foreground">
                    Imagem dermatoscópica
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Arraste o arquivo ou clique para escolher (JPG, PNG ou WEBP, até 10 MB)
                  </p>
                </>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="notas" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Notas clínicas <span className="normal-case font-normal tracking-normal">(opcional)</span>
              </Label>

              <Textarea
                id="notas"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                className="min-h-[100px] text-sm resize-none"
                placeholder="Descreva características visíveis, tempo de evolução, sintomas relatados..."
              />
            </div>
          </div>

          <div className="mt-6 space-y-2">
            {faltando && (
              <p className="text-xs text-muted-foreground text-center">
                {faltando.label === "Região" && "Para continuar, escolha a região do corpo."}
                {faltando.label === "Ponto" && "Para continuar, clique no ponto exato da lesão no corpo."}
                {faltando.label === "Imagem" && "Para continuar, envie a imagem dermatoscópica."}
              </p>
            )}
            <Button
              disabled={!!faltando || isSubmitting}
              className="w-full h-11 font-semibold gap-2 shadow-lg"
              onClick={handleSubmitAnalysis}
            >
              <BrainCircuit className="w-4 h-4" />
              {isSubmitting ? "Analisando..." : "Analisar com IA"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}