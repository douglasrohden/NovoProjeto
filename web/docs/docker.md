# Docker — guia completo

## Requisitos

- Docker 24+ e Compose v2
- ~2 GB de disco (imagem Node + modelos Tesseract)

## Fluxo recomendado: `docker build` + `docker compose`

Execute na pasta `web/` (onde estão o `Dockerfile` e o `docker-compose.yml`).

### 1. Ambiente

```bash
cp .env.example .env
```

| Variável | Default | Uso |
|----------|---------|-----|
| `APP_IMAGE` | `document-platform:latest` | Tag da imagem construída com `docker build` |
| `API_PORT` | `3000` | Porta da aplicação no host |
| `POSTGRES_PASSWORD` | `change_me` | Senha do PostgreSQL |
| `POSTGRES_PORT` | `5433` | Porta do Postgres no host (evita conflito com instalação local na 5432) |

### 2. Build da imagem

```bash
docker build -t document-platform:latest .
```

A imagem inclui:

- Node.js 22
- Next.js compilado para produção (`npm run build`)
- Prisma Client gerado
- Tesseract `por` + `eng` em `/app/tessdata`
- `xmllint` (`libxml2-utils`) para validação XSD

### 3. Subir a stack

```bash
docker compose up -d
```

Serviços:

| Container | Função |
|-----------|--------|
| `postgres` | PostgreSQL 16 |
| `redis` | Fila BullMQ |
| `init-db` | `prisma migrate deploy` |
| `web` | Next.js (`npm start`) — entrypoint `docker/entrypoint-web.sh` |
| `worker` | BullMQ consumer — entrypoint `docker/entrypoint-worker.sh` |

`web`, `worker` e `init-db` compartilham a **mesma imagem** (`APP_IMAGE`).

### 4. Verificar

```bash
docker compose ps
curl http://localhost:3000/api/health
```

## Produção (overlay)

Não expõe Postgres nem Redis no host:

```bash
docker build -t document-platform:latest .
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## Script `install.ps1` / `install.sh`

Executa build + compose automaticamente:

```bash
./install.sh
./install.sh --production   # usa docker-compose.prod.yml

.\install.ps1
.\install.ps1 -Production
```

## Rebuild após alterações no código

```bash
docker build -t document-platform:latest .
docker compose up -d
```

## Logs e parada

```bash
docker compose logs -f web worker
docker compose down          # mantém volumes
docker compose down -v       # apaga pgdata e uploads
```

## Alternativa: build pelo Compose

Equivalente a build + up em um comando:

```bash
docker compose up -d --build
```

## Variáveis dentro dos containers

O Compose **sobrescreve** em `web` e `worker`:

- `DATABASE_URL` → `postgresql://...@postgres:5432/...`
- `REDIS_URL` → `redis://redis:6379`
- `UPLOAD_DIR` → `/data/uploads`
- `NODE_ENV` → `production`

O `.env` com `localhost:5433` serve apenas para `npm run dev` fora do Docker.

## Estrutura

```
Dockerfile
docker-compose.yml
docker-compose.prod.yml
docker/
  entrypoint-web.sh
  entrypoint-worker.sh
install.sh
install.ps1
```
