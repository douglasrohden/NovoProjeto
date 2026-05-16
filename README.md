# Novo projeto

## Docker (stack completa)

Na pasta **`web/`**, com [Docker Desktop](https://docs.docker.com/desktop/install/windows-install/) instalado:

```powershell
cd web
copy .env.example .env        # opcional — ajuste POSTGRES_PASSWORD, etc.
docker compose up -d --build
```

- App: http://localhost:3000 (`API_PORT` no `.env`)
- Estado: http://localhost:3000/api/health

Para parar:

```powershell
docker compose down
```

O ficheiro `web/docs/xml-schema.xsd` tem de existir (validação XML no container).

---

Leitura sugerida (arquitetura), por ordem:

1. **[docs/DOCUMENTO.md](docs/DOCUMENTO.md)** — o que faz, decisões e regras (linguagem simples)  
2. **[docs/diagrama.md](docs/diagrama.md)** — um desenho + estados do documento  
