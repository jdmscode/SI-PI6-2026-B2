import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Calendar, MapPin, ScanLine, Loader2, ChevronRight, Bot, Stethoscope } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { RiskBadge } from "@/components/RiskBadge";
import { API_URL, authHeaders } from "@/lib/api";
import { formatDate, initials } from "@/lib/format";
import { BodyMap3D } from "@/components/BodyMap3D";
import { lesoesParaPins } from "@/components/LesionMarkers";

interface Lesao {
  id: number;
  data: string;
  localizacao: string;
  descricao: string;
  risco: string;
  classificacao?: string;
  confianca?: string;
  veredito_medico?: string | null;
}

interface PatientData {
  paciente: { id: number; nome: string; idade: number; cpf: string; risco: string; lesoes: number; ultima_consulta?: string };
  lesoes: Lesao[];
}

function Veredito({ valor }: { valor?: string | null }) {
  if (valor === "maligno") return <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700"><Stethoscope className="w-3.5 h-3.5" /> Médico: maligno</span>;
  if (valor === "benigno") return <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700"><Stethoscope className="w-3.5 h-3.5" /> Médico: benigno</span>;
  return <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700"><Stethoscope className="w-3.5 h-3.5" /> Laudo pendente</span>;
}

export default function PatientProfile() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [data, setData] = useState<PatientData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const carregar = async () => {
      try {
        const response = await fetch(`${API_URL}/pacientes/${id}`, { headers: authHeaders() });
        if (!response.ok) {
          toast.error("Paciente não encontrado.");
          navigate("/patients");
          return;
        }
        setData(await response.json());
      } catch {
        toast.error("Não foi possível abrir o prontuário.");
      } finally {
        setIsLoading(false);
      }
    };
    carregar();
  }, [id, navigate]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Abrindo prontuário...</p>
      </div>
    );
  }

  if (!data) return null;

  const { paciente } = data;
  const lesoes = [...data.lesoes].sort((a, b) => b.id - a.id);
  const pendentes = lesoes.filter((l) => !l.veredito_medico).length;

  return (
    <div className="space-y-6">
      <PageHeader
        crumbs={[{ label: "Pacientes", to: "/patients" }, { label: paciente.nome }]}
        title={
          <span className="flex items-center gap-4">
            <span className="w-14 h-14 rounded-2xl bg-primary text-primary-foreground text-lg font-bold flex items-center justify-center shrink-0">{initials(paciente.nome)}</span>
            <span>
              {paciente.nome}
              <span className="block text-sm font-normal text-muted-foreground mt-0.5">{paciente.idade} anos · CPF {paciente.cpf}</span>
            </span>
          </span>
        }
        actions={
          <Button className="gap-2" onClick={() => navigate(`/mapping/${id}`)}>
            <ScanLine className="w-4 h-4" /> Registrar nova lesão
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          ["Lesões registradas", String(lesoes.length)],
          ["Laudos pendentes", String(pendentes)],
          ["Última consulta", paciente.ultima_consulta || "—"],
        ].map(([l, v]) => (
          <Card key={l} className="shadow-surface border-border p-4">
            <p className="text-xs text-muted-foreground">{l}</p>
            <p className="text-xl font-bold text-foreground tabular-nums mt-0.5">{v}</p>
          </Card>
        ))}
        <Card className="shadow-surface border-border p-4">
          <p className="text-xs text-muted-foreground mb-1.5">Risco atual (última análise)</p>
          <RiskBadge risco={lesoes.length ? paciente.risco : null} size="md" />
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 items-start">
      <motion.div className="xl:col-span-3" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="shadow-surface border-border">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base font-semibold">Histórico de lesões</CardTitle>
            {lesoes.length > 0 && <span className="text-xs text-muted-foreground">Clique em uma lesão para ver a análise e o laudo</span>}
          </CardHeader>
          <CardContent className="px-2 pb-2">
            {lesoes.length > 0 ? (
              <ul className="divide-y divide-border">
                {lesoes.map((l) => (
                  <li key={l.id}>
                    <button
                      type="button"
                      onClick={() => navigate(`/analysis/${l.id}`)}
                      className="w-full text-left flex items-center gap-4 px-4 py-4 rounded-lg hover:bg-muted/60 transition-colors"
                    >
                      <span className={`w-1.5 self-stretch rounded-full ${l.veredito_medico === "maligno" ? "bg-red-500" : l.veredito_medico === "benigno" ? "bg-emerald-500" : "bg-amber-400"}`} aria-hidden />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-foreground flex items-center gap-1.5"><MapPin className="w-4 h-4 text-primary" />{l.localizacao}</span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{formatDate(l.data)}</span>
                        </div>
                        {l.descricao && <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{l.descricao}</p>}
                        <div className="flex items-center gap-4 mt-2 flex-wrap">
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-foreground">
                            <Bot className="w-3.5 h-3.5 text-muted-foreground" /> IA: {l.classificacao === "maligno" ? "maligno" : "benigno"}
                            {l.confianca && ` (${Math.round(parseFloat(l.confianca) * 100)}%)`}
                          </span>
                          <Veredito valor={l.veredito_medico} />
                        </div>
                      </div>
                      <RiskBadge risco={l.risco} />
                      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="py-12 text-center">
                <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                  <ScanLine className="w-6 h-6 text-primary" />
                </div>
                <p className="font-medium text-foreground">Nenhuma lesão registrada</p>
                <p className="text-sm text-muted-foreground mt-1 mb-4">Marque a lesão no corpo 3D e envie a imagem para análise.</p>
                <Button className="gap-2" onClick={() => navigate(`/mapping/${id}`)}><ScanLine className="w-4 h-4" /> Registrar primeira lesão</Button>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <motion.div className="xl:col-span-2" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className="shadow-surface border-border p-3">
          <div className="px-2 pt-1 pb-3">
            <h2 className="text-base font-semibold text-foreground">Mapa corporal</h2>
            <p className="text-xs text-muted-foreground">Gire o modelo e clique em um marcador para abrir a análise.</p>
          </div>
          <div className="h-[520px]">
            <BodyMap3D pins={lesoesParaPins(data.lesoes)} onSelect={(lesaoId) => navigate(`/analysis/${lesaoId}`)} />
          </div>
        </Card>
      </motion.div>
      </div>
    </div>
  );
}
