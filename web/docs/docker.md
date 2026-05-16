# Docker — guia completo

Repositório: [github.com/douglasrohden/NovoProjeto](https://github.com/douglasrohden/NovoProjeto)

## Requisitos

- Docker 24+ e Compose v2
- Git
- ~2 GB de disco (imagem Node + modelos Tesseract)

## Fluxo: clone → `docker compose up -d`

### 1. Clonar

```bash
git clone https://github.com/douglasrohden/NovoProjeto.git
cd NovoProjeto/web
```

### 2. Ambiente

```bash
cp .env.example .env
# Windows: copy .env.example .env
```

| Variável | Default | Uso |
|----------|---------|-----|
| `APP_IMAGE` | `document-platform:latest` | Tag da imagem (build automático pelo Compose) |
| `API_PORT` | `3000` | Porta da aplicação no host |
| `POSTGRES_PASSWORD` | `change_me` | Senha do PostgreSQL |
| `POSTGRES_PORT` | `5433` | Porta do Postgres no host |

### 3. Subir a stack (um comando)

```bash
docker compose up -d
```

O Compose constrói a imagem (`Dockerfile`) e inicia `postgres`, `redis`, `web` e `worker`.

A imagem inclui Node.js 22, Next.js em produção, Prisma, Tesseract (`por`/`eng`) e `xmllint`.

### 4. Verificar

```bash
docker compose ps
curl http://localhost:3000/api/health
```

## Produção (overlay)

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## Script `install.ps1` / `install.sh`

```bash
./install.sh
.\install.ps1
```

## Derrubar e subir de novo

```bash
docker compose down
docker compose up -d
```

Reset completo (volumes):

```bash
docker compose down -v
docker compose up -d
```

## Rebuild após alterações no código

```bash
docker compose up -d --build
```

## Logs e parada

```bash
docker compose logs -f web worker
docker compose down
docker compose down -v
```

## Variáveis dentro dos containers

O Compose define em `web` e `worker`:

- `DATABASE_URL` → `postgresql://...@postgres:5432/...`
- `REDIS_URL` → `redis://redis:6379`
- `NODE_ENV` → `production`

O `.env` com `localhost:5433` serve apenas para `npm run dev` fora do Docker.
