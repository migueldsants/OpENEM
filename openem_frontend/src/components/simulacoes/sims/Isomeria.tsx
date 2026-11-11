import { Html } from '@react-three/drei';
import { useMemo, useState } from 'react';
import * as THREE from 'three';
import { configuracao, distancia, formula, PARES, type Molecula } from '../../../lib/simulacoes/isomeria';
import { COR_ATOMO } from '../../../lib/simulacoes/moleculas';
import { fmt } from '../../../lib/simulacoes/numerico';
import { Palco3D } from '../Palco3D';
import { Alternar, Deslizador, Explicacao, LayoutSim, Leituras } from '../ui';

const RAIO: Record<string, number> = { H: 0.24, C: 0.36, O: 0.34, F: 0.32, Cl: 0.46, Br: 0.52 };
const CIMA = new THREE.Vector3(0, 1, 0);
const SEPARACAO = 3.8;

function Ligacao({ a, b, ordem }: { a: THREE.Vector3; b: THREE.Vector3; ordem: 1 | 2 }) {
  const dir = b.clone().sub(a);
  const comp = dir.length();
  const quat = new THREE.Quaternion().setFromUnitVectors(CIMA, dir.clone().normalize());
  const lado = new THREE.Vector3().crossVectors(dir, Math.abs(dir.y) < comp * 0.9 ? CIMA : new THREE.Vector3(1, 0, 0)).normalize().multiplyScalar(0.09);
  const meio = a.clone().add(b).multiplyScalar(0.5);
  const offs = ordem === 2 ? [lado, lado.clone().negate()] : [new THREE.Vector3()];
  return (
    <>
      {offs.map((o, i) => (
        <mesh key={i} position={meio.clone().add(o)} quaternion={quat}>
          <cylinderGeometry args={[ordem === 2 ? 0.055 : 0.08, ordem === 2 ? 0.055 : 0.08, comp, 12]} />
          <meshStandardMaterial color="#9aa3b2" roughness={0.45} />
        </mesh>
      ))}
    </>
  );
}

function Modelo({ m, deslocar, giroY = 0, destaque }: { m: Molecula; deslocar: number; giroY?: number; destaque?: number }) {
  const pos = useMemo(() => {
    const rot = new THREE.Matrix4().makeRotationY((giroY * Math.PI) / 180);
    return m.pos.map((p) => new THREE.Vector3(...p).applyMatrix4(rot).add(new THREE.Vector3(deslocar, 0, 0)));
  }, [m, deslocar, giroY]);
  return (
    <group>
      {m.el.map((el, i) => (
        <mesh key={i} position={pos[i]}>
          <sphereGeometry args={[RAIO[el] ?? 0.3, 24, 24]} />
          <meshStandardMaterial color={COR_ATOMO[el]} roughness={0.35} emissive={i === destaque ? '#f2587a' : '#000000'} emissiveIntensity={i === destaque ? 0.35 : 0} />
        </mesh>
      ))}
      {m.ligacoes.map((l, i) => (
        <Ligacao key={i} a={pos[l.a]} b={pos[l.b]} ordem={l.ordem} />
      ))}
    </group>
  );
}

/** Quantos átomos de B caem em cima de um átomo do mesmo elemento de A (depois de girar e encostar). */
function coincidem(a: Molecula, b: Molecula, giroY: number) {
  const rot = new THREE.Matrix4().makeRotationY((giroY * Math.PI) / 180);
  const pb = b.pos.map((p) => new THREE.Vector3(...p).applyMatrix4(rot));
  const usados = new Set<number>();
  let n = 0;
  b.el.forEach((el, i) => {
    const j = a.el.findIndex((e, k) => e === el && !usados.has(k) && new THREE.Vector3(...a.pos[k]).distanceTo(pb[i]) < 0.35);
    if (j >= 0) {
      usados.add(j);
      n++;
    }
  });
  return n;
}

export default function Isomeria() {
  const [key, setKey] = useState('but-2-eno');
  const [giro, setGiro] = useState(0);
  const [giroB, setGiroB] = useState(0);
  const [encostar, setEncostar] = useState(false);
  const [girar, setGirar] = useState(false);
  const par = PARES.find((p) => p.key === key)!;
  const [a, b] = useMemo(() => par.girar(giro), [par, giro]);
  const optica = par.tipo === 'óptica';
  const juntos = optica && encostar;
  const iguais = juntos ? coincidem(a, b, giroB) : 0;

  const escolher = (k: string) => {
    setKey(k);
    setGiro(0);
    setGiroB(0);
    setEncostar(false);
  };

  // Distância entre os dois substituintes da dupla (metilas ou cloros), para comparar cis e trans.
  const substituintes = par.tipo === 'geométrica' ? (key === 'but-2-eno' ? [0, 3] : [2, 3]) : null;

  return (
    <div className="lg:h-full">
      <LayoutSim
        palco={
          <Palco3D rotulo={`${a.nome} e ${b.nome}, isomeria ${par.tipo}`} camera={[0, 1.5, 15]} distancia={[4, 25]} autoGirar={girar} parado={!girar}>
            <ambientLight intensity={0.6} />
            <directionalLight position={[4, 6, 6]} intensity={1.5} />
            <directionalLight position={[-5, -2, -4]} intensity={0.4} />
            <Modelo m={a} deslocar={juntos ? 0 : -SEPARACAO} destaque={par.quiral} />
            <Modelo m={b} deslocar={juntos ? 0 : SEPARACAO} giroY={giroB} destaque={par.quiral} />
            {optica && !juntos && (
              <mesh rotation={[0, Math.PI / 2, 0]}>
                <planeGeometry args={[6, 5]} />
                <meshStandardMaterial color="#93c5fd" transparent opacity={0.12} side={THREE.DoubleSide} depthWrite={false} />
              </mesh>
            )}
            {!juntos && (
              <>
                <Html position={[-SEPARACAO, -2.4, 0]} center>
                  <span className="sim-rotulo-3d">{a.nome}</span>
                </Html>
                <Html position={[SEPARACAO, -2.4, 0]} center>
                  <span className="sim-rotulo-3d">{b.nome}</span>
                </Html>
              </>
            )}
            {optica && !juntos && (
              <Html position={[0, 2.7, 0]} center>
                <span className="sim-rotulo-3d">espelho</span>
              </Html>
            )}
          </Palco3D>
        }
        leituras={
          <Leituras
            itens={[
              { rotulo: 'Isomeria', valor: `${par.grupo} · ${par.tipo}` },
              { rotulo: 'Fórmula das duas', valor: formula(a), nota: 'mesma fórmula molecular: é o que faz deles isômeros' },
              ...(substituintes
                ? [
                    { rotulo: `Distância ${key === 'but-2-eno' ? 'CH₃ … CH₃' : 'Cl … Cl'} (cis)`, valor: `${fmt(distancia(a, substituintes[0], substituintes[1]), 2)} Å` },
                    { rotulo: '(trans)', valor: `${fmt(distancia(b, substituintes[0], substituintes[1]), 2)} Å` },
                  ]
                : []),
              ...(par.quiral !== undefined
                ? [
                    { rotulo: 'Carbono quiral', valor: configuracao(a, par.quiral) ? `${configuracao(a, par.quiral)} e ${configuracao(b, par.quiral)}` : 'sim (destacado)', nota: 'quatro grupos diferentes' },
                    ...(juntos ? [{ rotulo: 'Átomos que coincidem', valor: `${iguais} de ${a.el.length}`, cor: iguais === a.el.length ? 'var(--nat)' : 'var(--danger)' }] : []),
                  ]
                : []),
            ]}
          />
        }
        rotuloExtra="Sobre o par"
        extra={<p className="text-sm text-pretty">{par.nota}</p>}
        controles={
          <>
            {(['plana', 'espacial'] as const).map((g) => (
              <div key={g} className="space-y-1.5">
                <p className="text-sm font-medium">Isomeria {g}</p>
                <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={`Isomeria ${g}`}>
                  {PARES.filter((p) => p.grupo === g).map((p) => (
                    <button key={p.key} type="button" role="radio" aria-checked={key === p.key} data-active={key === p.key} className="chip" onClick={() => escolher(p.key)}>
                      {p.tipo === 'óptica' ? `óptica: ${p.a.nome.replace(/^\([RS]\)-/, '').replace(' no espelho', '')}` : `${p.tipo}: ${p.a.nome.replace(/^cis-/, '')}`}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {par.giro && !par.giro.dupla && (
              <Deslizador rotulo="Girar a ligação simples" valor={giro} min={0} max={360} passo={5} unidade="°" onChange={setGiro} dica="Gira à vontade: é a mesma molécula em outra posição (conformação), não outro isômero." />
            )}
            {par.giro?.dupla && (
              <p className="rounded-xl border border-line bg-surface-2 p-3 text-xs text-pretty">
                <strong>A dupla não gira.</strong> A segunda ligação (π) fica acima e abaixo do plano dos átomos; girar exigiria quebrá-la. Por isso cis e trans não viram um no outro.
              </p>
            )}
            {optica && (
              <>
                <Alternar rotulo="Encostar um no outro" marcado={encostar} onChange={setEncostar} dica="Tente sobrepor as duas moléculas." />
                <Deslizador rotulo="Girar a da direita" valor={giroB} min={0} max={360} passo={5} unidade="°" onChange={setGiroB} dica="Nenhum giro faz todos os átomos coincidirem: são enantiômeros." />
              </>
            )}
            <Alternar rotulo="Girar a cena sozinha" marcado={girar} onChange={setGirar} />
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
              {[...new Set([...a.el, ...b.el])].map((el) => (
                <span key={el} className="flex items-center gap-1">
                  <span className="size-2.5 rounded-full border border-line" style={{ background: COR_ATOMO[el] }} />
                  {el}
                </span>
              ))}
            </div>
          </>
        }
      />
      <Explicacao
        enem={'Cai classificar o tipo de isomeria entre dois nomes ou fórmulas, reconhecer o **carbono quiral** (quatro ligantes diferentes) e lembrar que a isomeria **geométrica** pede ligação dupla (ou anel) com dois ligantes diferentes em cada carbono. Os enantiômeros podem ter efeitos diferentes no corpo: um pode ser remédio e o outro, inativo ou tóxico (caso da talidomida).'}
      >
        {`**Isômeros** são compostos diferentes com a **mesma fórmula molecular**. Escolha um par e compare.

**Isomeria plana**: a diferença aparece já na fórmula estrutural.
- **De cadeia**: a cadeia muda (normal × ramificada).
- **De posição**: muda a posição de um grupo ou de uma insaturação na mesma cadeia.
- **De função**: as funções orgânicas são diferentes (álcool × éter).

**Isomeria espacial**: mesma fórmula estrutural, arranjo diferente no espaço.
- **Geométrica (cis-trans)**: na ligação dupla os átomos não giram. Com dois ligantes diferentes em cada carbono da dupla, eles podem ficar do mesmo lado (**cis**) ou em lados opostos (**trans**).
- **Óptica**: um **carbono quiral** (com quatro ligantes diferentes) faz a molécula e a sua imagem no espelho serem diferentes, como as mãos. Encoste uma na outra e gire: nunca coincidem.

A ligação simples gira livremente: girá-la só muda a **conformação** da mesma molécula. As moléculas aqui são montadas pelos ângulos reais (109,5° no carbono com só ligações simples, 120° no da dupla) e pelos comprimentos de ligação medidos.`}
      </Explicacao>
    </div>
  );
}
