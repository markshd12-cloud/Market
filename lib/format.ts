/**
 * Hora da requisição, para Server Components que rodam por request (depois de
 * connection()/cookies()). Passar adiante como prop evita divergência na hidratação.
 */
export const requestTime = () => Date.now();

/** "agora", "há 12 min", "há 3 h", "há 2 dias". Só usar em código de request. */
export function timeAgo(iso: string | null | undefined, now = Date.now()) {
  if (!iso) return "—";
  const diff = Math.max(0, now - Date.parse(iso));
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 48) return `há ${h} h`;
  return `há ${Math.floor(h / 24)} dias`;
}

/** Idade em horas (para colorir dado velho). */
export const ageHours = (iso: string | null | undefined, now = Date.now()) =>
  iso ? (now - Date.parse(iso)) / 3_600_000 : Infinity;

export const silver = (n: number | null | undefined) => (n == null ? "—" : Math.round(n).toLocaleString("pt-BR"));

/**
 * Lê silver digitado: "1.234.567", "1,5M", "250k", "2b". Devolve null se não
 * for um número válido (ou for negativo).
 */
export function parseSilver(input: FormDataEntryValue | string | null | undefined): number | null {
  if (input == null) return null;
  const s = String(input).trim().toLowerCase().replace(/\s/g, "");
  if (!s) return null;
  const m = s.match(/^([\d.,]+)([kmb])?$/);
  if (!m) return null;
  const mult = m[2] === "k" ? 1e3 : m[2] === "m" ? 1e6 : m[2] === "b" ? 1e9 : 1;
  let num = m[1];
  // Com sufixo, o separador é decimal ("1,5m" ou "1.5m"); sem sufixo, é milhar ("1.234.567").
  if (m[2]) num = num.includes(",") ? num.replace(/\./g, "").replace(",", ".") : num;
  else num = num.replace(/[.,]/g, "");
  const value = Math.round(Number(num) * mult);
  return Number.isFinite(value) && value >= 0 ? value : null;
}
