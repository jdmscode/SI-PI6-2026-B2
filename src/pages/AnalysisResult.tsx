import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Save, ArrowLeft, Cpu } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import {
  type AnaliseLesaoResponse,
  type ModoEnsemble,
  type ResultadoModeloIA,
  ORDEM_MODELOS,
  getResultadoGeral,
} from "@/types/ia";

const abcdeItems = [
  { key: "A", title: "Assimetria", detected: "Detectada", severity: "high" },
  { key: "B", title: "Bordas", detected: "Irregulares", severity: "high" },
  { key: "C", title: "Coloração", detected: "Policromia", severity: "high" },
  { key: "D", title: "Diâmetro", detected: "> 6mm", severity: "medium" },
  { key: "E", title: "Evolução", detected: "Relatada", severity: "high" },
];

function labelDiagnostico(classificacao: string) {
  return classificacao === "maligno" ? "Melanoma Maligno" : "Lesão Benigna";
}

function GaugeConfianca({
  percent,
  isAltoRisco,
  size = "lg",
}: {
  percent: number;
  isAltoRisco: boolean;
  size?: "lg" | "sm";
}) {
  const r = size === "lg" ? 80 : 52;
  const stroke = size === "lg" ? 12 : 8;
  const view = size === "lg" ? 192 : 128;
  const cx = view / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - percent / 100);
  const textClass = size === "lg" ? "text-4xl" : "text-2xl";

  return (
    <div
      className={`relative flex items-center justify-center ${
        size === "lg" ? "w-44 h-44" : "w-28 h-28"
      }`}
    >
      <svg className="w-full h-full transform -rotate-90" viewBox={`0 0 ${view} ${view}`}>
        <circle
          cx={cx}
          cy={cx}
          r={r}
          stroke="hsl(var(--muted))"
          strokeWidth={stroke}
          fill="transparent"
        />
        <circle
          cx={cx}
          cy={cx}
          r={r}
          stroke={isAltoRisco ? "hsl(var(--destructive))" : "hsl(var(--primary))"}
          strokeWidth={stroke}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`${textClass} font-bold text-foreground tabular-nums`}>{percent}%</span>
        {size === "lg" && (
          <span className="text-xs font-bold uppercase text-muted-foreground">de certeza</span>
        )}
      </div>
    </div>
  );
}

function PainelVotos({
  votos,
  vencedor,
}: {
  votos: { benigno: number; maligno: number };
  vencedor: string;
}) {
  const itens = [
    { key: "benigno", label: "Benigno", valor: votos.benigno },
    { key: "maligno", label: "Maligno", valor: votos.maligno },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 w-full">
      {itens.map((item) => {
        const ativo = item.key === vencedor;
        const maligno = item.key === "maligno";
        return (
          <div
            key={item.key}
            className={`rounded-xl border px-3 py-4 ${
              ativo
                ? maligno
                  ? "border-destructive bg-destructive/10"
                  : "border-primary bg-primary/10"
                : "border-border bg-muted/30"
            }`}
          >
            <p
              className={`text-5xl font-black tabular-nums leading-none ${
                ativo
                  ? maligno
                    ? "text-destructive"
                    : "text-primary"
                  : "text-muted-foreground"
              }`}
            >
              {item.valor}
            </p>
            <p className="text-[11px] font-bold uppercase tracking-wider mt-2">{item.label}</p>
            <p className="text-[10px] text-muted-foreground">
              {item.valor === 1 ? "voto" : "votos"}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function CardModelo({ modelo }: { modelo: ResultadoModeloIA }) {
  const isMaligno = modelo.classificacao === "maligno";
  const percent = Math.round(modelo.confianca * 100);

  return (
    <Card className="p-4 shadow-soft border-border flex flex-col items-center text-center gap-2">
      <Badge variant="outline" className="text-[10px] font-mono">
        {modelo.nome_exibicao}
      </Badge>
      <p
        className={`text-sm font-bold ${isMaligno ? "text-destructive" : "text-primary"}`}
      >
        {labelDiagnostico(modelo.classificacao)}
      </p>
      <GaugeConfianca percent={percent} isAltoRisco={isMaligno} size="sm" />
      <p className="text-[10px] text-muted-foreground">
        Benigno {Math.round(modelo.probabilidades.benigno * 100)}% · Maligno{" "}
        {Math.round(modelo.probabilidades.maligno * 100)}%
      </p>
    </Card>
  );
}

export default function AnalysisResult() {
  const navigate = useNavigate();
  const location = useLocation();
  const { lesaoId } = useParams();

  const [loading, setLoading] = useState(true);
  const [modoEnsemble, setModoEnsemble] = useState<ModoEnsemble>("soft");
  const [validatedItems, setValidatedItems] = useState<Record<string, boolean>>({});
  const [parecerMedico, setParecerMedico] = useState("");
  const [loadedAnalysis, setLoadedAnalysis] = useState<AnaliseLesaoResponse | null>(null);

  const stateAnalysisResult = location.state?.analysisResult as AnaliseLesaoResponse | undefined;
  const imagemPreview = location.state?.imagemPreview as string | undefined;
  const analysisResult = stateAnalysisResult || loadedAnalysis;

  const [vereditoMedico, setVereditoMedico] = useState<string | null>(null);

  const imagemServidor = analysisResult?.imagem_path
    ? `http://localhost:8000/${analysisResult.imagem_path.replace(/\\/g, "/").replace(/^\/+/, "")}`
    : null;
  const [imageSrc, setImageSrc] = useState<string | null>(imagemServidor || imagemPreview || null);

  useEffect(() => {
    setImageSrc(imagemServidor || imagemPreview || null);
  }, [imagemServidor, imagemPreview]);

  useEffect(() => {
    const fetchLesao = async () => {
      if (!lesaoId || analysisResult) return;

      try {
        const response = await fetch(`http://localhost:8000/lesoes/${lesaoId}`);

        if (!response.ok) {
          throw new Error("Erro ao buscar lesão");
        }

        const result = (await response.json()) as AnaliseLesaoResponse;
        setLoadedAnalysis(result);
      } catch (error) {
        console.error(error);
      }
    };

    fetchLesao();
  }, [lesaoId, analysisResult]);

  useEffect(() => {
    if (!analysisResult) return;

    if (analysisResult.parecer_medico) {
      setParecerMedico(analysisResult.parecer_medico);
    }

    if (analysisResult.criterios_abcde) {
      setValidatedItems(analysisResult.criterios_abcde);
    }

    if (analysisResult.veredito_medico) {
      setVereditoMedico(analysisResult.veredito_medico);
    }
  }, [analysisResult]);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1200);
    return () => clearTimeout(timer);
  }, []);

  if (!analysisResult && !loading) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => navigate("/patients")}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para Pacientes
        </button>

        <Card className="p-6 border-border shadow-soft">
          <h2 className="text-lg font-bold text-foreground">Nenhuma análise encontrada</h2>
          <p className="text-sm text-muted-foreground mt-2">
            Envie uma lesão pelo mapeamento anatômico para visualizar o resultado da IA.
          </p>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center relative">
            <Cpu className="w-5 h-5 text-primary animate-pulse" />
            <span className="absolute inset-0 rounded-full border-2 border-primary/30 animate-pulse-ring" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Processando ensemble...</h1>
            <p className="text-sm text-muted-foreground">
              EfficientNet-B3 · ResNet50 · Swin-T
            </p>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-4">
            <Skeleton className="h-72 rounded-2xl" />
          </div>
          <div className="col-span-8">
            <Skeleton className="h-72 rounded-2xl" />
          </div>
        </div>

        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-16 rounded-2xl" />
      </div>
    );
  }

  const geral = getResultadoGeral(analysisResult!, modoEnsemble);
  const certaintyPercent = Math.round(geral.confianca * 100);
  const votosHard = analysisResult?.resultado_ia?.ensemble.hard.votos;
  const isMaligno = geral.classificacao === "maligno";
  const isAltoRisco = geral.risco === "alto" || isMaligno;
  const diagnosticLabel = labelDiagnostico(geral.classificacao);
  const temEnsemble = Boolean(analysisResult?.resultado_ia?.modelos);
  const modelos = analysisResult?.resultado_ia?.modelos;

  const handleSaveMedicalReview = async () => {
    if (!analysisResult?.id) {
      alert("Lesão inválida.");
      return;
    }

    try {
      const response = await fetch(`http://localhost:8000/lesoes/${analysisResult.id}/laudo`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          parecer_medico: parecerMedico,
          criterios_abcde: validatedItems,
          veredito_medico: vereditoMedico,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error);
      }

      const result = await response.json();

      console.log("Laudo salvo:", result);
      alert("Laudo salvo no histórico do paciente.");
    } catch (error) {
      console.error("Erro ao salvar laudo:", error);
      alert("Erro ao salvar laudo médico.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </button>

        <Badge variant="outline" className="text-[10px] font-mono">
          Ensemble · 3 modelos
        </Badge>
      </div>

      <motion.div
        className="grid grid-cols-12 gap-6"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="col-span-12 lg:col-span-4">
          <Card className="shadow-soft border-border h-full flex flex-col items-center justify-center p-6 text-center">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">
              Resultado geral da IA
            </h3>

            <div className="flex items-center gap-2 mb-4">
              <span
                className={`text-[10px] font-medium ${
                  modoEnsemble === "hard" ? "text-primary" : "text-muted-foreground"
                }`}
              >
                Hard voting
              </span>
              <Switch
                checked={modoEnsemble === "soft"}
                onCheckedChange={(checked) => setModoEnsemble(checked ? "soft" : "hard")}
              />
              <span
                className={`text-[10px] font-medium ${
                  modoEnsemble === "soft" ? "text-primary" : "text-muted-foreground"
                }`}
              >
                Soft voting
              </span>
            </div>

            <div
              className={`text-2xl font-black mb-2 ${
                isMaligno ? "text-destructive" : "text-primary"
              }`}
            >
              {diagnosticLabel}
            </div>

            <p className="text-xs text-muted-foreground mb-5">
              {modoEnsemble === "hard"
                ? "Maioria simples entre os três modelos"
                : "Média das probabilidades dos três modelos"}
            </p>

            {modoEnsemble === "hard" && votosHard ? (
              <PainelVotos votos={votosHard} vencedor={geral.classificacao} />
            ) : (
              <GaugeConfianca percent={certaintyPercent} isAltoRisco={isAltoRisco} size="lg" />
            )}

            <p className="mt-5 text-xs text-muted-foreground leading-relaxed">
              {modoEnsemble === "hard"
                ? "O número em destaque é a quantidade de modelos que votaram em cada classe."
                : "A porcentagem indica o grau de confiança do ensemble nessa classificação."}
            </p>
          </Card>
        </div>

        <div className="col-span-12 lg:col-span-8">
          <Card className="shadow-soft border-border p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                Imagem da Lesão
              </h3>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <div className="flex justify-center items-center h-64 bg-muted rounded-lg border">
                  {imageSrc ? (
                    <img
                      src={imageSrc}
                      alt="Imagem da lesão"
                      className="max-h-64 w-auto mx-auto object-contain rounded-lg"
                      onError={() => {
                        if (imagemServidor && imageSrc !== imagemServidor) {
                          setImageSrc(imagemServidor);
                        }
                      }}
                    />
                  ) : (
                    <p className="text-xs text-muted-foreground">Imagem da lesão</p>
                  )}
                </div>
                <p className="text-[10px] text-center text-muted-foreground uppercase font-bold">
                  Imagem Original
                </p>
              </div>
            </div>
          </Card>
        </div>
      </motion.div>

      {temEnsemble && modelos && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">
            Detalhamento por modelo
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {ORDEM_MODELOS.map((id) => {
              const modelo = modelos[id];
              if (!modelo) return null;
              return <CardModelo key={id} modelo={modelo} />;
            })}
          </div>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15 }}
      >
        <Card className="bg-foreground text-primary-foreground p-8 border-none shadow-xl">
          <h3 className="text-xs font-bold uppercase tracking-widest mb-6 opacity-50">
            Critérios ABCDE — Revisão Médica
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-6">
            {abcdeItems.map((item) => (
              <div key={item.key} className="space-y-2">
                <div className="text-3xl font-black opacity-20">{item.key}</div>
                <div className="text-xs font-bold text-primary">{item.title}</div>
                <div className="text-sm font-medium">{item.detected}</div>

                <div className="flex items-center gap-2 mt-2">
                  <Checkbox
                    checked={validatedItems[item.key] === true}
                    onCheckedChange={(checked) => {
                      setValidatedItems((prev) => ({
                        ...prev,
                        [item.key]: checked === true,
                      }));
                    }}
                    className="border-primary-foreground/30 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                  />
                  <span className="text-[10px] opacity-60">Validado</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.25 }}
      >
        <Card className="shadow-surface border-border p-6">
          <div className="space-y-3">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Laudo / Parecer Médico
            </Label>
            <div className="space-y-3 mb-5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Veredito Final do Médico
              </Label>

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant={vereditoMedico === "benigno" ? "default" : "outline"}
                  onClick={() => setVereditoMedico("benigno")}
                >
                  Confirmar Benigno
                </Button>

                <Button
                  type="button"
                  variant={vereditoMedico === "maligno" ? "destructive" : "outline"}
                  onClick={() => setVereditoMedico("maligno")}
                >
                  Confirmar Maligno
                </Button>
              </div>
            </div>
            <Textarea
              value={parecerMedico}
              onChange={(e) => setParecerMedico(e.target.value)}
              className="min-h-[120px] text-sm resize-none"
              placeholder="Registre seu parecer clínico, conduta sugerida e encaminhamentos..."
            />
          </div>

          <div className="flex justify-end mt-4">
            <Button className="gap-2 font-semibold" onClick={handleSaveMedicalReview}>
              <Save className="w-4 h-4" />
              Salvar no Histórico do Paciente
            </Button>
          </div>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.35 }}
        className="p-4 bg-warning/10 border border-warning/20 rounded-lg flex gap-3 items-start"
      >
        <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
        <p className="text-xs text-foreground/80 leading-relaxed">
          <strong>Aviso de Suporte à Decisão:</strong> Esta análise combina EfficientNet-B3, ResNet50 e Swin-T
          (hard e soft voting) e deve ser utilizada apenas como ferramenta auxiliar. O diagnóstico final, conduta
          cirúrgica e laudo histopatológico são de responsabilidade exclusiva do médico assistente.
        </p>
      </motion.div>
    </div>
  );
}
