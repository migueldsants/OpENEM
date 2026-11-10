import { useState } from 'react';
import { MEIOS, refratar } from '../../../lib/simulacoes/optica-ondas';
import { clamp, fmt, grausParaRad, radParaGraus } from '../../../lib/simulacoes/numerico';
import { alfa, texto } from '../canvas';
import { Deslizador, Explicacao, LayoutSim, Leituras, Palco2D, Seletor, type Ponteiro, type Quadro } from '../ui';

const LASER = '#ff3b3b';
const TOM_MEIO: Record<string, string> = { ar: '#94a3b8', agua: '#3b82f6', acrilico: '#a78bfa', vidro: '#2dd4bf', diamante: '#e0f2fe' };

export default function Refracao() {
  const [m1, setM1] = useState<string>('agua');
  const [m2, setM2] = useState<string>('ar');
  const [ang, setAng] = useState(35);
  const n1 = MEIOS.find((m) => m.key === m1)!.n;
  const n2 = MEIOS.find((m) => m.key === m2)!.n;
  const r = refratar(n1, n2, ang);

  const onPonteiro = (p: Ponteiro) => {
    if (p.tipo === 'up') return;
    const cx = p.w / 2;
    const cy = p.h / 2;
    if (p.y >= cy - 4) return;
    setAng(Math.round(clamp(radParaGraus(Math.atan2(Math.abs(p.x - cx), cy - p.y)), 0, 89)));
  };

  const quadro: Quadro = (ctx, w, h, _dt, c) => {
    const cx = w / 2;
    const cy = h / 2;
    const R = Math.hypot(w, h);
    // Meios.
    ctx.fillStyle = alfa(TOM_MEIO[m1], m1 === 'ar' ? 0.06 : 0.2);
    ctx.fillRect(0, 0, w, cy);
    ctx.fillStyle = alfa(TOM_MEIO[m2], m2 === 'ar' ? 0.06 : 0.2);
    ctx.fillRect(0, cy, w, h - cy);
    ctx.strokeStyle = c.muted;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(w, cy); ctx.stroke();
    texto(ctx, `${MEIOS.find((m) => m.key === m1)!.nome} (n = ${fmt(n1, 3)})`, 12, 20, c.fg, { peso: 600 });
    texto(ctx, `${MEIOS.find((m) => m.key === m2)!.nome} (n = ${fmt(n2, 3)})`, 12, h - 12, c.fg, { peso: 600 });
    // Normal.
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = alfa(c.fg, 0.5);
    ctx.beginPath(); ctx.moveTo(cx, 8); ctx.lineTo(cx, h - 8); ctx.stroke();
    ctx.setLineDash([]);

    const t1 = grausParaRad(ang);
    const raio = (x1: number, y1: number, intens: number, larg = 3) => {
      if (intens < 0.002) return;
      ctx.save();
      ctx.strokeStyle = alfa(LASER, Math.min(1, 0.12 + intens));
      ctx.shadowColor = LASER;
      ctx.shadowBlur = 10 * intens;
      ctx.lineWidth = larg;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x1, y1); ctx.stroke();
      ctx.restore();
    };
    // Incidente (vem de cima, pela esquerda).
    raio(cx - Math.sin(t1) * R, cy - Math.cos(t1) * R, 1, 3.5);
    // Laser.
    const lx = cx - Math.sin(t1) * Math.min(w, h) * 0.42;
    const ly = cy - Math.cos(t1) * Math.min(w, h) * 0.42;
    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate(-Math.PI / 2 + Math.atan2(cy - ly, cx - lx) + Math.PI / 2);
    ctx.fillStyle = c.fg;
    ctx.fillRect(-26, -7, 34, 14);
    ctx.restore();
    // Refletido e refratado.
    raio(cx + Math.sin(t1) * R, cy - Math.cos(t1) * R, r.R, 3);
    if (r.refratadoGraus !== null) {
      const t2 = grausParaRad(r.refratadoGraus);
      raio(cx + Math.sin(t2) * R, cy + Math.cos(t2) * R, r.T, 3);
    }
    // Arcos dos ângulos.
    const arco = (de: number, ate: number, rr: number, cor: string, rot: string, lado: 1 | -1) => {
      ctx.strokeStyle = cor;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(cx, cy, rr, de, ate, de > ate); ctx.stroke();
      const meio = (de + ate) / 2;
      texto(ctx, rot, cx + Math.cos(meio) * (rr + 16), cy + Math.sin(meio) * (rr + 16) + 4 * lado, cor, { alinhar: 'center', mono: true, tamanho: 12 });
    };
    arco(-Math.PI / 2, -Math.PI / 2 - t1, 56, c.fg, `${fmt(ang, 0)}°`, -1);
    if (r.refratadoGraus !== null) {
      const t2 = grausParaRad(r.refratadoGraus);
      arco(Math.PI / 2, Math.PI / 2 - t2, 56, c.fg, `${fmt(r.refratadoGraus, 1)}°`, 1);
    }
    if (r.reflexaoTotal) texto(ctx, 'Reflexão total', cx + 12, cy + 26, c.danger, { peso: 700 });
    texto(ctx, 'Arraste na metade de cima para mirar o laser', w - 12, 20, c.muted, { alinhar: 'right', tamanho: 11 });
  };

  return (
    <div className="lg:h-full">
      <LayoutSim
        palco={<Palco2D quadro={quadro} rotulo="Raio de luz passando de um meio para outro" proporcao={4 / 3} onPonteiro={onPonteiro} />}
        leituras={
          <Leituras
            itens={[
              { rotulo: 'Ângulo de incidência', valor: `${fmt(ang, 0)}°` },
              { rotulo: 'Ângulo de refração', valor: r.refratadoGraus === null ? 'não há' : `${fmt(r.refratadoGraus, 1)}°` },
              { rotulo: 'Ângulo limite', valor: r.anguloCriticoGraus === null ? 'não há' : `${fmt(r.anguloCriticoGraus, 1)}°`, nota: r.anguloCriticoGraus === null ? 'só do meio mais refringente para o menos' : undefined },
              { rotulo: 'Luz refletida', valor: `${fmt(r.R * 100, 1)}%` },
              { rotulo: 'Luz refratada', valor: `${fmt(r.T * 100, 1)}%` },
              { rotulo: 'Velocidade no meio 1', valor: `${fmt(299792 / n1, 0)} km/s` },
              { rotulo: 'Velocidade no meio 2', valor: `${fmt(299792 / n2, 0)} km/s` },
            ]}
          />
        }
        controles={
          <>
            <Deslizador rotulo="Ângulo de incidência" valor={ang} min={0} max={89} unidade="°" onChange={setAng} />
            <Seletor rotulo="Meio de cima (onde está o laser)" valor={m1} opcoes={MEIOS.map((m) => ({ valor: m.key, rotulo: `${m.nome} (n = ${fmt(m.n, 3)})` }))} onChange={setM1} />
            <Seletor rotulo="Meio de baixo" valor={m2} opcoes={MEIOS.map((m) => ({ valor: m.key, rotulo: `${m.nome} (n = ${fmt(m.n, 3)})` }))} onChange={setM2} />
            <button type="button" className="btn btn-ghost w-full" onClick={() => { setM1(m2); setM2(m1); }}>
              Inverter os meios
            </button>
          </>
        }
      />
      <Explicacao enem={'A **fibra óptica** guia a luz por reflexão total: o núcleo tem índice maior que a casca e a luz bate na parede acima do ângulo limite. O brilho do diamante vem do mesmo efeito (ângulo limite de só 24°). Também cai muito a ideia de que a luz **desacelera** ao entrar num meio mais refringente e se aproxima da normal.'}>
        {`Ao mudar de meio a luz muda de velocidade ($v = c/n$) e, se chega inclinada, muda de direção pela **lei de Snell**:
$$n_1 \\sin\\theta_1 = n_2 \\sin\\theta_2.$$
Indo para um meio mais refringente (de índice maior), o raio se aproxima da normal; indo para um menos refringente, se afasta. Neste segundo caso existe um **ângulo limite**, $\\sin L = n_2/n_1$: acima dele não há refração e toda a luz volta (**reflexão total**).

Repare que sempre uma parte da luz é refletida. A intensidade de cada raio segue as equações de Fresnel: no vidro, com incidência perpendicular, cerca de 4% voltam; perto do rasante, quase tudo reflete (por isso um lago parece um espelho de longe).`}
      </Explicacao>
    </div>
  );
}
