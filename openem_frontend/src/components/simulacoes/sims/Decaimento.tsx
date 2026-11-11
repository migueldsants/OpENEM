import { useRef, useState } from 'react';
import { decairAleatorio, fmtDuracao, idadePorFracao, ISOTOPOS, restantes } from '../../../lib/simulacoes/quimica';
import { criarRng, fmt } from '../../../lib/simulacoes/numerico';
import { alfa, texto, usaMovimentoReduzido } from '../canvas';
import { BarraExecucao, Bloco, Deslizador, Explicacao, Grafico, LayoutSim, Leituras, Palco2D, Seletor, type Quadro } from '../ui';

const COLS = 30;
const LINS = 20;
const TOTAL = COLS * LINS;
const MAX_MEIAS = 6;

export default function Decaimento() {
  const [isoKey, setIsoKey] = useState<string>('c14');
  const [ritmo, setRitmo] = useState(0.25); // meias-vidas por segundo
  const [rodando, setRodando] = useState(!usaMovimentoReduzido());
  const [fracaoDatacao, setFracaoDatacao] = useState(25);
  const iso = ISOTOPOS.find((i) => i.key === isoKey)!;
  const sim = useRef({ vivos: new Uint8Array(TOTAL).fill(1), quando: new Float64Array(TOTAL).fill(-1), t: 0, hist: [[0, TOTAL]] as [number, number][], rng: criarRng(7), acc: 0 });
  const [vista, setVista] = useState({ t: 0, n: TOTAL, hist: [[0, TOTAL]] as [number, number][] });

  const reiniciar = () => {
    sim.current = { vivos: new Uint8Array(TOTAL).fill(1), quando: new Float64Array(TOTAL).fill(-1), t: 0, hist: [[0, TOTAL]], rng: criarRng(Math.floor(Math.random() * 1e9)), acc: 0 };
    setVista({ t: 0, n: TOTAL, hist: [[0, TOTAL]] });
  };

  const quadro: Quadro = (ctx, w, h, dt, c) => {
    const st = sim.current;
    // O tempo corre em meias-vidas: o mesmo gráfico serve a qualquer isótopo.
    if (rodando && st.t < MAX_MEIAS) {
      const passo = dt * ritmo;
      const antes = new Uint8Array(st.vivos);
      decairAleatorio(st.vivos, passo, 1, st.rng);
      for (let i = 0; i < TOTAL; i++) if (antes[i] && !st.vivos[i]) st.quando[i] = st.t;
      st.t += passo;
      let n = 0;
      for (let i = 0; i < TOTAL; i++) n += st.vivos[i];
      st.hist.push([st.t, n]);
      st.acc += dt;
      if (st.acc > 0.12) {
        st.acc = 0;
        setVista({ t: st.t, n, hist: st.hist.slice() });
      }
    }
    const tam = Math.min((w - 20) / COLS, (h - 40) / LINS);
    const ox = (w - tam * COLS) / 2;
    const oy = 10;
    for (let i = 0; i < TOTAL; i++) {
      const x = ox + (i % COLS) * tam + tam / 2;
      const y = oy + Math.floor(i / COLS) * tam + tam / 2;
      const vivo = st.vivos[i];
      // Brilho rápido no instante do decaimento (a radiação saindo).
      const idade = vivo ? Infinity : (st.t - st.quando[i]) / Math.max(ritmo, 1e-3);
      if (idade < 0.4) {
        ctx.fillStyle = alfa(c.hum, 0.6 * (1 - idade / 0.4));
        ctx.beginPath(); ctx.arc(x, y, tam * (0.5 + idade * 2), 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = vivo ? c.nat : alfa(c.muted, 0.35);
      ctx.beginPath(); ctx.arc(x, y, tam * 0.36, 0, Math.PI * 2); ctx.fill();
    }
    texto(ctx, `${iso.nome}: ${fmtDuracao(st.t * iso.meiaVida)} depois`, ox, h - 8, c.fg, { peso: 600, tamanho: 12 });
    texto(ctx, `● não decaiu   ● virou ${iso.filho}`, w - ox, h - 8, c.muted, { alinhar: 'right', tamanho: 11 });
  };

  const teorica: [number, number][] = [];
  for (let k = 0; k <= 120; k++) teorica.push([(k / 120) * MAX_MEIAS, restantes(TOTAL, (k / 120) * MAX_MEIAS, 1)]);
  const idade = idadePorFracao(fracaoDatacao / 100, iso.meiaVida);

  return (
    <div className="lg:h-full">
      <LayoutSim
        palco={<Palco2D quadro={quadro} rotulo={`Grade de ${TOTAL} núcleos de ${iso.nome} decaindo ao acaso`} proporcao={3 / 2} />}
        leituras={
          <Leituras
            itens={[
              { rotulo: 'Meia-vida', valor: fmtDuracao(iso.meiaVida), nota: `decaimento ${iso.decai} → ${iso.filho}` },
              { rotulo: 'Tempo decorrido', valor: fmtDuracao(vista.t * iso.meiaVida), nota: `${fmt(vista.t, 2)} meias-vidas` },
              { rotulo: 'Núcleos restantes', valor: `${vista.n} de ${TOTAL}`, cor: 'var(--nat)' },
              { rotulo: 'Previsto (N₀·½^(t/T))', valor: fmt(restantes(TOTAL, vista.t, 1), 0) },
              { rotulo: 'Uso', valor: iso.uso },
            ]}
          />
        }
        extra={
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
            <Bloco titulo="Núcleos ao longo do tempo">
              <Grafico
                series={[
                  { rotulo: 'sorteio na grade', cor: 'var(--nat)', pontos: vista.hist },
                  { rotulo: 'curva exponencial', cor: 'var(--brand)', pontos: teorica, tracejado: true },
                ]}
                rotuloX="tempo (meias-vidas)"
                rotuloY="núcleos"
                xMin={0}
                xMax={MAX_MEIAS}
                yMin={0}
                yMax={TOTAL}
                verticais={[1, 2, 3].map((k) => ({ x: k }))}
                horizontais={[{ y: TOTAL / 2, rotulo: 'metade' }, { y: TOTAL / 4, rotulo: '1/4' }]}
                altura={210}
              />
            </Bloco>
            <Bloco titulo="Datação">
              <Deslizador rotulo={`${iso.nome} que restou`} valor={fracaoDatacao} min={1} max={99} unidade="%" onChange={setFracaoDatacao} />
              <p className="mt-3 font-data text-xl font-bold">{fmtDuracao(idade)}</p>
              <p className="text-xs text-muted">t = T½ · log₂(N₀/N)</p>
            </Bloco>
          </div>
        }
        controles={
          <>
            <BarraExecucao rodando={rodando} onAlternar={() => setRodando((r) => !r)} onReiniciar={reiniciar} />
            <Seletor rotulo="Isótopo" valor={isoKey} opcoes={ISOTOPOS.map((i) => ({ valor: i.key, rotulo: `${i.nome} (${fmtDuracao(i.meiaVida)})` }))} onChange={(v) => { setIsoKey(v); reiniciar(); }} />
            <Deslizador rotulo="Ritmo" valor={ritmo} min={0.05} max={1} passo={0.05} formatar={(x) => fmt(x, 2)} unidade="meia-vida por segundo" onChange={setRitmo} />
            <p className="text-xs text-muted">Cada núcleo tem, a cada instante, a mesma chance de decair, sem memória do passado: o sorteio é feito núcleo a núcleo.</p>
          </>
        }
      />
      <Explicacao enem={'A cada **meia-vida** sobra metade: depois de 3 meias-vidas, 1/8. O césio-137 do acidente de Goiânia (1987), com meia-vida de 30 anos, ainda terá 1/4 da atividade inicial em 2047. Na datação por carbono-14, um fóssil com 25% do C-14 de um ser vivo tem cerca de 11 460 anos (2 meias-vidas).'}>
        {`O decaimento é **aleatório** para cada núcleo: não dá para saber quando um núcleo específico vai decair, só a probabilidade por unidade de tempo, a constante $\\lambda = \\ln 2 / T_{1/2}$. Com muitos núcleos, o acaso vira uma lei previsível:
$$N(t) = N_0 \\left(\\tfrac12\\right)^{t/T_{1/2}} = N_0\\,e^{-\\lambda t}.$$
Repare na grade: a linha da simulação oscila em torno da curva, e as flutuações são maiores quando restam poucos núcleos.

A meia-vida não depende da temperatura, da pressão nem da quantidade de material: o tecnécio-99m dos exames dura horas e o urânio-238, bilhões de anos. Datação: o C-14 serve até uns 50 mil anos; rochas antigas pedem urânio.`}
      </Explicacao>
    </div>
  );
}
