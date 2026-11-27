import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Users, ScanLine, ShieldAlert, ArrowRight, UserPlus, Loader2, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { RiskBadge, normalizarRisco } from "@/components/RiskBadge";
import { API_URL, authHeaders, clearSession } from "@/lib/api";
import { firstName, initials, saudacao } from "@/lib/format";

interface Paciente {
  id: number;
  nome: string;
  idade: number;
  lesoes: number;
  risco: string;
  ultima_consulta: string;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [patients, setPatients] = useState<Paciente[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const medicoNome = localStorage.getItem("medico_nome") || "";

  useEffect(() => {
    const carregar = async () => {
      try {
        const response = await fetch(`${API_URL}/pacientes`, { headers: authHeaders() });
        if (response.status === 401) {
          clearSession();
          toast.error("Sua sessão expirou. Entre novamente.");
          navigate("/login", { replace: true });
          return;
        }
        if (response.ok) setPatients(await response.json());
      } catch {
        toast.error("Não foi possível carregar o painel. Verifique a conexão com a API.");
      } finally {
        setIsLoading(false);
      }
    };
    carregar();
  }, [navigate]);

  const totalLesoes = patients.reduce((acc, p) => acc + (p.lesoes || 0), 0);
  const altoRisco = patients.filter((p) => normalizarRisco(p.risco) === "alto");
  const recentes = [...patients].sort((a, b) => b.id - a.id).slice(0, 6);

  const metricas = [
    { label: "Pacientes", valor: patients.length, detalhe: "cadastrados por você", icon: Users, cor: "bg-blue-50 text-blue-600" },
    { label: "Lesões mapeadas", valor: totalLesoes, detalhe: "com imagem analisada", icon: ScanLine, cor: "bg-violet-50 text-violet-600" },
    { label: "Alto risco", valor: altoRisco.length, detalhe: "pacientes para priorizar", icon: ShieldAlert, cor: "bg-red-50 text-red-600" },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title={`${saudacao()}${medicoNome ? `, ${firstName(medicoNome)}` : ""}`}
        description="Resumo dos seus pacientes e das últimas análises."
        actions={
          <Button className="gap-2" onClick={() => navigate("/patients?novo=1")}>
            <UserPlus className="w-4 h-4" /> Novo paciente
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {metricas.map((m, i) => (
          <motion.div key={m.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: i * 0.06 }}>
            <Card className="shadow-surface border-border">
              <CardContent className="p-5 flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${m.cor}`}>
                  <m.icon className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{m.label}</p>
                  <p className="text-3xl font-bold text-foreground tabular-nums leading-tight">
                    {isLoading ? <Loader2 className="w-6 h-6 animate-spin text-muted-foreground my-1" /> : m.valor}
                  </p>
                  <p className="text-xs text-muted-foreground">{m.detalhe}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="shadow-surface border-border lg:col-span-2">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base font-semibold">Pacientes recentes</CardTitle>
            <Button variant="ghost" size="sm" className="gap-1 text-primary" onClick={() => navigate("/patients")}>
              Ver todos <ArrowRight className="w-4 h-4" />
            </Button>
          </CardHeader>
          <CardContent className="px-2 pb-2">
            {isLoading ? (
              <div className="flex justify-center p-10"><Loader2 className="animate-spin text-primary" /></div>
            ) : recentes.length === 0 ? (
              <div className="text-center py-12 px-6">
                <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                  <Users className="w-6 h-6 text-primary" />
                </div>
                <p className="font-medium text-foreground">Nenhum paciente ainda</p>
                <p className="text-sm text-muted-foreground mt-1 mb-4">Cadastre o primeiro paciente para começar a mapear lesões.</p>
                <Button onClick={() => navigate("/patients?novo=1")} className="gap-2"><UserPlus className="w-4 h-4" /> Cadastrar paciente</Button>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {recentes.map((p) => (
                  <li key={p.id}>
                    <button
                      onClick={() => navigate(`/patients/${p.id}`)}
                      className="w-full flex items-center gap-4 px-4 py-3 rounded-lg hover:bg-muted/60 transition-colors text-left"
                    >
                      <span className="w-10 h-10 rounded-full bg-primary/10 text-primary font-semibold text-sm flex items-center justify-center shrink-0">
                        {initials(p.nome)}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block font-medium text-foreground truncate">{p.nome}</span>
                        <span className="block text-xs text-muted-foreground">
                          {p.idade} anos · {p.lesoes} {p.lesoes === 1 ? "lesão" : "lesões"} · última consulta {p.ultima_consulta}
                        </span>
                      </span>
                      <RiskBadge risco={p.lesoes > 0 ? p.risco : null} />
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-surface border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Como registrar uma lesão</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-4">
              {[
                ["Abra o paciente", "Na lista de pacientes, clique no nome."],
                ["Marque no corpo 3D", "Clique na região e depois no ponto exato."],
                ["Envie a imagem", "Foto dermatoscópica em JPG ou PNG."],
                ["Revise e assine", "Confira a IA, marque o ABCDE e salve o laudo."],
              ].map(([t, d], i) => (
                <li key={t} className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                  <span>
                    <span className="block text-sm font-medium text-foreground">{t}</span>
                    <span className="block text-xs text-muted-foreground">{d}</span>
                  </span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
