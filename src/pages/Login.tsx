import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { Activity, AlertCircle, Eye, EyeOff, Loader2 } from "lucide-react";
import { API_URL } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion } from "framer-motion";
import authHero from "@/assets/auth-hero.jpg";
import { useNavigate, Link } from "react-router-dom";

const UF_LIST = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

interface LoginForm {
  crm: string;
  uf: string;
  password: string;
}

export default function Login() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState("");

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<LoginForm>();

  // Garante que o campo 'uf' seja registrado e validado pelo react-hook-form
  useEffect(() => {
    register("uf", { required: "Estado obrigatório" });
  }, [register]);

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    setApiError("");

    try {
      const response = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          crm: data.crm,
          estado: data.uf,
          senha: data.password,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        localStorage.setItem("access_token", result.access_token);
        localStorage.setItem("medico_id", result.medico_id); 
        localStorage.setItem("medico_nome", result.medico_nome);
        navigate("/dashboard");
      } else {
        setApiError("CRM, UF ou senha não conferem. Confira os dados e tente de novo.");
      }
    } catch (error) {
      console.error("Erro ao conectar com a API:", error);
      setApiError("Servidor indisponível. Verifique se a API está rodando e tente de novo.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left - Image */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <img src={authHero} alt="Tecnologia médica" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900/85 via-blue-900/70 to-primary/50" />
        <div className="relative z-10 flex flex-col justify-end p-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <h2 className="text-3xl font-bold text-primary-foreground mb-3">
              Mapeie lesões no corpo.<br />Receba uma segunda opinião da IA.
            </h2>
            <p className="text-primary-foreground/80 text-sm max-w-md leading-relaxed">
              Três redes neurais analisam a imagem dermatoscópica. O laudo e a decisão continuam com você.
            </p>
          </motion.div>
        </div>
      </div>

      {}
      <div className="flex-1 flex items-center justify-center p-8 bg-card">
        <motion.div
          className="w-full max-w-sm space-y-8"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="text-center">
            <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center mx-auto mb-4">
              <Activity className="w-6 h-6 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Entrar no DermaScan AI</h1>
            <p className="text-sm text-muted-foreground mt-1">Use o CRM e a UF do seu registro profissional</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="crm" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                CRM
              </Label>
              <Input
                id="crm"
                placeholder="Somente números"
                autoFocus
                inputMode="numeric"
                autoComplete="username"
                {...register("crm", { required: "CRM obrigatório",
                  pattern: {
                    value: /^[0-9]+$/,
                    message: "Apenas números são permitidos"
                  }
              })}
                className="h-11"
              />
              {errors.crm && <p className="text-xs text-destructive">{errors.crm.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="uf" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Estado (UF)
              </Label>
              <Select onValueChange={(v) => setValue("uf", v, { shouldValidate: true })}>
                <SelectTrigger id="uf" className="h-11">
                  <SelectValue placeholder="Selecione o estado" />
                </SelectTrigger>
                <SelectContent>
                  {UF_LIST.map((uf) => (
                    <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.uf && <p className="text-xs text-destructive">{errors.uf.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Senha
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Sua senha"
                  autoComplete="current-password"
                  {...register("password", { required: "Senha obrigatória" })}
                  className="h-11 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
            </div>

            {apiError && (
              <div role="alert" className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-sm text-destructive font-medium">{apiError}</p>
              </div>
            )}

            <Button type="submit" className="w-full h-11 font-semibold" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Autenticando...
                </>
              ) : (
                "Entrar"
              )}
            </Button>
          </form>

          <div className="flex items-center justify-center gap-1 pt-4 border-t border-border mt-4">
            <span className="text-sm text-muted-foreground">Não tem conta?</span>
            <Link to="/register" className="text-sm text-primary hover:underline font-medium">
              Cadastre-se
            </Link>
          </div>

          <p className="text-[11px] text-center text-muted-foreground leading-relaxed">
            Acesso exclusivo para profissionais médicos<br />devidamente registrados no CRM.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
