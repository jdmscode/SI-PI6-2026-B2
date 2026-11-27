import { Link } from "react-router-dom";
import { Activity } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => (
  <div className="flex min-h-screen items-center justify-center bg-app p-6">
    <div className="text-center max-w-sm">
      <div className="mx-auto w-12 h-12 rounded-xl bg-primary flex items-center justify-center mb-6">
        <Activity className="w-6 h-6 text-primary-foreground" />
      </div>
      <p className="text-sm font-semibold text-primary">Erro 404</p>
      <h1 className="mt-2 text-2xl font-bold text-foreground">Página não encontrada</h1>
      <p className="mt-2 text-sm text-muted-foreground">O endereço pode estar errado ou a página foi removida.</p>
      <Button asChild className="mt-6">
        <Link to="/dashboard">Voltar ao painel</Link>
      </Button>
    </div>
  </div>
);

export default NotFound;
