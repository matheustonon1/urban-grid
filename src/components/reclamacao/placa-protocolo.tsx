// O número do protocolo como uma placa: borda de tinta de 2px, mono. É o
// "código de registro" da reclamação - fica visualmente diferente do estado
// (Etiqueta, que é preenchida) pra os dois não competirem lado a lado.
export function PlacaProtocolo({ protocolo, rotulo }: { protocolo: string; rotulo: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-[5px] border-2 border-ink bg-surface px-2 py-0.5">
      <span className="kicker">{rotulo}</span>
      <span className="font-mono text-sm font-medium tracking-tight text-ink">{protocolo}</span>
    </span>
  );
}
