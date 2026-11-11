import { Line } from '@react-three/drei';
import { useMemo, useState } from 'react';
import * as THREE from 'three';
import {
  BASES,
  complementar,
  conteudoGC,
  contagemDupla,
  efeitoMutacao,
  limparSequencia,
  NOME_AMINOACIDO,
  PARES_POR_VOLTA,
  posicaoPar,
  SUBIDA_NM,
  traduzir,
  transcrever,
  type Base,
} from '../../../lib/simulacoes/dna';
import { criarRng, fmt } from '../../../lib/simulacoes/numerico';
import { Palco3D } from '../Palco3D';
import { Alternar, Deslizador, Explicacao, LayoutSim, Leituras } from '../ui';

/** Uma cor por base (A–T e C–G em pares de cores que se distinguem também sem cor, pela legenda). */
const COR_BASE: Record<Base, string> = { A: '#22c55e', T: '#ef4444', C: '#3b82f6', G: '#f59e0b' };
const CIMA = new THREE.Vector3(0, 1, 0);
const INICIAL = 'ATGGCCAAATTTGGCTGGTAG';
const MAX = 36;

function Bastao({ de, para, cor, raio = 0.12, onClick }: { de: THREE.Vector3; para: THREE.Vector3; cor: string; raio?: number; onClick?: () => void }) {
  const dir = para.clone().sub(de);
  const comp = dir.length();
  const quat = new THREE.Quaternion().setFromUnitVectors(CIMA, dir.normalize());
  return (
    <mesh
      position={de.clone().add(para).multiplyScalar(0.5)}
      quaternion={quat}
      onClick={
        onClick
          ? (e) => {
              e.stopPropagation();
              onClick();
            }
          : undefined
      }
    >
      <cylinderGeometry args={[raio, raio, comp, 12]} />
      <meshStandardMaterial color={cor} roughness={0.45} />
    </mesh>
  );
}

function Helice({ seq, sel, onSel }: { seq: string; sel: number; onSel: (i: number) => void }) {
  const meio = ((seq.length - 1) * SUBIDA_NM) / 2;
  const pares = useMemo(
    () =>
      [...seq].map((b, i) => {
        const p = posicaoPar(i);
        return { base: b as Base, f1: new THREE.Vector3(p.fita1[0], p.y - meio, p.fita1[2]), f2: new THREE.Vector3(p.fita2[0], p.y - meio, p.fita2[2]) };
      }),
    [seq, meio],
  );
  // Esqueletos açúcar-fosfato: curvas suaves passando pelos pontos de cada par.
  const fita = (k: 'f1' | 'f2') => {
    const pts: [number, number, number][] = [];
    for (let i = 0; i < seq.length - 1; i += 0.125) {
      const j = Math.floor(i);
      const f = i - j;
      const a = posicaoPar(j + f);
      const p = k === 'f1' ? a.fita1 : a.fita2;
      pts.push([p[0], a.y - meio, p[2]]);
    }
    const ult = posicaoPar(seq.length - 1);
    const p = k === 'f1' ? ult.fita1 : ult.fita2;
    pts.push([p[0], ult.y - meio, p[2]]);
    return pts;
  };
  return (
    <group>
      {seq.length > 1 && (
        <>
          <Line points={fita('f1')} color="#cbd5e1" lineWidth={5} />
          <Line points={fita('f2')} color="#94a3b8" lineWidth={5} />
        </>
      )}
      {pares.map((p, i) => {
        const centro = p.f1.clone().add(p.f2).multiplyScalar(0.5);
        const par = complementar(p.base) as Base;
        const destaque = i === sel;
        return (
          <group key={i}>
            <Bastao de={p.f1} para={centro} cor={COR_BASE[p.base]} raio={destaque ? 0.16 : 0.11} onClick={() => onSel(i)} />
            <Bastao de={centro} para={p.f2} cor={COR_BASE[par]} raio={destaque ? 0.16 : 0.11} onClick={() => onSel(i)} />
            {[p.f1, p.f2].map((f, k) => (
              <mesh key={k} position={f}>
                <sphereGeometry args={[0.16, 16, 16]} />
                <meshStandardMaterial color={destaque ? '#f2587a' : '#e2e8f0'} roughness={0.4} />
              </mesh>
            ))}
          </group>
        );
      })}
    </group>
  );
}

const CODONS_SORTEIO = ['GCC', 'AAA', 'TTT', 'GGC', 'TGG', 'CAT', 'GAA', 'CTG', 'AGC', 'GTT', 'CCA', 'ACG', 'TAC', 'GAT', 'CGT', 'ATC'];

function sortearGene(semente: number) {
  const r = criarRng(semente);
  const n = 4 + Math.floor(r() * 5);
  let s = 'ATG';
  for (let i = 0; i < n; i++) s += CODONS_SORTEIO[Math.floor(r() * CODONS_SORTEIO.length)];
  return s + ['TAA', 'TAG', 'TGA'][Math.floor(r() * 3)];
}

/** Sequência em códons, a partir do início da leitura. */
function emCodons(s: string, inicio: number) {
  const grupos: string[] = [];
  if (inicio > 0) grupos.push(s.slice(0, inicio));
  for (let i = Math.max(0, inicio); i < s.length; i += 3) grupos.push(s.slice(i, i + 3));
  return grupos;
}

export default function DNA() {
  const [seq, setSeq] = useState(INICIAL);
  const [texto, setTexto] = useState(INICIAL);
  const [sel, setSel] = useState(4);
  const [girar, setGirar] = useState(true);
  const [aviso, setAviso] = useState<string | null>(null);
  const [semente, setSemente] = useState(7);
  const rna = transcrever(seq);
  const trad = traduzir(rna);
  const cont = contagemDupla(seq);
  const molde = complementar(seq);
  const selValida = Math.min(sel, seq.length - 1);

  const aplicar = (s: string) => {
    const limpa = limparSequencia(s).slice(0, MAX);
    if (limpa.length < 2) return;
    setSeq(limpa);
    setTexto(limpa);
    setSel((i) => Math.min(i, limpa.length - 1));
    setAviso(null);
  };
  const mutar = (b: Base) => {
    if (seq[selValida] === b) return;
    const efeito = efeitoMutacao(seq, selValida, b);
    const nova = seq.slice(0, selValida) + b + seq.slice(selValida + 1);
    setSeq(nova);
    setTexto(nova);
    setAviso(`Posição ${selValida + 1}: ${seq[selValida]} → ${b}. Mutação ${efeito}.`);
  };

  return (
    <div className="lg:h-full">
      <LayoutSim
        palco={
          <Palco3D rotulo={`Dupla hélice de DNA com ${seq.length} pares de bases`} camera={[0, 0, Math.max(9, seq.length * 0.42)]} distancia={[3, 30]} autoGirar={girar} parado={!girar}>
            <ambientLight intensity={0.6} />
            <directionalLight position={[4, 6, 6]} intensity={1.4} />
            <directionalLight position={[-5, -2, -4]} intensity={0.4} />
            <group rotation={[0, 0, Math.PI / 2]}>
              <Helice seq={seq} sel={selValida} onSel={setSel} />
            </group>
          </Palco3D>
        }
        leituras={
          <Leituras
            itens={[
              { rotulo: 'Pares de bases', valor: String(seq.length) },
              { rotulo: 'Voltas da hélice', valor: fmt(seq.length / PARES_POR_VOLTA, 1), nota: '10,5 pares por volta' },
              { rotulo: 'Comprimento', valor: `${fmt(seq.length * SUBIDA_NM, 1)} nm` },
              { rotulo: 'C + G', valor: `${fmt(conteudoGC(seq) * 100, 0)}%`, nota: 'C–G tem 3 pontes de hidrogênio, A–T tem 2' },
              { rotulo: 'A = T · C = G', valor: `${cont.A} = ${cont.T} · ${cont.C} = ${cont.G}`, nota: 'regra de Chargaff, nas duas fitas' },
              { rotulo: 'Proteína', valor: trad.inicio < 0 ? 'sem AUG' : `${trad.aminoacidos.length} aminoácidos` },
            ]}
          />
        }
        rotuloExtra="Do gene à proteína"
        extra={
          <div className="space-y-3 text-sm">
            {[
              { rotulo: "Fita codificadora (5'→3')", s: seq },
              { rotulo: "Fita molde (3'→5')", s: molde },
              { rotulo: "RNA mensageiro (5'→3')", s: rna },
            ].map((l) => (
              <div key={l.rotulo}>
                <p className="mb-1 text-xs text-muted">{l.rotulo}</p>
                <p className="flex flex-wrap gap-x-1.5 gap-y-0.5 font-data text-sm font-semibold break-all">
                  {emCodons(l.s, trad.inicio).map((c, i) => (
                    <span key={i}>
                      {[...c].map((b, k) => (
                        <span key={k} style={{ color: COR_BASE[(b === 'U' ? 'T' : b) as Base] }}>
                          {b}
                        </span>
                      ))}
                    </span>
                  ))}
                </p>
              </div>
            ))}
            <div>
              <p className="mb-1 text-xs text-muted">Proteína (do primeiro AUG até a parada)</p>
              {trad.inicio < 0 ? (
                <p className="text-xs text-muted">Sem códon de início (AUG): o ribossomo não começa a tradução.</p>
              ) : (
                <ul className="flex flex-wrap gap-1">
                  {trad.aminoacidos.map((a, i) => (
                    <li key={i} className="chip font-data" title={NOME_AMINOACIDO[a]}>
                      {a}
                    </li>
                  ))}
                  <li className="chip text-muted">{trad.parou ? 'parada' : 'sem parada'}</li>
                </ul>
              )}
            </div>
          </div>
        }
        controles={
          <>
            <div className="space-y-1.5">
              <label htmlFor="dna-seq" className="text-sm font-medium">
                Fita codificadora
              </label>
              <div className="flex gap-2">
                <input
                  id="dna-seq"
                  className="input font-data uppercase"
                  value={texto}
                  maxLength={MAX}
                  spellCheck={false}
                  onChange={(e) => setTexto(e.target.value.toUpperCase().replace(/[^ATCG]/g, ''))}
                  onKeyDown={(e) => e.key === 'Enter' && aplicar(texto)}
                />
                <button type="button" className="btn btn-ghost shrink-0" onClick={() => aplicar(texto)} disabled={texto === seq || texto.length < 2}>
                  Montar
                </button>
              </div>
              <button
                type="button"
                className="text-xs font-semibold text-muted hover:text-fg"
                onClick={() => {
                  const s = semente + 1;
                  setSemente(s);
                  aplicar(sortearGene(s));
                }}
              >
                Sortear outro gene
              </button>
            </div>
            <Deslizador rotulo="Base selecionada" valor={selValida + 1} min={1} max={seq.length} onChange={(v) => setSel(v - 1)} dica="Ou toque num degrau da hélice." />
            <div className="space-y-1.5">
              <p className="text-sm font-medium">
                Trocar a base {selValida + 1} ({seq[selValida]}) por
              </p>
              <div className="grid grid-cols-4 gap-1.5">
                {BASES.map((b) => (
                  <button key={b} type="button" className="btn btn-ghost font-data" disabled={seq[selValida] === b} onClick={() => mutar(b)} style={{ color: COR_BASE[b] }}>
                    {b}
                  </button>
                ))}
              </div>
              {aviso && (
                <p role="status" className="text-xs text-muted">
                  {aviso}
                </p>
              )}
            </div>
            <Alternar rotulo="Girar sozinha" marcado={girar} onChange={setGirar} />
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
              {BASES.map((b) => (
                <span key={b} className="flex items-center gap-1">
                  <span className="size-2.5 rounded-full" style={{ background: COR_BASE[b] }} />
                  {b} ({{ A: 'adenina', T: 'timina', C: 'citosina', G: 'guanina' }[b]})
                </span>
              ))}
            </div>
          </>
        }
      />
      <Explicacao
        enem={'Questões clássicas: completar a **fita complementar** (A–T, C–G; no RNA, A–U), calcular a porcentagem de bases pela **regra de Chargaff** (se há 30% de A, há 30% de T e 20% de C e de G), contar **aminoácidos** a partir dos códons e dizer o efeito de uma **mutação pontual**: o código é **degenerado** (vários códons para o mesmo aminoácido), por isso muitas trocas não mudam a proteína.'}
      >
        {`O DNA é uma **dupla hélice**: dois esqueletos de açúcar e fosfato (as fitas claras) ligados por pares de bases nitrogenadas, os degraus. A adenina sempre pareia com a timina (2 pontes de hidrogênio) e a citosina com a guanina (3 pontes). As fitas são **antiparalelas**: uma vai de 5' para 3', a outra ao contrário. Na forma B, a mais comum, há 10,5 pares por volta e 0,34 nm entre um par e o próximo.

Do gene à proteína são dois passos. Na **transcrição**, a RNA polimerase lê a fita molde e monta o RNA mensageiro, igual à fita codificadora com U no lugar de T. Na **tradução**, o ribossomo lê o RNA de três em três bases (os **códons**), a partir do AUG de início, e cada códon chama um aminoácido até um códon de parada.

Toque num degrau e troque a base: a simulação diz se a mutação é **silenciosa** (o novo códon pede o mesmo aminoácido), troca um aminoácido ou cria uma parada antes da hora (**sem sentido**), que corta a proteína.`}
      </Explicacao>
    </div>
  );
}
