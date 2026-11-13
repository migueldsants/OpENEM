import type { StudyResource } from '../api';
import { IconArrowRight, IconTranslate } from './icons';
import {
  dataCurta,
  hostDe,
  linkSeguro,
  ROTULO_IDIOMA,
  ROTULO_INSTITUICAO,
  ROTULO_TIPO,
} from '../lib/onde-estudar';

/**
 * Um material gratuito de outra instituição (Onde estudar e página da
 * matéria). O link só existe se for https e abre numa aba nova, sem enviar o
 * endereço do app (`noreferrer`) e sem passar autoridade (`nofollow`).
 */
export function MaterialCard({
  recurso: r,
  discreto = false,
}: {
  recurso: StudyResource;
  /** Botão sem preenchimento, para quando a página já tem outra ação principal. */
  discreto?: boolean;
}) {
  const href = linkSeguro(r.url);
  const host = hostDe(r.url);
  const idioma = ROTULO_IDIOMA[r.language];
  return (
    <article className="card flex h-full flex-col gap-3 p-4 sm:p-5">
      <div className="min-w-0">
        <h3 className="font-display font-bold leading-snug">{r.title}</h3>
        <p className="mt-0.5 text-xs text-muted">
          {r.provider.name} · {ROTULO_INSTITUICAO[r.provider.kind]}
        </p>
      </div>

      <p className="text-sm text-muted text-pretty">{r.description}</p>

      <ul className="flex flex-wrap gap-2" aria-label="Tipo de material">
        {r.types.map((t) => (
          <li key={t} className="chip">
            {ROTULO_TIPO[t]}
          </li>
        ))}
        {/* Idioma é conteúdo, não seleção: chip neutro com o ícone, sem o rosa. */}
        {idioma && (
          <li className="chip inline-flex items-center gap-1 font-semibold text-fg">
            <IconTranslate width={14} height={14} aria-hidden />
            {idioma}
          </li>
        )}
      </ul>

      {r.topics.length > 0 && (
        <p className="text-xs text-muted">
          <span className="font-semibold text-fg">Assuntos:</span> {r.topics.join(', ')}
        </p>
      )}

      <details className="text-xs text-muted">
        <summary className="cursor-pointer select-none font-semibold text-fg">
          Por que é gratuito
        </summary>
        <p className="mt-1.5 text-pretty">{r.provider.about}</p>
      </details>

      {/* Quebra em vez de empurrar: host longo (learnenglishteens.britishcouncil.org)
          numa coluna estreita jogava o botão para fora do cartão. */}
      <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-line pt-3">
        {/* A base é a largura do próprio texto: endereço curto fica ao lado do
            botão, e o longo joga o botão para a linha de baixo. Se nem a linha
            inteira couber, ele quebra depois de um ponto, nunca no meio. */}
        <p className="min-w-0 flex-auto text-xs text-muted">
          <span className="block font-data">
            {host.split('.').map((parte, i) => (
              <span key={i}>
                {i > 0 && (
                  <>
                    .<wbr />
                  </>
                )}
                {parte}
              </span>
            ))}
          </span>
          <span className="block">
            Conferido em <span className="font-data tabular-nums">{dataCurta(r.checkedAt)}</span>
          </span>
        </p>
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer nofollow"
            referrerPolicy="no-referrer"
            className={`btn ${discreto ? 'btn-ghost' : 'btn-primary'} ml-auto shrink-0 justify-center`}
            aria-label={`Abrir ${r.title} em ${host} (sai do OpENEM, numa nova aba)`}
          >
            Abrir no site
            <IconArrowRight width={16} height={16} aria-hidden />
          </a>
        ) : (
          <p className="text-xs text-muted">Link indisponível</p>
        )}
      </div>
    </article>
  );
}
