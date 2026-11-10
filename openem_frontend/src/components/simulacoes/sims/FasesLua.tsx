import { Html, Line } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  eclipseNoDia,
  eclipsesEntre,
  elongacao,
  fracaoIluminada,
  INCLINACAO,
  latitudeLua,
  MES_DRACONICO,
  MES_SINODICO,
  nomeFase,
} from '../../../lib/simulacoes/lua';
import { fmt } from '../../../lib/simulacoes/numerico';
import { usaMovimentoReduzido } from '../canvas';
import { Palco3D } from '../Palco3D';
import { Alternar, BarraExecucao, Deslizador, Explicacao, LayoutSim, Leituras, Segmentos } from '../ui';

/** Dias depois da primeira lua nova em que a Lua cruza o nodo ascendente (o ponto de partida da cena). */
const NODO = 3.1;
const R_ORBITA = 4;
const R_TERRA = 0.6;
const R_LUA = 0.18;
const RAD = Math.PI / 180;

/** Posição da Lua na cena: o Sol fica no eixo +x, longe; a Lua gira no sentido anti-horário visto do norte (+y). */
function posLua(t: number, exagero: number): THREE.Vector3 {
  const e = elongacao(t);
  const beta = latitudeLua(t, NODO) * exagero * RAD;
  return new THREE.Vector3(R_ORBITA * Math.cos(beta) * Math.cos(e), R_ORBITA * Math.sin(beta), -R_ORBITA * Math.cos(beta) * Math.sin(e));
}

/** Ângulo (a partir da direção do Sol) do nodo ascendente no dia t. */
const anguloNodo = (t: number) => elongacao(t) - (2 * Math.PI * (t - NODO)) / MES_DRACONICO;

function Relogio({ tRef, rodando, diasPorS, onTick }: { tRef: React.RefObject<number>; rodando: boolean; diasPorS: number; onTick: (t: number) => void }) {
  const acc = useRef(0);
  useFrame((_, dt) => {
    if (rodando) tRef.current += Math.min(dt, 0.05) * diasPorS;
    acc.current += dt;
    if (acc.current > 0.1) {
      acc.current = 0;
      onTick(tRef.current);
    }
  });
  return null;
}

function Lua({ tRef, exagero }: { tRef: React.RefObject<number>; exagero: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => {
    ref.current?.position.copy(posLua(tRef.current, exagero));
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[R_LUA, 32, 32]} />
      <meshStandardMaterial color="#d6d3d1" roughness={0.95} />
    </mesh>
  );
}

function Terra() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.6;
  });
  return (
    <mesh ref={ref} rotation={[0, 0, (23.44 * Math.PI) / 180]}>
      <sphereGeometry args={[R_TERRA, 48, 48]} />
      <meshStandardMaterial color="#2f6fb3" roughness={0.85} />
    </mesh>
  );
}

/** Órbita inclinada da Lua, com a linha dos nodos (onde ela cruza o plano da órbita da Terra). */
function Orbita({ t, exagero }: { t: number; exagero: number }) {
  const no = anguloNodo(t);
  const pontos = useMemo(() => {
    const out: [number, number, number][] = [];
    for (let k = 0; k <= 128; k++) {
      const phi = (k / 128) * Math.PI * 2;
      const beta = INCLINACAO * exagero * RAD * Math.sin(phi - no);
      out.push([R_ORBITA * Math.cos(beta) * Math.cos(phi), R_ORBITA * Math.sin(beta), -R_ORBITA * Math.cos(beta) * Math.sin(phi)]);
    }
    return out;
  }, [no, exagero]);
  const ecliptica = useMemo(
    () => Array.from({ length: 129 }, (_, k) => [R_ORBITA * Math.cos((k / 128) * Math.PI * 2), 0, -R_ORBITA * Math.sin((k / 128) * Math.PI * 2)] as [number, number, number]),
    [],
  );
  const nodo: [number, number, number][] = [
    [R_ORBITA * 1.12 * Math.cos(no), 0, -R_ORBITA * 1.12 * Math.sin(no)],
    [-R_ORBITA * 1.12 * Math.cos(no), 0, R_ORBITA * 1.12 * Math.sin(no)],
  ];
  return (
    <>
      <Line points={ecliptica} color="#64748b" lineWidth={1} dashed dashSize={0.2} gapSize={0.15} />
      <Line points={pontos} color="#e2e8f0" lineWidth={1.2} transparent opacity={0.7} />
      <Line points={nodo} color="#f59e3c" lineWidth={1.5} />
      <Html position={nodo[0]} center>
        <span className="sim-rotulo-3d">nodo</span>
      </Html>
    </>
  );
}

/** A Lua como se vê da Terra: no hemisfério sul a crescente é um "C"; no norte, um "D". */
function FaseVista({ t, sul }: { t: number; sul: boolean }) {
  const e = elongacao(t);
  const r = 34;
  const crescendo = e < Math.PI;
  const gibosa = fracaoIluminada(t) > 0.5;
  const rx = Math.abs(Math.cos(e)) * r;
  // No norte, a crescente tem o lado direito iluminado; no sul, o esquerdo.
  const espelhar = crescendo === sul;
  const caminho = `M 0 ${-r} A ${r} ${r} 0 0 1 0 ${r} A ${rx} ${r} 0 0 ${gibosa ? 1 : 0} 0 ${-r} Z`;
  return (
    <div className="pointer-events-none absolute right-3 top-3 rounded-xl border border-white/15 bg-black/55 p-2 text-center text-[11px] text-white/80 backdrop-blur-sm">
      <svg width={2 * r + 8} height={2 * r + 8} viewBox={`${-r - 4} ${-r - 4} ${2 * r + 8} ${2 * r + 8}`} aria-hidden>
        <circle r={r} fill="#1f2430" />
        <path d={caminho} fill="#ece8e1" transform={espelhar ? 'scale(-1 1)' : undefined} />
        <circle r={r} fill="none" stroke="rgba(255,255,255,0.25)" />
      </svg>
      <p className="mt-1 font-semibold">vista do {sul ? 'sul' : 'norte'}</p>
    </div>
  );
}

export default function FasesLua() {
  const [t, setT] = useState(0);
  const [rodando, setRodando] = useState(!usaMovimentoReduzido());
  const [diasPorS, setDiasPorS] = useState(3);
  const [exagerar, setExagerar] = useState(true);
  const [hemisferio, setHemisferio] = useState<'sul' | 'norte'>('sul');
  const tRef = useRef(0);
  const exagero = exagerar ? 4 : 1;
  const idade = ((t % MES_SINODICO) + MES_SINODICO) % MES_SINODICO;
  const beta = latitudeLua(t, NODO);
  const eclipse = eclipseNoDia(Math.round(t / (MES_SINODICO / 2)) * (MES_SINODICO / 2), NODO);
  const pertoDoAlinhamento = Math.abs(t - Math.round(t / (MES_SINODICO / 2)) * (MES_SINODICO / 2)) < 0.6;
  const proximo = useMemo(() => eclipsesEntre(Math.floor(t) + 1, Math.floor(t) + 400, NODO)[0], [t]);
  const pular = (dia: number) => {
    tRef.current = dia;
    setT(dia);
  };

  return (
    <div className="lg:h-full">
      <LayoutSim
        palco={
          <Palco3D
            rotulo="Terra, Lua e a luz do Sol vinda da direita, com a órbita inclinada da Lua"
            camera={[1.5, 7, 11.5]}
            distancia={[4, 30]}
            ceu
            sobreposicao={<FaseVista t={t} sul={hemisferio === 'sul'} />}
          >
            <ambientLight intensity={0.08} />
            <directionalLight position={[30, 0, 0]} intensity={3} />
            <mesh position={[5.5, 0, 0]}>
              <sphereGeometry args={[0.5, 32, 32]} />
              <meshBasicMaterial color="#ffd166" />
            </mesh>
            <mesh position={[5.5, 0, 0]}>
              <sphereGeometry args={[0.85, 32, 32]} />
              <meshBasicMaterial color="#ffb703" transparent opacity={0.15} />
            </mesh>
            <Html position={[5.5, 1.1, 0]} center>
              <span className="sim-rotulo-3d">Sol</span>
            </Html>
            {/* Sombra da Terra (umbra): um cone escuro do lado oposto ao Sol. */}
            <mesh position={[-3.2, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <coneGeometry args={[R_TERRA, 6.4, 32, 1, true]} />
              <meshBasicMaterial color="#000000" transparent opacity={0.35} side={THREE.DoubleSide} depthWrite={false} />
            </mesh>
            <Terra />
            <Lua tRef={tRef} exagero={exagero} />
            <Orbita t={t} exagero={exagero} />
            <Relogio tRef={tRef} rodando={rodando} diasPorS={diasPorS} onTick={setT} />
          </Palco3D>
        }
        leituras={
          <Leituras
            itens={[
              { rotulo: 'Fase', valor: nomeFase(t) },
              { rotulo: 'Iluminada', valor: `${fmt(fracaoIluminada(t) * 100, 0)}%` },
              { rotulo: 'Idade da Lua', valor: `${fmt(idade, 1)} dias`, nota: `mês sinódico: ${fmt(MES_SINODICO, 2)} dias` },
              { rotulo: 'Latitude da Lua', valor: `${fmt(beta, 2)}°`, nota: 'altura sobre o plano da órbita da Terra' },
              {
                rotulo: 'Agora',
                valor: pertoDoAlinhamento && eclipse ? `eclipse ${eclipse}` : pertoDoAlinhamento ? 'sem eclipse' : '–',
                cor: pertoDoAlinhamento && eclipse ? 'var(--danger)' : undefined,
              },
              { rotulo: 'Próximo eclipse', valor: proximo ? `${proximo.tipo}, em ${fmt(proximo.dia - t, 0)} dias` : '–' },
            ]}
          />
        }
        controles={
          <>
            <BarraExecucao rodando={rodando} onAlternar={() => setRodando((r) => !r)} onReiniciar={() => pular(0)} />
            <Deslizador rotulo="Passagem do tempo" valor={diasPorS} min={0.5} max={15} passo={0.5} unidade="dias por segundo" onChange={setDiasPorS} />
            <Deslizador
              rotulo="Dia do mês lunar"
              valor={Math.round(idade * 2) / 2}
              min={0}
              max={29.5}
              passo={0.5}
              unidade="dias"
              onChange={(v) => pular(t - idade + v)}
            />
            <button type="button" className="btn btn-ghost w-full" onClick={() => proximo && pular(proximo.dia)} disabled={!proximo}>
              Ir para o próximo eclipse
            </button>
            <Segmentos
              rotulo="Lua vista do hemisfério"
              valor={hemisferio}
              opcoes={[
                { valor: 'sul', rotulo: 'Sul (Brasil)' },
                { valor: 'norte', rotulo: 'Norte' },
              ]}
              onChange={setHemisferio}
            />
            <Alternar rotulo="Exagerar a inclinação (4×)" marcado={exagerar} onChange={setExagerar} dica="Os 5,1° de verdade são difíceis de ver. Distâncias e tamanhos fora de escala." />
          </>
        }
      />
      <Explicacao
        enem={'Cai muito: **por que não há eclipse todo mês** (a órbita da Lua é inclinada), **qual fase** tem eclipse solar (nova) e lunar (cheia), e o formato da Lua visto do **hemisfério sul**, onde a crescente parece um "C" e a minguante um "D", o contrário do norte. A Lua mostra sempre a mesma face porque gira em torno de si no mesmo tempo da volta em torno da Terra.'}
      >
        {`Metade da Lua está sempre iluminada pelo Sol. A **fase** é quanto dessa metade iluminada a gente vê da Terra, e depende só do ângulo entre o Sol, a Terra e a Lua: na **lua nova** a Lua está entre a Terra e o Sol e vemos o lado escuro; na **cheia**, está do lado oposto e vemos o lado iluminado inteiro. De uma lua nova a outra passam 29,5 dias (o mês sinódico).

Se a órbita da Lua estivesse no mesmo plano da órbita da Terra, haveria um eclipse solar em toda lua nova e um lunar em toda cheia. Mas ela é **inclinada 5,1°**: quase sempre a Lua passa um pouco acima ou abaixo da linha Sol-Terra. Só quando a lua nova ou cheia acontece perto dos **nodos** (os dois pontos laranja onde as órbitas se cruzam) a sombra acerta. Isso dá de 2 a 7 eclipses por ano, em "temporadas" a cada seis meses.

A simulação usa os meses sinódico (29,53 dias) e draconítico (27,21 dias) reais; a diferença entre eles faz a linha dos nodos girar em relação ao Sol. Use "Ir para o próximo eclipse" e veja a Lua cruzar o nodo bem na fase certa.`}
      </Explicacao>
    </div>
  );
}
