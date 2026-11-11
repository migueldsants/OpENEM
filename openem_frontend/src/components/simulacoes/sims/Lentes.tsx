import { useState } from 'react';
import { focoComSinal, formarImagem, vergencia, type Instrumento } from '../../../lib/simulacoes/optica-ondas';
import { clamp, fmt } from '../../../lib/simulacoes/numerico';
import { alfa, seta, texto } from '../canvas';
import { Deslizador, Explicacao, LayoutSim, Leituras, Palco2D, Seletor, type Ponteiro, type Quadro } from '../ui';

const INSTRUMENTOS: { valor: Instrumento; rotulo: string }[] = [
  { valor: 'lente-convergente', rotulo: 'Lente convergente (lupa, projetor)' },
  { valor: 'lente-divergente', rotulo: 'Lente divergente (óculos de miopia)' },
  { valor: 'espelho-concavo', rotulo: 'Espelho côncavo (maquiagem, farol)' },
  { valor: 'espelho-convexo', rotulo: 'Espelho convexo (retrovisor, garagem)' },
];

const H_OBJ = 4; // cm

export default function Lentes() {
  const [inst, setInst] = useState<Instrumento>('lente-convergente');
  const [fAbs, setFAbs] = useState(15);
  const [p, setP] = useState(40);
  const f = focoComSinal(inst, fAbs);
  const espelho = inst.startsWith('espelho');
  const im = formarImagem(f, p);

  const geo = (w: number, h: number) => {
    const X0 = espelho ? w * 0.7 : w * 0.5;
    // A escala se ajusta para a imagem caber (até um limite: perto do foco ela foge para o infinito).
    const pl = Number.isFinite(im.pLinha) ? Math.min(Math.abs(im.pLinha), 160) : 0;
    const real = im.natureza === 'real';
    const virtual = im.natureza === 'virtual';
    const esquerda = Math.max(50, p * 1.15, 2.4 * fAbs, (espelho ? real : virtual) ? pl * 1.12 : 0);
    const direita = (espelho ? virtual : real) ? pl * 1.12 : 0;
    const s = Math.min((X0 - 28) / esquerda, direita ? (w - X0 - 28) / direita : Infinity);
    const hi = Number.isFinite(im.aumento) ? Math.min(Math.abs(im.aumento) * H_OBJ, 28) : 0;
    const sy = Math.min((h * 0.2) / H_OBJ, (h * 0.4) / Math.max(hi, H_OBJ));
    return { X0, s, sy, Y0: h / 2, X: (x: number) => X0 + x * s, Y: (y: number) => h / 2 - y * sy };
  };

  const onPonteiro = (pt: Ponteiro) => {
    if (pt.tipo === 'up') return;
    const g = geo(pt.w, pt.h);
    if (pt.x < g.X0 - 6) setP(Math.round(clamp((g.X0 - pt.x) / g.s, 2, 100)));
  };

  const quadro: Quadro = (ctx, w, h, _dt, c) => {
    const { X0, s, Y, X, Y0 } = geo(w, h);
    const hl = h * 0.36;
    const lado = espelho ? -1 : 1; // para onde a luz segue depois do instrumento
    // Atrás do espelho não passa luz: a região fica sombreada (é onde moram as imagens virtuais).
    if (espelho) {
      ctx.fillStyle = alfa(c.muted, 0.08);
      ctx.fillRect(X0, 0, w - X0, h);
      texto(ctx, 'atrás do espelho', (X0 + w) / 2, h - 14, c.muted, { alinhar: 'center', tamanho: 11, peso: 600 });
    }
    // Eixo óptico e pontos notáveis.
    ctx.strokeStyle = alfa(c.muted, 0.7);
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, Y0); ctx.lineTo(w, Y0); ctx.stroke();
    const marca = (x: number, rot: string) => {
      const px = X(x);
      if (px < 8 || px > w - 8) return;
      ctx.strokeStyle = c.fg;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(px, Y0 - 5); ctx.lineTo(px, Y0 + 5); ctx.stroke();
      texto(ctx, rot, px, Y0 + 20, c.fg, { alinhar: 'center', tamanho: 12, peso: 700 });
    };
    if (espelho) {
      // No espelho o foco real fica do lado do objeto (esquerda) quando é côncavo.
      marca(-f, 'F');
      marca(-2 * f, 'C');
      texto(ctx, 'V', X0 + (f > 0 ? 12 : -12), Y0 + 20, c.fg, { alinhar: 'center', tamanho: 12, peso: 700 });
    } else {
      marca(-fAbs, f > 0 ? 'F' : "F'");
      marca(fAbs, f > 0 ? "F'" : 'F');
      marca(-2 * fAbs, f > 0 ? 'A' : "A'");
      marca(2 * fAbs, f > 0 ? "A'" : 'A');
      texto(ctx, 'O', X0 + 22, Y0 + 20, c.fg, { alinhar: 'center', tamanho: 12, peso: 700 });
    }
    // Instrumento, desenhado com a forma dele (a curvatura é simbólica: os raios dobram no plano central).
    ctx.setLineDash([3, 5]);
    ctx.strokeStyle = alfa(c.mat, 0.45);
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(X0, 8); ctx.lineTo(X0, h - 8); ctx.stroke();
    ctx.setLineDash([]);
    if (espelho) {
      const sag = 10;
      const borda = f > 0 ? X0 - sag : X0 + sag;
      const ctrl = f > 0 ? X0 + sag : X0 - sag;
      // Costas do espelho (hachura) e a face refletora.
      ctx.strokeStyle = alfa(c.muted, 0.6);
      ctx.lineWidth = 1.5;
      for (let k = 0; k <= 12; k++) {
        const u = k / 12;
        const y = Y0 - hl + 2 * hl * u;
        const x = (1 - u) * (1 - u) * borda + 2 * u * (1 - u) * ctrl + u * u * borda;
        ctx.beginPath(); ctx.moveTo(x + 2, y); ctx.lineTo(x + 11, y - 8); ctx.stroke();
      }
      ctx.strokeStyle = c.mat;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(borda, Y0 - hl); ctx.quadraticCurveTo(ctrl, Y0, borda, Y0 + hl); ctx.stroke();
      ctx.lineCap = 'butt';
    } else {
      ctx.fillStyle = alfa(c.mat, 0.22);
      ctx.strokeStyle = c.mat;
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (f > 0) {
        // Biconvexa: bordas finas, meio gordo.
        ctx.moveTo(X0, Y0 - hl);
        ctx.quadraticCurveTo(X0 + 30, Y0, X0, Y0 + hl);
        ctx.quadraticCurveTo(X0 - 30, Y0, X0, Y0 - hl);
      } else {
        // Bicôncava: bordas gordas, meio fino.
        ctx.moveTo(X0 - 13, Y0 - hl);
        ctx.lineTo(X0 + 13, Y0 - hl);
        ctx.quadraticCurveTo(X0 - 7, Y0, X0 + 13, Y0 + hl);
        ctx.lineTo(X0 - 13, Y0 + hl);
        ctx.quadraticCurveTo(X0 + 7, Y0, X0 - 13, Y0 - hl);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // Raios principais. Todos saem da ponta do objeto, dobram no plano do instrumento e,
    // depois dele, passam pela ponta da imagem (real) ou parecem vir dela (virtual).
    const xo = -p;
    const ho = H_OBJ;
    const finita = im.natureza !== 'imprópria';
    const xi = espelho ? -im.pLinha : im.pLinha;
    const hi = im.aumento * ho;
    const batidas: number[] = [ho, 0]; // 1. paralelo ao eixo; 2. pelo centro óptico ou vértice
    if (Math.abs(p - f) > 1e-6) batidas.push((ho * -f) / (p - f)); // 3. mirando o foco, sai paralelo
    const saidaImpropria = [[f, -ho], [p, -ho], [1, 0]]; // direções quando não há imagem
    const cores = [c.danger, c.nat, c.lin];
    const ponta = (x0: number, y0: number, x1: number, y1: number, fr: number, cor: string) => {
      const a = Math.atan2(y1 - y0, x1 - x0);
      const x = x0 + (x1 - x0) * fr;
      const y = y0 + (y1 - y0) * fr;
      ctx.fillStyle = cor;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * 7, y + Math.sin(a) * 7);
      ctx.lineTo(x + Math.cos(a + 2.5) * 7, y + Math.sin(a + 2.5) * 7);
      ctx.lineTo(x + Math.cos(a - 2.5) * 7, y + Math.sin(a - 2.5) * 7);
      ctx.closePath();
      ctx.fill();
    };
    ctx.lineJoin = 'round';
    batidas.forEach((yb, i) => {
      const pyB = Y(yb);
      if (pyB < -h || pyB > 2 * h) return; // bateria fora do instrumento por muito
      const cor = cores[i];
      // Chegada: da ponta do objeto até o plano do instrumento.
      ctx.strokeStyle = cor;
      ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.moveTo(X(xo), Y(ho)); ctx.lineTo(X0, pyB); ctx.stroke();
      ponta(X(xo), Y(ho), X0, pyB, 0.5, cor);
      // Saída, em pixels: direção que passa pela (ou foge da) ponta da imagem.
      let dx: number;
      let dy: number;
      if (finita) {
        dx = X(xi) - X0;
        dy = Y(hi) - pyB;
      } else {
        dx = saidaImpropria[i][0] * s * lado;
        dy = Y(yb + saidaImpropria[i][1]) - pyB;
      }
      if (dx * lado < 0) { dx = -dx; dy = -dy; }
      const n = Math.hypot(dx, dy) || 1;
      const ux = dx / n;
      const uy = dy / n;
      const longe = (w + h) * 1.5;
      const real = finita && im.natureza === 'real';
      const ate = real ? Math.hypot(X(xi) - X0, Y(hi) - pyB) : longe;
      ctx.beginPath(); ctx.moveTo(X0, pyB); ctx.lineTo(X0 + ux * ate, pyB + uy * ate); ctx.stroke();
      ponta(X0, pyB, X0 + ux * Math.min(ate, 260), pyB + uy * Math.min(ate, 260), 0.55, cor);
      if (real) {
        // Depois de formar a imagem a luz continua, mas isso já não interessa: fica apagado.
        ctx.strokeStyle = alfa(cor, 0.28);
        ctx.beginPath(); ctx.moveTo(X0 + ux * ate, pyB + uy * ate); ctx.lineTo(X0 + ux * longe, pyB + uy * longe); ctx.stroke();
      } else if (finita) {
        // Prolongamento para trás, só até a ponta da imagem virtual.
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = alfa(cor, 0.7);
        ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(X0, pyB); ctx.lineTo(X(xi), Y(hi)); ctx.stroke();
        ctx.setLineDash([]);
      }
    });
    // Objeto: uma seta com a alça de arrastar no pé.
    seta(ctx, X(xo), Y0, X(xo), Y(ho), c.fg, 4);
    ctx.fillStyle = alfa(c.brand, 0.3);
    ctx.beginPath(); ctx.arc(X(xo), Y0, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = c.brand;
    ctx.beginPath(); ctx.arc(X(xo), Y0, 5, 0, Math.PI * 2); ctx.fill();
    texto(ctx, 'objeto', X(xo), Y(ho) - 10, c.fg, { alinhar: 'center', tamanho: 12, peso: 700 });
    // Imagem: cheia se é real, tracejada se é virtual, com o ponto onde os raios se encontram.
    if (finita) {
      const px = X(xi);
      const py = Y(hi);
      const cabe = px > 10 && px < w - 10 && py > 10 && py < h - 10;
      if (cabe) {
        if (im.natureza === 'virtual') ctx.setLineDash([6, 5]);
        seta(ctx, px, Y0, px, py, c.hum, 4);
        ctx.setLineDash([]);
        ctx.fillStyle = alfa(c.hum, 0.3);
        ctx.beginPath(); ctx.arc(px, py, 9, 0, Math.PI * 2); ctx.fill();
        texto(ctx, `imagem ${im.natureza}`, px, hi > 0 ? py - 12 : py + 22, c.hum, { alinhar: 'center', tamanho: 12, peso: 700 });
      } else {
        texto(ctx, `A imagem ${im.natureza} não cabe na tela: fica a ${fmt(Math.abs(im.pLinha), 0)} cm, com ${fmt(Math.abs(hi), 0)} cm de altura`, w / 2, h - 14, c.hum, { alinhar: 'center', tamanho: 12, peso: 600 });
      }
    } else {
      texto(ctx, 'Objeto no foco: os raios saem paralelos e a imagem vai para o infinito', w / 2, h - 14, c.hum, { alinhar: 'center', tamanho: 12, peso: 600 });
    }
    texto(ctx, 'Arraste o objeto', 14, 22, c.muted, { tamanho: 11 });
  };

  const descreve = im.natureza === 'imprópria' ? 'imprópria (no infinito)' : `${im.natureza}, ${im.orientacao}, ${im.tamanho}`;

  return (
    <div className="lg:h-full">
      <LayoutSim
        palco={<Palco2D quadro={quadro} rotulo="Banco óptico com raios principais formando a imagem" proporcao={16 / 9} onPonteiro={onPonteiro} />}
        leituras={
          <Leituras
            itens={[
              { rotulo: 'Imagem', valor: descreve },
              { rotulo: "Distância da imagem (p')", valor: Number.isFinite(im.pLinha) ? `${fmt(im.pLinha, 1)} cm` : '∞', nota: 'negativa = virtual' },
              { rotulo: 'Aumento (A = −p\'/p)', valor: Number.isFinite(im.aumento) ? `${fmt(im.aumento, 2)}×` : '∞' },
              { rotulo: 'Altura da imagem', valor: Number.isFinite(im.aumento) ? `${fmt(im.aumento * H_OBJ, 1)} cm` : '∞' },
              { rotulo: 'Distância focal', valor: `${fmt(f, 0)} cm` },
              { rotulo: 'Vergência', valor: `${fmt(vergencia(f / 100), 2)} di`, nota: '"graus" dos óculos' },
            ]}
          />
        }
        controles={
          <>
            <Seletor rotulo="Instrumento" valor={inst} opcoes={INSTRUMENTOS} onChange={setInst} />
            <Deslizador rotulo="Distância do objeto (p)" valor={p} min={2} max={100} unidade="cm" onChange={setP} />
            <Deslizador rotulo="Distância focal (|f|)" valor={fAbs} min={5} max={30} unidade="cm" onChange={setFAbs} />
            <div className="space-y-1 text-xs text-muted">
              <p><span className="font-semibold" style={{ color: 'var(--danger)' }}>vermelho:</span> chega paralelo, sai pelo foco</p>
              <p><span className="font-semibold" style={{ color: 'var(--nat)' }}>verde:</span> pelo centro (ou vértice)</p>
              <p><span className="font-semibold" style={{ color: 'var(--lin)' }}>roxo:</span> passa pelo foco, sai paralelo</p>
            </div>
          </>
        }
      />
      <Explicacao enem={'Lupa: objeto **entre o foco e a lente** convergente dá imagem virtual, direita e maior. Câmera e olho: objeto **além do ponto antiprincipal** dá imagem real, invertida e menor. Espelho convexo e lente divergente dão sempre imagem virtual, direita e menor, e por isso ampliam o campo de visão (retrovisor).'}>
        {`Dois raios bastam para achar a imagem; a simulação traça os três raios principais. A posição e o tamanho saem da **equação de Gauss** e do **aumento linear**:
$$\\frac{1}{f} = \\frac{1}{p} + \\frac{1}{p'}, \\qquad A = \\frac{i}{o} = -\\frac{p'}{p}.$$
Pelo referencial de Gauss, $f$ é positivo em lentes convergentes e espelhos côncavos, e $p'$ positivo indica imagem **real** (onde os raios realmente se cruzam, dá para projetar numa tela). Imagem virtual é onde os prolongamentos (tracejados) se cruzam.

Leve o objeto até o foco e a imagem vai para o infinito; passe do foco para dentro e ela vira virtual de repente. A vergência, em dioptrias, é $1/f$ com $f$ em metros: a "miopia de 2 graus" pede uma lente de −0,5 m.`}
      </Explicacao>
    </div>
  );
}
