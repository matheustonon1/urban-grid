import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { emailDoTokenRedefinicao } from "@/lib/email";
import { botaoPrimario, cartao } from "@/lib/estilos";

import { FormularioRedefinirSenha } from "./formulario";

export default async function RedefinirSenhaPage({
  params,
}: PageProps<"/redefinir-senha/[token]">) {
  const { token } = await params;

  const registro = await prisma.verificationToken.findUnique({ where: { token } });
  const email = registro ? emailDoTokenRedefinicao(registro.identifier) : null;
  const usuario = email ? await prisma.user.findUnique({ where: { email } }) : null;
  const valido = !!registro && registro.expires > new Date() && !!usuario?.senhaHash;

  if (!valido) {
    return (
      <main className="animate-fade-in flex flex-1 flex-col items-center justify-center gap-4 p-8">
        <div className={`flex w-full max-w-sm flex-col items-center gap-3 text-center ${cartao}`}>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            Link inválido ou expirado
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Peça um novo link em &quot;Esqueci minha senha&quot;, ou faça
            login se já lembrar da sua senha.
          </p>
          <Link href="/esqueci-senha" className={botaoPrimario}>
            Pedir novo link
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="animate-fade-in flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <div className="flex max-w-sm flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Criar nova senha
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Escolha uma nova senha para {usuario!.email}.
        </p>
      </div>
      <FormularioRedefinirSenha token={token} />
    </main>
  );
}
