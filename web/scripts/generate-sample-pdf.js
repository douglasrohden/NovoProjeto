/**
 * Gera samples/nota-fiscal.pdf contendo padrões reconhecidos
 * pelo extrator (data brasileira, CPF, valor em R$).
 *
 * Uso: node scripts/generate-sample-pdf.js [output_path]
 */
const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

const LINES = [
  "Nota Fiscal de Exemplo - Documento de Teste",
  "Cliente ACME Corporation - Codigo ACME01",
  "Emissao: 15/03/2026   Vencimento: 30/03/2026",
  "CPF do destinatario: 529.982.247-25",
  "Valor total: R$ 1.234,56",
  "Referencia: INV-2026-0042",
];

function main() {
  const outPath = process.argv[2] || path.join("samples", "nota-fiscal.pdf");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  const doc = new PDFDocument({ size: "LETTER", margin: 72, compress: false });
  const stream = fs.createWriteStream(outPath);
  doc.pipe(stream);

  doc.font("Helvetica").fontSize(12);
  for (const line of LINES) {
    doc.text(line);
    doc.moveDown(0.4);
  }
  doc.end();

  stream.on("finish", () =>
    console.log(`PDF gerado: ${outPath} (${fs.statSync(outPath).size} bytes)`)
  );
}

main();
