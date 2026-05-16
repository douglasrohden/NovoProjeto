# Documento do projeto — fácil de ler

**Figuras:** tudo está desenhado em [diagrama.md](./diagrama.md).

---

## O que é este sistema?

1. Envia um **PDF ou imagem**.
2. O sistema **extrai texto** (leitura de PDF ou OCR), encontra **datas, CPF e valores**.
3. **Mais tarde** pode mandar um **XML extra** para enriquecer o registro; o XML é **validado** contra um modelo fixo (XSD).

**Quem usa:**  
- **Operador** — envia ficheiros e vê estado.  
- **Gestor** — relatórios e CSV.  
- **Administrador** — auditoria (versão inicial simples).

**Alguns números de referência:** até ~5000 docs/dia, ficheiros até **25 MB**, tratamento até **30 s**, ficheiro original no disco apenas **90 dias** (histórico fica na base).

---

## O diagrama original: o que havia de errado?

**Ideia principal:** tirar complexidade a mais — um único servidor de base de dados e um trabalhador separado por filas, em vez do desenho com muitos bancos microserviços e processamento no mesmo pedido HTTP.

| O que o diagrama sugeria | O que ficou |
|--------------------------|-------------|
| Vários bancos ao mesmo tempo | **Um** PostgreSQL |
| Índices de busca em cluster obrigatório | **Removido** — relatórios com SQL normal |
| Tudo síncrono (esperando OCR dentro do pedido) | **Alterado** — fila + worker faz o trabalho pesado |
| Fila/confusão opcional | **Alterado** — Redis + lista de trabalhos bem definida |
| XML sem obrigação forte | **Alterado** — **XSD obrigatório** |
| Pasta sem política de apagar dados | **Alterado** — volume Docker + apagar arquivo bruto aos 90 dias |
| Vários microsserviços pequenos | **Alterado** — **uma app** modular + **worker** à parte |

Outros pontos como Kubernetes e monitorização “empresa inteira”: **para fora deste MVP**; **Docker Compose** basta aqui.

---

## Decisões registadas (ADRs — 5)

Para cada tema: problema → o que fizemos → o que poderia ser diferente → efeitos.

**1 — Uma só base PostgreSQL**

- Porque o desenho pedia demasiados sistemas diferentes para pouco volume real.
- Um PostgreSQL guarda texto extraído, padrões e enriquecimento em formato JSON dentro da mesma tabela.
- *Alternativa:* vários produtos tipo Mongo ou Elasticsearch só para relatório.
- *Efeito:* mais simples; busca texto “premium” ficaria só numa segunda fase.

**2 — Filas Redis + trabalhador BullMQ**

- OCR demora segundos; não se pode segurar o browser nesse tempo.
- O site grava o ficheiro, mete trabalho na fila e já responde; consome a fila.
- *Alternativa:* OCR no próprio pedido HTTP; RabbitMQ só para isto.
- *Efeito:* resposta rápida ao utilizador; o estado aparece atualizado aos poucos.

**3 — Pasta em disco com regra de 90 dias**

- Containers precisam de volume bem definido; não se pode ficar anos com ficheiros sem regra.
- Caminho tipo `/data/uploads/…`; após 90 dias apaga-se o arquivo; texto e dados do XML ficam gravados na base.
- *Alternativa:* guardar blob gigante sempre na base; cloud S3 logo no primeiro dia.
- *Efeito:* disco controlável; há de existir automatismo (cron) para apagar aos 90 dias.

**4 — Next.js TypeScript (+ worker no mesmo projeto)**

- Uma tecnologia só para página + API REST + worker; comando único tipo `docker compose up`.
- Bibliotecas: leitura de PDF (`pdfjs-dist`), OCR no browser/stack (`tesseract.js`), conferência XSD (`xmllint`), logs (`pino`).
- *Alternativa:* Python FastAPI só API + front à parte outra equipa de deploy.
- *Efeito:* menos peças; OCR em WASM pode ser um pouco mais lento que nativo.

**5 — XML de enriquecimento sempre validado pelo XSD**

- Evita cliente enviar erro que corrompa relatórios.
- Endpoint próprio por documento; se XML não bater ao modelo → erro claro (**422**); pode atualizar quando já está `enriched`.
- *Alternativa:* aceitar qualquer XML; JSON sem modelo.
- *Efeito:* contrato claro; quando o modelo mudar, convém numerar versões.

---

## Tecnologia (lista curta)

| Para quê | Nome |
|----------|------|
| Páginas e API | Next.js / React / TypeScript |
| Dados | PostgreSQL / Prisma |
| Fila de trabalhos | Redis / BullMQ |
| PDF e OCR | pdfjs-dist, tesseract.js |
| Ler e validar XML | fast-xml-parser, xmllint |
| Arranjar tudo junto | Docker Compose (web + worker + base + Redis) |

---

## Registo principal `documents` — em linguagem normal

Guarda uma linha por documento: **quem**, **nome do ficheiro**, **onde está no disco**, **estado atual**, **texto lido**, **lista de dados encontrados**, **extras vindos do XML**, **mensagem de erro** se correu mal, **datas**.

Estados típicos: `pending` → `processing` → `processed` | `failed` → depois opcionalmente `enriched`.

---

## API — só o necessário para entender

- Endereço de exemplo: `http://localhost:3000` · rotas sob `/api/v1` (+ `GET /api/health`).

**O fluxo habitual:**

1. `POST …/documents` — enviar ficheiro; devolve um **id**.
2. `GET …/documents/{id}` — ver estado e resultado.
3. `GET …/documents` — listar com filtros simples (estado, datas, página).
4. `POST …/documents/{id}/enrichment` — enviar ficheiro **XML**.
5. `GET …/reports/summary` e `…/reports/export.csv` — números e exportação para quem gere.

Erros típicos: **400** pedido estranho, **404** não existe, **409** ainda não dá para enriquecer, **413** ficheiro grande demais, **422** XML fora da regra, **500** falha interna. Resposta JSON com texto legível (`message`) e código fixo (`code`).

---

## XML esperado — leitura humana

Dentro de `DocumentEnrichment`, por esta ordem: **Cliente**, **Referência**, **Lista de campos**, e opcionalmente **Metadados**.

- Cliente obriga **código** (ex.: `ACME01`).  
- Referência obriga **id** e **tipo** (fatura, contrato, etc.).  
- Pelo menos um **Field** com **name** e valor no texto.

Exemplo mínimo:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<DocumentEnrichment version="1.0">
  <Client code="ACME01" name="ACME Corporation"/>
  <Reference id="INV-2026-0042" type="invoice" externalId="EXT-9981"/>
  <Fields>
    <Field name="issue_date" label="Data">2026-03-15</Field>
    <Field name="total_amount" label="Total">1500.00</Field>
    <Field name="currency">BRL</Field>
  </Fields>
</DocumentEnrichment>
```

### Anexo — regras técnicas (XSD)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"
           elementFormDefault="qualified">

  <xs:element name="DocumentEnrichment" type="DocumentEnrichmentType"/>

  <xs:complexType name="DocumentEnrichmentType">
    <xs:sequence>
      <xs:element name="Client" type="ClientType"/>
      <xs:element name="Reference" type="ReferenceType"/>
      <xs:element name="Fields" type="FieldsType"/>
      <xs:element name="Metadata" type="MetadataType" minOccurs="0"/>
    </xs:sequence>
    <xs:attribute name="version" type="xs:string" use="optional" default="1.0"/>
  </xs:complexType>

  <xs:complexType name="ClientType">
    <xs:attribute name="code" type="ClientCodeType" use="required"/>
    <xs:attribute name="name" type="xs:string" use="optional"/>
  </xs:complexType>

  <xs:simpleType name="ClientCodeType">
    <xs:restriction base="xs:string">
      <xs:pattern value="[A-Z0-9]{2,20}"/>
    </xs:restriction>
  </xs:simpleType>

  <xs:complexType name="ReferenceType">
    <xs:attribute name="id" type="xs:string" use="required"/>
    <xs:attribute name="type" type="ReferenceTypeEnum" use="required"/>
    <xs:attribute name="externalId" type="xs:string" use="optional"/>
  </xs:complexType>

  <xs:simpleType name="ReferenceTypeEnum">
    <xs:restriction base="xs:string">
      <xs:enumeration value="invoice"/>
      <xs:enumeration value="contract"/>
      <xs:enumeration value="receipt"/>
      <xs:enumeration value="statement"/>
      <xs:enumeration value="other"/>
    </xs:restriction>
  </xs:simpleType>

  <xs:complexType name="FieldsType">
    <xs:sequence>
      <xs:element name="Field" type="FieldType" minOccurs="1" maxOccurs="unbounded"/>
    </xs:sequence>
  </xs:complexType>

  <xs:complexType name="FieldType">
    <xs:simpleContent>
      <xs:extension base="xs:string">
        <xs:attribute name="name" type="FieldNameType" use="required"/>
        <xs:attribute name="label" type="xs:string" use="optional"/>
      </xs:extension>
    </xs:simpleContent>
  </xs:complexType>

  <xs:simpleType name="FieldNameType">
    <xs:restriction base="xs:string">
      <xs:pattern value="[a-z][a-z0-9_]{1,63}"/>
    </xs:restriction>
  </xs:simpleType>

  <xs:complexType name="MetadataType">
    <xs:sequence>
      <xs:element name="ImportedAt" type="xs:dateTime" minOccurs="0"/>
      <xs:element name="SourceSystem" type="xs:string" minOccurs="0"/>
      <xs:element name="Notes" type="xs:string" minOccurs="0"/>
    </xs:sequence>
  </xs:complexType>

</xs:schema>
```

---

## O que procurar no texto após OCR/PDF

Depois de limpar espaços e quebras de linha: **data em dia/mês/ano**, **CPF**, **valor em reais** (ex.: `R$ 1.234,56`). Cada achado vira um item com **tipo** e **valor** (e às vezes posição no texto).

---

## Segurança e logs (versão curta)

- O servidor confirma o **tipo real** do ficheiro (não confia só na extensão) e recusa acima de **25 MB**.
- Palavras-passe e endereços vêm de ficheiro de ambiente (`.env`), nunca no código.
- Autenticação forte pode vir depois; nesta fase os endpoints podem estar abertos para teste.
- Logs em JSON com **quem pediu** e **que documento** ajudam a perceber falhas.
