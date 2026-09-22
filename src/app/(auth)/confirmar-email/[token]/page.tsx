import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { dadosDoTokenTrocaEmail } from "@/lib/email";
import { botaoPrimario, cartao } from "@/lib/estilos";

export default async function ConfirmarEmailPage({
  params,
}: PageProps<"/confirmar-email/[token]">) {
  const { token } = await params;

  const registro = await prisma.verificationToken.findUnique({ where: { token } });
  const dados = registro ? dadosDoTokenTrocaEmail(registro.identifier) : null;
  const expirado = !registro || registro.expires <= new Date();

  let mensagem = "Link inválido ou expirado.";
  let sucesso = false;

  if (dados && !expirado) {
    const usuario = await prisma.user.findUnique({ where: { id: dados.userId } });

    if (usuario?.email === dados.novoEmail) {
      // Já foi confirmado antes (ex.: provedor de e-mail pré-visitou o
      // link) - idempotente igual verificar-email, não é erro reexibir
      // sucesso num clique repetido.
      sucesso = true;
      mensagem = "E-mail confirmado! Use o novo endereço para entrar.";
    } else if (usuario) {
      const emailEmUso = await prisma.user.findUnique({ where: { email: dados.novoEmail } });
      if (emailEmUso) {
        mensagem = "Este e-mail passou a estar em uso por outra conta. Peça uma nova troca.";
      } else {
        await prisma.user.update({
          where: { id: usuario.id },
          data: {
            email: dados.novoEmail,
            emailVerified: new Date(),
            // Sessão JWT guarda o e-mail de quando logou e não é
            // revalidada contra o banco por padrão (ver callback jwt em
            // auth.ts) - sem isso, uma sessão já aberta continuaria
            // mostrando o e-mail antigo até expirar sozinha. Reusa o
            // mesmo campo de invalidação do fluxo de troca de senha.
            senhaAlteradaEm: new Date(),
          },
        });
        sucesso = true;
        mensagem = "E-mail confirmado! Use o novo endereço para entrar.";
      }
    }
  } else if (expirado) {
    mensagem = "Este link expirou. Peça uma nova troca em 'Minha conta'.";
  }

  return (
    <main className="animate-fade-in flex flex-1 flex-col items-center justify-center gap-4 p-8">
      <div className={`flex w-full max-w-sm flex-col items-center gap-3 text-center ${cartao}`}>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          {sucesso ? "E-mail atualizado!" : "Link inválido ou expirado"}
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">{mensagem}</p>
        <Link href="/login" className={botaoPrimario}>
          Ir para o login
        </Link>
      </div>
    </main>
  );
}
