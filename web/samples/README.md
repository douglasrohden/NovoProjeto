# Samples

Arquivos de exemplo para testar a plataforma manualmente (via `api.http`, `curl` ou Postman).

| Arquivo | Uso |
|---------|-----|
| [`nota-fiscal.pdf`](nota-fiscal.pdf) | PDF com texto contendo data, CPF e valor em R$ — extração via `pdf-parse` |
| [`enrichment-example.xml`](enrichment-example.xml) | XML válido conforme [`docs/xml-schema.xsd`](../docs/xml-schema.xsd) |
| [`enrichment-invalid.xml`](enrichment-invalid.xml) | XML com violações intencionais do XSD — útil para verificar resposta 422 |

## Regerar `nota-fiscal.pdf`

```bash
node scripts/generate-sample-pdf.js samples/nota-fiscal.pdf
```

O script usa `pdfkit` (dev-dependency) e produz um PDF de ~2 KB com texto Latin-1.

## PNG para OCR

Não há PNG de exemplo no repositório — uma imagem digitalizada real (digital twin de um documento escaneado) produz resultados de OCR mais representativos do uso em produção. Gere a sua para teste com qualquer scanner ou print de tela de um PDF.
