/**
 * Palco das simulações 3D: React Three Fiber com câmera orbital (arrastar
 * gira, roda/pinça aproxima). Sem WebGL (navegador antigo, aceleração
 * desligada) mostra um aviso no lugar da cena em vez de quebrar a tela.
 */
import { OrbitControls, Stars } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { COR_CEU, usaMovimentoReduzido } from './canvas';
import { PalcoCheioCtx } from './contexto';

function temWebGL() {
  if (typeof window === 'undefined' || typeof WebGLRenderingContext === 'undefined') return false;
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

export function Palco3D({
  children,
  camera = [0, 4, 10],
  fov = 45,
  rotulo,
  proporcao = 16 / 10,
  distancia = [2, 60],
  autoGirar = false,
  ceu = false,
  sobreposicao,
  parado = false,
}: {
  children: ReactNode;
  camera?: [number, number, number];
  fov?: number;
  rotulo: string;
  proporcao?: number;
  distancia?: [number, number];
  autoGirar?: boolean;
  /**
   * Cenas de astronomia: fundo de espaço com uma esfera de estrelas ao redor
   * (raio 120 a 180, além da distância máxima da câmera), que gira junto
   * quando o aluno arrasta, como uma skybox.
   */
  ceu?: boolean;
  /** Desenhado por cima da cena, fora do WebGL (um quadro, uma legenda). */
  sobreposicao?: ReactNode;
  /**
   * Cena sem animação própria (nada gira, nada anda): só redesenha quando o
   * aluno mexe na câmera ou quando algo muda. Poupa bateria no celular.
   */
  parado?: boolean;
}) {
  const [suporte] = useState(temWebGL);
  const cheio = useContext(PalcoCheioCtx);
  const preencher = cheio ? 'sim-palco-cheio' : '';
  // Fora da tela, o WebGL para de desenhar.
  const caixa = useRef<HTMLDivElement>(null);
  const [visivel, setVisivel] = useState(true);
  useEffect(() => {
    const el = caixa.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setVisivel(e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const [semMovimento] = useState(usaMovimentoReduzido);
  if (!suporte) {
    return (
      <div
        role="img"
        aria-label={rotulo}
        className={`grid w-full place-items-center rounded-xl bg-surface-2 p-6 text-center text-sm text-muted ${preencher}`}
        style={{ aspectRatio: String(proporcao), minHeight: 260 }}
      >
        <p className="max-w-sm">
          Esta simulação em 3D precisa de WebGL, que está desligado ou não existe neste navegador. As medidas
          e os controles ao lado continuam funcionando.
        </p>
      </div>
    );
  }
  return (
    <div
      ref={caixa}
      role="img"
      aria-label={`${rotulo}. Arraste para girar a cena e use a roda ou dois dedos para aproximar.`}
      className={`relative w-full overflow-hidden rounded-xl bg-surface-2 ${preencher}`}
      style={{ aspectRatio: String(proporcao), minHeight: 280, ...(ceu ? { background: COR_CEU } : null) }}
    >
      <Canvas camera={{ position: camera, fov, near: 0.01, far: 2000 }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }} frameloop={!visivel ? 'never' : parado ? 'demand' : 'always'}>
        {ceu && (
          <>
            <color attach="background" args={[COR_CEU]} />
            <Stars radius={120} depth={60} count={4000} factor={4} saturation={0.2} fade speed={semMovimento ? 0 : 0.6} />
          </>
        )}
        <OrbitControls
          makeDefault
          enableDamping
          enablePan={false}
          minDistance={distancia[0]}
          maxDistance={distancia[1]}
          autoRotate={autoGirar}
          autoRotateSpeed={0.6}
        />
        {children}
      </Canvas>
      {sobreposicao}
      <p className={`pointer-events-none absolute bottom-2 left-3 text-[11px] ${ceu ? 'text-white/70' : 'text-muted'}`}>Arraste para girar · role para aproximar</p>
    </div>
  );
}
