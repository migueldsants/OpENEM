import { useFrame } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { fmt } from '../../../lib/simulacoes/numerico';
import { amplitudeFonte, comprimentoOnda, envoltoria, linhasNodais, linhasVentrais, type Fontes } from '../../../lib/simulacoes/ondas-superficie';
import { usaMovimentoReduzido } from '../canvas';
import { Palco3D } from '../Palco3D';
import { Alternar, BarraExecucao, Deslizador, Explicacao, LayoutSim, Leituras, Segmentos } from '../ui';

/** A cuba tem 1 m de lado; na cena, 1 m = 10 unidades. */
const ESC = 10;
const LADO = 1;
/** Malha mais leve em tela pequena (celular): 8 mil vértices em vez de 20 mil. */
const SEG = typeof window !== 'undefined' && window.innerWidth < 768 ? 90 : 140;
/** Exagero vertical: ondas de milímetros não apareceriam. */
const EXAGERO = 4;
const BAIXO = new THREE.Color('#1e3a8a');
const ALTO = new THREE.Color('#bfdbfe');
const PARADA = new THREE.Color('#0f172a');

type Modo = 'fase' | 'oposicao' | 'uma';

/**
 * A superfície da água. O que não muda com o tempo (distância de cada vértice
 * a cada fonte, amplitude de cada onda ali, direção e a envoltória) é
 * calculado uma vez por ajuste dos controles; a cada quadro sobram dois senos
 * e dois cossenos por vértice. As normais saem da derivada da altura, sem
 * `computeVertexNormals` (que percorria 39 mil triângulos por quadro).
 */
function Superficie({ p, tRef, rodando, lento, amplitude }: { p: Fontes; tRef: React.RefObject<number>; rodando: boolean; lento: boolean; amplitude: boolean }) {
  const malha = useRef<THREE.Mesh>(null);
  const geo = useRef<THREE.PlaneGeometry | null>(null);
  const cache = useRef<{ chave: string; dados: Float32Array } | null>(null);
  useEffect(() => {
    const g = new THREE.PlaneGeometry(LADO * ESC, LADO * ESC, SEG, SEG);
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3), 3));
    geo.current = g;
    cache.current = null;
    if (malha.current) malha.current.geometry = g;
    return () => g.dispose();
  }, []);
  useFrame((_, dt) => {
    const g = geo.current;
    if (!g) return;
    if (rodando) tRef.current += Math.min(dt, 0.05) * (lento ? 0.25 : 1);
    const t = tRef.current;
    const pos = g.attributes.position.array as Float32Array;
    const cores = g.attributes.color.array as Float32Array;
    const normais = g.attributes.normal.array as Float32Array;
    const n = pos.length / 3;
    const lambda = comprimentoOnda(p);
    const k = (2 * Math.PI) / lambda;
    const w = 2 * Math.PI * p.f;
    const aRef = envoltoria(p, 0, LADO * 0.35) || 1;
    // Por vértice: r1, a1, ux1, uy1, r2, a2, ux2, uy2, envoltória.
    const chave = `${lambda}|${p.d}|${p.fase}|${p.uma ? 1 : 0}`;
    if (cache.current?.chave !== chave) {
      const dados = new Float32Array(n * 9);
      for (let i = 0; i < n; i++) {
        const x = pos[3 * i] / ESC;
        const y = pos[3 * i + 1] / ESC + LADO / 2; // fontes na borda de baixo
        for (let f = 0; f < 2; f++) {
          const dx = x + (f ? -p.d / 2 : p.d / 2);
          const r = Math.hypot(dx, y) || 1e-6;
          const o = i * 9 + f * 4;
          dados[o] = r;
          dados[o + 1] = f && p.uma ? 0 : amplitudeFonte(p, r);
          dados[o + 2] = dx / r;
          dados[o + 3] = y / r;
        }
        dados[i * 9 + 8] = Math.min(1, envoltoria(p, x, y) / aRef / 1.6);
      }
      cache.current = { chave, dados };
    }
    const d = cache.current.dados;
    const base = amplitude ? PARADA : BAIXO;
    for (let i = 0; i < n; i++) {
      const o = i * 9;
      const f1 = k * d[o] - w * t;
      const f2 = k * d[o + 4] - w * t + p.fase;
      const a1 = d[o + 1];
      const a2 = d[o + 5];
      const h = a1 * Math.sin(f1) + a2 * Math.sin(f2);
      pos[3 * i + 2] = h * ESC * EXAGERO;
      // Inclinação da superfície: derivada da altura em x e em y.
      const c1 = a1 * k * Math.cos(f1);
      const c2 = a2 * k * Math.cos(f2);
      const nx = -EXAGERO * (c1 * d[o + 2] + c2 * d[o + 6]);
      const ny = -EXAGERO * (c1 * d[o + 3] + c2 * d[o + 7]);
      const inv = 1 / Math.hypot(nx, ny, 1);
      normais[3 * i] = nx * inv;
      normais[3 * i + 1] = ny * inv;
      normais[3 * i + 2] = inv;
      const m = amplitude ? d[o + 8] : Math.max(0, Math.min(1, 0.5 + (h / aRef) * 0.55));
      cores[3 * i] = base.r + (ALTO.r - base.r) * m;
      cores[3 * i + 1] = base.g + (ALTO.g - base.g) * m;
      cores[3 * i + 2] = base.b + (ALTO.b - base.b) * m;
    }
    g.attributes.position.needsUpdate = true;
    g.attributes.color.needsUpdate = true;
    g.attributes.normal.needsUpdate = true;
  });
  return (
    <mesh ref={malha} rotation={[-Math.PI / 2, 0, 0]}>
      <meshStandardMaterial vertexColors roughness={0.35} metalness={0.05} side={THREE.DoubleSide} />
    </mesh>
  );
}

function Fonte({ x, fase, f, tRef }: { x: number; fase: number; f: number; tRef: React.RefObject<number> }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (ref.current) ref.current.position.y = 0.25 + 0.12 * Math.sin(2 * Math.PI * f * tRef.current - fase);
  });
  return (
    <mesh ref={ref} position={[x * ESC, 0.25, (LADO / 2) * ESC]}>
      <sphereGeometry args={[0.16, 20, 20]} />
      <meshStandardMaterial color="#f2587a" emissive="#f2587a" emissiveIntensity={0.4} />
    </mesh>
  );
}

export default function Interferencia() {
  const [f, setF] = useState(3);
  const [prof, setProf] = useState(5);
  const [dCm, setDCm] = useState(18);
  const [modo, setModo] = useState<Modo>('fase');
  const [rodando, setRodando] = useState(!usaMovimentoReduzido());
  const [lento, setLento] = useState(false);
  const [amplitude, setAmplitude] = useState(false);
  const tRef = useRef(0);
  // Água rasa: v = √(g·h).
  const v = Math.sqrt(9.81 * (prof / 1000));
  const p: Fontes = { f, v, d: dCm / 100, fase: modo === 'oposicao' ? Math.PI : 0, uma: modo === 'uma' };
  const lambda = comprimentoOnda(p);

  return (
    <div className="lg:h-full">
      <LayoutSim
        palco={
          <Palco3D rotulo="Cuba de ondas vista de cima, com duas fontes batendo na água" camera={[0, 8, 9]} distancia={[4, 22]}>
            <ambientLight intensity={0.45} />
            <directionalLight position={[3, 8, 4]} intensity={1.6} />
            <directionalLight position={[-4, 3, -6]} intensity={0.35} />
            <Superficie p={p} tRef={tRef} rodando={rodando} lento={lento} amplitude={amplitude} />
            <Fonte x={-p.d / 2} fase={0} f={f} tRef={tRef} />
            {!p.uma && <Fonte x={p.d / 2} fase={p.fase} f={f} tRef={tRef} />}
          </Palco3D>
        }
        leituras={
          <Leituras
            itens={[
              { rotulo: 'Comprimento de onda', valor: `${fmt(lambda * 100, 1)} cm`, nota: 'λ = v/f' },
              { rotulo: 'Velocidade da onda', valor: `${fmt(v * 100, 1)} cm/s`, nota: 'água rasa: v = √(g·h)' },
              { rotulo: 'Período', valor: `${fmt(1 / f, 2)} s` },
              { rotulo: 'Fontes a quantos λ', valor: p.uma ? '–' : fmt(p.d / lambda, 2) },
              { rotulo: 'Linhas nodais', valor: p.uma ? '–' : String(linhasNodais(p)), nota: 'onde a água fica parada' },
              { rotulo: 'Linhas de reforço', valor: p.uma ? '–' : String(linhasVentrais(p)) },
            ]}
          />
        }
        controles={
          <>
            <BarraExecucao rodando={rodando} onAlternar={() => setRodando((r) => !r)} />
            <Segmentos
              rotulo="Fontes"
              valor={modo}
              opcoes={[
                { valor: 'fase', rotulo: 'Em fase' },
                { valor: 'oposicao', rotulo: 'Oposição' },
                { valor: 'uma', rotulo: 'Uma só' },
              ]}
              onChange={setModo}
            />
            <Deslizador rotulo="Frequência" valor={f} min={1} max={6} passo={0.1} unidade="Hz" onChange={setF} />
            <Deslizador rotulo="Distância entre as fontes" valor={dCm} min={4} max={36} unidade="cm" onChange={setDCm} />
            <Deslizador rotulo="Profundidade da água" valor={prof} min={1} max={15} passo={0.5} unidade="mm" onChange={setProf} dica="Mais funda, a onda corre mais e o comprimento de onda cresce." />
            <Alternar rotulo="Colorir pela amplitude" marcado={amplitude} onChange={setAmplitude} dica="As faixas escuras são as linhas nodais: ali as duas ondas se cancelam o tempo todo." />
            <Alternar rotulo="Câmera lenta (¼)" marcado={lento} onChange={setLento} />
          </>
        }
      />
      <Explicacao
        enem={'A pergunta clássica: num ponto, a diferença entre as distâncias às duas fontes é $\\Delta = n\\lambda$ (interferência **construtiva**) ou $\\Delta = (n + \\tfrac12)\\lambda$ (**destrutiva**)? Também caem a equação fundamental $v = \\lambda f$ (a frequência é da fonte; a velocidade é do meio) e a interferência como prova de que a luz é onda (experimento de Young, com fendas no lugar das fontes).'}
      >
        {`Duas pontas batem na água na mesma frequência, e cada uma faz ondas circulares. Onde a crista de uma encontra a crista da outra, a água sobe o dobro (**interferência construtiva**); onde a crista encontra um vale, elas se cancelam e a água fica parada (**destrutiva**).

O que decide é a **diferença de caminho**: a distância até uma fonte menos a distância até a outra. Se é um número inteiro de comprimentos de onda, as ondas chegam juntas; se sobra meio comprimento, chegam opostas. Os pontos com a mesma diferença formam hipérboles: as **linhas nodais** (água parada) e as de reforço, alternadas. Ligue "Colorir pela amplitude" para vê-las.

Afaste as fontes ou aumente a frequência e as linhas ficam mais juntas e numerosas: cabem mais comprimentos de onda entre as fontes. Em **oposição de fase**, uma fonte sobe quando a outra desce, e o centro, que era de reforço, vira linha nodal.

A velocidade na água rasa depende da profundidade, $v = \\sqrt{g\\,h}$: mude a profundidade e veja $\\lambda$ mudar com a frequência fixa. A altura das ondas está exagerada ${EXAGERO} vezes.`}
      </Explicacao>
    </div>
  );
}
