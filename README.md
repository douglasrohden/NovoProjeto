# NovoProjeto — Document Processing Platform

Plataforma de ingestão e processamento de documentos (PDF/PNG) com enriquecimento XML.

Repositório: [https://github.com/douglasrohden/NovoProjeto](https://github.com/douglasrohden/NovoProjeto)

## Pré-requisitos

- [Docker Desktop](https://docs.docker.com/desktop/install/windows-install/) 24+ (Windows) ou Docker Engine + [Compose v2](https://docs.docker.com/compose/)
- [Git](https://git-scm.com/downloads)
- ~2 GB de disco livre

## Instalação (clone + subir)

### 1. Clonar o repositório

**Windows (PowerShell):**

```powershell
git clone https://github.com/douglasrohden/NovoProjeto.git
cd NovoProjeto\web
```

**Linux / macOS:**

```bash
git clone https://github.com/douglasrohden/NovoProjeto.git
cd NovoProjeto/web
```

### 2. Configurar ambiente

**Windows:**

```powershell
copy .env.example .env
```

**Linux / macOS:**

```bash
cp .env.example .env
```

Edite `.env` e altere `POSTGRES_PASSWORD` em ambiente real (a mesma senha deve constar em `DATABASE_URL` se for usar `npm run dev` fora do Docker).

### 3. Subir a stack completa (um comando)

```bash
docker compose up -d
```

Na primeira execução o Compose **constrói a imagem** e sobe todos os serviços (2–5 min).

| Serviço | Descrição |
|---------|-----------|
| `postgres` | PostgreSQL 16 |
| `redis` | Fila BullMQ |
| `init-db` | `prisma migrate deploy` (roda uma vez; obrigatório para produção) |
| `web` | UI + API Next.js — porta **3000** (só sobe após migrations OK) |
| `worker` | Processamento assíncrono (OCR/PDF) |

### 4. Verificar

```bash
docker compose logs init-db
docker compose ps
curl http://localhost:3000/api/health
```

Em `init-db` deve aparecer: **Migrations applied successfully.**

- **App:** http://localhost:3000  
- **Health:** http://localhost:3000/api/health  

Resposta esperada:

```json
{"status":"ok","version":"1.0.0","database":"connected","redis":"connected"}
```

## Script automático

Na pasta `web/` (cria `.env` se não existir e executa `docker compose up -d`):

```powershell
# Windows
.\install.ps1
```

```bash
# Linux / macOS
chmod +x install.sh
./install.sh
```

## Derrubar e subir de novo

```bash
docker compose down
docker compose up -d
```

Reset completo (apaga banco e uploads):

```bash
docker compose down -v
docker compose up -d
```

## Produção (sem expor Postgres/Redis no host)

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

Windows: `.\install.ps1 -Production`

## Parar

```bash
docker compose down
```

## Teste rápido

```bash
curl -X POST http://localhost:3000/api/v1/documents \
  -F "file=@samples/nota-fiscal.pdf"
```

## Desenvolvimento local (sem Docker)

```bash
cd web
npm install
cp .env.example .env   # ou: copy .env.example .env no Windows
npm run db:migrate
npm run dev      # terminal 1
npm run worker   # terminal 2
```

## Documentação

| Arquivo | Conteúdo |
|---------|----------|
| [web/docs/docker.md](web/docs/docker.md) | Guia Docker detalhado |
| [web/README.md](web/README.md) | README da aplicação (API, testes, arquitetura) |
| [docs/DOCUMENTO.md](docs/DOCUMENTO.md) | Visão geral e decisões |
| [docs/diagrama.md](docs/diagrama.md) | Diagrama e estados do documento |

## Problemas comuns

| Sintoma | Solução |
|---------|---------|
| `docker` não reconhecido | Instale e **inicie** o Docker Desktop |
| Só `postgres` e `redis` no Desktop | `docker compose logs init-db` — migrations falharam ou imagem não buildou |
| `init-db` exited (1) | Senha errada no `.env` vs volume antigo → `docker compose down -v` e subir de novo |
| Worker não processa | `docker compose logs worker` |
| Senha Postgres | `docker compose down -v` se mudou `POSTGRES_PASSWORD` após o 1º `up` |
| Porta 3000 em uso | `API_PORT=3001` no `.env` |
