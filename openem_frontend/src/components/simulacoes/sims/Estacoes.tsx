import { Html, Line } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { PLANETAS, posicaoPlaneta, UA_KM, type V3 } from '../../../lib/simulacoes/gravitacao';
import { fmt } from '../../../lib/simulacoes/numerico';
import {
  alturaMeioDia,
  CIDADES,
  declinacaoSolar,
  duracaoDia,
  eixoTerra,
  estacao,
  insolacaoDiaria,
  OBLIQUIDADE,
} from '../../../lib/simulacoes/vida-terra';
import { usaMovimentoReduzido } from '../canvas';
import { Palco3D } from '../Palco3D';
import { BarraExecucao, Bloco, Deslizador, Explicacao, Grafico, LayoutSim, Leituras, Seletor } from '../ui';

const ANO = 2026;
const DIST = 6; // unidades da cena por UA (raio da Terra exagerado)
const R_TERRA = 0.85;
const J2000 = Date.UTC(2000, 0, 1, 12);
const TERRA = PLANETAS[2];

const anosDesdeJ2000 = (dia: number) => (Date.UTC(ANO, 0, dia, 12) - J2000) / (365.25 * 86400000);
const cena = (p: V3, k: number): [number, number, number] => [p[0] * k, p[2] * k, -p[1] * k];
const dataDoDia = (dia: number) => new Date(Date.UTC(ANO, 0, dia, 12)).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', timeZone: 'UTC' });
const horas = (h: number) => `${Math.floor(h)} h ${String(Math.round((h % 1) * 60)).padStart(2, '0')} min`;

/** Textura da Terra desenhada no próprio aparelho: paralelos notáveis, sem imagem externa. */
function texturaTerra() {
  const W = 1024;
  const H = 512;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext('2d');
  if (!ctx) return null;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#dbeafe');
  g.addColorStop(0.12, '#2f6fb3');
  g.addColorStop(0.5, '#1f5fa8');
  g.addColorStop(0.88, '#2f6fb3');
  g.addColorStop(1, '#e0f2fe');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const y = (lat: number) => ((90 - lat) / 180) * H;
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 1;
  for (let lat = -75; lat <= 75; lat += 15) { ctx.beginPath(); ctx.moveTo(0, y(lat)); ctx.lineTo(W, y(lat)); ctx.stroke(); }
  for (let lon = 0; lon < 360; lon += 30) { ctx.beginPath(); ctx.moveTo((lon / 360) * W, 0); ctx.lineTo((lon / 360) * W, H); ctx.stroke(); }
  const linha = (lat: number, cor: string, larg: number, tracejado = false) => {
    ctx.setLineDash(tracejado ? [14, 10] : []);
    ctx.strokeStyle = cor;
    ctx.lineWidth = larg;
    ctx.beginPath(); ctx.moveTo(0, y(lat)); ctx.lineTo(W, y(lat)); ctx.stroke();
  };
  linha(0, '#ffffff', 4);
  linha(OBLIQUIDADE, '#fcd34d', 3, true);
  linha(-OBLIQUIDADE, '#fcd34d', 3, true);
  linha(90 - OBLIQUIDADE, '#e0f2fe', 3, true);
  linha(-(90 - OBLIQUIDADE), '#e0f2fe', 3, true);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function Terra({ diaRef, lat }: { diaRef: React.RefObject<number>; lat: number }) {
  const grupo = useRef<THREE.Group>(null);
  const textura = useMemo(() => texturaTerra(), []);
  useEffect(() => () => textura?.dispose(), [textura]);
  // O eixo aponta sempre para o mesmo lugar do céu (perto da estrela Polar).
  const quat = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...cena(eixoTerra(), 1))), []);
  useFrame(() => {
    grupo.current?.position.set(...cena(posicaoPlaneta(TERRA, anosDesdeJ2000(diaRef.current)), DIST));
  });
  const phi = (lat * Math.PI) / 180;
  return (
    <group ref={grupo}>
      <group quaternion={quat}>
        <mesh>
          <sphereGeometry args={[R_TERRA, 64, 64]} />
          <meshStandardMaterial map={textura ?? undefined} color={textura ? '#ffffff' : '#2f6fb3'} roughness={0.9} />
        </mesh>
        {/* Eixo de rotação. */}
        <mesh>
          <cylinderGeometry args={[0.015, 0.015, R_TERRA * 2.8, 8]} />
          <meshBasicMaterial color="#e2e8f0" />
        </mesh>
        {/* Paralelo da cidade escolhida. */}
        <mesh position={[0, R_TERRA * Math.sin(phi), 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[R_TERRA * Math.cos(phi) * 1.004, 0.018, 8, 96]} />
          <meshBasicMaterial color="#f2587a" />
        </mesh>
        <Html position={[0, R_TERRA * 1.55, 0]} center>
          <span className="sim-rotulo-3d">N</span>
        </Html>
      </group>
    </group>
  );
}

function Relogio({ diaRef, rodando, diasPorS, onTick }: { diaRef: React.RefObject<number>; rodando: boolean; diasPorS: number; onTick: (d: number) => void }) {
  const acc = useRef(0);
  useFrame((_, dt) => {
    if (rodando) {
      diaRef.current += Math.min(dt, 0.05) * diasPorS;
      if (diaRef.current >= 366) diaRef.current -= 365;
    }
    acc.current += dt;
    if (acc.current > 0.1) {
      acc.current = 0;
      onTick(diaRef.current);
    }
  });
  return null;
}

/** Marcos da órbita: solstícios e equinócios de 2026. */
const MARCOS = [
  { dia: 79, nome: 'Equinócio de março' },
  { dia: 172, nome: 'Solstício de junho' },
  { dia: 266, nome: 'Equinócio de setembro' },
  { dia: 355, nome: 'Solstício de dezembro' },
];

export default function Estacoes() {
  const [cidade, setCidade] = useState<string>('saopaulo');
  const [dia, setDia] = useState(355);
  const [diasPorS, setDiasPorS] = useState(20);
  const [rodando, setRodando] = useState(!usaMovimentoReduzido());
  const diaRef = useRef(355);
  const lat = CIDADES.find((c) => c.key === cidade)!.lat;
  const d = Math.max(1, Math.min(365, Math.round(dia)));
  const dec = declinacaoSolar(d);
  const orbita = useMemo(() => Array.from({ length: 366 }, (_, i) => cena(posicaoPlaneta(TERRA, anosDesdeJ2000(i + 1)), DIST)), []);
  const curva: [number, number][] = [];
  const equador: [number, number][] = [];
  for (let k = 1; k <= 365; k += 2) {
    curva.push([k, duracaoDia(lat, declinacaoSolar(k))]);
    equador.push([k, duracaoDia(0, declinacaoSolar(k))]);
  }
  const rTerraSol = Math.hypot(...posicaoPlaneta(TERRA, anosDesdeJ2000(d)));

  return (
    <div className="lg:h-full">
      <LayoutSim
        palco={
          <Palco3D rotulo="Terra em órbita ao redor do Sol com o eixo inclinado" camera={[0, 17, 5]} distancia={[3, 30]} ceu>
            <ambientLight intensity={0.22} />
            <Relogio diaRef={diaRef} rodando={rodando} diasPorS={diasPorS} onTick={setDia} />
            <mesh>
              <sphereGeometry args={[0.9, 48, 48]} />
              <meshBasicMaterial color="#ffd166" />
            </mesh>
            <pointLight intensity={3.2} decay={0} color="#fff7e0" />
            <Line points={orbita} color="#64748b" lineWidth={1} />
            {MARCOS.map((m) => (
              <Html key={m.dia} position={cena(posicaoPlaneta(TERRA, anosDesdeJ2000(m.dia)), DIST * 1.14)} center>
                <span className="sim-rotulo-3d">{m.nome}</span>
              </Html>
            ))}
            <Terra diaRef={diaRef} lat={lat} />
          </Palco3D>
        }
        leituras={
          <Leituras
            titulo={`${CIDADES.find((c) => c.key === cidade)!.nome}, ${dataDoDia(d)}`}
            itens={[
              { rotulo: 'Estação no Sul', valor: estacao(d, 'sul') },
              { rotulo: 'Estação no Norte', valor: estacao(d, 'norte') },
              { rotulo: 'Duração do dia', valor: horas(duracaoDia(lat, dec)) },
              { rotulo: 'Sol ao meio-dia', valor: `${fmt(alturaMeioDia(lat, dec), 1)}° de altura`, nota: Math.abs(lat - dec) < 0.5 ? 'a pino: sem sombra' : undefined },
              { rotulo: 'Declinação do Sol', valor: `${fmt(dec, 2)}°`, nota: 'latitude onde o Sol fica a pino' },
              { rotulo: 'Energia do Sol (média do dia)', valor: `${fmt(Math.max(0, insolacaoDiaria(lat, d)), 0)} W/m²`, nota: 'no topo da atmosfera' },
              { rotulo: 'Distância Terra-Sol', valor: `${fmt((rTerraSol * UA_KM) / 1e6, 1)} milhões de km` },
            ]}
          />
        }
        extra={
          <Bloco titulo="Duração do dia ao longo do ano">
            <Grafico
              series={[
                { rotulo: CIDADES.find((c) => c.key === cidade)!.nome, cor: 'var(--brand)', pontos: curva },
                { rotulo: 'Equador', cor: 'var(--muted)', pontos: equador, tracejado: true },
              ]}
              rotuloX="dia do ano"
              rotuloY="horas de Sol"
              xMin={1}
              xMax={365}
              yMin={0}
              yMax={24}
              verticais={MARCOS.map((m) => ({ x: m.dia }))}
              pontos={[{ x: d, y: duracaoDia(lat, dec), cor: 'var(--brand)' }]}
              altura={200}
            />
          </Bloco>
        }
        controles={
          <>
            <BarraExecucao rodando={rodando} onAlternar={() => setRodando((r) => !r)} />
            <Deslizador
              rotulo="Data"
              valor={d}
              min={1}
              max={365}
              formatar={dataDoDia}
              onChange={(v) => { diaRef.current = v; setDia(v); }}
            />
            <Seletor rotulo="Lugar" valor={cidade} opcoes={CIDADES.map((c) => ({ valor: c.key, rotulo: `${c.nome} (${fmt(Math.abs(c.lat), 1)}° ${c.lat < 0 ? 'S' : 'N'})` }))} onChange={setCidade} />
            <Deslizador rotulo="Passagem do tempo" valor={diasPorS} min={1} max={60} unidade="dias por segundo" onChange={setDiasPorS} />
            <div className="flex flex-wrap gap-1.5">
              {MARCOS.map((m) => (
                <button key={m.dia} type="button" className="chip" onClick={() => { diaRef.current = m.dia; setDia(m.dia); setRodando(false); }}>
                  {m.nome.replace('Equinócio', 'Equin.').replace('Solstício', 'Solst.')}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted">Órbita e inclinação reais; o tamanho da Terra e do Sol foi aumentado. Linhas amarelas: trópicos. Brancas: círculos polares.</p>
          </>
        }
      />
      <Explicacao enem={'As estações vêm da **inclinação do eixo** (23,4°), não da distância ao Sol: a Terra fica mais perto do Sol no começo de janeiro, em pleno verão do Sul. Entre os trópicos o Sol fica a pino duas vezes por ano; acima dos círculos polares há dias de 24 horas no verão e noites de 24 horas no inverno.'}>
        {`O eixo da Terra aponta sempre para o mesmo lugar do céu enquanto ela dá a volta no Sol. Em dezembro o **Hemisfério Sul** está inclinado para o Sol: recebe a luz mais de frente, os dias são mais longos e é verão; em junho acontece o contrário.

- **Solstícios** (junho e dezembro): o Sol fica a pino sobre um dos trópicos e a diferença entre o dia e a noite é máxima.
- **Equinócios** (março e setembro): o Sol fica a pino no Equador e o dia dura cerca de 12 horas em todo o planeta.

Escolha Macapá e veja a linha quase reta no gráfico: perto do Equador as estações quase não existem. Já em Tromsø, na Noruega, o Sol não se põe em junho nem nasce em dezembro. A posição da Terra vem da órbita real, e a declinação do Sol, de uma série de Fourier usada em engenharia solar (erro menor que 0,04°). A duração do dia considera a refração do ar e o tamanho do disco solar, como nos almanaques.`}
      </Explicacao>
    </div>
  );
}
