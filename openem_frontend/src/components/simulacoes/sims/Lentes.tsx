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
    const X0 = espelho ? w * 0.72 : w * 0.5;
    const s = (X0 - 28) / Math.max(50, p * 1.15, 2.4 * fAbs);
    const sy = (h * 0.2) / H_OBJ;
    return { X0, s, sy, Y0: h / 2, X: (x: number) => X0 + x * s, Y: (y: number) => h / 2 - y * sy };
  };

  const onPonteiro = (pt: Ponteiro) => {
    if (pt.tipo === 'up') return;
    const g = geo(pt.w, pt.h);
    if (pt.x < g.X0 - 6) setP(Math.round(clamp((g.X0 - pt.x) / g.s, 2, 100)));
  };

  const quadro: Quadro = (ctx, w, h, _dt, c) => {
    const { X0, s, Y, X, Y0 } = geo(w, h);
    // Eixo óptico e pontos notáveis.
    ctx.strokeStyle = c.muted;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, Y0); ctx.lineTo(w, Y0); ctx.stroke();
    const marca = (x: number, rot: string) => {
      const px = X(x);
      if (px < 0 || px > w) return;
      ctx.fillStyle = c.fg;
      ctx.beginPath(); ctx.arc(px, Y0, 3.5, 0, Math.PI * 2); ctx.fill();
      texto(ctx, rot, px, Y0 + 18, c.muted, { alinhar: 'center', tamanho: 11, peso: 600 });
    };
    if (espelho) {
      // No espelho o foco real fica do lado do objeto (esquerda) quando é côncavo.
      marca(-f, 'F');
      marca(-2 * f, 'C');
    } else {
      marca(-fAbs, f > 0 ? 'F' : "F'");
      marca(fAbs, f > 0 ? "F'" : 'F');
      marca(-2 * fAbs, f > 0 ? 'A' : "A'");
      marca(2 * fAbs, f > 0 ? "A'" : 'A');
    }
    // Instrumento.
    const hl = h * 0.4;
    ctx.strokeStyle = c.mat;
    ctx.fillStyle = c.mat;
    ctx.lineWidth = 3;
    if (espelho) {
      // Arco de raio R = 2f; côncavo abre para a esquerda.
      const R = 2 * fAbs * s;
      const meia = Math.asin(Math.min(1, hl / R));
      const cxArco = f > 0 ? X0 - R : X0 + R;
      ctx.beginPath();
      if (f > 0) ctx.arc(cxArco, Y0, R, -meia, meia);
      else ctx.arc(cxArco, Y0, R, Math.PI - meia, Math.PI + meia);
      ctx.stroke();
      ctx.strokeStyle = alfa(c.mat, 0.35);
      ctx.lineWidth = 8;
      ctx.beginPath();
      if (f > 0) ctx.arc(cxArco + 5, Y0, R, -meia, meia);
      else ctx.arc(cxArco + 5, Y0, R, Math.PI - meia, Math.PI + meia);
      ctx.stroke();
    } else {
      ctx.beginPath(); ctx.moveTo(X0, Y0 - hl); ctx.lineTo(X0, Y0 + hl); ctx.stroke();
      const pt = (y: number, dir: 1 | -1) => {
        const conv = f > 0;
        const ponta = conv ? dir : -dir;
        ctx.beginPath();
        ctx.moveTo(X0, y);
        ctx.lineTo(X0 - 9, y + ponta * 11);
        ctx.moveTo(X0, y);
        ctx.lineTo(X0 + 9, y + ponta * 11);
        ctx.stroke();
      };
      pt(Y0 - hl, 1);
      pt(Y0 + hl, -1);
    }

    // Raios principais (traçados como lente; no espelho a saída é rebatida).
    const xo = -p;
    const ho = H_OBJ;
    const dirSaida = (y0: number, dy: number, dx: number) => ({ y0, dx, dy });
    const raios: { entra: [number, number]; noInstr: number; saida: ReturnType<typeof dirSaida> }[] = [];
    // 1. Paralelo ao eixo → sai passando pelo foco.
    raios.push({ entra: [xo, ho], noInstr: ho, saida: dirSaida(ho, -ho, f) });
    // 2. Pelo centro óptico (lente) / vértice (espelho): não desvia (no espelho, reflete simétrico).
    raios.push({ entra: [xo, ho], noInstr: 0, saida: dirSaida(0, -ho, p) });
    // 3. Mirando o foco do lado do objeto → sai paralelo.
    if (Math.abs(p - f) > 1e-6) {
      const y3 = (ho * -f) / (p - f);
      raios.push({ entra: [xo, ho], noInstr: y3, saida: dirSaida(y3, 0, 1) });
    }
    const cores = [c.danger, c.nat, c.lin];
    const longe = (w / s) * 2;
    raios.forEach((r, i) => {
      let { dx, dy } = r.saida;
      if (dx < 0) { dx = -dx; dy = -dy; }
      const n = Math.hypot(dx, dy * (1 / 1));
      const ux = dx / n;
      const uy = dy / n;
      const sinal = espelho ? -1 : 1;
      ctx.strokeStyle = cores[i];
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(X(r.entra[0]), Y(r.entra[1]));
      ctx.lineTo(X0, Y(r.noInstr));
      ctx.lineTo(X(sinal * ux * longe), Y(r.noInstr + uy * longe));
      ctx.stroke();
      if (im.natureza === 'virtual') {
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = alfa(cores[i], 0.6);
        ctx.beginPath();
        ctx.moveTo(X0, Y(r.noInstr));
        ctx.lineTo(X(-sinal * ux * longe), Y(r.noInstr - uy * longe));
        ctx.stroke();
        ctx.setLineDash([]);
      }
    });
    // Objeto.
    seta(ctx, X(xo), Y0, X(xo), Y(ho), c.fg, 3.5);
    texto(ctx, 'objeto', X(xo), Y0 + 34, c.fg, { alinhar: 'center', tamanho: 11 });
    // Imagem.
    if (im.natureza !== 'imprópria') {
      const xi = espelho ? -im.pLinha : im.pLinha;
      const hi = im.aumento * ho;
      const px = X(xi);
      if (px > -20 && px < w + 20) {
        if (im.natureza === 'virtual') ctx.setLineDash([5, 4]);
        seta(ctx, px, Y0, px, Y(hi), c.hum, 3.5);
        ctx.setLineDash([]);
        texto(ctx, `imagem ${im.natureza}`, px, hi > 0 ? Y0 + 34 : Y0 - 10 + 0, c.hum, { alinhar: 'center', tamanho: 11, peso: 600 });
      }
    } else {
      texto(ctx, 'Objeto no foco: os raios saem paralelos (imagem imprópria)', 12, 20, c.hum, { peso: 600 });
    }
    texto(ctx, 'Arraste para mover o objeto', 12, h - 10, c.muted, { tamanho: 11 });
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
