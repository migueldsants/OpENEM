import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { CIDADES, diferenca, fusoTeorico, horaOficial, horaSolar, relogio, type Cidade } from '../../../lib/simulacoes/mais-modelos';
import { Palco3D } from '../Palco3D';
import { BarraExecucao, Deslizador, Explicacao, LayoutSim, Leituras, Seletor } from '../ui';

const R = 2;
const RAD = Math.PI / 180;

/** Posição na esfera com o mesmo mapeamento da textura equirretangular do three.js. */
function noGlobo(lat: number, lon: number, r = R): [number, number, number] {
  const u = (lon + 180) / 360;
  const c = Math.cos(lat * RAD);
  return [-r * Math.cos(2 * Math.PI * u) * c, r * Math.sin(lat * RAD), r * Math.sin(2 * Math.PI * u) * c];
}

/** Textura dos fusos: faixas de 15° alternadas, o número de cada fuso e o meridiano de Greenwich. */
function texturaFusos(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const cv = document.createElement('canvas');
  cv.width = 1440;
  cv.height = 720;
  const ctx = cv.getContext('2d');
  if (!ctx) return null;
  const X = (lon: number) => ((lon + 180) / 360) * cv.width;
  const Y = (lat: number) => ((90 - lat) / 180) * cv.height;
  ctx.fillStyle = '#1e3a8a';
  ctx.fillRect(0, 0, cv.width, cv.height);
  for (let f = -12; f <= 12; f++) {
    ctx.fillStyle = f % 2 === 0 ? 'rgba(147, 197, 253, 0.16)' : 'rgba(30, 64, 175, 0.0)';
    ctx.fillRect(X(f * 15 - 7.5), 0, X(f * 15 + 7.5) - X(f * 15 - 7.5), cv.height);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.font = '600 22px Inter, sans-serif';
    ctx.textAlign = 'center';
    if (Math.abs(f) < 12) ctx.fillText(f > 0 ? `+${f}` : String(f), X(f * 15), Y(-4));
  }
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = 1;
  for (let lat = -60; lat <= 60; lat += 30) {
    ctx.beginPath(); ctx.moveTo(0, Y(lat)); ctx.lineTo(cv.width, Y(lat)); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, Y(0)); ctx.lineTo(cv.width, Y(0)); ctx.stroke();
  ctx.strokeStyle = '#fcd34d';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(X(0), 0); ctx.lineTo(X(0), cv.height); ctx.stroke();
  // Linha internacional de data (simplificada no antimeridiano).
  ctx.strokeStyle = '#f2587a';
  ctx.setLineDash([14, 10]);
  ctx.beginPath(); ctx.moveTo(X(179.5), 0); ctx.lineTo(X(179.5), cv.height); ctx.stroke();
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function Sol({ hRef }: { hRef: React.RefObject<number> }) {
  const luz = useRef<THREE.DirectionalLight>(null);
  useFrame(() => {
    // Longitude onde é meio-dia solar agora (equinócio: o Sol sobre o equador).
    const lonSub = (12 - hRef.current) * 15;
    luz.current?.position.set(...noGlobo(0, lonSub, 10));
  });
  return <directionalLight ref={luz} intensity={2.6} />;
}

function Relogio({ hRef, rodando, onTick }: { hRef: React.RefObject<number>; rodando: boolean; onTick: (h: number) => void }) {
  const acc = useRef(0);
  useFrame((_, dt) => {
    if (rodando) hRef.current = (hRef.current + Math.min(dt, 0.05) * 1.5) % 24;
    acc.current += dt;
    if (acc.current > 0.1) {
      acc.current = 0;
      onTick(hRef.current);
    }
  });
  return null;
}

export default function FusosHorarios() {
  const [utc, setUtc] = useState(15);
  const [rodando, setRodando] = useState(false);
  const [a, setA] = useState('Brasília');
  const [b, setB] = useState('Tóquio');
  const hRef = useRef(15);
  const textura = useMemo(() => texturaFusos(), []);
  useEffect(() => () => textura?.dispose(), [textura]);
  const A = CIDADES.find((c) => c.nome === a)!;
  const B = CIDADES.find((c) => c.nome === b)!;
  // A câmera começa olhando para a cidade de referência inicial (depois o aluno gira à vontade).
  const [camera] = useState(() => noGlobo(-15.8, -47.9, 6.5));
  const mudarHora = (h: number) => {
    hRef.current = h;
    setUtc(h);
  };
  const dia = (c: Cidade) => {
    const h = horaSolar(utc, c.lon);
    return h >= 6 && h < 18;
  };
  const dif = diferenca(A, B);

  return (
    <div className="lg:h-full">
      <LayoutSim
        palco={
          <Palco3D rotulo="Globo com os fusos horários e o lado iluminado pelo Sol" camera={camera} distancia={[3.5, 14]} ceu>
            <ambientLight intensity={0.16} />
            <Sol hRef={hRef} />
            <Relogio hRef={hRef} rodando={rodando} onTick={setUtc} />
            <mesh>
              <sphereGeometry args={[R, 64, 64]} />
              <meshStandardMaterial map={textura ?? undefined} roughness={0.9} />
            </mesh>
            {CIDADES.map((c) => {
              const destaque = c.nome === a || c.nome === b;
              return (
                <group key={c.nome}>
                  <mesh position={noGlobo(c.lat, c.lon, R * 1.005)} onClick={(e) => { e.stopPropagation(); if (e.delta <= 6 && c.nome !== a) setB(c.nome); }}>
                    <sphereGeometry args={[destaque ? 0.06 : 0.04, 16, 16]} />
                    <meshBasicMaterial color={c.nome === a ? '#f2587a' : c.nome === b ? '#fcd34d' : '#e2e8f0'} />
                  </mesh>
                  <Html position={noGlobo(c.lat, c.lon, R * 1.07)} center occlude={false} style={{ pointerEvents: 'none' }}>
                    <span className={`sim-rotulo-3d ${destaque ? '' : 'opacity-70'}`}>
                      {c.nome}
                      {destaque ? ` ${relogio(horaOficial(utc, c.fuso))}` : ''}
                    </span>
                  </Html>
                </group>
              );
            })}
          </Palco3D>
        }
        leituras={
          <Leituras
            itens={[
              { rotulo: `Em ${A.nome}`, valor: relogio(horaOficial(utc, A.fuso)), cor: 'var(--brand)', nota: dia(A) ? 'dia' : 'noite' },
              { rotulo: `Em ${B.nome}`, valor: relogio(horaOficial(utc, B.fuso)), cor: '#fcd34d', nota: dia(B) ? 'dia' : 'noite' },
              { rotulo: 'Diferença', valor: `${dif > 0 ? '+' : ''}${String(dif).replace('.', ',')} h`, nota: dif > 0 ? `${B.nome} está adiantada` : dif < 0 ? `${B.nome} está atrasada` : 'mesmo horário' },
              { rotulo: `Fuso de ${A.nome}`, valor: `UTC${A.fuso >= 0 ? '+' : '−'}${String(Math.abs(A.fuso)).replace('.', ',')}`, nota: `teórico pela longitude: ${fusoTeorico(A.lon)}` },
              { rotulo: 'Em Greenwich', valor: relogio(utc) },
            ]}
          />
        }
        controles={
          <>
            <BarraExecucao rodando={rodando} onAlternar={() => setRodando((r) => !r)} />
            <Deslizador rotulo="Hora em Greenwich (UTC)" valor={Math.round(utc * 4) / 4} min={0} max={23.75} passo={0.25} formatar={(h) => relogio(h)} onChange={mudarHora} />
            <Seletor rotulo="Cidade de referência" valor={a} opcoes={CIDADES.map((c) => ({ valor: c.nome, rotulo: c.nome }))} onChange={setA} />
            <Seletor rotulo="Comparar com" valor={b} opcoes={CIDADES.filter((c) => c.nome !== a).map((c) => ({ valor: c.nome, rotulo: c.nome }))} onChange={setB} />
            <p className="text-xs text-muted text-pretty">Ou toque numa cidade no globo para comparar. A faixa amarela é Greenwich; a rosa tracejada, a linha internacional de data. O Sol está sobre o equador (equinócio).</p>
          </>
        }
      />
      <Explicacao
        enem={'A conta do ENEM: cada **15° de longitude** valem **1 hora**; para **leste** (direita do mapa) as horas aumentam, para **oeste** diminuem. Se um voo sai de São Paulo às 22 h e dura 10 h até um lugar 4 fusos a leste, chega às 12 h (do dia seguinte) do horário local. O Brasil tem **quatro fusos** oficiais, de −2 (Fernando de Noronha) a −5 (Acre).'}
      >
        {`A Terra gira 360° em 24 horas: **15° por hora**. Por isso o planeta foi dividido em 24 **fusos horários**, faixas de 15° de longitude a partir do **meridiano de Greenwich** (0°). Cada fuso a leste está uma hora adiantado; cada um a oeste, uma hora atrasado.

Os fusos **oficiais** seguem fronteiras e conveniências, não só a longitude: Brasília fica perto de −3 pela conta e é −3 mesmo, mas a China inteira usa um fuso só e a Índia usa meia hora (+5:30). Compare o fuso teórico com o oficial de cada cidade.

Do lado do globo virado para o Sol é dia; do outro, noite. Rode o tempo e veja a linha entre os dois (o **terminador**) atravessar os fusos. No meridiano oposto a Greenwich fica a **linha internacional de data**: ao cruzá-la para oeste, o calendário avança um dia.`}
      </Explicacao>
    </div>
  );
}
