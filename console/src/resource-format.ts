const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function resourceDate(value: unknown): number | undefined {
  if (typeof value !== 'string') return undefined;
  const native = /^\w{3} (\w{3}) (\d{1,2}) (\d{2}):(\d{2}):(\d{2}) UTC (\d{4})$/.exec(value);
  const timestamp =
    native && months.includes(native[1])
      ? Date.UTC(
          Number(native[6]),
          months.indexOf(native[1]),
          Number(native[2]),
          Number(native[3]),
          Number(native[4]),
          Number(native[5]),
        )
      : Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : undefined;
}
export function formatResourceDate(value: unknown) {
  const timestamp = resourceDate(value);
  return timestamp === undefined
    ? '—'
    : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(
        timestamp,
      );
}
export function certificateValidity(value: unknown, now = Date.now()) {
  const expires = resourceDate(value);
  if (expires === undefined) return { label: 'Validade indisponível', state: 'unknown' };
  const days = Math.ceil((expires - now) / 86_400_000);
  if (expires <= now) return { label: 'Expirado', state: 'error' };
  if (days <= 30)
    return { label: `Expira em ${days} ${days === 1 ? 'dia' : 'dias'}`, state: 'warning' };
  return { label: 'Válido', state: 'active' };
}
