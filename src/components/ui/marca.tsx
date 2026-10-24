// Marca do Urban Grid: quatro quarteirões separados por ruas (a "grade") - um
// de tinta, dois de azul de placa e um de amarelo de obra - mais o nome em
// Archivo. O glifo é decorativo (aria-hidden): quem usa o componente dentro de
// um link dá o nome acessível ao link.
export function Marca({
  className = "",
  semNome = false,
  tom = "padrao",
}: {
  className?: string;
  // "claro": para fundo escuro (painel da tela de entrada, faixa de chamada).
  tom?: "padrao" | "claro";
  // Só o glifo (favicon, espaços apertados).
  semNome?: boolean;
}) {
  const claro = tom === "claro";

  return (
    <span className={`inline-flex items-center gap-2 sm:gap-2.5 ${className}`}>
      <svg viewBox="0 0 28 28" aria-hidden className="h-7 w-7 shrink-0">
        <rect x="2" y="2" width="11" height="11" rx="1.5" className={claro ? "fill-chalk" : "fill-ink"} />
        <rect x="15" y="2" width="11" height="11" rx="1.5" className={claro ? "fill-chalk/55" : "fill-brand"} />
        <rect x="2" y="15" width="11" height="11" rx="1.5" className={claro ? "fill-chalk/55" : "fill-brand"} />
        <rect x="15" y="15" width="11" height="11" rx="1.5" className="fill-signal" />
      </svg>
      {!semNome && (
        <span
          className={`font-display text-lg leading-none font-extrabold tracking-tight sm:text-xl ${
            claro ? "text-chalk" : "text-ink"
          }`}
        >
          Urban <span className={claro ? "text-signal" : "text-brand"}>Grid</span>
        </span>
      )}
    </span>
  );
}
