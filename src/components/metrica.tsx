// Compartilhado entre o painel do órgão (app/(app)/orgao) e a página
// pública de detalhe do órgão (app/orgaos/[id]) - duas cópias idênticas
// antes disto. Número em mono/tabular segue o mesmo vocabulário visual
// do painel de estatísticas da home (ver app/page.tsx) - lembra um
// placar/painel técnico, não um stat card de SaaS genérico.
export function Metrica({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex flex-col">
      <span className="font-mono text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-100">
        {valor}
      </span>
      <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
    </div>
  );
}
