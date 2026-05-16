export interface PatternMatch {
  type: string;
  value: string;
  start?: number;
  end?: number;
  normalized?: string;
  valid?: boolean;
}

const DATE_RE = /\b(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])\/(19|20)\d{2}\b/g;
const CPF_FORMATTED_RE = /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g;
const CPF_DIGITS_RE = /\b\d{11}\b/g;
const CURRENCY_RE = /\bR\$\s?\d{1,3}(\.\d{3})*,\d{2}\b/g;

export function normalizeText(text: string): string {
  return text
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isValidDateParts(day: number, month: number): boolean {
  if (month < 1 || month > 12) return false;
  const daysInMonth = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day >= 1 && day <= daysInMonth[month - 1];
}

function validateCpf(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;
  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += parseInt(digits[i], 10) * (len + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return calc(9) === parseInt(digits[9], 10) && calc(10) === parseInt(digits[10], 10);
}

function parseCurrency(value: string): string {
  const num = value.replace(/R\$\s?/i, "").replace(/\./g, "").replace(",", ".");
  return parseFloat(num).toFixed(2);
}

export function extractPatterns(rawText: string): PatternMatch[] {
  const text = normalizeText(rawText);
  const patterns: PatternMatch[] = [];

  for (const match of text.matchAll(DATE_RE)) {
    const value = match[0];
    const [d, m] = value.split("/").map(Number);
    patterns.push({
      type: "date_br",
      value,
      start: match.index,
      end: (match.index ?? 0) + value.length,
      valid: isValidDateParts(d, m),
    });
  }

  const cpfSeen = new Set<string>();
  for (const match of [...text.matchAll(CPF_FORMATTED_RE), ...text.matchAll(CPF_DIGITS_RE)]) {
    const value = match[0];
    const normalized = value.replace(/\D/g, "");
    if (cpfSeen.has(normalized)) continue;
    cpfSeen.add(normalized);
    patterns.push({
      type: "cpf",
      value,
      normalized,
      valid: validateCpf(normalized),
    });
  }

  for (const match of text.matchAll(CURRENCY_RE)) {
    const value = match[0];
    patterns.push({
      type: "currency_brl",
      value,
      normalized: parseCurrency(value),
    });
  }

  return patterns;
}
