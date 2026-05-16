# Desafios, débitos técnicos e decisões retrospectivas

Documenta dificuldades reais, decisões revistas durante a implementação e o que ficaria diferente com mais tempo — requisito do Módulo 3 do desafio técnico.

---

## 1. Dificuldades encontradas

### 1.1 Análise do diagrama original *(Módulo 1)*

- **Ambiguidade intencional:** componentes "opcionais" (RabbitMQ, Redis Cache) coexistem com pipeline "Síncrono" — exige decisão explícita em vez de copiar o desenho.
- **Polyglot persistence injustificável** (Mongo+Postgres+MySQL+Elasticsearch) para 5k docs/dia. Decisão crítica de unificar em PostgreSQL com JSONB para `extracted_text`, `patterns` e `enrichment`.

### 1.2 Pivô de stack (FastAPI → Next.js)

O planejamento inicial em `docs/PLANEJAMENTO.md` previa **FastAPI + Python**. Durante o setup percebi que:

- O critério "subir com UM comando" pesa mais que escolha de linguagem.
- TypeScript + Next.js dá UI (Route Handlers) e API no mesmo build, com um único `Dockerfile` e uma única árvore de dependências.
- Tesseract.js + pdfjs-dist são puro JS — não precisam de bibliotecas nativas pesadas no container (apenas `libxml2-utils` para XSD).

Pivô documentado em [ADR](docs/adr/ADR.md). O `docs/PLANEJAMENTO.md` foi mantido como histórico do raciocínio original (linguagem ≠ arquitetura).

### 1.3 `pdf-parse` v1.1.1 é incapaz de ler PDFs gerados por bibliotecas modernas

A escolha inicial foi `pdf-parse` (familiar, "padrão" no ecossistema Node). Ao gerar um PDF mínimo para `samples/` descobri que **`pdf-parse` v1.1.1 falha com `bad XRef entry`** tanto para PDFs gerados por `pdfkit` quanto por `pdf-lib` — ambas as bibliotecas de referência no ecossistema. A versão 1.1.1 empacota um `pdf.js` v1.10.100 de 2018, sem manutenção.

**Decisão:** troquei `pdf-parse` por `pdfjs-dist` (build legacy, mesma engine porém atual e mantida pela Mozilla). O ponto de troca foi mínimo (`src/lib/pdf.ts`, ~20 linhas) e o teste `tests/pdf-flow.test.ts` valida o pipeline ponta a ponta sobre o sample real.

Lição: para um avaliador rodar `docker compose up` e testar com um PDF qualquer, uma lib de leitura quebrada é um risco silencioso pior que qualquer over-engineering documentado.

### 1.4 Pré-cache do modelo Tesseract no build

`tesseract.js` baixa `por.traineddata.gz` (~1 MB) **da internet na primeira execução**. Em ambiente do avaliador, isso:

- Pode falhar se a rede do build/runtime estiver restrita.
- Estoura facilmente o SLA de 30 s no primeiro documento PNG.

**Solução:** o `Dockerfile` baixa `por.traineddata.gz` e `eng.traineddata.gz` no estágio de build via `curl`, e `src/lib/ocr.ts` passa `langPath=/app/tessdata` + `cacheMethod=none` para forçar o uso local.

### 1.5 Race condition no `prisma db push`

O `docker-compose` original rodava `npx prisma db push` no entrypoint de `web` E de `worker` simultaneamente. Mesmo com `healthcheck` do Postgres, é uma corrida — dois clientes tentando aplicar o schema ao mesmo tempo geram erros intermitentes.

**Solução:** adicionei um serviço `init-db` (one-shot) que roda só o `db push --skip-generate`; `web` e `worker` dependem dele com `condition: service_completed_successfully`.

### 1.6 Variable shadowing no `/api/health`

Bug encontrado durante `tsc --noEmit`: `let redis` no escopo da função era ocultado por `const redis = getRedisConnection()` dentro do `try`, fazendo o flag de status nunca virar `"connected"`. Encontrado antes de qualquer execução, mas é o tipo de bug que passaria despercebido sem `noImplicitAny`/`noShadow`.

---

## 2. Débitos técnicos assumidos conscientemente

| Débito | Motivo | Mitigação futura |
|--------|--------|------------------|
| Autenticação JWT omitida | Foco no fluxo documental em 4h | OAuth2 + RBAC por persona |
| Job de expiração de arquivos (90 dias) não automatizado | Tempo | Cron/job que `DELETE` arquivos do volume com `created_at < now() - 90d` |
| Sem endpoint de reprocessamento (`status=failed` → retry) | Escopo do MVP | `POST /documents/{id}/reprocess` |
| NGINX/API Gateway omitido | API exposta direto na 3000 | Service `nginx` no compose, TLS via Let's Encrypt ou Cloudflare |
| Paginação offset/limit | Simples e suficiente para 5k/dia | Cursor-based pagination para >100k docs |
| Sem dead-letter queue no BullMQ | Default `attempts: 1` | `attempts: 3` + backoff exponencial + DLQ inspecionável |
| `audit_logs` tabela existe mas não é populada | Tempo | Middleware em rotas chave registrando ação + ator |
| Cobertura de teste mínima (12 testes, foco em pipeline) | Tempo | Mais testes de borda (XML parcial, OCR baixa confiança, arquivos corrompidos) |
| Métricas / tracing ausentes | Stdout JSON cobre observabilidade básica | Prometheus + OpenTelemetry quando houver SRE |

---

## 3. O que faria diferente com mais tempo

### Curto prazo (+2–4 horas)

1. **SPA mínima** (página de upload + tabela de status) para demo visual — o `src/app/page.tsx` atual é placeholder.
2. **Endpoint `POST /documents/{id}/reprocess`** para Operador corrigir falhas de OCR sem novo upload.
3. **Mais samples e testes negativos** — PDF criptografado, PNG corrompido, XML com encoding errado.
4. **Job de expiração de arquivos** rodando como segundo worker (BullMQ delayed/repeatable jobs).

### Médio prazo (+1–2 dias)

1. **Métricas Prometheus** + dashboard básico (latência OCR p95, taxa de falha por origem).
2. **DLQ BullMQ** com endpoint admin de inspeção/replay.
3. **Versionamento XSD** com `Accept`/`Content-Type` carregando a versão (`application/xml; profile=enrichment-1.0`).
4. **CI no GitHub Actions** — lint, test, build de imagem, push para registry.

### Longo prazo (produção)

1. **Kubernetes** com HPA no worker baseado no tamanho da fila Redis.
2. **MinIO/S3** em vez de volume local — alinhamento com cloud, retenção via lifecycle policies, backup transparente.
3. **Read replica** Postgres para relatórios pesados (sem competir com escrita do worker).
4. **Auditoria/LGPD completa** com retenção legal e direito ao esquecimento.
5. **Notificações** (e-mail/webhook) quando documento atinge `processed`/`enriched`/`failed` — campo está no diagrama original mas com trigger indefinido.

---

## 4. Decisões que manteria

- **PostgreSQL único** — 5k/dia + JSONB cobre todo o requisito; agregações SQL são triviais.
- **Processamento assíncrono via BullMQ/Redis** — única forma de cumprir SLA de 30 s sem travar a request HTTP.
- **`pdfjs-dist` + `tesseract.js`** — open-source, offline, sem chamada externa, reproduzível no Compose.
- **XSD versionado no repositório** + validação **obrigatória** (não opcional como no diagrama) — contrato claro com o cliente, rejeita lixo cedo (HTTP 422).
- **Monólito modular Next.js (web + worker)** — um build, um Dockerfile, dois entrypoints.
- **Init container `init-db`** — `prisma db push` idempotente serializado antes de qualquer serviço de runtime.

---

## 5. Decisões do diagrama que rejeitei

Resumo (tabela completa em [`docs/architecture.md` §3](docs/architecture.md#3-análise-crítica-do-diagrama-original)):

| Original | Rejeitado por |
|----------|---------------|
| Mongo + Postgres + MySQL + Elasticsearch | Volumetria não justifica polyglot; relatórios são SQL agregado |
| Elasticsearch "cluster 3 nós obrigatório" | Não há busca full-text; `COUNT`/`GROUP BY` resolve |
| MySQL `importacao_xml` com "join via aplicação" | Anti-pattern; uso JSONB no mesmo registro |
| Processamento síncrono | OCR 5–20 s estoura SLA HTTP |
| RabbitMQ "opcional" | Componente crítico não pode ser opcional; Redis explícito |
| XSD opcional | Risco de dados inválidos no enriquecimento |
| Filesystem "sem expiração nem backup" | Política de retenção explícita (90 dias) |
| Microserviços (Upload/OCR/Processing/XML/Report) | Overhead injustificado para equipe pequena; monólito modular |
| K8s + Docker single host coexistindo | Contradição interna no diagrama; escolhido Docker Compose para MVP |

---

## 6. Registro de tempo

| Módulo | Tempo planejado | Tempo real |
|--------|-----------------|------------|
| 1 — Arquitetura, ADRs, schema | 60 min | ~60 min |
| 2 — Core (upload, worker, OCR, XML) | 150 min | ~140 min |
| 3 — Relatórios, Docker, testes, docs | 90 min | ~90 min |
