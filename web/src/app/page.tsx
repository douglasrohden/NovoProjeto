"use client";

import { useState } from "react";

export default function HomePage() {
  const [file, setFile] = useState<File | null>(null);
  const [xmlFile, setXmlFile] = useState<File | null>(null);
  const [documentId, setDocumentId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>("");

  async function uploadDocument() {
    if (!file) return;
    setLoading(true);
    setResult("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/v1/documents", { method: "POST", body: fd });
      const data = await res.json();
      setResult(JSON.stringify(data, null, 2));
      if (data.id) setDocumentId(data.id);
    } catch (e) {
      setResult(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function pollStatus() {
    if (!documentId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/documents/${documentId}`);
      setResult(JSON.stringify(await res.json(), null, 2));
    } finally {
      setLoading(false);
    }
  }

  async function enrich() {
    if (!documentId || !xmlFile) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", xmlFile);
      const res = await fetch(`/api/v1/documents/${documentId}/enrichment`, {
        method: "POST",
        body: fd,
      });
      setResult(JSON.stringify(await res.json(), null, 2));
    } finally {
      setLoading(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "0.65rem",
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--bg)",
    color: "var(--text)",
  };

  return (
    <main>
      <h1>Document Processing Platform</h1>
      <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
        Next.js full-stack ·{" "}
        <a href="/api/health" target="_blank" rel="noreferrer">
          /api/health
        </a>
      </p>

      <div className="card">
        <label>Upload PDF ou PNG</label>
        <input
          type="file"
          accept=".pdf,.png,application/pdf,image/png"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <button type="button" onClick={uploadDocument} disabled={loading || !file}>
          Enviar documento
        </button>
      </div>

      <div className="card">
        <label>ID do documento</label>
        <input
          type="text"
          value={documentId}
          onChange={(e) => setDocumentId(e.target.value)}
          placeholder="UUID retornado no upload"
          style={inputStyle}
        />
        <button type="button" onClick={pollStatus} disabled={loading || !documentId}>
          Consultar status
        </button>
      </div>

      <div className="card">
        <label>XML de enriquecimento</label>
        <input
          type="file"
          accept=".xml,application/xml,text/xml"
          onChange={(e) => setXmlFile(e.target.files?.[0] ?? null)}
        />
        <button type="button" onClick={enrich} disabled={loading || !documentId || !xmlFile}>
          Importar XML
        </button>
      </div>

      {result && <pre>{result}</pre>}
    </main>
  );
}
