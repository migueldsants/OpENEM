import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { fmt } from '../../../lib/simulacoes/numerico';
import { dobrar, solido, type Face, type Solido } from '../../../lib/simulacoes/solidos';
import { usaMovimentoReduzido } from '../canvas';
import { Palco3D } from '../Palco3D';
import { Deslizador, Explicacao, LayoutSim, Leituras } from '../ui';

const CORES = ['#669dfb', '#13b981', '#f59e3c', '#ac8bf5', '#f2587a', '#3fa7c4'];

/** Faces que dobram: malhas criadas uma vez por sólido e atualizadas a cada quadro pela dobra. */
function Dobravel({ rede, abertaRef, alvo }: { rede: Face; abertaRef: React.RefObject<number>; alvo: number }) {
  const grupo = useRef<THREE.Group>(null);
  const objs = useRef<{ malhas: THREE.Mesh[]; bordas: THREE.LineLoop[] } | null>(null);
  const parado = useRef(usaMovimentoReduzido());

  useEffect(() => {
    const g = grupo.current;
    if (!g) return;
    const faces = dobrar(rede, abertaRef.current);
    const malhas: THREE.Mesh[] = [];
    const bordas: THREE.LineLoop[] = [];
    faces.forEach((f, i) => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((f.length - 2) * 9), 3));
      const malha = new THREE.Mesh(
        geo,
        new THREE.MeshStandardMaterial({ color: CORES[i % CORES.length], side: THREE.DoubleSide, transparent: true, opacity: 0.88, roughness: 0.55 }),
      );
      const lgeo = new THREE.BufferGeometry();
      lgeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(f.length * 3), 3));
      const borda = new THREE.LineLoop(lgeo, new THREE.LineBasicMaterial({ color: '#0f172a' }));
      g.add(malha, borda);
      malhas.push(malha);
      bordas.push(borda);
    });
    objs.current = { malhas, bordas };
    // Centraliza pela base: o sólido fecha em cima dela.
    const base = rede.pts;
    const cx = base.reduce((s, p) => s + p[0], 0) / base.length;
    const cz = base.reduce((s, p) => s + p[1], 0) / base.length;
    g.position.set(-cx, 0, -cz);
    return () => {
      for (const m of malhas) {
        g.remove(m);
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
      }
      for (const b of bordas) {
        g.remove(b);
        b.geometry.dispose();
        (b.material as THREE.Material).dispose();
      }
      objs.current = null;
    };
  }, [rede, abertaRef]);

  useFrame((_, dt) => {
    const o = objs.current;
    if (!o) return;
    const atual = abertaRef.current;
    abertaRef.current = parado.current ? alvo : atual + Math.sign(alvo - atual) * Math.min(Math.abs(alvo - atual), dt * 0.6);
    const faces = dobrar(rede, abertaRef.current);
    faces.forEach((f, i) => {
      const pos = o.malhas[i].geometry.attributes.position as THREE.BufferAttribute;
      let k = 0;
      for (let t = 1; t + 1 < f.length; t++) {
        for (const p of [f[0], f[t], f[t + 1]]) pos.setXYZ(k++, p[0], p[1], p[2]);
      }
      pos.needsUpdate = true;
      o.malhas[i].geometry.computeVertexNormals();
      o.malhas[i].geometry.computeBoundingSphere();
      const lp = o.bordas[i].geometry.attributes.position as THREE.BufferAttribute;
      f.forEach((p, j) => lp.setXYZ(j, p[0], p[1] + 0.002, p[2]));
      lp.needsUpdate = true;
      o.bordas[i].geometry.computeBoundingSphere();
    });
  });
  return <group ref={grupo} />;
}

const MEDIDAS: Record<Solido['key'], { rotulos: [string, string?, string?]; padrao: [number, number, number] }> = {
  cubo: { rotulos: ['Aresta (a)'], padrao: [2, 2, 2] },
  paralelepipedo: { rotulos: ['Comprimento (a)', 'Largura (b)', 'Altura (c)'], padrao: [3, 2, 1.5] },
  prisma: { rotulos: ['Aresta da base (a)', undefined, 'Altura (h)'], padrao: [2, 2, 2.5] },
  piramide: { rotulos: ['Aresta da base (a)', undefined, 'Altura (h)'], padrao: [2.5, 2.5, 2] },
  tetraedro: { rotulos: ['Aresta (a)'], padrao: [2.5, 2.5, 2.5] },
};

const NOMES: { key: Solido['key']; nome: string }[] = [
  { key: 'cubo', nome: 'Cubo' },
  { key: 'paralelepipedo', nome: 'Paralelepípedo' },
  { key: 'prisma', nome: 'Prisma' },
  { key: 'piramide', nome: 'Pirâmide' },
  { key: 'tetraedro', nome: 'Tetraedro' },
];

export default function Planificacao() {
  const [key, setKey] = useState<Solido['key']>('cubo');
  const [m, setM] = useState<[number, number, number]>(MEDIDAS.cubo.padrao);
  const [alvo, setAlvo] = useState(0.6);
  const abertaRef = useRef(0.6);
  const s = solido(key, { a: m[0], b: m[1], c: m[2] });
  // A rede só muda quando muda o sólido ou as medidas (a dobra anda por fora, a cada quadro).
  const rede = useMemo(() => solido(key, { a: m[0], b: m[1], c: m[2] }).rede, [key, m]);
  const rot = MEDIDAS[key].rotulos;
  const escolher = (k: Solido['key']) => {
    setKey(k);
    setM(MEDIDAS[k].padrao);
  };

  return (
    <div className="lg:h-full">
      <LayoutSim
        palco={
          <Palco3D rotulo={`${s.nome} ${alvo > 0.5 ? 'aberto na planificação' : 'fechado'}`} camera={[4.5, 6, 7]} distancia={[3, 25]}>
            <ambientLight intensity={0.6} />
            <directionalLight position={[4, 8, 5]} intensity={1.4} />
            <directionalLight position={[-5, 4, -4]} intensity={0.4} />
            <gridHelper args={[16, 16, '#475569', '#334155']} position={[0, -0.01, 0]} />
            <Dobravel rede={rede} abertaRef={abertaRef} alvo={alvo} />
          </Palco3D>
        }
        leituras={
          <Leituras
            titulo={s.nome}
            itens={[
              { rotulo: 'Vértices (V)', valor: String(s.vertices) },
              { rotulo: 'Arestas (A)', valor: String(s.arestas) },
              { rotulo: 'Faces (F)', valor: String(s.faces) },
              { rotulo: 'V − A + F', valor: String(s.vertices - s.arestas + s.faces), nota: 'relação de Euler' },
              { rotulo: 'Área total', valor: fmt(s.area, 2), nota: 'a área da planificação' },
              { rotulo: 'Volume', valor: fmt(s.volume, 2), nota: s.formulaVolume },
            ]}
          />
        }
        controles={
          <>
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Sólido</p>
              <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Sólido">
                {NOMES.map((n) => (
                  <button key={n.key} type="button" role="radio" aria-checked={key === n.key} className="chip" data-active={key === n.key} onClick={() => escolher(n.key)}>
                    {n.nome}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <button type="button" className="btn btn-primary" onClick={() => setAlvo(1)}>
                Abrir
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setAlvo(0)}>
                Fechar
              </button>
            </div>
            <Deslizador rotulo="Abertura" valor={Math.round(alvo * 100)} min={0} max={100} unidade="%" onChange={(v) => setAlvo(v / 100)} />
            <Deslizador rotulo={rot[0]} valor={m[0]} min={1} max={4} passo={0.5} onChange={(v) => setM(key === 'cubo' || key === 'tetraedro' ? [v, v, v] : [v, m[1], m[2]])} />
            {rot[1] && <Deslizador rotulo={rot[1]} valor={m[1]} min={1} max={4} passo={0.5} onChange={(v) => setM([m[0], v, m[2]])} />}
            {rot[2] && <Deslizador rotulo={rot[2]} valor={m[2]} min={1} max={4} passo={0.5} onChange={(v) => setM([m[0], m[1], v])} />}
          </>
        }
      />
      <Explicacao
        enem={'Cai reconhecer qual **planificação** monta um sólido (cuidado: nem todo desenho de seis quadrados fecha um cubo), contar **vértices, arestas e faces** e calcular **área** (embalagem, quanto papel ou tinta) e **volume** (quanto cabe). Lembre que a pirâmide tem um terço do volume do prisma de mesma base e altura.'}
      >
        {`A **planificação** é o sólido "desmontado" no plano: todas as faces ligadas pelas arestas, como a caixa de papelão aberta. Use **Abrir** e **Fechar** e veja cada face girar em torno da aresta que a prende (a dobradiça) até fechar o sólido.

A **área total** do sólido é a área da planificação: a soma das áreas de todas as faces. O **volume** é quanto cabe dentro: base × altura nos prismas e no paralelepípedo, e **um terço** disso nas pirâmides.

Conte vértices (V), arestas (A) e faces (F) de qualquer poliedro convexo e sempre dá $V - A + F = 2$: é a **relação de Euler**. No cubo, $8 - 12 + 6 = 2$; na pirâmide de base quadrada, $5 - 8 + 5 = 2$.`}
      </Explicacao>
    </div>
  );
}
