import { useState, useEffect } from "react";
import { User, Loader2, LogOut, ShieldCheck, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { API_URL, authHeaders, clearSession } from "@/lib/api";
import { initials } from "@/lib/format";

export default function SettingsPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState({ nome: "", crm: "", estado: "" });

  useEffect(() => {
    fetch(`${API_URL}/me`, { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setProfile)
      .catch(() => toast.error("Não foi possível carregar seu perfil."))
      .finally(() => setLoading(false));
  }, []);

  const sair = () => {
    clearSession();
    navigate("/login", { replace: true });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Carregando perfil...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader crumbs={[{ label: "Painel", to: "/dashboard" }, { label: "Meu perfil" }]} title="Meu perfil" description="Dados do seu registro profissional." />

      <Card className="shadow-surface border-border">
        <CardHeader className="flex flex-row items-center gap-4 space-y-0">
          <span className="w-14 h-14 rounded-2xl bg-primary text-primary-foreground text-lg font-bold flex items-center justify-center">{initials(profile.nome) || <User />}</span>
          <div>
            <CardTitle className="text-lg">{profile.nome}</CardTitle>
            <p className="text-sm text-muted-foreground">CRM {profile.crm} / {profile.estado}</p>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2 md:col-span-1">
              <Label htmlFor="nome">Nome</Label>
              <Input id="nome" value={profile.nome} readOnly className="bg-muted/50" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="crm">CRM</Label>
              <Input id="crm" value={profile.crm} readOnly className="bg-muted/50" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="uf">UF</Label>
              <Input id="uf" value={profile.estado} readOnly className="bg-muted/50" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5" /> Nome, CRM e UF vêm do cadastro e não podem ser editados por aqui.
          </p>
        </CardContent>
      </Card>

      <Card className="shadow-surface border-border">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-primary" /> Sessão</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4 flex-wrap">
          <p className="text-sm text-muted-foreground">A sessão expira 24 horas após o login. Saia ao usar um computador compartilhado.</p>
          <Button variant="outline" className="gap-2 text-destructive hover:text-destructive" onClick={sair}>
            <LogOut className="w-4 h-4" /> Sair do sistema
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
