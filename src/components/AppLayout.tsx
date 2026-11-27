import { useState, type FormEvent } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Outlet, useNavigate } from "react-router-dom";
import { Search, LogOut, Settings, UserPlus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { clearSession } from "@/lib/api";
import { initials } from "@/lib/format";

export function AppLayout() {
  const navigate = useNavigate();
  const [busca, setBusca] = useState("");

  const medicoNome = localStorage.getItem("medico_nome") || "Médico(a)";

  const handleLogout = () => {
    clearSession();
    navigate("/login", { replace: true });
  };

  const handleBusca = (e: FormEvent) => {
    e.preventDefault();
    const termo = busca.trim();
    navigate(termo ? `/patients?busca=${encodeURIComponent(termo)}` : "/patients");
    setBusca("");
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar onLogout={handleLogout} />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-16 flex items-center justify-between gap-4 border-b border-border bg-card/80 backdrop-blur px-4 md:px-6 shrink-0 sticky top-0 z-20">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <SidebarTrigger className="text-muted-foreground" aria-label="Recolher menu" />
              <form onSubmit={handleBusca} role="search" className="relative hidden md:block w-full max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar paciente por nome ou CPF e pressionar Enter"
                  aria-label="Buscar paciente"
                  className="pl-9 h-10 text-sm bg-muted/60 border-transparent focus-visible:bg-card focus-visible:border-input"
                />
              </form>
            </div>

            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="hidden sm:inline-flex gap-2" onClick={() => navigate("/patients?novo=1")}>
                <UserPlus className="w-4 h-4" /> Novo paciente
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2.5 rounded-full pl-1 pr-3 py-1 hover:bg-accent transition-colors outline-none" aria-label="Menu do usuário">
                    <span className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold">
                      {initials(medicoNome) || "MD"}
                    </span>
                    <span className="hidden lg:block text-sm font-medium text-foreground max-w-[160px] truncate">{medicoNome}</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="font-normal">
                    <p className="text-sm font-semibold text-foreground truncate">{medicoNome}</p>
                    <p className="text-xs text-muted-foreground">Sessão ativa</p>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="cursor-pointer" onClick={() => navigate("/settings")}>
                    <Settings className="mr-2 h-4 w-4" /> Meu perfil
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
                    onClick={handleLogout}
                  >
                    <LogOut className="mr-2 h-4 w-4" /> Sair do sistema
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          <main className="flex-1 overflow-auto p-4 md:p-8 bg-app">
            <div className="mx-auto w-full max-w-7xl">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
