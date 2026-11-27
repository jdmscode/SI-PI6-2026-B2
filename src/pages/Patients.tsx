import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Search, Plus, Loader2, ChevronRight, ScanLine, X, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { RiskBadge, normalizarRisco } from "@/components/RiskBadge";
import { API_URL, authHeaders, clearSession } from "@/lib/api";
import { initials, isCpfCompleto, maskCpf } from "@/lib/format";

interface Patient {
  id: number;
  nome: string;
  idade: number;
  cpf: string;
  lesoes: number;
  risco: string;
  ultima_consulta: string;
}

interface NewPatientForm {
  nome: string;
  idade: number;
  cpf: string;
}

type Filtro = "todos" | "alto" | "sem_lesao";

export default function Patients() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get("busca") ?? "");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(params.get("novo") === "1");
  const navigate = useNavigate();

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<NewPatientForm>();

  useEffect(() => {
    setSearch(params.get("busca") ?? "");
    if (params.get("novo") === "1") setIsModalOpen(true);
  }, [params]);

  const fetchPatients = useCallback(async () => {
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
      toast.error("Não foi possível carregar os pacientes.");
    } finally {
      setIsLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  const fecharModal = (aberto: boolean) => {
    setIsModalOpen(aberto);
    if (!aberto) {
      reset();
      if (params.has("novo")) {
        params.delete("novo");
        setParams(params, { replace: true });
      }
    }
  };

  const handleCreatePatient = async (data: NewPatientForm) => {
    setIsSaving(true);
    try {
      const response = await fetch(`${API_URL}/pacientes`, {
        method: "POST",
        headers: authHeaders(true),
        body: JSON.stringify({ ...data, nome: data.nome.trim(), idade: Number(data.idade) }),
      });
      if (!response.ok) throw new Error();
      toast.success(`${data.nome.trim()} foi cadastrado(a).`);
      fecharModal(false);
      fetchPatients();
    } catch {
      toast.error("Não foi possível salvar o paciente. Tente de novo.");
    } finally {
      setIsSaving(false);
    }
  };

  const termo = search.trim().toLowerCase();
  const soDigitos = termo.replace(/\D/g, "");
  const filtered = patients
    .filter((p) => !termo || p.nome.toLowerCase().includes(termo) || (soDigitos && p.cpf.replace(/\D/g, "").includes(soDigitos)))
    .filter((p) => (filtro === "alto" ? p.lesoes > 0 && normalizarRisco(p.risco) === "alto" : filtro === "sem_lesao" ? p.lesoes === 0 : true));

  const filtros: { id: Filtro; label: string }[] = [
    { id: "todos", label: "Todos" },
    { id: "alto", label: "Alto risco" },
    { id: "sem_lesao", label: "Sem lesões" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        crumbs={[{ label: "Painel", to: "/dashboard" }, { label: "Pacientes" }]}
        title="Pacientes"
        description={isLoading ? "Carregando..." : `${patients.length} ${patients.length === 1 ? "paciente cadastrado" : "pacientes cadastrados"}`}
        actions={
          <Button className="gap-2" onClick={() => setIsModalOpen(true)}>
            <Plus className="w-4 h-4" /> Novo paciente
          </Button>
        }
      />

      <Dialog open={isModalOpen} onOpenChange={fecharModal}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Novo paciente</DialogTitle>
            <DialogDescription>Os dados ficam visíveis só para você.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(handleCreatePatient)} className="space-y-4 pt-2" noValidate>
            <div className="space-y-2">
              <Label htmlFor="nome">Nome completo</Label>
              <Input id="nome" autoFocus {...register("nome", { required: "Informe o nome do paciente", minLength: { value: 3, message: "Nome muito curto" } })} placeholder="Ex.: Maria Oliveira" aria-invalid={!!errors.nome} />
              {errors.nome && <p className="text-xs text-destructive">{errors.nome.message}</p>}
            </div>
            <div className="grid grid-cols-[110px_1fr] gap-4">
              <div className="space-y-2">
                <Label htmlFor="idade">Idade</Label>
                <Input id="idade" type="number" inputMode="numeric" min={0} max={120} {...register("idade", { required: "Obrigatório", min: { value: 0, message: "Inválida" }, max: { value: 120, message: "Inválida" } })} placeholder="Anos" aria-invalid={!!errors.idade} />
                {errors.idade && <p className="text-xs text-destructive">{errors.idade.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="cpf">CPF</Label>
                <Input
                  id="cpf"
                  inputMode="numeric"
                  {...register("cpf", { required: "Informe o CPF", validate: (v) => isCpfCompleto(v) || "O CPF precisa ter 11 dígitos" })}
                  onChange={(e) => setValue("cpf", maskCpf(e.target.value), { shouldValidate: !!errors.cpf })}
                  placeholder="000.000.000-00"
                  aria-invalid={!!errors.cpf}
                />
                {errors.cpf && <p className="text-xs text-destructive">{errors.cpf.message}</p>}
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => fecharModal(false)}>Cancelar</Button>
              <Button type="submit" className="flex-1" disabled={isSaving}>
                {isSaving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Salvando...</> : "Salvar paciente"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou CPF"
            aria-label="Buscar paciente"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-9 h-10 bg-card"
          />
          {search && (
            <button onClick={() => setSearch("")} aria-label="Limpar busca" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="flex gap-1 p-1 rounded-lg bg-muted w-fit" role="tablist" aria-label="Filtrar pacientes">
          {filtros.map((f) => (
            <button
              key={f.id}
              role="tab"
              aria-selected={filtro === f.id}
              onClick={() => setFiltro(f.id)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${filtro === f.id ? "bg-card text-foreground shadow-sm font-medium" : "text-muted-foreground hover:text-foreground"}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary/50" /></div>
      ) : filtered.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((p, i) => (
            <motion.div key={p.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 8) * 0.04 }}>
              <Card className="card-hover shadow-surface border-border p-4 flex items-center gap-4 cursor-pointer" onClick={() => navigate(`/patients/${p.id}`)}>
                <span className="w-11 h-11 rounded-full bg-primary/10 text-primary font-semibold flex items-center justify-center shrink-0">{initials(p.nome)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-foreground truncate">{p.nome}</p>
                    <RiskBadge risco={p.lesoes > 0 ? p.risco : null} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {p.idade} anos · CPF {p.cpf} · {p.lesoes} {p.lesoes === 1 ? "lesão" : "lesões"} · última consulta {p.ultima_consulta}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1.5 text-primary hidden sm:inline-flex"
                  onClick={(e) => { e.stopPropagation(); navigate(`/mapping/${p.id}`); }}
                  title="Registrar nova lesão"
                >
                  <ScanLine className="w-4 h-4" /> Nova lesão
                </Button>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </Card>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-14 px-6 border-2 border-dashed rounded-2xl bg-card/50">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
            <Users className="w-6 h-6 text-primary" />
          </div>
          {patients.length === 0 ? (
            <>
              <p className="font-medium text-foreground">Nenhum paciente cadastrado</p>
              <p className="text-sm text-muted-foreground mt-1 mb-4">Comece cadastrando o primeiro paciente.</p>
              <Button className="gap-2" onClick={() => setIsModalOpen(true)}><Plus className="w-4 h-4" /> Novo paciente</Button>
            </>
          ) : (
            <>
              <p className="font-medium text-foreground">Nenhum resultado{termo ? ` para "${search}"` : ""}</p>
              <p className="text-sm text-muted-foreground mt-1 mb-4">Confira a grafia ou limpe os filtros.</p>
              <Button variant="outline" onClick={() => { setSearch(""); setFiltro("todos"); }}>Limpar filtros</Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
