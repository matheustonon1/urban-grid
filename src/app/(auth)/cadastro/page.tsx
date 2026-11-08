import { redirect } from "next/navigation";

import { obterSessao } from "@/lib/seguranca/sessao";
import { CadastroTipoSwitch } from "@/components/formulario/cadastro-tipo-switch";
import { PaginaAuth } from "@/components/ui/pagina-auth";

export default async function CadastroPage({
  searchParams,
}: PageProps<"/cadastro">) {
  const session = await obterSessao();
  if (session?.user) {
    redirect("/painel");
  }

  const { tipo } = await searchParams;
  const tipoInicial = tipo === "orgao" ? "orgao" : "pessoa";

  return (
    <PaginaAuth>
      <CadastroTipoSwitch tipoInicial={tipoInicial} />
    </PaginaAuth>
  );
}
