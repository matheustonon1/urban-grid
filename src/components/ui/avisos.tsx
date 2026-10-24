"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";

import { TONS_AVISO, type TomAviso } from "./aviso";

// Avisos flutuantes ("toasts") do site inteiro: confirmação do que acabou de
// acontecer - "Papel de Ana alterado para Moderador", "Reclamação publicada" - ou
// do que não deu certo. Moram no layout raiz, não na página: a ação costuma
// revalidar a lista e o cartão que a disparou some junto, e um aviso preso a ele
// sumiria antes de ser lido.
//
// - Sucesso e informação saem sozinhos (7 s, pausam com o mouse ou o foco em cima);
//   erro e atenção ficam até serem fechados, porque quem errou precisa ler.
// - Duas regiões ao vivo permanentes: "status" (educada, não interrompe) e "alert"
//   (assertiva). Uma região que já existe no DOM é anunciada de forma confiável;
//   criar a região junto com a mensagem, não.

export interface NovoAviso {
  tipo: TomAviso;
  mensagem: string;
}

interface Entrada extends NovoAviso {
  id: number;
}

const DURACAO_MS = 7000;
const MAXIMO_NA_TELA = 4;

const ContextoAvisos = createContext<{ notificar: (aviso: NovoAviso) => void } | null>(null);

// Fora do provider (um teste isolado, por exemplo) notificar vira um no-op em vez
// de derrubar a tela.
export function useAvisos() {
  return useContext(ContextoAvisos) ?? { notificar: () => {} };
}

export function AvisosProvider({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<Entrada[]>([]);
  const proximoId = useRef(0);

  const notificar = useCallback((aviso: NovoAviso) => {
    const id = ++proximoId.current;
    setAvisos((atuais) => [...atuais, { ...aviso, id }].slice(-MAXIMO_NA_TELA));
  }, []);

  const fechar = useCallback((id: number) => {
    setAvisos((atuais) => atuais.filter((aviso) => aviso.id !== id));
  }, []);

  const valor = useMemo(() => ({ notificar }), [notificar]);

  const educados = avisos.filter((aviso) => aviso.tipo === "sucesso" || aviso.tipo === "info");
  const urgentes = avisos.filter((aviso) => aviso.tipo === "erro" || aviso.tipo === "atencao");

  return (
    <ContextoAvisos.Provider value={valor}>
      {children}
      <div className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-center gap-2 sm:inset-x-auto sm:right-4 sm:items-end">
        <div role="alert" className="flex w-full max-w-sm flex-col gap-2">
          {urgentes.map((aviso) => (
            <ItemAviso key={aviso.id} aviso={aviso} aoFechar={fechar} />
          ))}
        </div>
        <div role="status" aria-live="polite" className="flex w-full max-w-sm flex-col gap-2">
          {educados.map((aviso) => (
            <ItemAviso key={aviso.id} aviso={aviso} aoFechar={fechar} />
          ))}
        </div>
      </div>
    </ContextoAvisos.Provider>
  );
}

function ItemAviso({ aviso, aoFechar }: { aviso: Entrada; aoFechar: (id: number) => void }) {
  const t = useTranslations("Acao");
  const [pausado, setPausado] = useState(false);
  const { caixa, icone: Icone } = TONS_AVISO[aviso.tipo];
  const some = aviso.tipo === "sucesso" || aviso.tipo === "info";

  useEffect(() => {
    if (!some || pausado) return;
    const timer = setTimeout(() => aoFechar(aviso.id), DURACAO_MS);
    return () => clearTimeout(timer);
  }, [some, pausado, aviso.id, aoFechar]);

  return (
    <div
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
      onFocus={() => setPausado(true)}
      onBlur={() => setPausado(false)}
      className={`animate-fade-in pointer-events-auto flex items-start gap-3 rounded-md border px-3.5 py-3 text-sm shadow-lg ${caixa}`}
    >
      <Icone className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <p className="min-w-0 flex-1 leading-snug font-medium">{aviso.mensagem}</p>
      <button
        type="button"
        onClick={() => aoFechar(aviso.id)}
        aria-label={t("fecharAviso")}
        className="-m-1 shrink-0 rounded p-1 opacity-70 transition hover:bg-ink/10 hover:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-current"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
