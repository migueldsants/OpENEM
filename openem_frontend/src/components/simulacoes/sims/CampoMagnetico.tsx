import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  PARTICULAS,
  passoBoris,
  passoHelice,
  periodoCiclotron,
  raioCiclotron,
  velocidadeInicial,
  type Vec3,
} from '../../../lib/simulacoes/eletromagnetismo';
import { fmt, fmtCientifico } from '../../../lib/simulacoes/numerico';
import { usaMovimentoReduzido } from '../canvas';
import { Palco3D } from '../Palco3D';
import { BarraExecucao, Deslizador, Explicacao, LayoutSim, Leituras, Seletor } from '../ui';

const RAIO_CENA = 2; // o raio da circunferência sempre aparece com 2 unidades
const SEG_POR_VOLTA = 3; // uma volta leva 3 s na tela
const MAX_RASTRO = 1800;

/** Simulação (B no eixo z) → cena (B para cima): (x, y, z) → (x, z, −y), uma rotação. */
const cena = (p: Vec3, k: number): [number, number, number] => [p[0] * k, p[2] * k, -p[1] * k];

function LinhasDeCampo() {
  const setas = useMemo(() => {
    const out: THREE.ArrowHelper[] = [];
    for (let i = -2; i <= 2; i++) {
      for (let j = -2; j <= 2; j++) {
        out.push(new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(i * 1.6, -3, j * 1.6), 6, 0x7c8aa5, 0.35, 0.18));
      }
    }
    return out;
  }, []);
  useEffect(
    () => () => setas.forEach((s) => s.dispose()),
    [setas],
  );
  return (
    <group>
      {setas.map((s, i) => (
        <primitive key={i} object={s} />
      ))}
    </group>
  );
}

function Particula({
  q,
  m,
  v,
  alfa,
  B,
  rodando,
  carga,
}: {
  q: number;
  m: number;
  v: number;
  alfa: number;
  B: number;
  rodando: boolean;
  carga: 1 | -1;
}) {
  const r = raioCiclotron(m, v * Math.sin((Math.max(alfa, 1) * Math.PI) / 180), q, B);
  const T = periodoCiclotron(m, q, B);
  const k = RAIO_CENA / r;
  // Começa num ponto que deixa o centro do círculo no eixo da cena (a força
  // aponta para −y numa carga positiva com v em +x e B em +z) e, se houver
  // componente ao longo de B, embaixo, para a hélice subir pela cena toda.
  const inicio = () => {
    const vel = velocidadeInicial(v, alfa);
    const pos: Vec3 = [0, Math.sign(q) * r, vel[2] > 1e-9 * v ? -3 / k : 0];
    return { pos, vel };
  };
  const estado = useRef(inicio());
  const bola = useRef<THREE.Mesh>(null);
  const grupo = useRef<THREE.Group>(null);
  const n = useRef(0);
  // Objetos do three mexidos a cada quadro: criados num efeito e guardados
  // num ref (o React não precisa vê-los).
  const objs = useRef<{ rastro: THREE.BufferGeometry; setaV: THREE.ArrowHelper; setaF: THREE.ArrowHelper } | null>(null);

  useEffect(() => {
    const g = grupo.current;
    if (!g) return;
    const rastro = new THREE.BufferGeometry();
    rastro.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_RASTRO * 3), 3));
    rastro.setDrawRange(0, 0);
    const material = new THREE.LineBasicMaterial({ color: carga > 0 ? 0xf2587a : 0x669dfb });
    const linha = new THREE.Line(rastro, material);
    const setaV = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 1, 0x13b981, 0.25, 0.14);
    const setaF = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 1, 0xf59e3c, 0.25, 0.14);
    g.add(linha, setaV, setaF);
    objs.current = { rastro, setaV, setaF };
    n.current = 0;
    return () => {
      g.remove(linha, setaV, setaF);
      rastro.dispose();
      material.dispose();
      setaV.dispose();
      setaF.dispose();
      objs.current = null;
    };
  }, [carga]);

  // Recomeça quando os parâmetros mudam.
  useEffect(() => {
    estado.current = inicio();
    n.current = 0;
    objs.current?.rastro.setDrawRange(0, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, m, v, alfa, B]);

  useFrame((_, dt) => {
    let st = estado.current;
    if (rodando) {
      const simDt = (Math.min(dt, 0.05) / SEG_POR_VOLTA) * T;
      const passos = Math.max(1, Math.ceil(simDt / (T / 400)));
      for (let i = 0; i < passos; i++) {
        const r2 = passoBoris(st.pos, st.vel, q, m, [0, 0, 0], [0, 0, B], simDt / passos);
        st.pos = r2.pos;
        st.vel = r2.vel;
      }
      // Hélice saindo de vista: recomeça.
      if (Math.abs(st.pos[2] * k) > 3.2) {
        estado.current = inicio();
        st = estado.current;
        n.current = 0;
      }
      const o = objs.current;
      if (o) {
        const attr = o.rastro.getAttribute('position') as THREE.BufferAttribute;
        if (n.current >= MAX_RASTRO) {
          attr.array.copyWithin(0, 3, MAX_RASTRO * 3);
          n.current = MAX_RASTRO - 1;
        }
        attr.setXYZ(n.current, ...cena(st.pos, k));
        n.current++;
        attr.needsUpdate = true;
        o.rastro.setDrawRange(0, n.current);
      }
    }
    const p = cena(st.pos, k);
    bola.current?.position.set(...p);
    const o = objs.current;
    if (!o) return;
    o.setaV.position.set(...p);
    o.setaV.setDirection(new THREE.Vector3(...cena(st.vel, 1)).normalize());
    // F = q v × B, com B no eixo z da simulação.
    const F: Vec3 = [q * st.vel[1] * B, -q * st.vel[0] * B, 0];
    const fn = Math.hypot(...F);
    o.setaF.position.set(...p);
    o.setaF.visible = fn > 0;
    if (fn > 0) o.setaF.setDirection(new THREE.Vector3(...cena(F, 1)).normalize());
  });

  return (
    <group ref={grupo}>
      <mesh ref={bola}>
        <sphereGeometry args={[0.13, 24, 24]} />
        <meshStandardMaterial color={carga > 0 ? '#f2587a' : '#669dfb'} emissive={carga > 0 ? '#f2587a' : '#669dfb'} emissiveIntensity={0.5} />
      </mesh>
    </group>
  );
}

export default function CampoMagnetico() {
  const [pKey, setPKey] = useState<string>('proton');
  const [logV, setLogV] = useState(6); // v = 10^logV m/s
  const [alfa, setAlfa] = useState(90);
  const [B, setB] = useState(0.5);
  const [rodando, setRodando] = useState(!usaMovimentoReduzido());
  const par = PARTICULAS.find((p) => p.key === pKey)!;
  const v = 10 ** logV;
  const a = (alfa * Math.PI) / 180;
  const vPerp = v * Math.sin(a);
  // cos 90° em ponto flutuante dá 6·10⁻¹⁷, não zero.
  const vPar = alfa >= 90 ? 0 : v * Math.cos(a);
  const T = periodoCiclotron(par.m, par.q, B);
  const r = raioCiclotron(par.m, vPerp, par.q, B);
  const F = Math.abs(par.q) * v * B * Math.sin(a);
  const comprimento = (x: number) => (x >= 1 ? `${fmt(x, 2)} m` : x >= 1e-3 ? `${fmt(x * 1000, 2)} mm` : `${fmt(x * 1e6, 2)} µm`);

  return (
    <div className="lg:h-full">
      <LayoutSim
        palco={
          <Palco3D rotulo="Partícula carregada descrevendo uma trajetória num campo magnético vertical" camera={[5.5, 3.5, 6.5]} distancia={[3, 25]}>
            <ambientLight intensity={0.6} />
            <directionalLight position={[4, 6, 3]} intensity={1.2} />
            <LinhasDeCampo />
            <gridHelper args={[8, 8, 0x475569, 0x334155]} position={[0, -3, 0]} />
            <Particula q={par.q} m={par.m} v={v} alfa={alfa} B={B} rodando={rodando} carga={par.q > 0 ? 1 : -1} />
          </Palco3D>
        }
        leituras={
          <Leituras
            itens={[
              { rotulo: 'Força magnética', valor: `${fmtCientifico(F)} N`, nota: 'F = |q|·v·B·sen α', cor: 'var(--hum)' },
              { rotulo: 'Raio (r = mv⊥/|q|B)', valor: comprimento(r) },
              { rotulo: 'Período (T = 2πm/|q|B)', valor: `${fmtCientifico(T)} s`, nota: 'não depende da velocidade' },
              { rotulo: 'Frequência', valor: `${fmtCientifico(1 / T)} Hz` },
              { rotulo: 'Passo da hélice', valor: alfa < 89.5 ? comprimento(passoHelice(vPar, T)) : 'é uma circunferência' },
              { rotulo: 'v ao longo de B', valor: `${fmtCientifico(vPar)} m/s` },
              { rotulo: 'v perpendicular', valor: `${fmtCientifico(vPerp)} m/s`, cor: 'var(--nat)' },
            ]}
          />
        }
        controles={
          <>
            <BarraExecucao rodando={rodando} onAlternar={() => setRodando((x) => !x)} />
            <Seletor rotulo="Partícula" valor={pKey} opcoes={PARTICULAS.map((p) => ({ valor: p.key, rotulo: `${p.nome} (${p.q > 0 ? '+' : '−'})` }))} onChange={setPKey} />
            <Deslizador rotulo="Velocidade" valor={logV} min={4} max={7.3} passo={0.05} formatar={(x) => fmtCientifico(10 ** x)} unidade="m/s" onChange={setLogV} />
            <Deslizador rotulo="Ângulo entre v e B (α)" valor={alfa} min={0} max={90} unidade="°" onChange={setAlfa} dica="90°: circunferência. Menor: hélice. 0°: segue reto, sem força." />
            <Deslizador rotulo="Campo magnético" valor={B} min={0.01} max={2} passo={0.01} unidade="T" onChange={setB} />
            <div className="space-y-1 text-xs text-muted">
              <p><span className="font-semibold" style={{ color: 'var(--nat)' }}>verde:</span> velocidade</p>
              <p><span className="font-semibold" style={{ color: 'var(--hum)' }}>laranja:</span> força magnética (sempre perpendicular)</p>
              <p>Setas cinza: o campo magnético, de baixo para cima.</p>
            </div>
          </>
        }
      />
      <Explicacao enem={'A força magnética é sempre **perpendicular à velocidade**: muda a direção, nunca o módulo, e por isso **não realiza trabalho**. Carga parada ou andando na direção do campo não sofre força. É o princípio do espectrômetro de massa, dos aceleradores (cíclotron) e da aurora boreal, em que partículas do vento solar espiralam nas linhas do campo da Terra.'}>
        {`Uma carga $q$ com velocidade $\\vec v$ num campo $\\vec B$ sofre a força de Lorentz
$$\\vec F = q\\,\\vec v \\times \\vec B, \\qquad F = |q|\\,v\\,B\\sin\\alpha.$$
O sentido sai da **regra da mão direita** para carga positiva e é o oposto para a negativa: troque próton por elétron e veja o giro inverter.

Como a força faz o papel de resultante centrípeta, $|q|vB = mv^2/r$, o raio é $r = \\frac{mv}{|q|B}$. O período, $T = \\frac{2\\pi m}{|q|B}$, não depende da velocidade: partículas mais rápidas fazem círculos maiores no mesmo tempo. O elétron, 1836 vezes mais leve que o próton, gira num raio muito menor.

A simulação usa os valores reais de carga e massa e o integrador de Boris, que conserva a energia exatamente. A escala da cena se ajusta para o círculo caber na tela: veja nas medidas o tamanho real.`}
      </Explicacao>
    </div>
  );
}
