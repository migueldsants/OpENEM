import type { ReactNode } from 'react';
import {
  ROTULO_ESTADO,
  evParaKjMol,
  grupoTexto,
  massaCurta,
  numeroBr,
  rotuloCategoria,
  type Elemento,
} from '../../lib/elementos';
import { formatarAbreviada, lerConfiguracao } from '../../lib/configuracao-eletronica';
import { Expoentes } from './Expoentes';

interface Linha {
  rotulo: string;
  valor: (e: Elemento) => ReactNode;
  /** Para marcar quem tem mais: o número comparável, se houver. */
  numero?: (e: Elemento) => number | null;
}

const desconhecido = <span className="text-muted">desconhecido</span>;

const LINHAS: Linha[] = [
  { rotulo: 'Número atômico', valor: (e) => e.z, numero: (e) => e.z },
  { rotulo: 'Massa atômica', valor: massaCurta, numero: (e) => Number(e.massa.abreviado?.valor ?? e.massa.numeroMassa) },
  { rotulo: 'Categoria', valor: rotuloCategoria },
  { rotulo: 'Período e grupo', valor: (e) => `${e.periodo} · ${grupoTexto(e)}` },
  { rotulo: 'Configuração', valor: (e) => <Expoentes texto={formatarAbreviada(lerConfiguracao(e.configuracao))} /> },
  {
    rotulo: 'Eletronegatividade',
    valor: (e) => (e.eletronegatividade ? numeroBr(e.eletronegatividade.valor) : desconhecido),
    numero: (e) => e.eletronegatividade?.valor ?? null,
  },
  {
    rotulo: 'Raio covalente',
    valor: (e) => (e.raio ? `${e.raio.valor} pm` : desconhecido),
    numero: (e) => e.raio?.valor ?? null,
  },
  {
    rotulo: '1ª energia de ionização',
    valor: (e) => (e.energiaIonizacao ? `${numeroBr(evParaKjMol(Number(e.energiaIonizacao.ev)), 0)} kJ/mol` : desconhecido),
    numero: (e) => (e.energiaIonizacao ? Number(e.energiaIonizacao.ev) : null),
  },
  {
    rotulo: 'Afinidade eletrônica',
    valor: (e) =>
      e.afinidade == null ? desconhecido : 'anionInstavel' in e.afinidade ? 'sem ânion estável' : `${numeroBr(evParaKjMol(e.afinidade.ev), 0)} kJ/mol`,
  },
  {
    rotulo: 'Densidade',
    valor: (e) => (e.densidade ? `${numeroBr(e.densidade.valor, e.densidade.valor < 0.1 ? 6 : 3)} g/cm³` : desconhecido),
    numero: (e) => e.densidade?.valor ?? null,
  },
  {
    rotulo: 'Fusão',
    valor: (e) => (e.fusao ? `${numeroBr(e.fusao.k - 273.15, 1)} °C` : desconhecido),
    numero: (e) => e.fusao?.k ?? null,
  },
  {
    rotulo: 'Ebulição',
    valor: (e) => (e.ebulicao ? `${numeroBr(e.ebulicao.k - 273.15, 1)} °C` : desconhecido),
    numero: (e) => e.ebulicao?.k ?? null,
  },
  { rotulo: 'Estado a 25 °C', valor: (e) => (e.estado ? ROTULO_ESTADO[e.estado] : desconhecido) },
  { rotulo: 'Estados de oxidação comuns', valor: (e) => (e.oxidacao.comuns.length ? e.oxidacao.comuns.map((o) => (o > 0 ? `+${o}` : `−${-o}`)).join(', ') : '—') },
];

function Escolha({ lista, valor, onMudar, rotulo }: { lista: Elemento[]; valor: number; onMudar: (z: number) => void; rotulo: string }) {
  return (
    <label className="block min-w-0 text-xs font-medium text-muted">
      {rotulo}
      <select className="input mt-1" value={valor} onChange={(ev) => onMudar(Number(ev.target.value))}>
        {lista.map((x) => (
          <option key={x.z} value={x.z}>
            {x.z} · {x.simbolo} · {x.nome}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Dois elementos lado a lado, com o maior valor de cada propriedade em negrito. */
export function Comparar({
  lista,
  a,
  b,
  onA,
  onB,
}: {
  lista: Elemento[];
  a: number;
  b: number;
  onA: (z: number) => void;
  onB: (z: number) => void;
}) {
  const ea = lista.find((e) => e.z === a) ?? lista[0];
  const eb = lista.find((e) => e.z === b) ?? lista[1];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:max-w-xl">
        <Escolha lista={lista} valor={ea.z} onMudar={onA} rotulo="Primeiro" />
        <Escolha lista={lista} valor={eb.z} onMudar={onB} rotulo="Segundo" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[30rem] text-sm">
          <caption className="sr-only">
            {ea.nome} comparado com {eb.nome}
          </caption>
          <thead>
            <tr className="border-b border-line text-left">
              <th scope="col" className="w-2/5 pb-2 text-xs font-medium text-muted">
                Propriedade
              </th>
              {[ea, eb].map((e) => (
                <th key={e.z} scope="col" className="pb-2">
                  <span className="font-display text-lg font-bold">{e.simbolo}</span>{' '}
                  <span className="font-normal text-muted">{e.nome}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {LINHAS.map((l) => {
              const na = l.numero?.(ea) ?? null;
              const nb = l.numero?.(eb) ?? null;
              const maior = na != null && nb != null && na !== nb ? (na > nb ? ea.z : eb.z) : null;
              return (
                <tr key={l.rotulo}>
                  <th scope="row" className="py-2 pr-3 text-left text-xs font-medium text-muted">
                    {l.rotulo}
                  </th>
                  {[ea, eb].map((e) => (
                    <td key={e.z} className={`py-2 pr-3 font-data tabular-nums ${maior === e.z ? 'font-bold' : ''}`}>
                      {l.valor(e)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">Em negrito, o maior valor de cada propriedade numérica.</p>
    </div>
  );
}

