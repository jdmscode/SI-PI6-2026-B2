export type ClasseLesao = "benigno" | "maligno";
export type ModoEnsemble = "hard" | "soft";

export interface ProbabilidadesClasse {
  benigno: number;
  maligno: number;
}

export interface ResultadoModeloIA {
  id: string;
  nome_exibicao: string;
  classificacao: ClasseLesao;
  confianca: number;
  probabilidades: ProbabilidadesClasse;
}

export interface ResultadoEnsembleHard {
  classificacao: ClasseLesao;
  confianca: number;
  risco: string;
  votos: { benigno: number; maligno: number };
}

export interface ResultadoEnsembleSoft {
  classificacao: ClasseLesao;
  confianca: number;
  risco: string;
  probabilidades: ProbabilidadesClasse;
}

export interface ResultadoIAEnsemble {
  modelos: Record<string, ResultadoModeloIA>;
  ensemble: {
    hard: ResultadoEnsembleHard;
    soft: ResultadoEnsembleSoft;
  };
}

export interface AnaliseLesaoResponse {
  id?: number;
  classificacao?: ClasseLesao | string;
  risco?: string;
  confianca?: number | string;
  imagem_path?: string;
  resultado_ia?: ResultadoIAEnsemble | null;
  parecer_medico?: string | null;
  criterios_abcde?: Record<string, boolean> | null;
  veredito_medico?: string | null;
  paciente_id?: number;
  data?: string;
  localizacao?: string;
  descricao?: string;
}

export function parseConfianca(valor: number | string | undefined): number {
  if (valor === undefined || valor === null) return 0;
  const n = typeof valor === "string" ? parseFloat(valor) : valor;
  return Number.isFinite(n) ? n : 0;
}

export function getResultadoGeral(
  analysis: AnaliseLesaoResponse,
  modo: ModoEnsemble
): { classificacao: ClasseLesao; confianca: number; risco: string } {
  const ensemble = analysis.resultado_ia?.ensemble;
  if (ensemble) {
    const bloco = modo === "hard" ? ensemble.hard : ensemble.soft;
    return {
      classificacao: bloco.classificacao,
      confianca: bloco.confianca,
      risco: bloco.risco,
    };
  }
  return {
    classificacao: (analysis.classificacao as ClasseLesao) ?? "benigno",
    confianca: parseConfianca(analysis.confianca),
    risco: analysis.risco ?? "indefinido",
  };
}

export const ORDEM_MODELOS = ["efficientnet_b3", "resnet50", "swin_t"] as const;
