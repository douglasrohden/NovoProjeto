# Desafios, débitos técnicos e decisões retrospectivas

Documenta dificuldades reais encontradas na implementação, o que faria diferente com mais tempo e débitos técnicos assumidos de forma consciente — requisito do desafio técnico (Módulo 3).

**Coleção de API:** [`api.http`](api.http) (VS Code REST Client / IntelliJ) · [`postman/Document-Processing-Platform.postman_collection.json`](postman/Document-Processing-Platform.postman_collection.json) (Postman / Insomnia via import)

---

## 1. Dificuldades encontradas

### 1.1 Análise do diagrama original

- **Ambiguidade intencional:** componentes "opcionais" (RabbitMQ, Redis Cache) coexistem com pipeline "Síncrono" — exige decisão explícita em vez de copiar o desenho.
- **Polyglot persistence injustificável** (Mongo + Postgres + MySQL + Elasticsearch) para ~5k docs/dia. Decisão crítica: **PostgreSQL único** com JSONB para `extracted_text`, `patterns` e `enrichment`.

Visão consolidada: [`../docs/DOCUMENTO.md`](../docs/DOCUMENTO.md).

### 1.2 Pivô de stack (FastAPI → Next.js)

O planejamento inicial previa **FastAPI + Python**. Durante o setup:

- O critério "subir com **um** comando" (`docker compose up -d`) pesou mais que a linguagem.
- TypeScript + Next.js unifica UI (App Router) e API (Route Handlers) no mesmo build, com um `Dockerfile` e uma árvore de dependências.
- `tesseract.js` + `pdfjs-dist` rodam em Node sem bibliotecas nativas pesadas no container (apenas `libxml2-utils` para validação XSD).

### 1.3 `pdf-parse` v1.1.1 não lê PDFs modernos

A escolha inicial foi `pdf-parse`. PDFs gerados por `pdfkit` ou `pdf-lib` falhavam com **`bad XRef entry`** — a lib empacota `pdf.js` de 2018, sem manutenção.

**Solução:** troca por **`pdfjs-dist`** (build legacy, Mozilla). Ponto de troca pequeno (`src/lib/pdf.ts`) e teste `tests/pdf-flow.test.ts` sobre `samples/nota-fiscal.pdf`.

**Lição:** para quem roda `docker compose up` e testa com um PDF qualquer, lib de leitura quebrada é pior que over-engineering documentado.

### 1.4 Pré-cache do modelo Tesseract no build

`tesseract.js` baixa `por.traineddata.gz` da internet na **primeira execução**:

- Pode falhar em rede restrita (CI, avaliador offline).
- Estoura o SLA de 30 s no primeiro PNG.

**Solução:** o `Dockerfile` baixa `por` e `eng` no build; `src/lib/ocr.ts` usa `langPath=/app/tessdata` e `cacheMethod=none`.

### 1.5 Migrations e ordem de subida no Docker

Correr schema a partir de `web` e `worker` em paralelo gera **race condition** (dois clientes Prisma ao mesmo tempo).

**Solução:** serviço one-shot `init-db` com `prisma migrate deploy`; `web` e `worker` dependem de `service_completed_successfully`. Em dev local: `npm run db:migrate` antes de `dev`/`worker`.

### 1.6 Variable shadowing no `/api/health`

`let redis` no escopo externo era ocultado por `const redis = getRedisConnection()` dentro do `try`, impedindo o status `"connected"`. Detectado em `tsc` / build Docker — típico bug que passa sem typecheck estrito.

### 1.7 Build Docker e convenções React/JSX

- **`pull access denied` para `document-platform:latest`:** Compose tenta puxar a imagem antes do build local. Mitigação: `docker compose up -d --build` na primeira vez ou após alterar código.
- **`<motionCard>` vs `<MotionCard>`:** componente com nome em camelCase minúsculo é tratado como tag HTML inválida; o build Next.js falha com `Property 'motionCard' does not exist on type 'JSX.IntrinsicElements'`. Convenção React: **PascalCase** para componentes customizados.

### 1.8 Ambiente Windows (Postgres, PowerShell, curl)

- **Porta 5432** costuma estar ocupada por PostgreSQL local; o compose expõe **5433** no host — `DATABASE_URL` no `.env` deve usar a mesma porta e password que `POSTGRES_PASSWORD`.
- **Volume antigo:** mudar senha no `.env` após o primeiro `up` não altera dados já criados → `docker compose down -v` e subir de novo.
- **`curl` no PowerShell** é alias de `Invoke-WebRequest`; para multipart como no Linux, usar `curl.exe` ou `Invoke-RestMethod` só no health check.

### 1.9 Enriquecimento antes do processamento terminar

O endpoint de XML chama `ensureDocumentProcessed` (poll até 90 s). Sem **worker** (ou com `PROCESS_INLINE=false` e Redis indisponível), o documento fica em `pending`/`processing` e o cliente recebe **409 `DOCUMENT_NOT_READY`**. Exige documentação clara e UI que mostre o status — não é bug, é contrato assíncrono.

---

## 2. Débitos técnicos assumidos conscientemente

| Débito | Motivo | Mitigação futura |
|--------|--------|------------------|
| Autenticação JWT omitida | Foco no fluxo documental no tempo do MVP | OAuth2 + RBAC por persona (Operador / Gestor / Admin) |
| Job de expiração de arquivos (90 dias) não automatizado | Tempo | Cron ou BullMQ repeatable job + delete no volume |
| Sem `POST /documents/{id}/reprocess` | Escopo | Retry explícito para `status=failed` |
| NGINX / API Gateway omitido | Simplicidade | Service `nginx` no compose, TLS (Let's Encrypt / Cloudflare) |
| Paginação offset/limit | Suficiente para ~5k/dia | Cursor-based pagination em volumes maiores |
| BullMQ com `attempts: 1` (default) | Tempo | Backoff exponencial + dead-letter queue inspecionável |
| Tabela `audit_logs` existe mas não é populada | Tempo | Middleware nas rotas críticas (ação + ator + request_id) |
| Cobertura de testes mínima (patterns, PDF, XML) | Tempo | PDF criptografado, PNG corrompido, XML encoding inválido |
| Métricas / tracing ausentes | Logs JSON (`pino`) cobrem o básico | Prometheus + OpenTelemetry |
| Documentação de arquitetura fragmentada | Prioridade na entrega executável | Unificar ADRs e diagramas em `docs/` versionados |
| UI em `page.tsx` funcional mas simples | Tempo | Design system, histórico de jobs, preview de padrões |

---

## 3. O que faria diferente com mais tempo

### Curto prazo (+2–4 horas)

1. **Testes E2E** (Playwright ou API-only) cobrindo upload → worker → enrichment → relatório.
2. **`POST /documents/{id}/reprocess`** para falhas de OCR sem novo upload.
3. **Mais samples** — PNG de scan real, PDF criptografado, XML com encoding errado.
4. **Job de expiração** (90 dias) como worker BullMQ repeatable.
5. **CI (GitHub Actions)** — lint, `npm test`, build de imagem Docker.

### Médio prazo (+1–2 dias)

1. **Métricas Prometheus** — latência OCR p95, taxa de falha por origem (PDF vs PNG).
2. **DLQ BullMQ** com endpoint admin de inspeção/replay.
3. **Versionamento XSD** (`Accept` / profile no Content-Type).
4. **OpenAPI** gerado a partir dos Route Handlers ou contrato em `docs/api-contract.md` sincronizado com código.

### Longo prazo (produção)

1. **Kubernetes** com HPA no worker pela profundidade da fila Redis.
2. **Object storage (S3/MinIO)** em vez de volume local + lifecycle policy.
3. **Read replica** Postgres para relatórios pesados.
4. **Auditoria / LGPD** — retenção legal, direito ao esquecimento.
5. **Notificações** (webhook/e-mail) em transições `processed` / `enriched` / `failed`.

---

## 4. Decisões que manteria

- **PostgreSQL único** — volumetria + JSONB cobrem o requisito; agregações são SQL direto.
- **Processamento assíncrono (BullMQ + Redis)** — única forma realista de cumprir SLA de 30 s sem bloquear HTTP.
- **`pdfjs-dist` + `tesseract.js`** — open-source, offline, reproduzível no Compose.
- **XSD versionado no repositório** + validação **obrigatória** (HTTP 422) — contrato claro, rejeita lixo cedo.
- **Monólito modular Next.js** — um build, um Dockerfile, entrypoints `web` e `worker`.
- **`init-db` com `migrate deploy`** — migrations versionadas, idempotentes, antes de qualquer runtime.

---

## 5. Decisões do diagrama original que rejeitei

| Original | Decisão tomada |
|----------|----------------|
| Mongo + Postgres + MySQL + Elasticsearch | **Um** PostgreSQL |
| Elasticsearch "cluster obrigatório" | Removido — relatórios com SQL |
| Processamento síncrono | Fila + worker |
| RabbitMQ "opcional" | Redis + BullMQ explícitos |
| XSD opcional | **Obrigatório** |
| Filesystem sem política | Volume Docker + retenção 90 dias (regra de negócio; job pendente) |
| Vários microserviços | Monólito modular + worker |
| K8s + Docker no mesmo desenho | **Docker Compose** para MVP |

---

## 6. Registro de tempo (referência)

| Fase | Planejado | Real (aprox.) |
|------|-----------|---------------|
| Arquitetura e schema | 60 min | ~60 min |
| Core (upload, worker, OCR, XML) | 150 min | ~140 min |
| Relatórios, Docker, testes, docs | 90 min | ~90 min |

---

## 7. Como reproduzir os cenários de erro (manual)

Use [`api.http`](api.http) ou a coleção Postman. Pré-requisito: stack no ar (`docker compose up -d --build` na pasta `web/`).

| Cenário | Request | HTTP esperado |
|---------|---------|---------------|
| Upload sem arquivo | `POST /api/v1/documents` sem `file` | 400 `MISSING_FILE` |
| Documento inexistente | `GET /api/v1/documents/{uuid-invalido}` | 404 `DOCUMENT_NOT_FOUND` |
| XML antes de `processed` (sem worker) | `POST .../enrichment` logo após upload | 409 `DOCUMENT_NOT_READY` |
| Processamento falhou | enrichment em doc `failed` | 409 `DOCUMENT_PROCESSING_FAILED` |
| XML inválido (XSD) | `samples/enrichment-invalid.xml` | 422 `XML_VALIDATION_ERROR` |

Após upload bem-sucedido, copie o `id` da resposta para a variável `documentId` em `api.http` ou na coleção Postman.
