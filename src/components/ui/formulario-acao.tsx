"use client";

import {
  createContext,
  startTransition,
  useActionState,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import type { FormEvent, ReactNode } from "react";
import Link from "next/link";
import { LoaderCircle, ShieldAlert, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";

import { Campo } from "@/components/formulario/campo";
import { Aviso } from "@/components/ui/aviso";
import { useAvisos } from "@/components/ui/avisos";
import { botaoPerigoSolido, botaoPrimario, botaoSecundario, campoInput } from "@/lib/estilos";
import { CAMPO_CODIGO_CONFIRMACAO, CAMPO_SENHA_CONFIRMACAO } from "@/lib/acoes/senha";
import type { ResultadoAcao } from "@/lib/acoes/resultado";

// Diálogo que pede uma confirmação ANTES de a ação sair. O texto é escrito no
// servidor (traduzido) e pode citar o que a pessoa escolheu no formulário com
// `{campo}` - o rótulo da opção marcada, não o valor cru ("Moderador", não
// "MODERADOR"). Para deixar um `{campo}` passar pelo ICU do next-intl sem erro,
// passe o próprio texto como parâmetro: `t("x", { papel: "{papel}" })`.
export interface Confirmacao {
  titulo: string;
  descricao?: string;
  // Consequências, uma por linha - o que muda de fato e para quem.
  detalhes?: string[];
  // Rótulo do botão que confirma: verbo + objeto ("Banir por 30 dias"), nunca "OK".
  confirmar: string;
  // "perigo" = botão vermelho cheio e ícone de alerta; "primario" = ação séria, mas
  // não destrutiva.
  tom?: "perigo" | "primario";
  // Só pede confirmação se este campo mudou em relação ao valor inicial; sem
  // mudança, envia direto (e o servidor responde que não havia o que alterar).
  soSeMudar?: string;
  // Pede a senha de quem está agindo. `true` = sempre; `{ campo, valor }` = só
  // quando aquele campo tiver aquele valor (banimento permanente). A checagem de
  // verdade é a do servidor (exigirReautenticacao) - isto só mostra os campos.
  senha?: boolean | { campo: string; valor: string };
  // Junto com a senha, o código de duas etapas de quem age: "ativo" mostra o campo do
  // código; "ausente" (a conta não tem 2FA) troca os campos por um aviso com o caminho
  // para ativá-lo e trava o botão. Só vale quando `senha` pede reautenticação.
  segundoFator?: "ativo" | "ausente";
}

interface ContextoFormulario {
  pendente: boolean;
  comConfirmacao: boolean;
  pedirConfirmacao: () => void;
}

const ContextoFormulario = createContext<ContextoFormulario>({
  pendente: false,
  comConfirmacao: false,
  pedirConfirmacao: () => {},
});

interface Resumo {
  titulo: string;
  descricao?: string;
  detalhes: string[];
  confirmar: string;
  exigeSenha: boolean;
  segundoFator?: "ativo" | "ausente";
}

type Controle = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

const ehControle = (elemento: Element): elemento is Controle =>
  elemento instanceof HTMLInputElement ||
  elemento instanceof HTMLSelectElement ||
  elemento instanceof HTMLTextAreaElement;

// Campo -> texto que a pessoa vê (o rótulo da opção marcada num <select>).
function textosDoFormulario(form: HTMLFormElement): Record<string, string> {
  const mapa: Record<string, string> = {};
  for (const elemento of Array.from(form.elements)) {
    if (
      !ehControle(elemento) ||
      !elemento.name ||
      elemento.name === CAMPO_SENHA_CONFIRMACAO ||
      elemento.name === CAMPO_CODIGO_CONFIRMACAO
    ) {
      continue;
    }
    if (
      elemento instanceof HTMLInputElement &&
      (elemento.type === "checkbox" || elemento.type === "radio") &&
      !elemento.checked
    ) {
      continue;
    }
    mapa[elemento.name] =
      elemento instanceof HTMLSelectElement
        ? (elemento.selectedOptions[0]?.text ?? elemento.value)
        : elemento.value;
  }
  return mapa;
}

const interpolar = (texto: string, valores: Record<string, string>) =>
  texto.replace(/\{(\w+)\}/g, (inteiro, chave: string) => valores[chave] ?? inteiro);

function mudou(form: HTMLFormElement, campo: string): boolean {
  const elemento = form.elements.namedItem(campo);
  if (elemento instanceof HTMLSelectElement) {
    const inicial = Array.from(elemento.options).find((opcao) => opcao.defaultSelected);
    return elemento.value !== (inicial?.value ?? elemento.options[0]?.value);
  }
  if (elemento instanceof HTMLInputElement || elemento instanceof HTMLTextAreaElement) {
    return elemento.value !== elemento.defaultValue;
  }
  return true;
}

// <form> de uma ação que mexe em dados: mostra o retorno como aviso flutuante,
// bloqueia o botão enquanto roda e, se pedido, antes de enviar abre um diálogo de
// confirmação (com senha quando a ação muda o acesso de outra conta).
//
// Envia por `onSubmit` + `useActionState` em vez de `<form action>`: o React
// zera os campos de um `<form action>` ao fim da ação, mesmo com erro - uma senha
// errada limparia também a escolha que o diálogo acabou de descrever, e o novo
// envio sairia com outro valor. Aqui o formulário só é limpo quando se pede
// (`limparAoSucesso`).
export function FormularioAcao({
  action,
  children,
  className,
  confirmacao,
  limparAoSucesso = false,
  recolherAoSucesso = false,
  id,
  rotuloId,
}: {
  action: (formData: FormData) => Promise<ResultadoAcao>;
  children: ReactNode;
  className?: string;
  confirmacao?: Confirmacao;
  // Zera os campos depois de um sucesso (comentário enviado, resposta enviada).
  limparAoSucesso?: boolean;
  // Fecha o <details> que envolve o formulário (denunciar, responder) depois de um sucesso.
  recolherAoSucesso?: boolean;
  id?: string;
  // id do título que nomeia o formulário (aria-labelledby).
  rotuloId?: string;
}) {
  const t = useTranslations("Acao");
  const { notificar } = useAvisos();
  const formRef = useRef<HTMLFormElement>(null);
  const dialogoRef = useRef<HTMLDialogElement>(null);
  const idTitulo = useId();
  const idDescricao = useId();
  const [aberto, setAberto] = useState(false);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [erroDialogo, setErroDialogo] = useState<string | null>(null);

  // O aviso é disparado aqui, dentro da ação, e não por um efeito sobre o estado:
  // quando a ação revalida a página e este formulário sai da lista, o componente
  // desmonta junto com a atualização e um efeito nunca chegaria a rodar.
  const [, despachar, pendente] = useActionState(
    async (_anterior: ResultadoAcao | null, dados: FormData) => {
      const resultado = await action(dados);
      if (resultado.manterDialogo) {
        setErroDialogo(resultado.mensagem);
        return resultado;
      }
      setErroDialogo(null);
      setAberto(false);
      notificar(resultado);
      if (resultado.tipo === "sucesso") {
        if (limparAoSucesso) formRef.current?.reset();
        if (recolherAoSucesso) formRef.current?.closest("details")?.removeAttribute("open");
      }
      return resultado;
    },
    null
  );

  useEffect(() => {
    const dialogo = dialogoRef.current;
    if (!dialogo) return;
    if (aberto && !dialogo.open) dialogo.showModal();
    if (!aberto && dialogo.open) dialogo.close();
  }, [aberto]);

  function precisaConfirmar(form: HTMLFormElement) {
    if (!confirmacao) return false;
    return confirmacao.soSeMudar ? mudou(form, confirmacao.soSeMudar) : true;
  }

  function abrirDialogo(form: HTMLFormElement) {
    if (!confirmacao) return;
    const valores = textosDoFormulario(form);
    const crus = new FormData(form);
    const exigeSenha =
      typeof confirmacao.senha === "object"
        ? crus.get(confirmacao.senha.campo) === confirmacao.senha.valor
        : Boolean(confirmacao.senha);

    setResumo({
      titulo: interpolar(confirmacao.titulo, valores),
      descricao: confirmacao.descricao && interpolar(confirmacao.descricao, valores),
      detalhes: (confirmacao.detalhes ?? []).map((linha) => interpolar(linha, valores)),
      confirmar: interpolar(confirmacao.confirmar, valores),
      exigeSenha,
      segundoFator: exigeSenha ? confirmacao.segundoFator : undefined,
    });
    setErroDialogo(null);
    setAberto(true);
  }

  function enviar(form: HTMLFormElement, enviador: Element | null) {
    const dados = new FormData(form, enviador instanceof HTMLButtonElement ? enviador : null);
    startTransition(() => despachar(dados));
  }

  // O botão da tela (BotaoAcao) só valida e abre o diálogo; o envio de verdade sai
  // do botão de dentro do diálogo, que se identifica com data-confirmacao. Enter
  // num campo de texto também passa por aqui: sem o botão do diálogo como
  // enviador, abre o diálogo em vez de pular a confirmação.
  function aoEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const form = evento.currentTarget;
    const enviador = (evento.nativeEvent as SubmitEvent).submitter;
    const vemDoDialogo = enviador instanceof HTMLElement && enviador.dataset.confirmacao === "sim";

    if (!vemDoDialogo && precisaConfirmar(form)) {
      abrirDialogo(form);
      return;
    }
    enviar(form, enviador);
  }

  function pedirConfirmacao() {
    const form = formRef.current;
    if (!form || !form.reportValidity()) return;
    if (precisaConfirmar(form)) {
      abrirDialogo(form);
    } else {
      enviar(form, null);
    }
  }

  const perigo = confirmacao?.tom === "perigo";

  return (
    <ContextoFormulario.Provider
      value={{ pendente, comConfirmacao: Boolean(confirmacao), pedirConfirmacao }}
    >
      <form
        ref={formRef}
        id={id}
        aria-labelledby={rotuloId}
        onSubmit={aoEnviar}
        className={className}
      >
        {children}

        {confirmacao && (
          <dialog
            ref={dialogoRef}
            aria-labelledby={idTitulo}
            aria-describedby={resumo?.descricao ? idDescricao : undefined}
            onClose={() => setAberto(false)}
            onCancel={(evento) => pendente && evento.preventDefault()}
            className="animate-pop-in m-auto w-[calc(100%-2rem)] max-w-md rounded-lg border border-line bg-surface p-0 text-ink shadow-[0_24px_60px_-20px_rgb(14_21_32/0.5)] backdrop:bg-ink/50"
          >
            {aberto && resumo && (
              <div className="flex flex-col gap-5 p-6">
                <div className="flex items-start gap-3.5">
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${
                      perigo ? "bg-danger-soft text-danger-ink" : "bg-brand-soft text-brand-ink"
                    }`}
                  >
                    {perigo ? (
                      <ShieldAlert className="h-5 w-5" aria-hidden />
                    ) : (
                      <ShieldCheck className="h-5 w-5" aria-hidden />
                    )}
                  </span>
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <h2 id={idTitulo} className="text-xl leading-tight font-extrabold tracking-tight">
                      {resumo.titulo}
                    </h2>
                    {resumo.descricao && (
                      <p id={idDescricao} className="text-sm leading-relaxed text-ink-2">
                        {resumo.descricao}
                      </p>
                    )}
                  </div>
                </div>

                {resumo.detalhes.length > 0 && (
                  <ul className="flex flex-col gap-2 rounded-md border border-line bg-sunken/60 px-4 py-3 text-sm text-ink-2">
                    {resumo.detalhes.map((linha) => (
                      <li key={linha} className="flex items-start gap-2.5">
                        <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-ink-faint" />
                        {linha}
                      </li>
                    ))}
                  </ul>
                )}

                {resumo.exigeSenha && resumo.segundoFator === "ausente" && (
                  <Aviso
                    tom="atencao"
                    acao={
                      <Link href="/painel/conta" className={botaoSecundario}>
                        {t("segundoFatorAtivar")}
                      </Link>
                    }
                  >
                    <p className="font-semibold">{t("segundoFatorTitulo")}</p>
                    <p>{t("segundoFatorExplicacao")}</p>
                  </Aviso>
                )}

                {resumo.exigeSenha && resumo.segundoFator !== "ausente" && (
                  <Campo id={`${idTitulo}-senha`} rotulo={t("senhaRotulo")} dica={t("senhaDica")}>
                    <input
                      id={`${idTitulo}-senha`}
                      type="password"
                      name={CAMPO_SENHA_CONFIRMACAO}
                      required
                      autoComplete="current-password"
                      className={campoInput}
                    />
                  </Campo>
                )}

                {resumo.exigeSenha && resumo.segundoFator === "ativo" && (
                  <Campo
                    id={`${idTitulo}-codigo`}
                    rotulo={t("codigoRotulo")}
                    dica={t("codigoDica")}
                  >
                    <input
                      id={`${idTitulo}-codigo`}
                      type="text"
                      name={CAMPO_CODIGO_CONFIRMACAO}
                      required
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      className={`${campoInput} font-mono tracking-widest`}
                    />
                  </Campo>
                )}

                {erroDialogo && <Aviso tom="erro">{erroDialogo}</Aviso>}

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    disabled={pendente}
                    onClick={() => setAberto(false)}
                    className={botaoSecundario}
                  >
                    {t("cancelar")}
                  </button>
                  <button
                    type="submit"
                    data-confirmacao="sim"
                    disabled={pendente || (resumo.exigeSenha && resumo.segundoFator === "ausente")}
                    aria-busy={pendente}
                    className={perigo ? botaoPerigoSolido : botaoPrimario}
                  >
                    {pendente && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />}
                    {resumo.confirmar}
                  </button>
                </div>
              </div>
            )}
          </dialog>
        )}
      </form>
    </ContextoFormulario.Provider>
  );
}

// Botão de envio de um FormularioAcao. Sem confirmação configurada é um submit
// comum; com ela, só valida o formulário e abre o diálogo. Enquanto a ação roda
// fica desabilitado e mostra o indicador - clique duplo não duplica o efeito.
export function BotaoAcao({
  children,
  className,
  titulo,
  desabilitado = false,
  pressionado,
}: {
  children: ReactNode;
  className?: string;
  titulo?: string;
  desabilitado?: boolean;
  // Botão de alternar (aria-pressed): "também sofro com isso" marcado ou não.
  pressionado?: boolean;
}) {
  const { pendente, comConfirmacao, pedirConfirmacao } = useContext(ContextoFormulario);

  return (
    <button
      type={comConfirmacao ? "button" : "submit"}
      onClick={comConfirmacao ? pedirConfirmacao : undefined}
      aria-haspopup={comConfirmacao ? "dialog" : undefined}
      aria-pressed={pressionado}
      disabled={pendente || desabilitado}
      aria-busy={pendente}
      title={titulo}
      className={className}
    >
      {pendente && !comConfirmacao && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}
