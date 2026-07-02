import type { GameConfig } from "./types";

export function formatMoney(config: GameConfig, value: number): string {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(Math.trunc(value)).toLocaleString("en-US");
  return config.currency.prefix
    ? `${sign}${config.currency.symbol}${abs}`
    : `${sign}${abs}${config.currency.symbol}`;
}

export function parseAmount(value: string): number {
  const trimmed = value.trim().toLowerCase().replaceAll(",", "");
  if (!trimmed) {
    return 0;
  }

  const multiplier = trimmed.endsWith("m") ? 1_000_000 : trimmed.endsWith("k") ? 1_000 : 1;
  const numeric = multiplier === 1 ? trimmed : trimmed.slice(0, -1);
  const parsed = Number.parseFloat(numeric);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(0, Math.floor(parsed * multiplier));
}

export function formatDate(dateText: string): string {
  const [year, month, day] = dateText.split("-");
  return `${month}-${day}-${year}`;
}

export function addDays(dateText: string, days: number): string {
  const [year, month, day] = dateText.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
