import { describe, expect, it } from "vitest";
import { extractPatterns, normalizeText } from "../src/lib/patterns";

describe("normalizeText", () => {
  it("collapses whitespace", () => {
    expect(normalizeText("a    b")).toBe("a b");
  });
});

describe("extractPatterns", () => {
  const sample = `
    Nota Fiscal
    Data: 15/03/2026
    CPF: 529.982.247-25
    Total: R$ 2.500,00
  `;

  it("finds brazilian date", () => {
    const p = extractPatterns(sample);
    expect(p.some((x) => x.type === "date_br" && x.value === "15/03/2026")).toBe(true);
  });

  it("finds valid CPF", () => {
    const p = extractPatterns(sample);
    const cpf = p.find((x) => x.type === "cpf");
    expect(cpf?.valid).toBe(true);
  });

  it("finds currency", () => {
    const p = extractPatterns(sample);
    const cur = p.find((x) => x.type === "currency_brl");
    expect(cur?.normalized).toBe("2500.00");
  });

  it("rejects invalid CPF sequence", () => {
    const p = extractPatterns("CPF 111.111.111-11");
    const cpf = p.find((x) => x.type === "cpf");
    expect(cpf?.valid).toBe(false);
  });
});
