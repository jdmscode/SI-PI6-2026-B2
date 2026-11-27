export function maskCpf(value: string) {
  const d = value.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

export function isCpfCompleto(value: string) {
  return value.replace(/\D/g, "").length === 11;
}

/** Aceita "AAAA-MM-DD" ou "DD/MM/AAAA" e devolve sempre "DD/MM/AAAA". */
export function formatDate(value?: string | null) {
  if (!value) return "—";
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return iso ? `${iso[3]}/${iso[2]}/${iso[1]}` : value;
}

export function firstName(nome?: string | null) {
  if (!nome) return "";
  const partes = nome.trim().split(/\s+/);
  const semTitulo = /^dr(a)?\.?$/i.test(partes[0]) ? partes.slice(1) : partes;
  return semTitulo[0] ?? "";
}

export function initials(nome?: string | null) {
  return (nome ?? "")
    .trim()
    .split(/\s+/)
    .filter((p) => !/^dr(a)?\.?$/i.test(p))
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function saudacao() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}
