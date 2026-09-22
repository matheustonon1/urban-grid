import { auth } from "@/auth";
import { AdminNav } from "@/components/admin-nav";

// Só UI compartilhada (o menu) - cada página e cada server action desta
// área continuam com seu próprio guard (exigirModerador/exigirAdmin),
// igual antes. Um layout não é suficiente sozinho como controle de
// acesso: Server Functions postam pra própria URL da página, então uma
// verificação aqui não cobriria as ações, só o GET inicial.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const ehAdmin = session?.user?.papel === "ADMIN";

  return (
    <>
      {/* Container próprio, separado do <main> de cada página - as páginas
          já aplicam seu próprio containerPagina (mx-auto + padding), então
          embrulhar tudo aqui duplicaria o espaçamento. Mais largo que o
          conteúdo (max-w-3xl) de propósito: com 6 abas + ícones, max-w-3xl
          não cabia numa linha só e forçava rolagem/quebra feia. */}
      <div className="mx-auto w-full max-w-5xl px-6 pt-4 sm:px-8">
        <AdminNav ehAdmin={ehAdmin} />
      </div>
      {children}
    </>
  );
}
