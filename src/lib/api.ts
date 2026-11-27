export const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:8000";

export function authHeaders(json = false): HeadersInit {
  const token = localStorage.getItem("access_token");
  return {
    ...(json ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export function clearSession() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("medico_nome");
  localStorage.removeItem("medico_id");
}

export function imageUrl(path?: string | null) {
  if (!path) return null;
  return `${API_URL}/${path.replace(/\\/g, "/").replace(/^\/+/, "")}`;
}
