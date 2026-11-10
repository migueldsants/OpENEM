import { Html } from '@react-three/drei';
import { useMemo, useState } from 'react';
import * as THREE from 'three';
import {
  anguloEntre,
  COR_ATOMO,
  ehPolar,
  momentoDipolo,
  MOLECULAS,
  montarMolecula,
  RAIO_ATOMO,
  type V3,
} from '../../../lib/simulacoes/moleculas';
import { fmt } from '../../../lib/simulacoes/numerico';
import { Palco3D } from '../Palco3D';
import { Alternar, Explicacao, LayoutSim, Leituras } from '../ui';

const PM = 1 / 100; // 1 unidade da cena = 100 pm
const CIMA = new THREE.Vector3(0, 1, 0);

function Ligacao({ de, para, ordem }: { de: V3; para: V3; ordem: number }) {
  const { meio, quat, comp, lado } = useMemo(() => {
    const a = new THREE.Vector3(...de).multiplyScalar(PM);
    const b = new THREE.Vector3(...para).multiplyScalar(PM);
    const dir = b.clone().sub(a);
    const comp = dir.length();
    dir.normalize();
    const quat = new THREE.Quaternion().setFromUnitVectors(CIMA, dir);
    // Desvio lateral para desenhar as ligações duplas e triplas lado a lado.
    const ref = Math.abs(dir.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    const lado = new THREE.Vector3().crossVectors(dir, ref).normalize();
    return { meio: a.add(b).multiplyScalar(0.5), quat, comp, lado };
  }, [de, para]);
  const offsets = ordem === 1 ? [0] : ordem === 2 ? [-0.07, 0.07] : [-0.11, 0, 0.11];
  return (
    <>
      {offsets.map((o) => (
        <mesh key={o} position={meio.clone().addScaledVector(lado, o)} quaternion={quat}>
          <cylinderGeometry args={[ordem === 1 ? 0.07 : 0.045, ordem === 1 ? 0.07 : 0.045, comp, 16]} />
          <meshStandardMaterial color="#9aa3b2" roughness={0.4} metalness={0.1} />
        </mesh>
      ))}
    </>
  );
}

function ParIsolado({ dir }: { dir: V3 }) {
  const quat = useMemo(() => new THREE.Quaternion().setFromUnitVectors(CIMA, new THREE.Vector3(...dir)), [dir]);
  const pos = new THREE.Vector3(...dir).multiplyScalar(0.62);
  const off = new THREE.Vector3(...dir).multiplyScalar(0.7);
  const perp = new THREE.Vector3(...(Math.abs(dir[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0])).cross(new THREE.Vector3(...dir)).normalize().multiplyScalar(0.08);
  return (
    <group>
      <mesh position={pos} quaternion={quat} scale={[0.26, 0.42, 0.26]}>
        <sphereGeometry args={[1, 24, 24]} />
        <meshStandardMaterial color="#ac8bf5" transparent opacity={0.28} depthWrite={false} />
      </mesh>
      {[1, -1].map((s) => (
        <mesh key={s} position={off.clone().addScaledVector(perp, s)}>
          <sphereGeometry args={[0.04, 12, 12]} />
          <meshBasicMaterial color="#7651ba" />
        </mesh>
      ))}
    </group>
  );
}

export default function GeometriaMolecular() {
  const [key, setKey] = useState('h2o');
  const [pares, setPares] = useState(true);
  const [dipolo, setDipolo] = useState(true);
  const [girar, setGirar] = useState(true);
  const mol = MOLECULAS.find((m) => m.key === key)!;
  const geo = useMemo(() => montarMolecula(mol), [mol]);
  const mu = useMemo(() => momentoDipolo(mol), [mol]);
  const polar = ehPolar(mol);

  // Par de ligantes cujo ângulo é o primeiro da ficha, para o rótulo na cena.
  const rotulo = useMemo(() => {
    const alvo = mol.angulos[0].valor;
    let melhor: [number, number] = [1, 2];
    let erro = Infinity;
    for (let i = 1; i < geo.atomos.length; i++) {
      for (let j = i + 1; j < geo.atomos.length; j++) {
        const e = Math.abs(anguloEntre(geo.atomos[i].pos, geo.atomos[j].pos) - alvo);
        if (e < erro) { erro = e; melhor = [i, j]; }
      }
    }
    const [i, j] = melhor;
    const a = new THREE.Vector3(...geo.atomos[i].pos).normalize();
    const b = new THREE.Vector3(...geo.atomos[j].pos).normalize();
    const meio = a.add(b);
    if (meio.length() < 1e-6) meio.set(0, 0.0001, 1);
    return meio.normalize().multiplyScalar(0.55);
  }, [geo, mol]);

  const muLen = Math.hypot(...mu);
  const muDir = muLen > 0.05 ? new THREE.Vector3(...mu).normalize() : null;

  return (
    <div className="lg:h-full">
      <LayoutSim
        palco={
          <Palco3D rotulo={`Modelo de bolas e varetas de ${mol.nome}`} camera={[0, 1.2, 5]} distancia={[2.5, 12]} autoGirar={girar}>
            <ambientLight intensity={0.55} />
            <directionalLight position={[3, 5, 4]} intensity={1.6} />
            <directionalLight position={[-4, -2, -3]} intensity={0.4} />
            {geo.atomos.map((a, i) => (
              <mesh key={i} position={a.pos.map((x) => x * PM) as [number, number, number]}>
                <sphereGeometry args={[RAIO_ATOMO[a.el] * PM * (i === 0 ? 1.15 : 1), 32, 32]} />
                <meshStandardMaterial color={COR_ATOMO[a.el]} roughness={0.35} metalness={0.05} />
              </mesh>
            ))}
            {geo.ligacoes.map((l) => (
              <Ligacao key={l.para} de={geo.atomos[l.de].pos} para={geo.atomos[l.para].pos} ordem={l.ordem} />
            ))}
            {pares && geo.pares.map((d, i) => <ParIsolado key={i} dir={d} />)}
            {dipolo && muDir && (
              <arrowHelper args={[muDir, new THREE.Vector3(0, 0, 0), 0.6 + muLen * 0.5, 0xf2587a, 0.22, 0.14]} />
            )}
            <Html position={rotulo.toArray()} center>
              <span className="sim-rotulo-3d">{fmt(mol.angulos[0].valor, 1)}°</span>
            </Html>
            {geo.atomos.slice(1).map((a, i) => (
              <Html key={`r${i}`} position={a.pos.map((x) => x * PM * 1.32) as [number, number, number]} center>
                <span className="text-[11px] font-bold text-muted">{a.el}</span>
              </Html>
            ))}
          </Palco3D>
        }
        leituras={
          <Leituras
            titulo={`${mol.formula} · ${mol.nome}`}
            itens={[
              { rotulo: 'Geometria', valor: mol.geometria },
              { rotulo: 'Nuvens eletrônicas', valor: mol.arranjo },
              { rotulo: 'Pares isolados no central', valor: String(geo.pares.length) },
              { rotulo: 'Polaridade', valor: polar ? 'polar' : 'apolar', cor: polar ? 'var(--brand)' : 'var(--nat)' },
              ...mol.angulos.map((a) => ({ rotulo: `Ângulo ${a.rotulo}`, valor: `${fmt(a.valor, 1)}°`, nota: a.valor !== a.ideal ? `ideal: ${fmt(a.ideal, 1)}°` : undefined })),
              { rotulo: 'Ligação', valor: `${fmt(mol.ligantes[0].pm, 1)} pm`, nota: `${mol.central}–${mol.ligantes[0].el}` },
            ]}
          />
        }
        rotuloExtra="Sobre a molécula"
        extra={<p className="text-sm text-pretty">{mol.nota}</p>}
        controles={
          <>
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Molécula</p>
              <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Molécula">
                {MOLECULAS.map((m) => (
                  <button key={m.key} type="button" role="radio" aria-checked={m.key === key} className="chip" data-active={m.key === key} onClick={() => setKey(m.key)} title={m.nome}>
                    {m.formula}
                  </button>
                ))}
              </div>
            </div>
            <Alternar rotulo="Pares de elétrons isolados" marcado={pares} onChange={setPares} />
            <Alternar rotulo="Momento de dipolo (seta)" marcado={dipolo} onChange={setDipolo} dica="A seta aponta para o polo negativo. Molécula apolar: sem seta." />
            <Alternar rotulo="Girar sozinha" marcado={girar} onChange={setGirar} />
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
              {[...new Set(geo.atomos.map((a) => a.el))].map((el) => (
                <span key={el} className="flex items-center gap-1">
                  <span className="size-2.5 rounded-full border border-line" style={{ background: COR_ATOMO[el] }} />
                  {el}
                </span>
              ))}
            </div>
          </>
        }
      />
      <Explicacao enem={'A polaridade decide a **solubilidade** ("semelhante dissolve semelhante") e as forças intermoleculares: a água é polar e faz pontes de hidrogênio; o $CO_2$ tem ligações polares, mas é apolar porque é linear e os dipolos se anulam. Questões de geometria pedem contar as nuvens eletrônicas do átomo central e quantas são pares isolados.'}>
        {`Pela **teoria da repulsão dos pares eletrônicos** (VSEPR), as nuvens de elétrons em volta do átomo central se afastam o máximo possível: 2 nuvens ficam em linha, 3 em triângulo, 4 num tetraedro, 5 numa bipirâmide trigonal e 6 num octaedro. A **geometria** da molécula, porém, considera só os átomos: o metano, a amônia e a água têm 4 nuvens, mas são tetraédrica, piramidal e angular.

Os pares isolados (lobos roxos) ocupam mais espaço que os pares ligantes e fecham os ângulos: 109,5° no metano, 106,7° na amônia, 104,5° na água. Os ângulos e comprimentos de ligação deste modelo são os **medidos** em laboratório, não os ideais.

A seta é a soma vetorial dos dipolos de cada ligação (apontando para o átomo mais eletronegativo) e dos pares isolados. Se a soma se anula por simetria, a molécula é apolar.`}
      </Explicacao>
    </div>
  );
}
