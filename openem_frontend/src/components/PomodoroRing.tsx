/**
 * Anel de progresso do Pomodoro (issue #41) — usado pelo pop-up flutuante e
 * pela tela dedicada. O traço usa `currentColor`, então quem chama define a
 * cor da fase (foco = marca, pausa = verde) pela classe de texto.
 */
export function PomodoroRing({
  progress,
  size = 44,
  stroke = 4,
  children,
  className = '',
}: {
  /** Fração já decorrida da fase (0–1). */
  progress: number;
  size?: number;
  stroke?: number;
  children?: React.ReactNode;
  className?: string;
}) {
  const pct = Math.min(1, Math.max(0, progress));
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;

  return (
    <div
      className={`relative grid shrink-0 place-items-center ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-hidden
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--line)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct)}
          className="transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      {children && (
        <span className="absolute inset-0 grid place-items-center">
          {children}
        </span>
      )}
    </div>
  );
}
