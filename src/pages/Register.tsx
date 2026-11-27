import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { AlertCircle, ArrowLeft, UserPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { API_URL } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion } from "framer-motion";
import authHero from "@/assets/auth-hero.jpg";

const UF_LIST = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

interface RegisterForm {
  name: string;
  crm: string;
  uf: string;
  password: string;
  confirmPassword: string;
}

export default function Register() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<RegisterForm>();
  const password = watch("password");

  // Registra o campo UF no hook-form para podermos validá-mo
  useEffect(() => {
    register("uf", { required: "UF obrigatória" });
  }, [register]);

  const onSubmit = async (data: RegisterForm) => {
    setIsLoading(true);
    setApiError("");
    setIsSuccess(false);

    try {
      const response = await fetch(`${API_URL}/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nome: data.name.trim(),
          crm: data.crm,
          estado: data.uf, 
          senha: data.password,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setIsSuccess(true);
        toast.success("Conta criada. Agora é só entrar com seu CRM.");
        setTimeout(() => navigate("/login"), 1200);
      } else {
        setApiError(result.detail === "CRM já cadastrado." ? "Este CRM já tem conta. Use a tela de login." : result.detail || "Não foi possível concluir o cadastro.");
      }
    } catch (error) {
      setApiError("Servidor indisponível. Tente novamente em instantes.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <img src={authHero} alt="Tecnologia médica" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900/85 via-blue-900/70 to-primary/50" />
        <div className="relative z-10 flex flex-col justify-end p-12">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }}>
            <h2 className="text-3xl font-bold text-primary-foreground mb-3">Crie sua conta em menos de um minuto</h2>
            <p className="text-primary-foreground/80 text-sm max-w-md">Você só precisa do nome, do CRM e da UF. Os pacientes que cadastrar ficam visíveis apenas para você.</p>
          </motion.div>
        </div>
      </div>

      {}
      <div className="flex-1 flex items-center justify-center p-8 bg-card overflow-y-auto">
        <motion.div className="w-full max-w-md space-y-6" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-center">
            <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center mx-auto mb-4">
              <UserPlus className="w-6 h-6 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold">Criar conta médica</h1>
            <p className="text-sm text-muted-foreground mt-1">Todos os campos são obrigatórios</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-xs font-semibold uppercase text-muted-foreground">Nome completo</Label>
              <Input id="name" autoFocus autoComplete="name" {...register("name", { required: "Informe seu nome" })} placeholder="Como aparece no CRM, sem Dr./Dra." />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="crm" className="text-xs font-semibold uppercase text-muted-foreground">CRM</Label>
                <Input id="crm" inputMode="numeric" 
                  {...register("crm", { 
                    required: "Obrigatório",
                    pattern: { value: /^[0-9]+$/, message: "Apenas números" }
                  })} 
                  placeholder="Somente números" 
                />
                {errors.crm && <p className="text-[10px] text-destructive">{errors.crm.message}</p>}
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase text-muted-foreground">UF</Label>
                <Select onValueChange={(v) => setValue("uf", v, { shouldValidate: true })}>
                  <SelectTrigger aria-label="UF do CRM"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {UF_LIST.map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
                  </SelectContent>
                </Select>
                {errors.uf && <p className="text-[10px] text-destructive">{errors.uf.message}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs font-semibold uppercase text-muted-foreground">Senha</Label>
              <Input id="password" type="password" autoComplete="new-password" placeholder="Mínimo de 6 caracteres" {...register("password", { required: "Senha obrigatória", minLength: { value: 6, message: "Mínimo 6 caracteres" } })} />
              {errors.password ? <p className="text-xs text-destructive">{errors.password.message}</p> : <p className="text-xs text-muted-foreground">Use pelo menos 6 caracteres.</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-xs font-semibold uppercase text-muted-foreground">Confirmar senha</Label>
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                placeholder="Repita a senha"
                {...register("confirmPassword", { 
                  validate: (val) => val === password || "As senhas não coincidem" 
                })} 
              />
              {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>}
            </div>

            {}
            {apiError && (
              <div role="alert" className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-sm text-destructive font-medium">{apiError}</p>
              </div>
            )}

            {isSuccess && (
              <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-md">
                <p className="text-sm text-green-600 dark:text-green-400 text-center font-medium">
                  Médico cadastrado com sucesso! Redirecionando...
                </p>
              </div>
            )}

            <Button type="submit" className="w-full h-11" disabled={isLoading || isSuccess}>
              {isLoading ? <><Loader2 className="animate-spin mr-2 h-4 w-4" /> Criando conta...</> : "Criar conta"}
            </Button>
          </form>

          <div className="text-center">
            <Link to="/login" className="text-sm text-primary flex items-center justify-center gap-1 font-medium hover:underline">
              <ArrowLeft className="w-4 h-4" /> Voltar para o Login
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}