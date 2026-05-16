# Document Processing Platform

Plataforma de ingestão, processamento automático e enriquecimento de documentos digitalizados (PDF/PNG) com dados XML de referência — desafio técnico de arquitetura e desenvolvimento.

## O que o sistema faz

1. **Upload** de PDF ou PNG com validação server-side (magic bytes, 25 MB máx.).
2. **Processamento assíncrono:** extração de texto (PDF nativo ou OCR Tesseract), normalização e identificação de padrões (data, CPF, valor em R$).
3. **Enriquecimento XML** em endpoint separado, com validação XSD — pode ocorrer horas ou dias após o upload.
4. **Relatórios** quantitativos e exportação CSV.

## Personas

| Persona | Função no sistema |
|---------|-------------------|
| Operador | Upload, acompanhamento de status |
| Gestor | Relatórios e exportações |
| Administrador | Auditoria (logs) — escopo simplificado no MVP |

## Decisões arquiteturais (resumo)

O diagrama de referência original foi **revisado**. Principais mudanças:

| Original | Decisão |
|----------|---------|
| Mongo + Postgres + MySQL + Elasticsearch | **PostgreSQL único** |
| Processamento síncrono | **Worker assíncrono + Redis** |
| Disco local sem política | **Volume Docker + retenção 90 dias** |
| XSD opcional | **XSD obrigatório** |
| Microserviços | **Monólito modular (API + Worker)** |

Documentação completa: [`docs/architecture.md`](docs/architecture.md) · ADRs: [`docs/adr/`](docs/adr/) · **Planejamento 4h:** [`docs/PLANEJAMENTO.md`](docs/PLANEJAMENTO.md)

## Stack tecnológica (Next.js full-stack)

| Tecnologia | Uso |
|------------|-----|
| **Next.js 15** | UI (App Router) + API Route Handlers |
| **TypeScript** | Linguagem |
| **React 19** | Interface de upload e status |
| **Prisma 6** | ORM → PostgreSQL 16 |
| **BullMQ + Redis 7** | Fila e worker assíncrono |
| **pdfjs-dist** | Texto em PDF (Mozilla pdf.js, build legacy) |
| **tesseract.js** | OCR em PNG (modelo `por` pré-cacheado na imagem) |
| **fast-xml-parser + xmllint** | Parse XML + validação XSD |
| **pino** | Logs JSON |
| **Vitest** | Testes |
| **Docker Compose** | web + worker + postgres + redis |

Documentação da stack: [`docs/stack-nextjs.md`](docs/stack-nextjs.md) · ADR: [`docs/adr/ADR.md`](docs/adr/ADR.md)

## Pré-requisitos

- [Docker](https://docs.docker.com/get-docker/) 24+
- [Docker Compose](https://docs.docker.com/compose/) v2

## Instalação e execução (Docker)

Repositório: [github.com/douglasrohden/NovoProjeto](https://github.com/douglasrohden/NovoProjeto)  
Guia na raiz: [`../README.md`](../README.md) · Detalhes: [`docs/docker.md`](docs/docker.md)

### 1. Clonar e configurar ambiente

```bash
git clone https://github.com/douglasrohden/NovoProjeto.git
cd NovoProjeto/web
cp .env.example .env
```

Windows (PowerShell): `copy .env.example .env`

### 2. Subir a stack completa

```bash
docker compose up -d
```

Produção (sem expor Postgres/Redis no host):

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

Script (cria `.env` se não existir e sobe a stack):

```bash
./install.sh
./install.sh --production
.\install.ps1
.\install.ps1 -Production
```

Serviços:

| Serviço | Porta | Descrição |
|---------|-------|-----------|
| `web` | 3000 | Next.js (UI + API `/api/v1/*`) |
| `worker` | — | Processamento OCR/PDF (BullMQ) |
| `postgres` | 5433 (host) | Banco de dados (5433 evita conflito com PostgreSQL local na 5432) |
| `redis` | 6379 | Fila de jobs |

### 3. Verificar saúde

```bash
curl http://localhost:3000/api/health
```

### 4. Interface web

Abra [http://localhost:3000](http://localhost:3000) para upload, consulta de status e importação XML.

### 5. Desenvolvimento local (sem Docker)

```bash
npm install
cp .env.example .env
npm run db:migrate
npm run dev          # terminal 1 — http://localhost:3000
npm run worker       # terminal 2 — processa fila Redis
```

### 6. Parar

```bash
docker compose down
```

Volumes `pgdata` e `uploads_data` preservam dados entre reinícios.

## Exemplos de uso

Substitua `{id}` pelo UUID retornado no upload. Coleção completa: [`api.http`](api.http).

### Upload de documento

```bash
curl -X POST http://localhost:3000/api/v1/documents \
  -F "file=@samples/nota-fiscal.pdf"
```

**Resposta:**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "pending",
  "filename": "nota-fiscal.pdf",
  "created_at": "2026-05-16T14:00:00Z"
}
```

### Consultar status

```bash
curl http://localhost:3000/api/v1/documents/{id}
```

### Enriquecer com XML

```bash
curl -X POST http://localhost:3000/api/v1/documents/{id}/enrichment \
  -F "file=@samples/enrichment-example.xml"
```

Para validar a resposta 422 do XSD:

```bash
curl -X POST http://localhost:3000/api/v1/documents/{id}/enrichment \
  -F "file=@samples/enrichment-invalid.xml"
```

### Relatório resumido

```bash
curl "http://localhost:3000/api/v1/reports/summary?from=2026-05-01&to=2026-05-31&group_by=day"
```

### Exportar CSV

```bash
curl -o report.csv "http://localhost:3000/api/v1/reports/export.csv?status=processed"
```

## Documentação (`/docs`)

| Arquivo | Conteúdo |
|---------|----------|
| [architecture.md](docs/architecture.md) | Diagrama revisado, análise do diagrama original |
| [adr/](docs/adr/) | 5 Architecture Decision Records |
| [xml-schema.md](docs/xml-schema.md) | Contrato XML de enriquecimento |
| [xml-schema.xsd](docs/xml-schema.xsd) | Schema XSD |
| [patterns.md](docs/patterns.md) | Padrões regex reconhecidos |
| [api-contract.md](docs/api-contract.md) | Endpoints e códigos HTTP |
| [error-handling.md](docs/error-handling.md) | Matriz de falhas |

## Testes

```bash
# Após cp .env.example .env e npm install
npm test
```

Cobertura atual:

| Arquivo | O que valida |
|---------|--------------|
| [`tests/patterns.test.ts`](tests/patterns.test.ts) | Unit: normalização + extração regex (data, CPF válido/inválido, R$) |
| [`tests/pdf-flow.test.ts`](tests/pdf-flow.test.ts) | Pipeline real: magic bytes → `pdfjs-dist` → padrões sobre `samples/nota-fiscal.pdf` |
| [`tests/xml-enrichment.test.ts`](tests/xml-enrichment.test.ts) | Parse XML + validação XSD via `xmllint` (skipa se binário ausente) |

## Estrutura do repositório

```
ProjectEntrevista/
├── docker-compose.yml     # web + worker + init-db + postgres + redis
├── Dockerfile             # imagem única (Tesseract pré-cacheado, libxml2-utils)
├── .env.example
├── README.md
├── CHALLENGES.md
├── api.http               # exemplos manuais de chamadas
├── docs/                  # Módulo 1 — arquitetura, ADRs, schemas
├── src/app/               # Next.js UI + Route Handlers
│   └── api/v1/            # /documents, /enrichment, /reports
├── src/lib/               # processor, pdf, ocr, xml, patterns, validation, queue
├── worker/                # BullMQ consumer (npm run worker)
├── prisma/                # schema único (Document, AuditLog)
├── tests/                 # vitest — 3 arquivos cobrindo patterns, PDF, XML
├── samples/               # PDF + XMLs (válido e inválido) para testar
└── scripts/               # generate-sample-pdf.js (regerar samples/nota-fiscal.pdf)
```

## Retenção de arquivos brutos

**90 dias** no volume de uploads; metadados, texto e enriquecimento permanecem no PostgreSQL. Ver [ADR §7](docs/adr/ADR.md#7-armazenamento-de-arquivos-e-retenção).

## Licença

Projeto de desafio técnico — uso conforme política da empresa avaliadora.
