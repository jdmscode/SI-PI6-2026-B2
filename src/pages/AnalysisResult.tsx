import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Save, Loader2, MapPin, Calendar, Users, Info, CheckCircle2, Stethoscope } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { RiskBadge } from "@/components/RiskBadge";
import { API_URL, authHeaders, imageUrl } from "@/lib/api";
import { formatDate } from "@/lib/format";
import {
  type AnaliseLesaoResponse,
  type ModoEnsemble,
  type ResultadoModeloIA,
  ORDEM_MODELOS,
  getResultadoGeral,
} from "@/types/ia";

// Checklist que o médico preenche olhando a lesão. A IA não avalia estes critérios.
const abcdeItems = [
  { key: "A", title: "Assimetria", help: "As duas metades da lesão são diferentes." },
  { key: "B", title: "Bordas", help: "Contorno irregular, serrilhado ou mal definido." },
  { key: "C", title: "Cor", help: "Mais de uma cor ou tons desiguais." },
  { key: "D", title: "Diâmetro", help: "Maior que 6 mm." },
  { key: "E", title: "Evolução", help: "Mudou de tamanho, forma ou cor recentemente." },
];

function labelDiagnostico(classificacao: string) {
  return classificacao === "maligno" ? "Sugere melanoma" : "Sugere lesão benigna";
}

function Gauge({ percent, maligno, size = "lg" }: { percent: number; maligno: boolean; size?: "lg" | "sm" }) {
  const r = size === "lg" ? 80 : 52;
  const stroke = size === "lg" ? 12 : 8;
  const view = size === "lg" ? 192 : 128;
  const cx = view / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - percent / 100);

  return (
    <div className={`relative flex items-center justify-center ${size === "lg" ? "w-40 h-40" : "w-24 h-24"}`}>
      <svg className="w-full h-full -rotate-90" viewBox={`0 0 ${view} ${view}`} aria-hidden>
        <circle cx={cx} cy={cx} r={r} stroke="hsl(var(--muted))" strokeWidth={stroke} fill="transparent" />
        <circle
          cx={cx} cy={cx} r={r}
          stroke={maligno ? "hsl(var(--destructive))" : "hsl(var(--primary))"}
          strokeWidth={stroke} fill="transparent" strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`${size === "lg" ? "text-4xl" : "text-xl"} font-bold text-foreground tabular-nums`}>{percent}%</span>
        {size === "lg" && <span className="text-[11px] text-muted-foreground">de confiança</span>}
      </div>
    </div>
  );
}

function PainelVotos({ votos, vencedor }: { votos: { benigno: number; maligno: number }; vencedor: string }) {
  return (
    <div className="grid grid-cols-2 gap-3 w-full">
      {(["benigno", "maligno"] as const).map((k) => {
        const ativo = k === vencedor;
        const mal = k === "maligno";
        return (
          <div key={k} className={`rounded-xl border px-3 py-4 text-center ${ativo ? (mal ? "border-destructive bg-destructive/10" : "border-primary bg-primary/10") : "border-border bg-muted/30"}`}>
            <p className={`text-5xl font-black tabular-nums leading-none ${ativo ? (mal ? "text-destructive" : "text-primary") : "text-muted-foreground"}`}>{votos[k]}</p>
            <p className="text-xs font-semibold mt-2 capitalize">{k}</p>
            <p className="text-[11px] text-muted-foreground">{votos[k] === 1 ? "voto" : "votos"} de 3</p>
          </div>
        );
      })}
    </div>
  );
}

function CardModelo({ modelo }: { modelo: ResultadoModeloIA }) {
  const mal = modelo.classificacao === "maligno";
  return (
    <Card className="p-4 shadow-surface border-border flex items-center gap-4">
      <Gauge percent={Math.round(modelo.confianca * 100)} maligno={mal} size="sm" />
      <div className="min-w-0">
        <Badge variant="outline" className="text-[11px] font-mono mb-1">{modelo.nome_exibicao}</Badge>
        <p className={`text-sm font-semibold ${mal ? "text-destructive" : "text-primary"}`}>{mal ? "Maligno" : "Benigno"}</p>
        <p className="text-xs text-muted-foreground">
          P(maligno) {Math.round(modelo.probabilidades.maligno * 100)}% · P(benigno) {Math.round(modelo.probabilidades.benigno * 100)}%
        </p>
      </div>
    </Card>
  );
}

export default function AnalysisResult() {
  const navigate = useNavigate();
  const location = useLocation();
  const { lesaoId } = useParams();

  const [modoEnsemble, setModoEnsemble] = useState<ModoEnsemble>("soft");
  const [validatedItems, setValidatedItems] = useState<Record<string, boolean>>({});
  const [parecerMedico, setParecerMedico] = useState("");
  const [vereditoMedico, setVereditoMedico] = useState<string | null>(null);
  const [loadedAnalysis, setLoadedAnalysis] = useState<AnaliseLesaoResponse | null>(null);
  const [erro, setErro] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [pacienteNome, setPacienteNome] = useState<string>(location.state?.pacienteNome ?? "");

  const stateAnalysisResult = location.state?.analysisResult as AnaliseLesaoResponse | undefined;
  const imagemPreview = location.state?.imagemPreview as string | undefined;
  const analysisResult = stateAnalysisResult || loadedAnalysis;

  const imagemServidor = imageUrl(analysisResult?.imagem_path);
  const [imageSrc, setImageSrc] = useState<string | null>(imagemServidor || imagemPreview || null);

  useEffect(() => {
    setImageSrc(imagemServidor || imagemPreview || null);
  }, [imagemServidor, imagemPreview]);

  useEffect(() => {
    if (!lesaoId || stateAnalysisResult) return;
    fetch(`${API_URL}/lesoes/${lesaoId}`, { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: AnaliseLesaoResponse) => setLoadedAnalysis(d))
      .catch(() => setErro(true));
  }, [lesaoId, stateAnalysisResult]);

  const pacienteId = analysisResult?.paciente_id ?? location.state?.pacienteId;

  useEffect(() => {
    if (pacienteNome || !pacienteId) return;
    fetch(`${API_URL}/pacientes/${pacienteId}`, { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.paciente?.nome && setPacienteNome(d.paciente.nome))
      .catch(() => undefined);
  }, [pacienteId, pacienteNome]);

  useEffect(() => {
    if (!analysisResult) return;
    if (analysisResult.parecer_medico) setParecerMedico(analysisResult.parecer_medico);
    if (analysisResult.criterios_abcde) setValidatedItems(analysisResult.criterios_abcde);
    if (analysisResult.veredito_medico) {
      setVereditoMedico(analysisResult.veredito_medico);
      setSalvo(true);
    }
  }, [analysisResult]);

  const crumbs = [
    { label: "Pacientes", to: "/patients" },
    ...(pacienteId ? [{ label: pacienteNome || "Paciente", to: `/patients/${pacienteId}` }] : []),
    { label: "Resultado da análise" },
  ];

  if (erro || (!analysisResult && !lesaoId)) {
    return (
      <div className="space-y-6">
        <PageHeader crumbs={crumbs} title="Análise não encontrada" />
        <Card className="p-6 border-border shadow-soft">
          <p className="text-sm text-muted-foreground">Esta análise não existe ou foi removida. Abra o paciente e escolha uma lesão do histórico.</p>
          <Button className="mt-4" onClick={() => navigate("/patients")}>Ir para pacientes</Button>
        </Card>
      </div>
    );
  }

  if (!analysisResult) {
    return (
      <div className="space-y-6" role="status" aria-live="polite">
        <PageHeader crumbs={crumbs} title="Carregando análise..." />
        <div className="grid grid-cols-12 gap-6">
          <Skeleton className="col-span-12 lg:col-span-5 h-80 rounded-2xl" />
          <Skeleton className="col-span-12 lg:col-span-7 h-80 rounded-2xl" />
        </div>
        <Skeleton className="h-28 rounded-2xl" />
      </div>
    );
  }

  const geral = getResultadoGeral(analysisResult, modoEnsemble);
  const certaintyPercent = Math.round(geral.confianca * 100);
  const votosHard = analysisResult.resultado_ia?.ensemble.hard.votos;
  const isMaligno = geral.classificacao === "maligno";
  const modelos = analysisResult.resultado_ia?.modelos;
  const listaModelos = modelos ? ORDEM_MODELOS.map((id) => modelos[id]).filter(Boolean) : [];
  const concordam = listaModelos.filter((m) => m.classificacao === geral.classificacao).length;

  const marcarAlterado = () => setSalvo(false);

  const handleSaveMedicalReview = async () => {
    if (!vereditoMedico) {
      toast.error("Escolha o veredito (benigno ou maligno) antes de salvar.");
      return;
    }
    setSalvando(true);
    try {
      const response = await fetch(`${API_URL}/lesoes/${analysisResult.id}/laudo`, {
        method: "PATCH",
        headers: authHeaders(true),
        body: JSON.stringify({ parecer_medico: parecerMedico, criterios_abcde: validatedItems, veredito_medico: vereditoMedico }),
      });
      if (!response.ok) throw new Error();
      setSalvo(true);
      toast.success("Laudo salvo no histórico do paciente.", {
        action: pacienteId ? { label: "Ver paciente", onClick: () => navigate(`/patients/${pacienteId}`) } : undefined,
      });
    } catch {
      toast.error("Não foi possível salvar o laudo. Seu texto continua aqui; tente de novo.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        crumbs={crumbs}
        title="Resultado da análise"
        description={
          <span className="inline-flex flex-wrap items-center gap-x-4 gap-y-1">
            {analysisResult.localizacao && <span className="inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{analysisResult.localizacao}</span>}
            {analysisResult.data && <span className="inline-flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{formatDate(analysisResult.data)}</span>}
          </span>
        }
        actions={<RiskBadge risco={geral.risco} size="md" />}
      />

      <motion.div className="grid grid-cols-12 gap-6" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <Card className="col-span-12 lg:col-span-5 shadow-soft border-border p-6 flex flex-col items-center text-center">
          <div className="flex w-full p-1 rounded-lg bg-muted mb-5" role="tablist" aria-label="Forma de combinar os modelos">
            {([
              ["soft", "Média das probabilidades", "Soma a confiança de cada modelo e tira a média. É o padrão do sistema."],
              ["hard", "Votação por maioria", "Cada modelo dá um voto; vence a classe com 2 ou 3 votos."],
            ] as const).map(([id, label, ajuda]) => (
              <Tooltip key={id}>
                <TooltipTrigger asChild>
                  <button
                    role="tab"
                    aria-selected={modoEnsemble === id}
                    onClick={() => setModoEnsemble(id)}
                    className={`flex-1 px-2 py-1.5 text-xs rounded-md transition-colors ${modoEnsemble === id ? "bg-card text-foreground shadow-sm font-semibold" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {label}
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-[220px]">{ajuda}</TooltipContent>
              </Tooltip>
            ))}
          </div>

          <p className={`text-2xl font-bold mb-1 ${isMaligno ? "text-destructive" : "text-primary"}`}>{labelDiagnostico(geral.classificacao)}</p>
          {listaModelos.length > 0 && (
            <p className="text-sm text-muted-foreground mb-5 inline-flex items-center gap-1.5">
              <Users className="w-4 h-4" /> {concordam} de {listaModelos.length} modelos concordam
            </p>
          )}

          {modoEnsemble === "hard" && votosHard ? (
            <PainelVotos votos={votosHard} vencedor={geral.classificacao} />
          ) : (
            <Gauge percent={certaintyPercent} maligno={isMaligno} />
          )}

          <p className="mt-5 text-xs text-muted-foreground leading-relaxed flex gap-1.5 text-left">
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            {concordam < listaModelos.length
              ? "Os modelos discordaram. Trate como caso duvidoso e dê mais peso ao exame clínico."
              : "Resultado de apoio. Confirme com o exame clínico e os critérios ABCDE abaixo."}
          </p>
        </Card>

        <Card className="col-span-12 lg:col-span-7 shadow-soft border-border p-6 flex flex-col">
          <h2 className="text-sm font-semibold text-foreground mb-3">Imagem enviada</h2>
          <div className="flex-1 flex justify-center items-center min-h-64 bg-muted rounded-xl border overflow-hidden">
            {imageSrc ? (
              <img
                src={imageSrc}
                alt={`Imagem dermatoscópica da lesão${analysisResult.localizacao ? ` em ${analysisResult.localizacao}` : ""}`}
                className="max-h-80 w-auto object-contain"
                onError={() => { if (imagemServidor && imageSrc !== imagemServidor) setImageSrc(imagemServidor); }}
              />
            ) : (
              <p className="text-xs text-muted-foreground">Imagem indisponível</p>
            )}
          </div>
          {analysisResult.descricao && (
            <p className="text-sm text-muted-foreground mt-3"><span className="font-medium text-foreground">Notas:</span> {analysisResult.descricao}</p>
          )}
        </Card>
      </motion.div>

      {listaModelos.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-foreground mb-3">O que cada modelo disse</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {ORDEM_MODELOS.map((id) => (modelos?.[id] ? <CardModelo key={id} modelo={modelos[id]} /> : null))}
          </div>
        </section>
      )}

      <Card className="shadow-soft border-border p-6 space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2"><Stethoscope className="w-5 h-5 text-primary" /> Laudo médico</h2>
            <p className="text-sm text-muted-foreground">Preenchido por você. A IA não avalia os critérios ABCDE.</p>
          </div>
          {salvo ? (
            <span className="inline-flex items-center gap-1.5 text-sm text-emerald-700 font-medium"><CheckCircle2 className="w-4 h-4" /> Salvo no histórico</span>
          ) : (
            <span className="text-sm text-amber-700 font-medium">Alterações não salvas</span>
          )}
        </div>

        <div>
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">1. Critérios ABCDE presentes na lesão</Label>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 mt-3">
            {abcdeItems.map((item) => {
              const ativo = validatedItems[item.key] === true;
              return (
                <button
                  key={item.key}
                  type="button"
                  role="checkbox"
                  aria-checked={ativo}
                  onClick={() => { setValidatedItems((prev) => ({ ...prev, [item.key]: !ativo })); marcarAlterado(); }}
                  className={`text-left rounded-xl border p-3 transition-colors ${ativo ? "border-amber-400 bg-amber-50" : "border-border hover:border-primary/40 hover:bg-muted/40"}`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-2xl font-black ${ativo ? "text-amber-600" : "text-muted-foreground/40"}`}>{item.key}</span>
                    <span className={`w-5 h-5 rounded-md border flex items-center justify-center ${ativo ? "bg-amber-500 border-amber-500 text-white" : "border-input"}`}>
                      {ativo && <CheckCircle2 className="w-3.5 h-3.5" />}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-foreground mt-1">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.help}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">2. Veredito final</Label>
          <div className="flex gap-3 mt-3 flex-wrap">
            <Button type="button" variant={vereditoMedico === "benigno" ? "default" : "outline"} onClick={() => { setVereditoMedico("benigno"); marcarAlterado(); }}>
              Confirmar benigno
            </Button>
            <Button type="button" variant={vereditoMedico === "maligno" ? "destructive" : "outline"} onClick={() => { setVereditoMedico("maligno"); marcarAlterado(); }}>
              Confirmar maligno
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="parecer" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">3. Parecer e conduta</Label>
          <Textarea
            id="parecer"
            value={parecerMedico}
            onChange={(e) => { setParecerMedico(e.target.value); marcarAlterado(); }}
            className="min-h-[110px] text-sm resize-none"
            placeholder="Ex.: suspeita de melanoma, encaminhar para biópsia excisional. Retorno em 30 dias."
          />
        </div>

        <div className="flex items-center justify-end gap-3 flex-wrap">
          {!vereditoMedico && <span className="text-xs text-muted-foreground">Escolha o veredito para salvar.</span>}
          <Button className="gap-2 font-semibold" onClick={handleSaveMedicalReview} disabled={salvando || !vereditoMedico}>
            {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {salvando ? "Salvando..." : "Salvar laudo"}
          </Button>
        </div>
      </Card>

      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex gap-3 items-start">
        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-xs text-foreground/80 leading-relaxed">
          Ferramenta de apoio à decisão. O resultado combina EfficientNet-B3, ResNet50 e Swin-T e pode errar, principalmente deixando passar
          melanomas. Diagnóstico, conduta e laudo histopatológico são responsabilidade do médico.
        </p>
      </div>
    </div>
  );
}
