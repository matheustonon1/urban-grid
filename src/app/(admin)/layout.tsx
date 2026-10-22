import { auth } from "@/auth";
import { AdminNav } from "@/components/layout/admin-nav";
import { contarPendenciasModeracao } from "@/lib/moderacao/pendencias";

// Só UI compartilhada (o menu) - cada página e cada server action desta
// área continuam com seu próprio guard (exigirModerador/exigirAdmin),
// igual antes. Um layout não é suficiente sozinho como controle de
// acesso: Server Functions postam pra própria URL da página, então uma
// verificação aqui não cobriria as ações, só o GET inicial.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const ehAdmin = session?.user?.papel === "ADMIN";
  const ehModerador = ehAdmin || session?.user?.papel === "MODERADOR";
  // Só pra quem modera: este layout também envolve páginas cujo guard fica na
  // própria página (usuarios, banimentos...), então os números não podem sair
  // pra quem só chegou até aqui antes do redirecionamento.
  const pendentes = ehModerador ? await contarPendenciasModeracao() : {};

  return (
    <>
      {/* Container próprio, separado do <main> de cada página - as páginas
          já aplicam seu próprio containerPagina (mx-auto + padding), então
          embrulhar tudo aqui duplicaria o espaçamento. Mais largo que o
          conteúdo (max-w-3xl) de propósito: com 6 abas + ícones, max-w-3xl
          não cabia numa linha só e forçava rolagem/quebra feia. */}
      <div className="mx-auto w-full max-w-6xl px-6 pt-4 sm:px-8">
        <AdminNav ehAdmin={ehAdmin} pendentes={pendentes} />
      </div>
      {children}
    </>
  );
}
