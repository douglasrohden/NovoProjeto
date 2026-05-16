# Novo projeto

## Docker — projeto completo

Requisito: [Docker Desktop](https://docs.docker.com/desktop/install/windows-install/) em execução.

```powershell
cd web
copy .env.example .env
docker build -t document-platform:latest .
docker compose up -d
```

- App: http://localhost:3000  
- Health: http://localhost:3000/api/health  

Ou use o script (faz build + compose):

```powershell
cd web
.\install.ps1
```

Guia completo na raiz do repositório: [`../README.md`](../README.md)  
Detalhes: [`web/docs/docker.md`](web/docs/docker.md)

Parar: `docker compose down` (dentro de `web/`)

---

Leitura sugerida (arquitetura):

1. **[docs/DOCUMENTO.md](docs/DOCUMENTO.md)**  
2. **[docs/diagrama.md](docs/diagrama.md)**  
