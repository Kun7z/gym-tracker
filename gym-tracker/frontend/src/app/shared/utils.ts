/** Gera um UUID v4 (para clientUuid — idempotência de séries). */
export function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Estimativa de 1RM (fórmula de Epley). */
export function e1rm(weightKg: number, reps: number): number {
  if (reps <= 1) return weightKg;
  return weightKg * (1 + reps / 30);
}

export function formatWeight(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded)
    ? String(rounded)
    : String(rounded).replace('.', ',');
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatDayLabel(iso: string): string {
  const date = new Date(iso + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((today.getTime() - date.getTime()) / 86_400_000);

  if (diffDays === 0) return 'Hoje';
  if (diffDays === 1) return 'Ontem';
  if (diffDays > 1 && diffDays < 7) {
    return date.toLocaleDateString('pt-BR', { weekday: 'long' });
  }
  return formatDate(iso);
}

export function formatTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function daysAgoLabel(days: number | null): string {
  if (days === null) return '—';
  if (days === 0) return 'Hoje';
  if (days === 1) return 'Ontem';
  return `há ${days} dias`;
}

/** Chave do dia no fuso local (YYYY-MM-DD). */
export function localDayKey(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Extrai mensagem de erro amigável de respostas da API. */
export function apiErrorMessage(err: unknown): string {
  const body = (err as { error?: { message?: unknown } })?.error;
  const message = body?.message;
  if (typeof message === 'string') return message;
  if (Array.isArray(message) && message.length > 0) {
    return message.join('. ');
  }
  return 'Algo deu errado. Tente novamente.';
}
