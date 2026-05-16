"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type DocStatus =
  | "pending"
  | "processing"
  | "processed"
  | "failed"
  | "enriched"
  | "";

type DocSnapshot = {
  status: DocStatus;
};

const TERMINAL: DocStatus[] = ["processed", "failed", "enriched"];

export default function HomePage() {
  const [file, setFile] = useState<File | null>(null);
  const [xmlFile, setXmlFile] = useState<File | null>(null);
  const [documentId, setDocumentId] = useState("");
  const [docStatus, setDocStatus] = useState<DocStatus>("");
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);
  const [result, setResult] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setPolling(false);
  }, []);

  const fetchStatus = useCallback(async (id: string): Promise<DocSnapshot | null> => {
    const res = await fetch(`/api/v1/documents/${id}`);
    const data = await res.json();
    if (!res.ok) {
      setResult(JSON.stringify(data, null, 2));
      return null;
    }
    setResult(JSON.stringify(data, null, 2));
    const status = (data.status as DocStatus) ?? "";
    setDocStatus(status);
    return { status };
  }, []);

  const startPolling = useCallback(
    (id: string) => {
      stopPolling();
      setPolling(true);
      void fetchStatus(id);
      pollRef.current = setInterval(() => {
        void fetchStatus(id).then((snap) => {
          if (snap && TERMINAL.includes(snap.status)) stopPolling();
        });
      }, 2000);
    },
    [fetchStatus, stopPolling]
  );

  useEffect(() => () => stopPolling(), [stopPolling]);

  async function uploadDocument() {
    if (!file) return;
    setLoading(true);
    setResult("");
    setDocStatus("");
    stopPolling();
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/v1/documents", { method: "POST", body: fd });
      const data = await res.json();
      setResult(JSON.stringify(data, null, 2));
      if (data.id) {
        setDocumentId(data.id);
        setDocStatus((data.status as DocStatus) ?? "pending");
        startPolling(data.id);
      }
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
      await fetchStatus(documentId);
    } finally {
      setLoading(false);
    }
  }

  async function enrich() {
    if (!documentId || !xmlFile) return;

    if (docStatus !== "processed" && docStatus !== "enriched") {
      setResult(
        JSON.stringify(
          {
            error: {
              code: "DOCUMENT_NOT_READY",
              message:
                docStatus === "pending"
                  ? "Documento na fila. Inicie o worker: npm run worker (ou docker compose up worker)."
                  : docStatus === "processing"
                    ? "Ainda a processar. Aguarde ou use Consultar status."
                    : docStatus === "failed"
                      ? "Processamento falhou; nao e possivel enriquecer."
                      : "Consulte o status antes de importar o XML.",
              details: { status: docStatus || "unknown" },
            },
          },
          null,
          2
        )
      );
      return;
    }

    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", xmlFile);
      const res = await fetch(`/api/v1/documents/${documentId}/enrichment`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      setResult(JSON.stringify(data, null, 2));
      if (res.ok && data.status) setDocStatus(data.status);
    } finally {
      setLoading(false);
    }
  }

  const canEnrich = docStatus === "processed" || docStatus === "enriched";
  const statusHint =
    docStatus === "pending"
      ? "Na fila — precisa do worker (npm run worker)."
      : docStatus === "processing"
        ? "A processar OCR/PDF…"
        : docStatus === "processed"
          ? "Pronto para XML."
          : docStatus === "failed"
            ? "Falhou no processamento."
            : docStatus === "enriched"
              ? "Ja enriquecido (pode substituir XML)."
              : "";

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

      {(docStatus || polling) && (
        <p
          style={{
            padding: "0.75rem 1rem",
            borderRadius: 8,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            fontSize: "0.9rem",
          }}
        >
          <strong>Status:</strong> {docStatus || "—"}
          {polling && " (a atualizar…)"}
          {statusHint && <> — {statusHint}</>}
        </p>
      )}

      <MotionCard>
        <label>Upload PDF ou PNG</label>
        <input
          type="file"
          accept=".pdf,.png,application/pdf,image/png"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <button type="button" onClick={uploadDocument} disabled={loading || !file}>
          Enviar documento
        </button>
      </MotionCard>

      <MotionCard>
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
      </MotionCard>

      <MotionCard>
        <label>XML de enriquecimento</label>
        <input
          type="file"
          accept=".xml,application/xml,text/xml"
          onChange={(e) => setXmlFile(e.target.files?.[0] ?? null)}
        />
        <button
          type="button"
          onClick={enrich}
          disabled={loading || !documentId || !xmlFile || (!canEnrich && docStatus !== "")}
          title={canEnrich ? "" : "Aguarde status processed"}
        >
          Importar XML
        </button>
        {!canEnrich && docStatus && docStatus !== "failed" && (
          <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginTop: "0.5rem" }}>
            Importar XML so quando o status for <strong>processed</strong>.
          </p>
        )}
      </MotionCard>

      {result && <pre>{result}</pre>}
    </main>
  );
}

function MotionCard({ children }: { children: React.ReactNode }) {
  return <div className="card">{children}</div>;
}
