import { LayoutDashboard, Users, Settings, LogOut, Activity, ShieldCheck } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";

const grupos = [
  {
    titulo: "Atendimento",
    itens: [
      { title: "Painel", url: "/dashboard", icon: LayoutDashboard },
      { title: "Pacientes", url: "/patients", icon: Users },
    ],
  },
  {
    titulo: "Conta",
    itens: [{ title: "Meu perfil", url: "/settings", icon: Settings }],
  },
];

const linkBase =
  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/75 hover:text-white hover:bg-sidebar-accent transition-colors";
const linkAtivo = "!bg-sidebar-primary !text-white font-medium shadow-sm";

export function AppSidebar({ onLogout }: { onLogout: () => void }) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="px-4 py-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center shrink-0 shadow-lg shadow-blue-900/40">
            <Activity className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="text-[15px] font-bold text-white tracking-tight">DermaScan AI</span>
              <span className="text-[11px] text-sidebar-foreground/60">Mapeamento de melanoma</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2">
        {grupos.map((g) => (
          <SidebarGroup key={g.titulo}>
            {!collapsed && (
              <SidebarGroupLabel className="text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/45">
                {g.titulo}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu className="gap-1">
                {g.itens.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild tooltip={item.title} className="h-auto p-0 hover:bg-transparent">
                      <NavLink to={item.url} className={linkBase} activeClassName={linkAtivo}>
                        <item.icon className="h-4 w-4 shrink-0" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="p-3 gap-3">
        {!collapsed && (
          <div className="rounded-xl bg-sidebar-accent/70 p-3 text-[11px] leading-relaxed text-sidebar-foreground/70">
            <div className="flex items-center gap-1.5 text-sidebar-foreground font-semibold mb-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Apoio à decisão
            </div>
            A IA sugere. O diagnóstico e o laudo são sempre do médico.
          </div>
        )}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={onLogout}
              tooltip="Sair"
              className="text-sidebar-foreground/70 hover:text-red-300 hover:bg-sidebar-accent"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              {!collapsed && <span>Sair</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
