// Editor de fórmula WYSIWYG (MathLive, lazy). Apenas o campo <math-field> —
// sem paleta de símbolos ("tecladinho") e sem teclado virtual do MathLive: a
// entrada é pela digitação direta da fórmula. MathLive registra o custom element
// <math-field> ao ser importado.
//
// Componente NÃO controlado: durante a edição a fonte da verdade é o próprio
// <math-field> (espelha o padrão do InlineTextEditor no QuadroEditor). O `value`
// da prop é aplicado só na montagem e quando o elemento troca (elId) — nunca
// enquanto o usuário digita — para evitar o bug de duplicar dígitos (o mathlive
// normaliza o LaTeX no getter, o que derrotava o guard `mf.value !== value` e
// re-aplicava setValue em cima da tecla em andamento). O listener de `input` é
// anexado manualmente (em vez do `onInput` do React) para evitar o double-dispatch
// do React 19 em custom elements.

import { useEffect, useRef, useState } from 'react';
import type { MathFieldElement } from './mathlive';

export function MathField({
  value,
  elId,
  onChange,
  onCommit,
}: {
  value: string;
  /** Id do elemento que está sendo editado — ao trocar, reinicializa o campo. */
  elId?: string;
  onChange: (latex: string) => void;
  onCommit?: () => void;
}) {
  const ref = useRef<MathFieldElement | null>(null);
  const [ready, setReady] = useState(false);
  // Verdadeiro enquanto o usuário está digitando — bloqueia o sync externo→campo.
  const editingRef = useRef(false);
  const onChangeRef = useRef(onChange);
  const onCommitRef = useRef(onCommit);
  useEffect(() => {
    onChangeRef.current = onChange;
    onCommitRef.current = onCommit;
  });

  useEffect(() => {
    let cancelled = false;
    import('mathlive')
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch(() => {
        if (!cancelled) setReady(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Inicializa o campo a partir do `value` só na montagem / quando o elemento
  // troca (elId) — nunca a cada tecla. Não depende de `value`.
  useEffect(() => {
    const mf = ref.current;
    if (!mf || !ready) return;
    editingRef.current = false;
    if (typeof mf.setValue === 'function') mf.setValue(value);
  }, [elId, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  // Foca o campo ao montar / trocar de elemento. Defasado (setTimeout 0) pelo
  // mesmo motivo do InlineTextEditor: o criador faz setPointerCapture no viewport
  // e o click seguinte reverteria o foco para <body> se fosse síncrono — o que
  // aqui faria a digitação toda ir para o body (campo nunca recebe input) e o
  // commit por blur disparar cedo demais. Depois do ciclo de pointer o foco gruda.
  useEffect(() => {
    const mf = ref.current;
    if (!mf || !ready) return;
    const t = setTimeout(() => {
      mf.focus?.();
    }, 0);
    return () => clearTimeout(t);
  }, [elId, ready]);

  // Sync externo→campo: só re-aplica se NÃO estiver editando (ex.: undo/programático).
  useEffect(() => {
    const mf = ref.current;
    if (!mf || !ready) return;
    if (editingRef.current) return; // não mexe durante a digitação
    if (typeof mf.setValue === 'function' && mf.value !== value) {
      // silenceNotifications: não re-emite 'input' (evita loop/edição fantasma).
      mf.setValue(value, { silenceNotifications: true });
    }
  }, [value, ready]);

  // Listener manual de input/keydown/blur (evita double-dispatch do React 19).
  // Também desliga o teclado virtual do MathLive (virtual-keyboard-policy=manual)
  // e esconde o teclado global no foco — a entrada é só pela digitação.
  useEffect(() => {
    const mf = ref.current;
    if (!mf || !ready) return;
    mf.setAttribute('virtual-keyboard-policy', 'manual');

    const emit = () => {
      editingRef.current = true;
      onChangeRef.current(mf.value ?? '');
    };
    const onInput = () => emit();
    const onFocus = () => {
      const vk = (window as unknown as { mathVirtualKeyboard?: { hide?: () => void } }).mathVirtualKeyboard;
      vk?.hide?.();
    };
    const onBlur = () => {
      editingRef.current = false;
      onCommitRef.current?.();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        // Commita a fórmula (mesmo gesto do InlineTextEditor). Sem isso o
        // Enter caía dentro do mathlive e editingId nunca limpava, travando a
        // criação de qualquer outro elemento (onPointerDown descarta se
        // editingId estiver setado).
        e.preventDefault();
        editingRef.current = false;
        onCommitRef.current?.();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        editingRef.current = false;
        onCommitRef.current?.();
      }
    };
    mf.addEventListener('input', onInput);
    mf.addEventListener('focus', onFocus);
    mf.addEventListener('blur', onBlur);
    mf.addEventListener('keydown', onKey);
    return () => {
      mf.removeEventListener('input', onInput);
      mf.removeEventListener('focus', onFocus);
      mf.removeEventListener('blur', onBlur);
      mf.removeEventListener('keydown', onKey);
    };
  }, [ready]);

  return (
    <div className="flex flex-col gap-2">
      {ready ? (
        <math-field
          ref={ref}
          style={{
            display: 'block',
            border: '1px solid var(--line)',
            borderRadius: 8,
            padding: '6px 8px',
            fontSize: 18,
            background: 'var(--surface)',
            color: 'var(--fg)',
          }}
        />
      ) : (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onCommit}
          rows={2}
          className="w-full rounded-lg border border-line bg-surface px-2 py-1 font-mono text-sm"
          placeholder="LaTeX (mathlive indisponível)…"
        />
      )}
      {ready && (
        <button type="button" onClick={() => onCommit?.()} className="btn btn-primary self-start">
          Concluir
        </button>
      )}
    </div>
  );
}