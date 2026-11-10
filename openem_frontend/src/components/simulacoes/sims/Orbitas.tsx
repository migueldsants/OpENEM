import { Html, Line } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  avancarCorpo,
  elementosOrbita,
  PLANETAS,
  periodoKepler,
  posicaoPlaneta,
  UA_KM,
  ANO_S,
  vCircular,
  type Corpo,
  type V3,
} from '../../../lib/simulacoes/gravitacao';
import { fmt } from '../../../lib/simulacoes/numerico';
import { usaMovimentoReduzido } from '../canvas';
import { Palco3D } from '../Palco3D';
import { BarraExecucao, Deslizador, Explicacao, LayoutSim, Leituras, Segmentos } from '../ui';

type Modo = 'kepler' | 'rochosos' | 'todos';

/** Eclíptica (x, y, z) → cena (x, z, −y): o plano da órbita fica "deitado". */
const cena = (p: V3, esc: number): [number, number, number] => [p[0] * esc, p[2] * esc, -p[1] * esc];
const kmS = (uaAno: number) => (uaAno * UA_KM) / ANO_S;
const J2000 = Date.UTC(2000, 0, 1, 12);
const HOJE_ANOS = (Date.now() - J2000) / (365.25 * 86400000);
const SETORES = 12;

function Sol({ raio }: { raio: number }) {
  return (
    <group>
      <mesh>
        <sphereGeometry args={[raio, 48, 48]} />
        <meshBasicMaterial color="#ffd166" />
      </mesh>
      <mesh>
        <sphereGeometry args={[raio * 1.6, 32, 32]} />
        <meshBasicMaterial color="#ffb703" transparent opacity={0.15} />
      </mesh>
      <pointLight intensity={3} decay={0} color="#fff4d6" />
    </group>
  );
}

function OrbitaPlaneta({ p, esc }: { p: (typeof PLANETAS)[number]; esc: number }) {
  const pts = useMemo(() => {
    const T = periodoKepler(p.a);
    return Array.from({ length: 361 }, (_, i) => cena(posicaoPlaneta(p, (i / 360) * T), esc));
  }, [p, esc]);
  return <Line points={pts} color={p.cor} lineWidth={1} transparent opacity={0.55} />;
}

function Planeta({ p, esc, tRef, tamanho }: { p: (typeof PLANETAS)[number]; esc: number; tRef: React.RefObject<number>; tamanho: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    const [x, y, z] = cena(posicaoPlaneta(p, tRef.current), esc);
    ref.current?.position.set(x, y, z);
  });
  return (
    <group ref={ref}>
      <mesh>
        <sphereGeometry args={[tamanho, 32, 32]} />
        <meshStandardMaterial color={p.cor} roughness={0.8} />
      </mesh>
      <Html center position={[0, tamanho + 0.25, 0]}>
        <span className="sim-rotulo-3d">{p.nome}</span>
      </Html>
    </group>
  );
}

/** Afasta ou aproxima a câmera para a cena caber (raio em unidades da cena). */
function Enquadrar({ raio }: { raio: number }) {
  const get = useThree((s) => s.get);
  useEffect(() => {
    const { camera, controls } = get();
    camera.position.setLength(Math.max(4, raio * 2.3));
    (controls as { update?: () => void } | null)?.update?.();
  }, [raio, get]);
  return null;
}

function Relogio({ tRef, rodando, anosPorSegundo, onTick }: { tRef: React.RefObject<number>; rodando: boolean; anosPorSegundo: number; onTick: (t: number) => void }) {
  const acc = useRef(0);
  useFrame((_, dt) => {
    if (rodando) tRef.current += Math.min(dt, 0.05) * anosPorSegundo;
    acc.current += dt;
    if (acc.current > 0.15) {
      acc.current = 0;
      onTick(tRef.current);
    }
  });
  return null;
}

/** Percurso da sonda: integrado uma vez (leapfrog), depois só reproduzido. */
function percorrer(c0: Corpo) {
  const el = elementosOrbita(c0);
  const fechada = Number.isFinite(el.periodo);
  const total = fechada ? el.periodo : 6;
  const n = 1440;
  const dt = total / n;
  const pos: V3[] = [c0.pos];
  const vel: V3[] = [c0.vel];
  let c = c0;
  for (let i = 0; i < n; i++) {
    c = avancarCorpo(c, dt);
    pos.push(c.pos);
    vel.push(c.vel);
    if (!fechada && Math.hypot(...c.pos) > 12) break;
  }
  return { pos, vel, dt, total: (pos.length - 1) * dt, fechada, el };
}

function Sonda({ percurso, esc, tRef }: { percurso: ReturnType<typeof percorrer>; esc: number; tRef: React.RefObject<number> }) {
  const ref = useRef<THREE.Mesh>(null);
  const linha = useMemo(() => percurso.pos.map((p) => cena(p, esc)), [percurso, esc]);
  // Setores de mesmo tempo (2ª lei de Kepler): leques alternados a partir do Sol.
  const setores = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const vert: number[] = [];
    const cores: number[] = [];
    const porSetor = Math.floor((percurso.pos.length - 1) / SETORES);
    for (let s = 0; s < SETORES; s++) {
      const cor = s % 2 ? [0.95, 0.45, 0.55] : [0.4, 0.6, 1];
      for (let i = s * porSetor; i < (s + 1) * porSetor; i++) {
        vert.push(0, 0, 0, ...cena(percurso.pos[i], esc), ...cena(percurso.pos[i + 1], esc));
        for (let k = 0; k < 3; k++) cores.push(...cor);
      }
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vert, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cores, 3));
    return geo;
  }, [percurso, esc]);
  useFrame(() => {
    const t = percurso.fechada ? tRef.current % percurso.total : Math.min(tRef.current, percurso.total);
    const i = Math.min(percurso.pos.length - 2, Math.floor(t / percurso.dt));
    const f = t / percurso.dt - i;
    const a = percurso.pos[i];
    const b = percurso.pos[i + 1];
    const p: V3 = [a[0] + f * (b[0] - a[0]), a[1] + f * (b[1] - a[1]), a[2] + f * (b[2] - a[2])];
    ref.current?.position.set(...cena(p, esc));
  });
  return (
    <group>
      <mesh geometry={setores}>
        <meshBasicMaterial vertexColors transparent opacity={0.28} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <Line points={linha} color="#f2587a" lineWidth={2} />
      <mesh ref={ref}>
        <sphereGeometry args={[0.12, 24, 24]} />
        <meshStandardMaterial color="#f8fafc" emissive="#f2587a" emissiveIntensity={0.6} />
      </mesh>
    </group>
  );
}

export default function Orbitas() {
  const [modo, setModo] = useState<Modo>('kepler');
  const [fatorV, setFatorV] = useState(1.15);
  const [direcao, setDirecao] = useState(0);
  const [velocidade, setVelocidade] = useState(0.25);
  const [rodando, setRodando] = useState(!usaMovimentoReduzido());
  const tRef = useRef(modo === 'kepler' ? 0 : HOJE_ANOS);
  const [t, setT] = useState(0);

  const corpo0 = useMemo<Corpo>(() => {
    const g = (direcao * Math.PI) / 180;
    const v = fatorV * vCircular(1);
    return { pos: [1, 0, 0], vel: [v * Math.sin(g), v * Math.cos(g), 0] };
  }, [fatorV, direcao]);
  const percurso = useMemo(() => percorrer(corpo0), [corpo0]);

  const trocarModo = (m: Modo) => {
    setModo(m);
    tRef.current = m === 'kepler' ? 0 : HOJE_ANOS;
    setVelocidade(m === 'todos' ? 8 : m === 'rochosos' ? 0.5 : 0.25);
  };

  const esc = modo === 'todos' ? 0.42 : 4;
  const raioCena =
    modo === 'kepler'
      ? Math.min(Number.isFinite(percurso.el.afelio) ? percurso.el.afelio : 4, 6) * esc
      : modo === 'rochosos'
        ? 1.67 * esc
        : 30.5 * esc;
  const planetas = modo === 'rochosos' ? PLANETAS.slice(0, 4) : modo === 'todos' ? PLANETAS : [];
  const data = new Date(J2000 + t * 365.25 * 86400000);

  // Estado atual da sonda para as leituras.
  const el = percurso.el;
  const tt = percurso.fechada ? t % percurso.total : Math.min(t, percurso.total);
  const i = Math.min(percurso.pos.length - 1, Math.floor(tt / percurso.dt));
  const rAtual = Math.hypot(...percurso.pos[i]);
  const vAtual = Math.hypot(...percurso.vel[i]);

  return (
    <div className="lg:h-full">
      <LayoutSim
        palco={
          <Palco3D rotulo={modo === 'kepler' ? 'Sonda em órbita ao redor do Sol com as áreas varridas' : 'Planetas do Sistema Solar em suas órbitas'} camera={modo === 'todos' ? [0, 14, 18] : [0, 6.5, 8]} distancia={[2, 80]} ceu>
            <ambientLight intensity={0.25} />
            <Relogio tRef={tRef} rodando={rodando} anosPorSegundo={velocidade} onTick={setT} />
            <Enquadrar raio={raioCena} />
            <Sol raio={modo === 'todos' ? 0.35 : 0.3} />
            {modo === 'kepler' ? (
              <>
                <Line points={Array.from({ length: 129 }, (_, k) => cena([Math.cos((k / 128) * 2 * Math.PI), Math.sin((k / 128) * 2 * Math.PI), 0], esc))} color="#64748b" lineWidth={1} dashed dashSize={0.2} gapSize={0.15} />
                <Sonda percurso={percurso} esc={esc} tRef={tRef} />
              </>
            ) : (
              planetas.map((p) => (
                <group key={p.key}>
                  <OrbitaPlaneta p={p} esc={esc} />
                  <Planeta p={p} esc={esc} tRef={tRef} tamanho={modo === 'todos' ? 0.12 + Math.cbrt(p.raio / 6371) * 0.08 : 0.08 + Math.cbrt(p.raio / 6371) * 0.08} />
                </group>
              ))
            )}
          </Palco3D>
        }
        leituras={
          modo === 'kepler' ? (
            <Leituras
              itens={[
                { rotulo: 'Órbita', valor: el.tipo },
                { rotulo: 'Excentricidade', valor: fmt(el.e, 3) },
                { rotulo: 'Semieixo maior', valor: Number.isFinite(el.a) ? `${fmt(el.a, 3)} UA` : '∞' },
                { rotulo: 'Período (T² = a³)', valor: Number.isFinite(el.periodo) ? `${fmt(el.periodo, 3)} anos` : 'não volta' },
                { rotulo: 'Periélio', valor: `${fmt(el.perielio, 3)} UA` },
                { rotulo: 'Afélio', valor: Number.isFinite(el.afelio) ? `${fmt(el.afelio, 3)} UA` : '∞' },
                { rotulo: 'Distância agora', valor: `${fmt(rAtual, 3)} UA` },
                { rotulo: 'Velocidade agora', valor: `${fmt(kmS(vAtual), 1)} km/s` },
              ]}
            />
          ) : (
            <Leituras
              titulo="Posições"
              itens={[
                { rotulo: 'Data', valor: data.toLocaleDateString('pt-BR') },
                ...planetas.map((p) => ({
                  rotulo: p.nome,
                  valor: `${fmt(Math.hypot(...posicaoPlaneta(p, t)), 2)} UA`,
                  nota: `ano de ${fmt(periodoKepler(p.a), 2)} anos terrestres`,
                  cor: p.cor,
                })),
              ]}
            />
          )
        }
        controles={
          <>
            <Segmentos
              rotulo="Cena"
              valor={modo}
              opcoes={[
                { valor: 'kepler', rotulo: 'Lançar sonda' },
                { valor: 'rochosos', rotulo: 'Rochosos' },
                { valor: 'todos', rotulo: 'Todos' },
              ]}
              onChange={trocarModo}
            />
            <BarraExecucao rodando={rodando} onAlternar={() => setRodando((r) => !r)} onReiniciar={() => { tRef.current = modo === 'kepler' ? 0 : HOJE_ANOS; setT(tRef.current); }} />
            <Deslizador
              rotulo="Passagem do tempo"
              valor={velocidade}
              min={0.05}
              max={modo === 'todos' ? 40 : 2}
              passo={0.05}
              formatar={(v) => (v < 1 ? `${fmt(v * 365, 0)} dias` : `${fmt(v, 1)} anos`)}
              unidade="por segundo"
              onChange={setVelocidade}
            />
            {modo === 'kepler' && (
              <>
                <Deslizador
                  rotulo="Velocidade de lançamento"
                  valor={fatorV}
                  min={0.4}
                  max={1.6}
                  passo={0.01}
                  formatar={(v) => `${fmt(kmS(v * vCircular(1)), 1)} km/s`}
                  onChange={(v) => { setFatorV(v); tRef.current = 0; }}
                  dica={`Órbita circular: 29,8 km/s. Escape: ${fmt(kmS(Math.SQRT2 * vCircular(1)), 1)} km/s.`}
                />
                <Deslizador rotulo="Direção (a partir da tangente)" valor={direcao} min={-60} max={60} unidade="°" onChange={(v) => { setDirecao(v); tRef.current = 0; }} />
              </>
            )}
            <p className="text-xs text-muted">Distâncias em escala real; o tamanho dos astros foi aumentado para aparecerem.</p>
          </>
        }
      />
      <Explicacao enem={'As três leis de Kepler: órbitas **elípticas** com o Sol num dos focos; o raio vetor varre **áreas iguais em tempos iguais** (o planeta é mais rápido no periélio); e $T^2/a^3$ é o mesmo para todos os planetas. A Terra passa no periélio no começo de janeiro: as estações **não** vêm da distância ao Sol.'}>
        {`A sonda parte de 1 UA (a distância Terra-Sol) e só sente a gravidade do Sol, $F = G\\frac{Mm}{r^2}$. A órbita é integrada numericamente e respeita as leis de Kepler sem que elas sejam programadas:

- Com 29,8 km/s na tangente, a órbita é **circular**. Mais rápido, vira uma **elipse** que se afasta; mais devagar, uma elipse que cai para perto do Sol.
- Os leques coloridos foram varridos em **intervalos de tempo iguais**: perto do Sol são curtos e largos, longe são longos e finos, mas todos têm a **mesma área**.
- A partir de $\\sqrt{2}$ vezes a velocidade circular (42,1 km/s) a sonda **escapa**: a energia fica positiva e a trajetória vira hipérbole.

Nas cenas dos planetas, as posições vêm dos elementos orbitais reais (NASA/JPL) e começam na data de hoje. Mercúrio, o mais excêntrico, mostra bem a elipse.`}
      </Explicacao>
    </div>
  );
}
