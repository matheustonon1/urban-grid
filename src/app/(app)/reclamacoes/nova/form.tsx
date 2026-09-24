"use client";

import { useActionState, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { SeletorCidade } from "@/components/cidade-combobox";
import { botaoPrimario, campoInput, cartao } from "@/lib/estilos";

import { criarReclamacao } from "./actions";

interface Categoria {
  id: string;
  nome: string;
}

interface CidadeResultado {
  id: string;
  nome: string;
  uf: string;
}

export function NovaReclamacaoForm({
  categorias,
}: {
  categorias: Categoria[];
}) {
  const t = useTranslations("NovaReclamacao");
  const [state, action, pending] = useActionState(criarReclamacao, undefined);
  const enderecoRef = useRef<HTMLInputElement>(null);
  const bairroRef = useRef<HTMLInputElement>(null);
  const [cidadeAutoPreenchida, setCidadeAutoPreenchida] =
    useState<CidadeResultado | null>(null);
  const [statusCep, setStatusCep] = useState<
    "idle" | "buscando" | "nao-encontrado"
  >("idle");
  const [previews, setPreviews] = useState<string[]>([]);

  function selecionarImagens(arquivos: FileList | null) {
    previews.forEach((url) => URL.revokeObjectURL(url));
    setPreviews(arquivos ? Array.from(arquivos).map((arquivo) => URL.createObjectURL(arquivo)) : []);
  }

  async function buscarCep(valorDigitado: string) {
    const cep = valorDigitado.replace(/\D/g, "");
    if (cep.length !== 8) {
      setStatusCep("idle");
      return;
    }

    setStatusCep("buscando");
    try {
      const resposta = await fetch(`/api/cep?cep=${cep}`);
      const dados = await resposta.json();

      if (dados.erro) {
        setStatusCep("nao-encontrado");
        return;
      }

      setStatusCep("idle");
      if (enderecoRef.current && dados.logradouro) {
        enderecoRef.current.value = dados.logradouro;
      }
      if (bairroRef.current && dados.bairro) {
        bairroRef.current.value = dados.bairro;
      }
      if (dados.cidade) {
        setCidadeAutoPreenchida(dados.cidade);
      }
    } catch {
      setStatusCep("nao-encontrado");
    }
  }

  return (
    <form action={action} className={`flex flex-col gap-5 ${cartao}`}>
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
          {t("sobreProblema")}
        </h2>

        <input
          type="text"
          name="titulo"
          placeholder={t("titulo")}
          className={campoInput}
        />
        {state?.erros?.titulo && (
          <p className="text-sm text-red-600 dark:text-red-400">{state.erros.titulo[0]}</p>
        )}

        <textarea
          name="descricao"
          placeholder={t("descrevaProblema")}
          rows={5}
          className={campoInput}
        />
        {state?.erros?.descricao && (
          <p className="text-sm text-red-600 dark:text-red-400">{state.erros.descricao[0]}</p>
        )}

        <select name="categoriaId" defaultValue="" className={campoInput}>
          <option value="" disabled>
            {t("categoria")}
          </option>
          {categorias.map((categoria) => (
            <option key={categoria.id} value={categoria.id}>
              {categoria.nome}
            </option>
          ))}
        </select>
        {state?.erros?.categoriaId && (
          <p className="text-sm text-red-600 dark:text-red-400">{state.erros.categoriaId[0]}</p>
        )}
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
        <h2 className="text-sm font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
          {t("localizacao")}
        </h2>

        <input
          type="text"
          name="cep"
          required
          placeholder={t("cep")}
          onChange={(evento) => buscarCep(evento.target.value)}
          className={campoInput}
        />
        {statusCep === "buscando" && (
          <p className="text-sm text-slate-500 dark:text-slate-400">{t("buscandoEndereco")}</p>
        )}
        {statusCep === "nao-encontrado" && (
          <p className="text-sm text-amber-600 dark:text-amber-400">{t("cepNaoEncontrado")}</p>
        )}
        {state?.erros?.cep && (
          <p className="text-sm text-red-600 dark:text-red-400">{state.erros.cep[0]}</p>
        )}

        <SeletorCidade
          key={cidadeAutoPreenchida?.id ?? "manual"}
          required
          placeholder={t("cidade")}
          defaultValue={cidadeAutoPreenchida}
        />
        {state?.erros?.cidadeId && (
          <p className="text-sm text-red-600 dark:text-red-400">{state.erros.cidadeId[0]}</p>
        )}

        <input
          ref={enderecoRef}
          type="text"
          name="endereco"
          placeholder={t("endereco")}
          className={campoInput}
        />
        {state?.erros?.endereco && (
          <p className="text-sm text-red-600 dark:text-red-400">{state.erros.endereco[0]}</p>
        )}

        <input
          ref={bairroRef}
          type="text"
          name="bairro"
          placeholder={t("bairro")}
          className={campoInput}
        />
        {state?.erros?.bairro && (
          <p className="text-sm text-red-600 dark:text-red-400">{state.erros.bairro[0]}</p>
        )}

        <input
          type="text"
          name="referencia"
          placeholder={t("referencia")}
          className={campoInput}
        />
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
        <h2 className="text-sm font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
          {t("fotos")}
        </h2>

        <input
          type="file"
          name="imagens"
          multiple
          accept="image/jpeg,image/png,image/webp"
          onChange={(evento) => selecionarImagens(evento.target.files)}
          className="text-sm text-slate-600 dark:text-slate-400"
        />
        <p className="text-xs text-slate-400 dark:text-slate-500">{t("ateCincoFotos")}</p>

        {previews.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {previews.map((url) => (
              // eslint-disable-next-line @next/next/no-img-element -- preview local via object URL, não é ativo do Next
              <img
                key={url}
                src={url}
                alt=""
                className="h-20 w-20 rounded-lg border border-slate-200 object-cover dark:border-slate-700"
              />
            ))}
          </div>
        )}
      </div>

      <label className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
        <input
          type="checkbox"
          name="declaracaoVeracidade"
          required
          className="mt-0.5"
        />
        <span>{t("declaracaoVeracidade")}</span>
      </label>
      {state?.erros?.declaracaoVeracidade && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.erros.declaracaoVeracidade[0]}</p>
      )}

      {state?.mensagem && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.mensagem}</p>
      )}

      <button type="submit" disabled={pending} className={botaoPrimario}>
        {t("enviarReclamacao")}
      </button>
    </form>
  );
}
