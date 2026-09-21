"use client";

// Só entra em ação se o próprio layout raiz quebrar (bem raro) - por isso
// não usa Tailwind/estilos do app: não herda o CSS global por padrão, e
// esse é o último fallback, não pode depender de nada que também possa
// ter quebrado junto com o layout.
export default function GlobalError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="pt-BR">
      <body
        style={{
          display: "flex",
          minHeight: "100vh",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          padding: "2rem",
          textAlign: "center",
          fontFamily: "system-ui, sans-serif",
          color: "#0f172a",
          background: "#f8fafc",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>
          Algo deu muito errado
        </h1>
        <p style={{ maxWidth: "28rem", color: "#475569" }}>
          O Urban Grid encontrou um erro inesperado ao carregar a página.
        </p>
        <button
          type="button"
          onClick={() => retry()}
          style={{
            borderRadius: "0.5rem",
            background: "#2563eb",
            color: "#fff",
            padding: "0.5rem 1rem",
            fontSize: "0.875rem",
            fontWeight: 500,
            border: "none",
            cursor: "pointer",
          }}
        >
          Tentar de novo
        </button>
      </body>
    </html>
  );
}
