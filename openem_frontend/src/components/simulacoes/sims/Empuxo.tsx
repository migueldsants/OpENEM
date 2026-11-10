import { useRef, useState } from 'react';
import { equilibrioEmpuxo, FLUIDOS, forcasEmpuxo, MATERIAIS, passoEmpuxo } from '../../../lib/simulacoes/mecanica';
import { fmt } from '../../../lib/simulacoes/numerico';
import { alfa, seta, texto } from '../canvas';
import { Deslizador, Explicacao, LayoutSim, Leituras, Palco2D, Seletor, type Quadro } from '../ui';

const FUNDO = 1; // m de profundidade do tanque
const G = 9.81;

const COR_FLUIDO: Record<string, string> = {
  agua: '#3b82f6', mar: '#0e7490', oleo: '#d4a017', alcool: '#a5b4fc', glicerina: '#c4b5fd', mercurio: '#9ca3af',
};
const COR_MATERIAL: Record<string, string> = {
  isopor: '#f8fafc', cortica: '#b0855a', pinho: '#d6a565', gelo: '#bfe3f2', pvc: '#e2e8f0', aluminio: '#a1a1aa', ferro: '#52525b', ouro: '#e5b53b',
};

export default function Empuxo() {
  const [matKey, setMatKey] = useState<string>('pinho');
  const [fluKey, setFluKey] = useState<string>('agua');
  const [aresta, setAresta] = useState(0.2);
  const mat = MATERIAIS.find((x) => x.key === matKey)!;
  const flu = FLUIDOS.find((x) => x.key === fluKey)!;
  const p = { aresta, rhoCorpo: mat.rho, rhoFluido: flu.rho, g: G };
  const sim = useRef({ s: [-0.25, 0] as number[], acc: 0 });
  const [prof, setProf] = useState(-0.25);

  const soltar = () => {
    sim.current = { s: [-0.25, 0], acc: 0 };
    setProf(-0.25);
  };

  const quadro: Quadro = (ctx, w, h, dt, c) => {
    const st = sim.current;
    st.s = passoEmpuxo(p, st.s, dt, FUNDO);
    st.acc += dt;
    if (st.acc > 0.1) {
      st.acc = 0;
      setProf(st.s[0]);
    }
    const esc = (h * 0.86) / (FUNDO + 0.45);
    const tw = Math.min(w * 0.6, FUNDO * 1.3 * esc);
    const tx = (w - tw) / 2;
    const ySup = h * 0.06 + 0.45 * esc;
    const yFundo = ySup + FUNDO * esc;
    // Líquido e tanque.
    const corF = COR_FLUIDO[flu.key];
    ctx.fillStyle = alfa(corF, c.escuro ? 0.35 : 0.28);
    ctx.fillRect(tx, ySup, tw, FUNDO * esc);
    ctx.strokeStyle = c.muted;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(tx, ySup - 0.3 * esc); ctx.lineTo(tx, yFundo); ctx.lineTo(tx + tw, yFundo); ctx.lineTo(tx + tw, ySup - 0.3 * esc); ctx.stroke();
    ctx.strokeStyle = alfa(corF, 0.9);
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(tx, ySup); ctx.lineTo(tx + tw, ySup); ctx.stroke();
    // Escala de profundidade.
    for (let d = 0; d <= FUNDO + 1e-9; d += 0.25) {
      texto(ctx, `${fmt(d, 2)} m`, tx - 8, ySup + d * esc + 4, c.muted, { alinhar: 'right', tamanho: 10 });
    }
    // Cubo.
    const lado = aresta * esc;
    const yBase = ySup + st.s[0] * esc;
    const cx = w / 2;
    ctx.fillStyle = COR_MATERIAL[mat.key];
    ctx.strokeStyle = c.fg;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.rect(cx - lado / 2, yBase - lado, lado, lado); ctx.fill(); ctx.stroke();
    // Linha d'água sobre o cubo (parte submersa sombreada).
    const sub = Math.min(aresta, Math.max(0, st.s[0]));
    if (sub > 0) {
      ctx.fillStyle = alfa(corF, 0.35);
      ctx.fillRect(cx - lado / 2, yBase - sub * esc, lado, sub * esc);
    }
    // Forças.
    const f = forcasEmpuxo(p, st.s[0]);
    const escF = 120 / Math.max(f.peso, forcasEmpuxo(p, 1).empuxo, 1);
    const yc = yBase - lado / 2;
    seta(ctx, cx - 10, yc, cx - 10, yc + f.peso * escF, c.fg, 2.5, 'P');
    if (f.empuxo > 0.01) seta(ctx, cx + 10, yc, cx + 10, yc - f.empuxo * escF, c.mat, 2.5, 'E');
    texto(ctx, `${flu.nome}: ρ = ${fmt(flu.rho, 0)} kg/m³`, tx + tw - 8, yFundo - 10, c.fg, { alinhar: 'right', tamanho: 11 });
  };

  const f = forcasEmpuxo(p, prof);
  const eq = equilibrioEmpuxo(p);
  const fSub = forcasEmpuxo(p, 1);

  return (
    <div className="lg:h-full">
      <LayoutSim
        palco={<Palco2D quadro={quadro} rotulo="Bloco em um tanque com líquido e as forças peso e empuxo" proporcao={4 / 3} />}
        leituras={
          <Leituras
            itens={[
              { rotulo: 'Peso', valor: `${fmt(f.peso, 2)} N`, cor: 'var(--fg)' },
              { rotulo: 'Empuxo agora', valor: `${fmt(f.empuxo, 2)} N`, cor: 'var(--mat)' },
              { rotulo: 'Volume submerso', valor: `${fmt((Math.min(aresta, Math.max(0, prof)) / aresta) * 100, 0)}%` },
              { rotulo: 'Previsão', valor: eq.flutua ? 'flutua' : 'afunda', nota: eq.flutua ? `${fmt(eq.fracaoSubmersa * 100, 1)}% submerso` : 'ρ do corpo > ρ do líquido' },
              { rotulo: 'Empuxo se submerso', valor: `${fmt(fSub.empuxo, 2)} N`, nota: 'E = ρ·g·V' },
              { rotulo: 'Peso aparente submerso', valor: `${fmt(Math.max(0, fSub.pesoAparente), 2)} N`, nota: 'o que um dinamômetro marcaria' },
            ]}
          />
        }
        controles={
          <>
            <button type="button" className="btn btn-primary w-full" onClick={soltar}>
              Soltar de novo
            </button>
            <Seletor rotulo="Material do bloco" valor={matKey} opcoes={MATERIAIS.map((x) => ({ valor: x.key, rotulo: `${x.nome} (${fmt(x.rho, 0)} kg/m³)` }))} onChange={(v) => { setMatKey(v); soltar(); }} />
            <Seletor rotulo="Líquido" valor={fluKey} opcoes={FLUIDOS.map((x) => ({ valor: x.key, rotulo: `${x.nome} (${fmt(x.rho, 0)} kg/m³)` }))} onChange={(v) => { setFluKey(v); soltar(); }} />
            <Deslizador rotulo="Aresta do cubo" valor={aresta} min={0.05} max={0.3} passo={0.01} formatar={(v) => fmt(v * 100, 0)} unidade="cm" onChange={(v) => { setAresta(v); soltar(); }} />
          </>
        }
      />
      <Explicacao enem={'O iceberg com cerca de 90% do volume submerso é um clássico: a fração submersa é a razão entre as densidades, $\\rho_{gelo}/\\rho_{água}$. Outro: um navio de aço flutua porque o casco oco faz a **densidade média** ficar menor que a da água.'}>
        {`Pelo **princípio de Arquimedes**, todo corpo mergulhado num líquido recebe uma força vertical para cima igual ao peso do líquido deslocado:
$$E = \\rho_{líquido}\\,g\\,V_{submerso}.$$
Se o corpo é menos denso que o líquido, ele afunda só até o empuxo igualar o peso, e a fração submersa é $\\rho_{corpo}/\\rho_{líquido}$. Se é mais denso, nem totalmente submerso o empuxo basta, e ele vai ao fundo.

Ferro afunda na água, mas **boia no mercúrio**. Debaixo d'água o corpo parece mais leve: o dinamômetro marca o peso aparente, $P - E$. A simulação inclui o arrasto do líquido e a perda de energia em ondas, por isso o bloco balança e se acomoda.`}
      </Explicacao>
    </div>
  );
}
