import { Line } from '@react-three/drei';
import { useMemo, useState } from 'react';
import * as THREE from 'three';
import {
  atomosPorCelula,
  coordenacao,
  densidade,
  empacotamento,
  ESTRUTURAS,
  gerarReticulo,
  ligacoesVizinhas,
  type Estrutura,
  type V3,
} from '../../../lib/simulacoes/cristais';
import { fmt } from '../../../lib/simulacoes/numerico';
import { Palco3D } from '../Palco3D';
import { Alternar, Deslizador, Explicacao, LayoutSim, Leituras } from '../ui';

const CIMA = new THREE.Vector3(0, 1, 0);

function Barra({ de, para }: { de: THREE.Vector3; para: THREE.Vector3 }) {
  const { meio, quat, comp } = useMemo(() => {
    const dir = para.clone().sub(de);
    const comp = dir.length();
    return { meio: de.clone().add(para).multiplyScalar(0.5), quat: new THREE.Quaternion().setFromUnitVectors(CIMA, dir.normalize()), comp };
  }, [de, para]);
  return (
    <mesh position={meio} quaternion={quat}>
      <cylinderGeometry args={[0.028, 0.028, comp, 10]} />
      <meshStandardMaterial color="#9aa3b2" roughness={0.5} />
    </mesh>
  );
}

/** Arestas do cubo da célula unitária. */
function Celula({ lado, centro }: { lado: number; centro: number }) {
  const c = (v: number) => v * lado - centro;
  const vertices: V3[] = [];
  for (const x of [0, 1]) for (const y of [0, 1]) for (const z of [0, 1]) vertices.push([x, y, z]);
  const arestas = vertices.flatMap((a, i) => vertices.slice(i + 1).filter((b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) === 1).map((b) => [a, b]));
  return (
    <>
      {arestas.map(([a, b], i) => (
        <Line key={i} points={[a.map(c) as V3, b.map(c) as V3]} color="#f2587a" lineWidth={2} />
      ))}
    </>
  );
}

function Reticulo({ e, n, compacto, ligacoes, soCelula }: { e: Estrutura; n: number; compacto: boolean; ligacoes: boolean; soCelula: boolean }) {
  const lado = 1.6; // tamanho da célula na cena
  const centro = (n * lado) / 2;
  const atomos = useMemo(() => gerarReticulo(e, n), [e, n]);
  const coord = useMemo(() => coordenacao(e), [e]);
  const lig = useMemo(() => (ligacoes ? ligacoesVizinhas(atomos, coord.distancia) : []), [atomos, coord, ligacoes]);
  const pos = (p: V3) => new THREE.Vector3(p[0] * lado - centro, p[1] * lado - centro, p[2] * lado - centro);
  // Raio real (escala da célula) no modelo compacto; bolinhas pequenas no de varetas.
  const raio = (esp: number) => (e.especies[esp].raio / e.a) * lado * (compacto ? 1 : 0.45);
  // Na primeira célula, destaca os átomos que pertencem a ela.
  const naCelula = (p: V3) => p.every((c) => c > -1e-6 && c < 1 + 1e-6);
  return (
    <group>
      {atomos.map((a, i) => {
        const dentro = naCelula(a.pos);
        if (soCelula && !dentro) return null;
        return (
          <mesh key={i} position={pos(a.pos)}>
            <sphereGeometry args={[raio(a.especie), 24, 24]} />
            <meshStandardMaterial color={e.especies[a.especie].cor} roughness={0.35} transparent={!dentro} opacity={dentro ? 1 : 0.35} />
          </mesh>
        );
      })}
      {lig.map(([i, j], k) =>
        soCelula && !(naCelula(atomos[i].pos) && naCelula(atomos[j].pos)) ? null : <Barra key={k} de={pos(atomos[i].pos)} para={pos(atomos[j].pos)} />,
      )}
      <Celula lado={lado} centro={centro} />
    </group>
  );
}

export default function Cristais() {
  const [key, setKey] = useState<Estrutura['key']>('nacl');
  const [n, setN] = useState(2);
  const [compacto, setCompacto] = useState(false);
  const [ligacoes, setLigacoes] = useState(true);
  const [soCelula, setSoCelula] = useState(false);
  const [girar, setGirar] = useState(true);
  const e = ESTRUTURAS.find((x) => x.key === key)!;
  const z = atomosPorCelula(e);
  const coord = coordenacao(e);
  const rho = densidade(e);

  return (
    <div className="lg:h-full">
      <LayoutSim
        palco={
          <Palco3D rotulo={`Retículo cristalino: ${e.nome} (${e.exemplo})`} camera={[4.5, 3.5, 6]} distancia={[3, 20]} autoGirar={girar}>
            <ambientLight intensity={0.55} />
            <directionalLight position={[4, 6, 5]} intensity={1.5} />
            <directionalLight position={[-5, -3, -4]} intensity={0.4} />
            <Reticulo e={e} n={soCelula ? 1 : n} compacto={compacto} ligacoes={ligacoes && !compacto} soCelula={soCelula} />
          </Palco3D>
        }
        leituras={
          <Leituras
            titulo={`${e.nome} · ${e.exemplo}`}
            itens={[
              { rotulo: 'Ligação', valor: e.ligacao },
              { rotulo: 'Átomos por célula', valor: e.key === 'nacl' ? `${fmt(z / 2, 0)} Na⁺ + ${fmt(z / 2, 0)} Cl⁻` : fmt(z, 0), nota: 'canto vale 1/8, aresta 1/4, face 1/2' },
              { rotulo: 'Vizinhos de cada átomo', valor: String(coord.numero), nota: 'número de coordenação' },
              { rotulo: 'Espaço ocupado', valor: `${fmt(empacotamento(e) * 100, 0)}%`, nota: 'fator de empacotamento' },
              { rotulo: 'Aresta da célula', valor: `${fmt(e.a, 1)} pm` },
              { rotulo: 'Densidade calculada', valor: `${fmt(rho, 2)} g/cm³`, nota: `medida: ${fmt(e.densidadeReal, 2)} g/cm³` },
            ]}
          />
        }
        rotuloExtra="Sobre o cristal"
        extra={<p className="text-sm text-pretty">{e.nota}</p>}
        controles={
          <>
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Cristal</p>
              <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Cristal">
                {ESTRUTURAS.map((x) => (
                  <button key={x.key} type="button" role="radio" aria-checked={x.key === key} data-active={x.key === key} className="chip justify-center" onClick={() => setKey(x.key)}>
                    {x.exemplo}
                  </button>
                ))}
              </div>
            </div>
            <Deslizador rotulo="Células por aresta" valor={n} min={1} max={3} onChange={setN} />
            <Alternar rotulo="Só a célula unitária" marcado={soCelula} onChange={setSoCelula} dica="Os átomos dos vizinhos ficam de fora: dá para contar quanto de cada um cabe na célula." />
            <Alternar rotulo="Tamanho real dos átomos" marcado={compacto} onChange={setCompacto} dica="Esferas no raio medido: veja quanto espaço sobra entre elas." />
            <Alternar rotulo="Ligações com os vizinhos" marcado={ligacoes} onChange={setLigacoes} />
            <Alternar rotulo="Girar sozinho" marcado={girar} onChange={setGirar} />
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
              {e.especies.map((esp) => (
                <span key={esp.simbolo} className="flex items-center gap-1">
                  <span className="size-2.5 rounded-full border border-line" style={{ background: esp.cor }} />
                  {esp.simbolo} ({esp.nome})
                </span>
              ))}
              <span className="flex items-center gap-1">
                <span className="h-0.5 w-3 rounded" style={{ background: '#f2587a' }} />
                célula unitária
              </span>
            </div>
          </>
        }
      />
      <Explicacao
        enem={'As questões ligam a **estrutura** às **propriedades**: compostos iônicos (retículo de íons) têm ponto de fusão alto, são duros e quebradiços e só conduzem corrente fundidos ou dissolvidos; metais conduzem e são maleáveis porque os elétrons ficam livres no retículo; o diamante é duro porque cada carbono faz 4 ligações covalentes numa rede contínua, enquanto o grafite, também de carbono, tem camadas que deslizam.'}
      >
        {`Um cristal é a mesma **célula unitária** repetida nas três direções. O cubo rosa marca uma delas.

**Contando os átomos:** um átomo no canto do cubo é dividido entre 8 células, então só 1/8 dele pertence a esta; na aresta, 1/4; na face, 1/2; no interior, inteiro. Ligue "Só a célula unitária" e confira: a cúbica de corpo centrado tem $8 \\cdot \\tfrac18 + 1 = 2$ átomos, a de face centrada $8 \\cdot \\tfrac18 + 6 \\cdot \\tfrac12 = 4$.

Com o tamanho real dos átomos, aparece o **fator de empacotamento**: 68% do espaço ocupado na cúbica de corpo centrado e 74% na de face centrada, o máximo possível para esferas iguais. O diamante ocupa só 34%, porque as ligações covalentes têm direção fixa.

A **densidade** sai da geometria: $\\rho = \\dfrac{Z \\cdot M}{N_A \\cdot a^3}$, com $Z$ átomos por célula, $M$ a massa molar e $a$ a aresta medida por difração de raios X. O resultado bate com a densidade medida em balança.`}
      </Explicacao>
    </div>
  );
}
