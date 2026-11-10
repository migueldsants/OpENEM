import { Html, Line } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import * as THREE from 'three';
import { formatarAbreviada, type Subnivel } from '../../../lib/configuracao-eletronica';
import { decimalBr, evParaKjMol, massaCurta, rotuloIon, type Elemento } from '../../../lib/elementos';
import {
  caixasHund,
  camadas,
  cargasPossiveis,
  configuracaoDe,
  estavel,
  ionsSugeridos,
  isotopoPadrao,
  meiaVidaTexto,
  notacaoA,
  nucleo,
  nuvem,
  orbitais,
  raioCamada,
  textoCarga,
  tipoIon,
  vizinhoA,
  type Nuclideo,
  type V3,
} from '../../../lib/simulacoes/atomo';
import { criarRng } from '../../../lib/simulacoes/numerico';
import { alfa, texto, usaMovimentoReduzido, type Cores } from '../canvas';
import { useDadosTabela } from '../dados';
import { Palco3D } from '../Palco3D';
import { Alternar, Explicacao, LayoutSim, Leituras, Palco2D, Segmentos, type Quadro } from '../ui';

type Modelo = 'dalton' | 'thomson' | 'rutherford' | 'bohr' | 'sommerfeld' | 'quantico';

const MODELOS: { key: Modelo; nome: string; ano: string; ideia: string; limite: string }[] = [
  { key: 'dalton', nome: 'Dalton', ano: '1808', ideia: 'Átomo como esfera maciça, indivisível e indestrutível; átomos de um mesmo elemento são iguais entre si.', limite: 'Não explica a eletricidade nem a existência de partículas menores.' },
  { key: 'thomson', nome: 'Thomson', ano: '1897', ideia: 'Descoberto o elétron (raios catódicos), o átomo vira uma massa positiva com elétrons espalhados dentro, como passas num pudim.', limite: 'Não explica por que, no experimento de Rutherford, umas poucas partículas α voltam.' },
  { key: 'rutherford', nome: 'Rutherford', ano: '1911', ideia: 'A folha de ouro mostrou que o átomo é quase todo vazio: um núcleo minúsculo, denso e positivo, com elétrons girando em volta (modelo planetário).', limite: 'Um elétron girando deveria irradiar energia e cair no núcleo: o átomo não seria estável.' },
  { key: 'bohr', nome: 'Bohr', ano: '1913', ideia: 'Os elétrons ficam em camadas (níveis) de energia fixa, K, L, M…; só absorvem ou emitem luz ao saltar entre elas, o que explica o espectro do hidrogênio.', limite: 'Só acerta o espectro de átomos com um elétron.' },
  { key: 'sommerfeld', nome: 'Sommerfeld', ano: '1916', ideia: 'Dentro de cada camada há órbitas elípticas de excentricidades diferentes: a origem dos subníveis s, p, d e f.', limite: 'Ainda trata o elétron como uma bolinha com trajetória definida.' },
  { key: 'quantico', nome: 'Quântico', ano: '1926', ideia: 'Schrödinger e Heisenberg: não há trajetória, só a probabilidade de achar o elétron. Cada orbital é uma nuvem com forma própria (s esférico, p em halteres, d em trevo) e cabe no máximo 2 elétrons.', limite: 'É o modelo atual; as formas dos orbitais de átomos com muitos elétrons são aproximações.' },
];

const COR_PROTON = '#ef4444';
const COR_NEUTRON = '#9ca3af';
const COR_ELETRON = '#3b82f6';
const COR_L: Record<string, keyof Pick<Cores, 'mat' | 'hum' | 'lin' | 'danger'>> = { s: 'mat', p: 'hum', d: 'lin', f: 'danger' };
const HEX_L: Record<string, string> = { s: '#669dfb', p: '#f59e3c', d: '#ac8bf5', f: '#f7708a' };

/** Órbita de um elétron no plano local (x, z), girada por `rot`; elipse com o núcleo num foco. */
interface Orbita {
  a: number;
  b: number;
  rot: [number, number, number];
  fase: number;
  vel: number;
}

function posOrbita(o: Orbita, t: number, m: THREE.Matrix4): V3 {
  const c = Math.sqrt(Math.max(0, o.a * o.a - o.b * o.b));
  const ang = o.fase + o.vel * t;
  const p = new THREE.Vector3(o.a * Math.cos(ang) - c, 0, o.b * Math.sin(ang)).applyMatrix4(m);
  return [p.x, p.y, p.z];
}

const matriz = (rot: [number, number, number]) => new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...rot));

/** As órbitas que cada modelo desenha para a configuração dada. */
function orbitasDe(modelo: Modelo, cfg: Subnivel[], total: number): Orbita[] {
  const r = criarRng(total * 31 + 7);
  if (modelo === 'rutherford') {
    return Array.from({ length: total }, (_, i) => {
      const raio = 2.2 + 2.6 * r();
      return { a: raio, b: raio, rot: [r() * Math.PI, r() * Math.PI, 0], fase: r() * Math.PI * 2, vel: 1.6 / Math.sqrt(raio) * (i % 2 ? 1 : -1) };
    });
  }
  if (modelo === 'bohr') {
    const cs = camadas(cfg);
    return cs.flatMap((n, k) =>
      Array.from({ length: n }, (_, i) => {
        const raio = raioCamada(k + 1);
        return { a: raio, b: raio, rot: [0, 0, 0] as [number, number, number], fase: (2 * Math.PI * i) / n, vel: 1.4 / (k + 1) };
      }),
    );
  }
  if (modelo === 'sommerfeld') {
    const out: Orbita[] = [];
    cfg.filter((s) => s.e > 0).forEach((s, idx) => {
      const lk = { s: 0, p: 1, d: 2, f: 3 }[s.l];
      const a = raioCamada(s.n);
      // Sommerfeld: b/a = k/n, com k = l + 1 (a órbita "s" é a mais alongada).
      const b = (a * (lk + 1)) / s.n;
      const giro = idx * 2.399;
      for (let i = 0; i < s.e; i++) out.push({ a, b, rot: [0.25 * Math.sin(idx), giro, 0], fase: (2 * Math.PI * i) / s.e, vel: 1.4 / s.n });
    });
    return out;
  }
  return [];
}

/** Pontos da nuvem do modelo quântico: cada orbital ocupado, com mais pontos onde há mais elétrons. */
function pontosNuvem(cfg: Subnivel[], soValencia: boolean, so: string | null): { p: V3; l: string }[] {
  const ocupados = cfg.filter((s) => s.e > 0);
  const nMax = Math.max(...ocupados.map((s) => s.n));
  const usados = soValencia ? ocupados.filter((s) => s.n === nMax || (s.l === 'd' && s.n === nMax - 1) || (s.l === 'f' && s.n === nMax - 2)) : ocupados;
  const out: { p: V3; l: string }[] = [];
  // Um orbital escolhido: muitos pontos, para a forma aparecer (a soma de um subnível cheio é esférica).
  if (so) {
    const s = ocupados.find((x) => orbitais(x).some((o) => `${x.n}${o.forma}` === so));
    if (s) for (const p of nuvem(so.slice(1), s.n, 3500, 77, 1)) out.push({ p, l: s.l });
    return out;
  }
  usados.forEach((s, i) =>
    orbitais(s).forEach((o, j) => {
      for (const p of nuvem(o.forma, s.n, Math.round((soValencia ? 900 : 380) * o.eletrons), 1000 + i * 37 + j, 1)) out.push({ p, l: s.l });
    }),
  );
  return out;
}

// ---------------------------------------------------------------------------
// 3D
// ---------------------------------------------------------------------------

function Nucleo3D({ z, n, raio }: { z: number; n: number; raio: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const nucleons = useMemo(() => nucleo(z, n, raio), [z, n, raio]);
  useEffect(() => {
    const m = ref.current;
    if (!m) return;
    const mat = new THREE.Matrix4();
    const cor = new THREE.Color();
    nucleons.forEach((x, i) => {
      mat.makeTranslation(...x.pos);
      m.setMatrixAt(i, mat);
      m.setColorAt(i, cor.set(x.proton ? COR_PROTON : COR_NEUTRON));
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [nucleons]);
  return (
    <instancedMesh key={nucleons.length} ref={ref} args={[undefined, undefined, nucleons.length]}>
      <sphereGeometry args={[raio, 14, 14]} />
      <meshStandardMaterial roughness={0.4} />
    </instancedMesh>
  );
}

function Eletrons3D({ orbitas, girando }: { orbitas: Orbita[]; girando: boolean }) {
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  const t = useRef(0);
  const ms = useMemo(() => orbitas.map((o) => matriz(o.rot)), [orbitas]);
  useFrame((_, dt) => {
    if (girando) t.current += Math.min(dt, 0.05);
    orbitas.forEach((o, i) => {
      const m = refs.current[i];
      if (m) m.position.set(...posOrbita(o, t.current, ms[i]));
    });
  });
  // Uma linha por órbita diferente (as do mesmo círculo se repetem no Bohr).
  const linhas = useMemo(() => {
    const vistas = new Set<string>();
    return orbitas.flatMap((o, i) => {
      const chave = `${o.a.toFixed(2)}-${o.b.toFixed(2)}-${o.rot.join()}`;
      if (vistas.has(chave)) return [];
      vistas.add(chave);
      return [Array.from({ length: 97 }, (_, k) => posOrbita({ ...o, fase: 0, vel: 1 }, (k / 96) * Math.PI * 2, ms[i]))];
    });
  }, [orbitas, ms]);
  return (
    <>
      {linhas.map((pts, i) => (
        <Line key={i} points={pts} color="#94a3b8" lineWidth={1} transparent opacity={0.35} />
      ))}
      {orbitas.map((_, i) => (
        <mesh key={i} ref={(m) => { refs.current[i] = m; }}>
          <sphereGeometry args={[0.13, 12, 12]} />
          <meshStandardMaterial color={COR_ELETRON} emissive={COR_ELETRON} emissiveIntensity={0.5} />
        </mesh>
      ))}
    </>
  );
}

function Nuvem3D({ pontos }: { pontos: { p: V3; l: string }[] }) {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pontos.flatMap((x) => x.p), 3));
    const cor = new THREE.Color();
    g.setAttribute('color', new THREE.Float32BufferAttribute(pontos.flatMap((x) => cor.set(HEX_L[x.l]).toArray()), 3));
    return g;
  }, [pontos]);
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <points geometry={geo}>
      <pointsMaterial size={0.06} vertexColors transparent opacity={0.8} depthWrite={false} blending={THREE.AdditiveBlending} sizeAttenuation />
    </points>
  );
}

function Thomson3D({ eletrons, girando }: { eletrons: number; girando: boolean }) {
  const grupo = useRef<THREE.Group>(null);
  const base = useMemo(() => {
    const r = criarRng(eletrons + 5);
    return Array.from({ length: eletrons }, (_, i) => {
      const y = 1 - (2 * (i + 0.5)) / Math.max(1, eletrons);
      const rr = Math.sqrt(1 - y * y);
      const th = i * 2.39996;
      const k = 1.9 * Math.cbrt(0.2 + 0.8 * r());
      return [Math.cos(th) * rr * k, y * k, Math.sin(th) * rr * k] as V3;
    });
  }, [eletrons]);
  useFrame(({ clock }) => {
    if (!grupo.current || !girando) return;
    grupo.current.children.forEach((c, i) => {
      const b = base[i];
      c.position.set(b[0] + 0.05 * Math.sin(clock.elapsedTime * 3 + i), b[1] + 0.05 * Math.cos(clock.elapsedTime * 2.5 + i), b[2]);
    });
  });
  return (
    <>
      <mesh>
        <sphereGeometry args={[2.4, 48, 48]} />
        <meshStandardMaterial color="#f2587a" transparent opacity={0.22} depthWrite={false} />
      </mesh>
      <group ref={grupo}>
        {base.map((p, i) => (
          <mesh key={i} position={p}>
            <sphereGeometry args={[0.14, 12, 12]} />
            <meshStandardMaterial color={COR_ELETRON} emissive={COR_ELETRON} emissiveIntensity={0.5} />
          </mesh>
        ))}
      </group>
    </>
  );
}

// ---------------------------------------------------------------------------
// Tela
// ---------------------------------------------------------------------------

function NotacaoNuclideo({ simbolo, z, a, carga }: { simbolo: string; z: number; a: number; carga: number }) {
  return (
    <span className="inline-flex items-center font-data font-bold">
      <span className="mr-0.5 inline-flex flex-col text-right text-[10px] leading-[1.05]">
        <span>{a}</span>
        <span>{z}</span>
      </span>
      <span className="text-lg">{simbolo}</span>
      {carga !== 0 && <sup className="text-[11px]">{textoCarga(carga)}</sup>}
    </span>
  );
}

function Contador({ rotulo, valor, cor, menos, mais, podeMenos, podeMais }: { rotulo: string; valor: number; cor: string; menos: () => void; mais: () => void; podeMenos: boolean; podeMais: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className="size-3 shrink-0 rounded-full" style={{ background: cor }} aria-hidden />
      <span className="flex-1 text-sm font-medium">{rotulo}</span>
      <button type="button" className="btn btn-ghost px-3 py-1.5" onClick={menos} disabled={!podeMenos} aria-label={`Tirar um ${rotulo.toLowerCase().replace(/s$/, '')}`}>
        −
      </button>
      <span className="w-10 text-center font-data text-base font-bold tabular-nums" aria-live="polite">
        {valor}
      </span>
      <button type="button" className="btn btn-ghost px-3 py-1.5" onClick={mais} disabled={!podeMais} aria-label={`Pôr um ${rotulo.toLowerCase().replace(/s$/, '')}`}>
        +
      </button>
    </div>
  );
}

export default function Atomo() {
  const dados = useDadosTabela();
  const [z, setZ] = useState(6);
  const [a, setA] = useState(12);
  const [eletrons, setEletrons] = useState(6);
  const [modelo, setModelo] = useState<Modelo>('bohr');
  const [dim, setDim] = useState<'2D' | '3D'>('2D');
  const [girando, setGirando] = useState(!usaMovimentoReduzido());
  const [soValencia, setSoValencia] = useState(true);
  const [todos, setTodos] = useState(false);
  const [orbitalSel, setOrbitalSel] = useState<string>('todos');
  const tempo = useRef(0);

  const els = dados?.catalogo.elementos;
  const e: Elemento | undefined = els?.[z - 1];
  const nucs: Nuclideo[] = (dados && dados.nuclideos.get(z)) || [];
  const carga = z - eletrons;
  const cfg = useMemo(() => (e ? configuracaoDe(e, carga) ?? configuracaoDe(e, 0)! : []), [e, carga]);
  // A configuração é memorizada: as órbitas e a nuvem só mudam quando ela (ou o modelo) muda.
  const orbitas = useMemo(() => orbitasDe(modelo, cfg, eletrons), [modelo, cfg, eletrons]);
  const listaOrbitais = useMemo(() => cfg.filter((s) => s.e > 0).flatMap((s) => orbitais(s).map((o) => `${s.n}${o.forma}`)), [cfg]);
  const so = orbitalSel !== 'todos' && listaOrbitais.includes(orbitalSel) ? orbitalSel : null;
  const nuvemPts = useMemo(() => (modelo === 'quantico' && cfg.length ? pontosNuvem(cfg, soValencia, so) : []), [modelo, cfg, soValencia, so]);

  if (!dados || !e) {
    return (
      <div className="grid min-h-[50vh] place-items-center text-sm text-muted" aria-busy>
        Carregando a tabela periódica…
      </div>
    );
  }

  const nuc = nucs.find((x) => x.a === a);
  const lim = cargasPossiveis(e);
  const tipo = tipoIon(e, carga);
  const n = a - z;
  const escolher = (novoZ: number) => {
    const ne = els![novoZ - 1];
    setZ(novoZ);
    setA(isotopoPadrao(ne, dados.nuclideos.get(novoZ) ?? []));
    setEletrons(novoZ);
  };
  const naturais = e.isotopos.map((i) => i.a);
  const atalhosIsotopos = todos ? nucs.map((x) => x.a) : [...new Set([...naturais, ...(e.isotopoMaisEstavel ? [e.isotopoMaisEstavel.a] : []), ...(z === 6 ? [14] : []), ...(z === 1 ? [3] : []), ...(z === 92 ? [235] : [])])].filter((x) => nucs.some((y) => y.a === x)).sort((x, y) => x - y);

  const quadro: Quadro = (ctx, w, h, dt, c) => {
    if (girando) tempo.current += dt;
    const t = tempo.current;
    const cx = w / 2;
    const cy = h / 2;
    const S = Math.min(w, h) / 2 - 16;
    if (modelo === 'dalton') {
      const R = S * 0.62;
      const g = ctx.createRadialGradient(cx - R / 3, cy - R / 3, R * 0.1, cx, cy, R);
      g.addColorStop(0, '#e2e8f0');
      g.addColorStop(1, '#64748b');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
      texto(ctx, e.simbolo, cx, cy + 16, '#0f172a', { alinhar: 'center', tamanho: 44, peso: 800 });
      return;
    }
    if (modelo === 'thomson') {
      const R = S * 0.68;
      ctx.fillStyle = alfa(c.brand, 0.22);
      ctx.strokeStyle = alfa(c.brand, 0.6);
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      for (let i = 0; i < eletrons; i++) {
        const raio = R * 0.88 * Math.sqrt((i + 0.5) / eletrons);
        const th = i * 2.39996;
        const x = cx + Math.cos(th) * raio + 2 * Math.sin(t * 3 + i);
        const y = cy + Math.sin(th) * raio + 2 * Math.cos(t * 2.5 + i);
        ctx.fillStyle = COR_ELETRON;
        ctx.beginPath(); ctx.arc(x, y, Math.max(3, Math.min(7, R / 18)), 0, Math.PI * 2); ctx.fill();
      }
      texto(ctx, '+ massa positiva +', cx, cy + R + 14 > h ? h - 4 : cy + R + 14, c.brand, { alinhar: 'center', tamanho: 11, peso: 600 });
      return;
    }
    // Núcleo (fora de escala: o de verdade seria dezenas de milhares de vezes menor).
    const raioMax = modelo === 'quantico' ? Math.max(3, ...nuvemPts.map((q) => Math.hypot(q.p[0], q.p[1]))) * 0.9 : Math.max(2, ...orbitas.map((o) => o.a + Math.sqrt(Math.max(0, o.a * o.a - o.b * o.b))));
    const k = S / raioMax;
    const alvoNucleo = modelo === 'rutherford' || modelo === 'quantico' ? 6 : Math.min(26, S * 0.11);
    const rn = alvoNucleo / (1.05 * Math.cbrt(a));
    const nucl = nucleo(z, n, rn);
    const giroN = t * 0.3;
    nucl
      .map((q) => ({ x: q.pos[0] * Math.cos(giroN) + q.pos[2] * Math.sin(giroN), y: q.pos[1], d: -q.pos[0] * Math.sin(giroN) + q.pos[2] * Math.cos(giroN), proton: q.proton }))
      .sort((p, q) => p.d - q.d)
      .forEach((q) => {
        const g = ctx.createRadialGradient(cx + q.x - rn / 3, cy - q.y - rn / 3, 0.5, cx + q.x, cy - q.y, rn);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(1, q.proton ? COR_PROTON : COR_NEUTRON);
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(cx + q.x, cy - q.y, rn, 0, Math.PI * 2); ctx.fill();
      });
    if (modelo === 'quantico') {
      const giro = t * 0.35;
      const co = Math.cos(giro);
      const se = Math.sin(giro);
      for (const q of nuvemPts) {
        const x = q.p[0] * co + q.p[2] * se;
        ctx.fillStyle = alfa(c[COR_L[q.l]], 0.45);
        ctx.fillRect(cx + x * k - 1, cy - q.p[1] * k - 1, 2, 2);
      }
      return;
    }
    // Órbitas vistas de cima (o plano x, z do 3D) e os elétrons.
    const vistas = new Set<string>();
    orbitas.forEach((o) => {
      const chave = `${o.a.toFixed(2)}-${o.b.toFixed(2)}-${o.rot.join()}`;
      if (vistas.has(chave)) return;
      vistas.add(chave);
      const m = matriz(o.rot);
      ctx.strokeStyle = alfa(c.muted, 0.45);
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let s = 0; s <= 72; s++) {
        const p = posOrbita({ ...o, fase: 0, vel: 1 }, (s / 72) * Math.PI * 2, m);
        if (s) ctx.lineTo(cx + p[0] * k, cy + p[2] * k);
        else ctx.moveTo(cx + p[0] * k, cy + p[2] * k);
      }
      ctx.stroke();
    });
    if (modelo === 'bohr') {
      camadas(cfg).forEach((qtd, i) => {
        const r = raioCamada(i + 1) * k;
        texto(ctx, `${'KLMNOPQ'[i]} · ${qtd}`, cx + r * 0.71 + 4, cy - r * 0.71 - 4, c.muted, { tamanho: 11, peso: 700, mono: true });
      });
    }
    orbitas.forEach((o) => {
      const p = posOrbita(o, t, matriz(o.rot));
      ctx.fillStyle = COR_ELETRON;
      ctx.beginPath(); ctx.arc(cx + p[0] * k, cy + p[2] * k, 4.2, 0, Math.PI * 2); ctx.fill();
    });
  };

  const raioCena = modelo === 'quantico' ? 1.7 * Math.max(...cfg.map((s) => s.n), 1) + 1.5 : modelo === 'bohr' || modelo === 'sommerfeld' ? raioCamada(camadas(cfg).length) + 2 : 6;
  const info = MODELOS.find((m) => m.key === modelo)!;
  const ultimos = cfg.filter((s) => s.e > 0).slice(-3);

  return (
    <div className="lg:h-full">
      <LayoutSim
        palco={
          dim === '2D' ? (
            <Palco2D quadro={quadro} rotulo={`Modelo de ${info.nome} do ${e.nome.toLowerCase()}, ${notacaoA(e.simbolo, a)}${carga ? ` com carga ${textoCarga(carga)}` : ''}`} proporcao={16 / 11} alturaMin={300} />
          ) : (
            <Palco3D rotulo={`Modelo de ${info.nome} do ${e.nome.toLowerCase()} em 3D`} camera={[0, raioCena * 0.9, raioCena * 1.6]} distancia={[2, 40]} autoGirar={girando}>
              <ambientLight intensity={0.6} />
              <directionalLight position={[5, 8, 6]} intensity={1.4} />
              <directionalLight position={[-6, -3, -4]} intensity={0.4} />
              {modelo === 'dalton' && (
                <>
                  <mesh>
                    <sphereGeometry args={[2.2, 64, 64]} />
                    <meshStandardMaterial color="#94a3b8" roughness={0.35} />
                  </mesh>
                  <Html center position={[0, 2.8, 0]}>
                    <span className="sim-rotulo-3d">{e.simbolo}</span>
                  </Html>
                </>
              )}
              {modelo === 'thomson' && <Thomson3D eletrons={eletrons} girando={girando} />}
              {modelo !== 'dalton' && modelo !== 'thomson' && <Nucleo3D z={z} n={n} raio={modelo === 'rutherford' || modelo === 'quantico' ? 0.06 : 0.16} />}
              {(modelo === 'rutherford' || modelo === 'bohr' || modelo === 'sommerfeld') && <Eletrons3D orbitas={orbitas} girando={girando} />}
              {modelo === 'quantico' && <Nuvem3D pontos={nuvemPts} />}
            </Palco3D>
          )
        }
        leituras={
          <Leituras
            itens={[
              { rotulo: e.nome, valor: <NotacaoNuclideo simbolo={e.simbolo} z={z} a={a} carga={carga} />, nota: e.familia ?? undefined },
              { rotulo: 'Prótons · nêutrons · elétrons', valor: `${z} · ${n} · ${eletrons}` },
              { rotulo: 'Carga', valor: carga === 0 ? 'neutro' : `${rotuloIon(e.simbolo, carga)} (${{ comum: 'íon comum', conhecido: 'íon conhecido', plasma: 'só arrancando à força', neutro: '' }[tipo]})` },
              { rotulo: `Isótopo ${notacaoA(e.simbolo, a)}`, valor: nuc ? meiaVidaTexto(nuc) : '–', nota: nuc ? [nuc.decaimento && `decai por ${nuc.decaimento}`, nuc.abundancia != null && `${decimalBr(String(nuc.abundancia))}% na natureza`].filter(Boolean).join(' · ') || undefined : undefined },
              { rotulo: 'Massa atômica (média)', valor: `${massaCurta(e)} u` },
              { rotulo: 'Distribuição', valor: formatarAbreviada(cfg) },
              { rotulo: 'Camadas', valor: camadas(cfg).map((x, i) => `${'KLMNOPQ'[i]}${x}`).join(' ') },
              { rotulo: 'Eletronegatividade', valor: e.eletronegatividade ? decimalBr(String(e.eletronegatividade.valor)) : '–' },
              { rotulo: '1ª energia de ionização', valor: e.energiaIonizacao ? `${Math.round(evParaKjMol(Number(e.energiaIonizacao.ev)))} kJ/mol` : '–' },
            ]}
          />
        }
        rotuloExtra="O modelo"
        extra={
          <div className="space-y-4 text-sm">
            <div className="space-y-1">
              <p className="font-display text-base font-bold">
                {info.nome} <span className="font-data text-xs text-muted">{info.ano}</span>
              </p>
              <p className="text-pretty">{info.ideia}</p>
              <p className="text-xs text-muted text-pretty">Limite: {info.limite}</p>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs text-muted">Diagrama de orbitais dos últimos subníveis (regra de Hund)</p>
              {ultimos.map((s) => (
                <div key={`${s.n}${s.l}`} className="flex items-center gap-2">
                  <span className="w-8 font-data text-xs font-bold" style={{ color: HEX_L[s.l] }}>
                    {s.n}
                    {s.l}
                  </span>
                  <div className="flex gap-0.5">
                    {caixasHund(s.l, s.e).map((q, i) => (
                      <span key={i} className="grid h-7 w-7 place-items-center rounded border border-line font-data text-sm">
                        {q === 2 ? '↑↓' : q === 1 ? '↑' : ''}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted text-pretty">
              Propriedades da <Link to={`/tabela-periodica?z=${z}`} className="font-semibold underline">tabela periódica do OpENEM</Link> (CIAAW, NIST, PubChem); isótopos e meias-vidas da IAEA LiveChart, conferidos em {dados.nuclideosConferidoEm.split('-').reverse().join('/')}.
            </p>
          </div>
        }
        controles={
          <>
            <Segmentos
              rotulo="Ver em"
              valor={dim}
              opcoes={[
                { valor: '2D', rotulo: '2D' },
                { valor: '3D', rotulo: '3D' },
              ]}
              onChange={setDim}
            />
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Modelo atômico</p>
              <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Modelo atômico">
                {MODELOS.map((m) => (
                  <button key={m.key} type="button" role="radio" aria-checked={modelo === m.key} data-active={modelo === m.key} className="chip flex-col justify-center gap-0 py-1 leading-tight" onClick={() => setModelo(m.key)}>
                    <span>{m.nome}</span>
                    <span className="font-data text-[10px] opacity-70">{m.ano}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="atomo-elemento" className="text-sm font-medium">
                Elemento
              </label>
              <select id="atomo-elemento" className="input" value={z} onChange={(ev) => escolher(Number(ev.target.value))}>
                {els!.map((x) => (
                  <option key={x.z} value={x.z}>
                    {x.z} · {x.simbolo} · {x.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2 rounded-xl border border-line bg-surface-2 p-3">
              <Contador rotulo="Prótons" valor={z} cor={COR_PROTON} menos={() => escolher(z - 1)} mais={() => escolher(z + 1)} podeMenos={z > 1} podeMais={z < 118} />
              <Contador
                rotulo="Nêutrons"
                valor={n}
                cor={COR_NEUTRON}
                menos={() => setA(vizinhoA(nucs, a, -1) ?? a)}
                mais={() => setA(vizinhoA(nucs, a, 1) ?? a)}
                podeMenos={vizinhoA(nucs, a, -1) !== null}
                podeMais={vizinhoA(nucs, a, 1) !== null}
              />
              <Contador
                rotulo="Elétrons"
                valor={eletrons}
                cor={COR_ELETRON}
                menos={() => setEletrons(eletrons - 1)}
                mais={() => setEletrons(eletrons + 1)}
                podeMenos={z - (eletrons - 1) <= lim.max && eletrons > 0}
                podeMais={z - (eletrons + 1) >= lim.min}
              />
              <p className="text-xs text-muted text-pretty">
                Trocar o número de prótons troca o elemento. Os nêutrons só passam pelos isótopos já observados ({nucs.length} do {e.nome.toLowerCase()}); os elétrons, pelos íons que existem.
              </p>
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Isótopos</p>
              <div className="flex flex-wrap gap-1">
                {atalhosIsotopos.map((x) => {
                  const q = nucs.find((y) => y.a === x)!;
                  return (
                    <button key={x} type="button" className="chip font-data text-xs" data-active={a === x} onClick={() => setA(x)} title={meiaVidaTexto(q)}>
                      {notacaoA(e.simbolo, x)}
                      {!estavel(q) && <span aria-label="radioativo"> ☢</span>}
                    </button>
                  );
                })}
              </div>
              {nucs.length > atalhosIsotopos.length || todos ? (
                <button type="button" className="text-xs font-semibold text-muted hover:text-fg" onClick={() => setTodos(!todos)}>
                  {todos ? 'Mostrar só os principais' : `Ver os ${nucs.length} isótopos conhecidos`}
                </button>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Íons</p>
              <div className="flex flex-wrap gap-1">
                <button type="button" className="chip font-data text-xs" data-active={carga === 0} onClick={() => setEletrons(z)}>
                  neutro
                </button>
                {ionsSugeridos(e).map((q) => (
                  <button key={q} type="button" className="chip font-data text-xs" data-active={carga === q} onClick={() => setEletrons(z - q)}>
                    {rotuloIon(e.simbolo, q)}
                  </button>
                ))}
              </div>
            </div>
            {modelo === 'quantico' && (
              <>
                <div className="space-y-1">
                  <label htmlFor="atomo-orbital" className="text-sm font-medium">
                    Orbital
                  </label>
                  <select id="atomo-orbital" className="input" value={so ?? 'todos'} onChange={(ev) => setOrbitalSel(ev.target.value)}>
                    <option value="todos">Todos os ocupados</option>
                    {listaOrbitais.map((o) => (
                      <option key={o} value={o}>
                        {o.replace('x2y2', 'x²−y²').replace('z2', 'z²')}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted text-pretty">Escolha um orbital para ver a forma dele: s é uma esfera, p um haltere, d um trevo. Somados, os de um subnível cheio ficam esféricos.</p>
                </div>
                {!so && <Alternar rotulo="Só a camada de valência" marcado={soValencia} onChange={setSoValencia} dica="Desligado, mostra todos os orbitais ocupados (os de dentro ficam perto do núcleo)." />}
              </>
            )}
            <Alternar rotulo="Animar" marcado={girando} onChange={setGirando} />
          </>
        }
      />
      <Explicacao
        enem={'Cai a **evolução dos modelos atômicos** (o que cada experimento derrubou), a notação ${}^{A}_{Z}X$ com $A = Z + N$, e a comparação entre **isótopos** (mesmo Z, A diferente: ¹²C e ¹⁴C), **isóbaros** (mesmo A) e **isótonos** (mesmo N). Em íons, só muda o número de elétrons: o Na⁺ tem 11 prótons e 10 elétrons. O ¹⁴C (meia-vida de 5.700 anos) é a base da datação de fósseis.'}
      >
        {`Um átomo tem **prótons** e **nêutrons** no núcleo e **elétrons** em volta. O número de prótons ($Z$, número atômico) define o elemento: trocou o próton, trocou o elemento. A soma de prótons e nêutrons é o **número de massa** ($A$).

**Isótopos** são átomos do mesmo elemento com nêutrons diferentes: o carbono-12 e o carbono-14 têm 6 prótons, mas 6 e 8 nêutrons. Alguns são estáveis; outros são **radioativos** e decaem com uma meia-vida. O simulador só deixa montar isótopos que já foram observados (a lista da IAEA): tente pôr nêutrons demais e o botão trava.

**Íons** são átomos que ganharam ou perderam elétrons. O sódio perde um e vira Na⁺; o cloro ganha um e vira Cl⁻. Ânion, só os que existem (o neônio não aceita elétron extra); cátions, até tirar todos os elétrons, o que só acontece em plasma, como no Sol.

Os **modelos atômicos** contam a história de como a ciência chegou ao átomo de hoje: cada um explicou algo que o anterior não conseguia. Escolha um, veja em 2D ou em 3D e abra a aba "O modelo" para a ideia e o limite de cada um. O núcleo está fora de escala: se o átomo fosse um estádio de futebol, o núcleo seria uma ervilha no centro.`}
      </Explicacao>
    </div>
  );
}
