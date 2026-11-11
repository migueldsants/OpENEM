import { Html } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import { useState } from 'react';
import { totalCubos, vistas, vistasIguais, type Pilhas, type Vistas } from '../../../lib/simulacoes/matematica';
import { Palco3D } from '../Palco3D';
import { Explicacao, LayoutSim, Leituras, Segmentos } from '../ui';

const N = 4;
const ALTURA_MAX = 4;
const vazio = (): Pilhas => Array.from({ length: N }, () => new Array<number>(N).fill(0));
const de = (linhas: number[][]): Pilhas => linhas.map((l) => [...l]);

/** Desafios: o aluno vê só as três vistas e precisa montar um sólido que as produza. */
const DESAFIOS: { nome: string; alvo: Pilhas }[] = [
  { nome: 'Escada', alvo: de([[0, 0, 0, 0], [0, 0, 0, 0], [3, 2, 1, 0], [0, 0, 0, 0]]) },
  { nome: 'Torre com base', alvo: de([[0, 0, 0, 0], [0, 1, 1, 0], [0, 1, 3, 0], [0, 0, 0, 0]]) },
  { nome: 'Em L', alvo: de([[2, 0, 0, 0], [1, 0, 0, 0], [1, 1, 1, 0], [0, 0, 0, 0]]) },
  { nome: 'Degraus cruzados', alvo: de([[0, 0, 1, 0], [0, 1, 2, 0], [1, 2, 3, 0], [0, 0, 0, 0]]) },
];

const pos = (linha: number, col: number, nivel: number): [number, number, number] => [col - (N - 1) / 2, nivel + 0.5, linha - (N - 1) / 2];

function Grade({ v, tipo, alvo }: { v: Vistas; tipo: 'frontal' | 'superior' | 'lateral'; alvo?: Vistas }) {
  const L = 15;
  const cel = (x: number, y: number, cheio: boolean, k: string) => (
    <rect key={k} x={x * L} y={y * L} width={L - 1} height={L - 1} rx={1.5} fill={cheio ? 'currentColor' : 'transparent'} stroke="rgba(148,163,184,0.35)" strokeWidth={0.6} />
  );
  const grades: { titulo: string; w: number; h: number; celulas: [number, number, boolean][] } =
    tipo === 'superior'
      ? { titulo: 'De cima', w: N, h: N, celulas: v.superior.flatMap((l, i) => l.map((c, j) => [j, i, c] as [number, number, boolean])) }
      : tipo === 'frontal'
        ? { titulo: 'De frente', w: N, h: ALTURA_MAX, celulas: v.frontal.flatMap((alt, j) => Array.from({ length: ALTURA_MAX }, (_, k) => [j, ALTURA_MAX - 1 - k, k < alt] as [number, number, boolean])) }
        : // Lado esquerdo: a frente do sólido aparece à direita do desenho.
          { titulo: 'Da esquerda', w: N, h: ALTURA_MAX, celulas: v.lateral.flatMap((alt, i) => Array.from({ length: ALTURA_MAX }, (_, k) => [i, ALTURA_MAX - 1 - k, k < alt] as [number, number, boolean])) };
  const igual = alvo ? JSON.stringify(v[tipo]) === JSON.stringify(alvo[tipo]) : null;
  return (
    <figure className="flex flex-col items-center gap-0.5">
      <svg width={grades.w * L} height={grades.h * L} className={igual === false ? 'text-white/40' : 'text-[#93c5fd]'} aria-hidden>
        {grades.celulas.map(([x, y, c], i) => cel(x, y, c, String(i)))}
      </svg>
      <figcaption className="text-[10px] text-white/75">
        {grades.titulo}
        {igual === true && ' ✓'}
      </figcaption>
    </figure>
  );
}

function PainelVistas({ v, alvo }: { v: Vistas; alvo?: Vistas }) {
  return (
    <div className="pointer-events-none absolute right-2 top-2 flex flex-col gap-2 rounded-xl border border-white/15 bg-black/55 p-2 backdrop-blur-sm">
      {alvo && (
        <div className="space-y-1">
          <p className="text-center text-[10px] font-semibold text-white/85">O desafio</p>
          <div className="flex gap-2 text-[#fcd34d]">
            {(['frontal', 'superior', 'lateral'] as const).map((t) => (
              <AlvoGrade key={t} v={alvo} tipo={t} />
            ))}
          </div>
        </div>
      )}
      <p className="text-center text-[10px] font-semibold text-white/85">{alvo ? 'O seu sólido' : 'As três vistas'}</p>
      <div className="flex gap-2">
        {(['frontal', 'superior', 'lateral'] as const).map((t) => (
          <Grade key={t} v={v} tipo={t} alvo={alvo} />
        ))}
      </div>
    </div>
  );
}

function AlvoGrade({ v, tipo }: { v: Vistas; tipo: 'frontal' | 'superior' | 'lateral' }) {
  const L = 15;
  const celulas: [number, number, boolean][] =
    tipo === 'superior'
      ? v.superior.flatMap((l, i) => l.map((c, j) => [j, i, c] as [number, number, boolean]))
      : (tipo === 'frontal' ? v.frontal : v.lateral).flatMap((alt, j) => Array.from({ length: ALTURA_MAX }, (_, k) => [j, ALTURA_MAX - 1 - k, k < alt] as [number, number, boolean]));
  return (
    <svg width={N * L} height={(tipo === 'superior' ? N : ALTURA_MAX) * L} aria-hidden>
      {celulas.map(([x, y, c], i) => (
        <rect key={i} x={x * L} y={y * L} width={L - 1} height={L - 1} rx={1.5} fill={c ? '#fcd34d' : 'transparent'} stroke="rgba(148,163,184,0.35)" strokeWidth={0.6} />
      ))}
    </svg>
  );
}

export default function Projecoes() {
  const [h, setH] = useState<Pilhas>(() => de([[0, 0, 0, 0], [0, 1, 0, 0], [2, 2, 1, 0], [1, 0, 0, 0]]));
  const [modo, setModo] = useState<'por' | 'tirar'>('por');
  const [desafio, setDesafio] = useState<number | null>(null);
  const v = vistas(h);
  const alvo = desafio !== null ? vistas(DESAFIOS[desafio].alvo) : undefined;
  const acertou = alvo ? vistasIguais(v, alvo) : false;

  const mudar = (linha: number, col: number, delta: number) => {
    if (linha < 0 || col < 0 || linha >= N || col >= N) return;
    const novo = h.map((l) => [...l]);
    novo[linha][col] = Math.max(0, Math.min(ALTURA_MAX, novo[linha][col] + delta));
    setH(novo);
  };

  const clicarCubo = (linha: number, col: number) => (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    // Arrastar para girar a cena não conta como clique.
    if (e.delta > 6) return;
    if (modo === 'tirar') return mudar(linha, col, -1);
    const n = e.face?.normal;
    if (!n || n.y > 0.5) return mudar(linha, col, 1);
    // Clique numa face lateral: o cubo novo vai na pilha vizinha daquele lado.
    mudar(linha + Math.round(n.z), col + Math.round(n.x), 1);
  };

  return (
    <div className="lg:h-full">
      <LayoutSim
        palco={
          <Palco3D rotulo={`Sólido de ${totalCubos(h)} cubos e as suas vistas`} camera={[5.5, 6, 7.5]} distancia={[5, 20]} sobreposicao={<PainelVistas v={v} alvo={alvo} />} parado>
            <ambientLight intensity={0.55} />
            <directionalLight position={[4, 8, 6]} intensity={1.5} />
            <directionalLight position={[-6, 3, -2]} intensity={0.35} />
            {/* Base clicável. */}
            {h.map((l, i) =>
              l.map((_, j) => (
                <mesh key={`b${i}${j}`} position={[j - (N - 1) / 2, 0, i - (N - 1) / 2]} rotation={[-Math.PI / 2, 0, 0]} onClick={(e) => { e.stopPropagation(); if (modo === 'por' && e.delta <= 6) mudar(i, j, 1); }}>
                  <planeGeometry args={[0.96, 0.96]} />
                  <meshStandardMaterial color="#334155" transparent opacity={0.55} />
                </mesh>
              )),
            )}
            {h.flatMap((l, i) =>
              l.flatMap((alt, j) =>
                Array.from({ length: alt }, (_, k) => (
                  <mesh key={`c${i}${j}${k}`} position={pos(i, j, k)} onClick={clicarCubo(i, j)}>
                    <boxGeometry args={[0.98, 0.98, 0.98]} />
                    <meshStandardMaterial color={k === alt - 1 && modo === 'tirar' ? '#f2587a' : '#669dfb'} roughness={0.5} />
                  </mesh>
                )),
              ),
            )}
            <Html position={[0, 0, N / 2 + 0.7]} center>
              <span className="sim-rotulo-3d">frente ↓</span>
            </Html>
            <Html position={[-N / 2 - 0.8, 0, 0]} center>
              <span className="sim-rotulo-3d">esquerda</span>
            </Html>
          </Palco3D>
        }
        leituras={
          <Leituras
            itens={[
              { rotulo: 'Cubos', valor: String(totalCubos(h)) },
              { rotulo: 'Altura máxima', valor: String(Math.max(...v.frontal)) },
              { rotulo: 'Casas ocupadas', valor: String(v.superior.flat().filter(Boolean).length), nota: 'a vista de cima' },
              ...(alvo ? [{ rotulo: 'Desafio', valor: acertou ? 'resolvido!' : 'ainda não', cor: acertou ? 'var(--nat)' : undefined }] : []),
            ]}
          />
        }
        controles={
          <>
            <Segmentos
              rotulo="Ao clicar"
              valor={modo}
              opcoes={[
                { valor: 'por', rotulo: 'Pôr cubo' },
                { valor: 'tirar', rotulo: 'Tirar cubo' },
              ]}
              onChange={setModo}
            />
            <p className="text-xs text-muted text-pretty">
              {modo === 'por'
                ? 'Clique numa casa do chão ou no topo de um cubo para empilhar; na lateral de um cubo, o novo vai para a casa do lado. Arraste para girar a cena.'
                : 'Clique num cubo para tirar o de cima daquela pilha (o vermelho).'}
            </p>
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Desafio: monte um sólido com estas vistas</p>
              <div className="grid grid-cols-2 gap-1.5">
                {DESAFIOS.map((d, i) => (
                  <button key={d.nome} type="button" className="chip justify-center" data-active={desafio === i} onClick={() => { setDesafio(desafio === i ? null : i); setH(vazio()); }}>
                    {d.nome}
                  </button>
                ))}
              </div>
              {alvo && (
                <p role="status" className={`text-xs ${acertou ? 'font-semibold text-[var(--nat)]' : 'text-muted'}`}>
                  {acertou
                    ? `Bateu! As três vistas são iguais às do desafio, com ${totalCubos(h)} cubos. Dá para fazer com menos?`
                    : 'As vistas amarelas são o alvo; as azuis, o seu sólido. Cada vista que já bate ganha um ✓.'}
                </p>
              )}
            </div>
            <button type="button" className="btn btn-ghost w-full" onClick={() => setH(vazio())}>
              Limpar a base
            </button>
          </>
        }
      />
      <Explicacao
        enem={'É uma das questões de geometria mais comuns do ENEM: dada uma peça (um prédio, uma escada, uma caixa de blocos), qual é a **vista de frente, de cima ou de lado**? Ou o contrário: com as vistas, qual é a peça. Pense em cada vista como uma sombra achatada: de frente, só importa a coluna mais alta de cada posição, não importa o que está atrás.'}
      >
        {`Uma **projeção ortográfica** é o desenho de um objeto visto de muito longe, de uma direção só, com as linhas de visão paralelas: cada ponto vai direto para o plano do desenho. O desenho técnico usa três: **frente**, **topo** (de cima) e **lateral**.

Monte o seu sólido clicando e veja as três vistas se atualizarem no canto:

- **De frente**, cada coluna mostra a pilha mais alta daquela coluna, esteja ela na frente ou atrás.
- **De cima**, aparecem só as casas ocupadas, sem altura.
- **Da esquerda**, cada linha mostra a pilha mais alta daquela linha; a frente do sólido fica à direita do desenho.

Por isso **sólidos diferentes podem ter as mesmas vistas**: um cubo escondido atrás de uma pilha mais alta não muda nada. Nos desafios, tente montar com o menor número de cubos possível.`}
      </Explicacao>
    </div>
  );
}
