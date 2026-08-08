// Galeria do Quadro de Estudos (issue #32). CRUD local: criar, abrir,
// renomear, duplicar, excluir. Thumbnails ao vivo via <BoardSVG> (texto
// simples no lugar do KaTeX — não puxa o chunk do editor). Import `.openem`.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EmptyState } from '../components/EmptyState';
import { IconBoard, IconImage as ImageIcon } from '../components/icons';
import { BoardSVG } from '../board/render';
import {
  createBoard,
  type Board,
  type BoardElement,
} from '../board/types';
import {
  deleteBoard,
  duplicateBoard,
  listBoards,
  saveBoard,
} from '../board/storage';
import { cryptoRandomId, toOpenEm } from '../board/serialize';
import {
  downloadDataUrl,
  downloadSvg,
  downloadText,
  importOpenEmFile,
  toPNGDataUrl,
  toSVG,
} from '../board/export';

/** Data relativa curta ("hoje", "ontem", "3 dias atrás"). */
function relativeDate(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffDays = Math.floor((Date.now() - then) / 86_400_000);
  if (diffDays <= 0) return 'hoje';
  if (diffDays === 1) return 'ontem';
  if (diffDays < 30) return `${diffDays} dias atrás`;
  const months = Math.floor(diffDays / 30);
  return months === 1 ? 'mês atrás' : `${months} meses atrás`;
}

/** Thumbnail: BoardSVG com fórmula em texto simples (sem KaTeX). Mostra o
 * canvas inteiro (0 0 2000 1400) escalado na caixa — sem isso, o viewBox
 * default recortaria só o canto superior esquerdo e o thumb ficava vazio. */
const WORLD_VIEWBOX = '0 0 2000 1400';

function Thumb({ board }: { board: Board }) {
  const renderFormula = (el: BoardElement) =>
    el.latex ? (
      <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{el.latex}</span>
    ) : null;
  return (
    <div className="aspect-video overflow-hidden rounded-lg bg-bg">
      <BoardSVG
        board={board}
        width={300}
        height={170}
        viewBox={WORLD_VIEWBOX}
        renderFormula={renderFormula}
      />
    </div>
  );
}

export default function Quadro() {
  const navigate = useNavigate();
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState('');
  const [error, setError] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setBoards(await listBoards());
    } catch {
      setError('Não foi possível ler os quadros salvos neste dispositivo.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function newBoard() {
    const b = createBoard({ id: cryptoRandomId(), title: 'Quadro sem título' });
    await saveBoard(b);
    navigate(`/quadro/${b.id}`);
  }

  async function onImport(file: File) {
    try {
      const board = await importOpenEmFile(file);
      await saveBoard(board);
      navigate(`/quadro/${board.id}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Não foi possível importar o arquivo.',
      );
    }
  }

  async function onRename(id: string) {
    const title = renameVal.trim();
    setRenaming(null);
    if (!title) return;
    const b = boards.find((x) => x.id === id);
    if (!b) return;
    await saveBoard({ ...b, title });
    void reload();
  }

  async function onDuplicate(id: string) {
    setBusyId(id);
    try {
      const copy = await duplicateBoard(id);
      if (copy) navigate(`/quadro/${copy.id}`);
    } finally {
      setBusyId(null);
      setMenuFor(null);
    }
  }

  async function onDelete(id: string) {
    if (!confirm('Excluir este quadro? Não dá para desfazer.')) return;
    setBusyId(id);
    try {
      await deleteBoard(id);
      void reload();
    } finally {
      setBusyId(null);
      setMenuFor(null);
    }
  }

  async function onExport(id: string, kind: 'openem' | 'png' | 'svg') {
    const b = boards.find((x) => x.id === id);
    setMenuFor(null);
    if (!b) return;
    const slug = b.title.replace(/[^\w-]+/g, '_') || 'quadro';
    setBusyId(id);
    try {
      if (kind === 'openem') {
        downloadText(toOpenEm(b), `${slug}.openem`);
      } else if (kind === 'svg') {
        downloadSvg(await toSVG(b), `${slug}.svg`);
      } else {
        downloadDataUrl(await toPNGDataUrl(b, 2), `${slug}.png`);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Falha ao exportar o quadro.',
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4 pb-28 md:pb-12">
      <header className="flex items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Ferramentas de estudo</p>
          <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight">
            Quadro de Estudos
          </h1>
          <p className="mt-1 text-sm text-muted">
            Mapas mentais, fórmulas e rascunhos — salvos no dispositivo.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={() => importRef.current?.click()}
            className="btn btn-ghost"
          >
            Importar
          </button>
          <button onClick={newBoard} className="btn btn-primary">
            Novo quadro
          </button>
          <input
            ref={importRef}
            type="file"
            accept=".openem,application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onImport(f);
              e.target.value = '';
            }}
          />
        </div>
      </header>

      {error && (
        <p className="rounded-lg bg-red/10 px-3 py-2 text-sm text-red">{error}</p>
      )}

      {loading ? (
        <p className="text-sm text-muted">Carregando quadros…</p>
      ) : boards.length === 0 ? (
        <EmptyState
          icon={IconBoard}
          title="Nenhum quadro ainda"
          description="Crie mapas mentais, escreva fórmulas e rabisque geometria num canvas livre voltado para o estudo."
          action={{ onClick: newBoard, label: 'Criar primeiro quadro' }}
          tip="Ou importe um arquivo .openem"
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {boards.map((b) => (
            <div key={b.id} className="card card-raised overflow-hidden">
              <button
                onClick={() => navigate(`/quadro/${b.id}`)}
                className="block w-full"
                aria-label={`Abrir ${b.title}`}
              >
                <Thumb board={b} />
              </button>
              <div className="flex items-center gap-2 p-3">
                {renaming === b.id ? (
                  <input
                    autoFocus
                    value={renameVal}
                    onChange={(e) => setRenameVal(e.target.value)}
                    onBlur={() => onRename(b.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') onRename(b.id);
                      if (e.key === 'Escape') setRenaming(null);
                    }}
                    className="min-w-0 flex-1 rounded-md border border-line bg-surface px-2 py-1 text-sm font-semibold"
                  />
                ) : (
                  <button
                    onClick={() => navigate(`/quadro/${b.id}`)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="truncate font-display text-sm font-bold">
                      {b.title}
                    </p>
                    <p className="text-xs text-muted">
                      {b.elements.length} elementos · {relativeDate(b.updatedAt)}
                    </p>
                  </button>
                )}
                <div className="relative">
                  <button
                    onClick={() => setMenuFor(menuFor === b.id ? null : b.id)}
                    aria-label="Mais ações"
                    className="grid size-8 place-items-center rounded-lg border border-line text-muted hover:bg-surface-2"
                  >
                    <span className="text-lg leading-none">⋯</span>
                  </button>
                  {menuFor === b.id && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setMenuFor(null)}
                        aria-hidden
                      />
                      <div className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-xl border border-line bg-surface shadow-[var(--shadow)]">
                        <MenuItem
                          onClick={() => {
                            setRenaming(b.id);
                            setRenameVal(b.title);
                            setMenuFor(null);
                          }}
                        >
                          Renomear
                        </MenuItem>
                        <MenuItem
                          onClick={() => onExport(b.id, 'openem')}
                          icon={<ImageIcon width={15} height={15} />}
                        >
                          Exportar .openem
                        </MenuItem>
                        <MenuItem
                          onClick={() => onExport(b.id, 'png')}
                          icon={<ImageIcon width={15} height={15} />}
                        >
                          Exportar PNG
                        </MenuItem>
                        <MenuItem
                          onClick={() => onExport(b.id, 'svg')}
                          icon={<ImageIcon width={15} height={15} />}
                        >
                          Exportar SVG
                        </MenuItem>
                        <MenuItem
                          onClick={() => onDuplicate(b.id)}
                          disabled={busyId === b.id}
                        >
                          Duplicar
                        </MenuItem>
                        <MenuItem
                          onClick={() => onDelete(b.id)}
                          disabled={busyId === b.id}
                          danger
                        >
                          Excluir
                        </MenuItem>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MenuItem({
  children,
  onClick,
  icon,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  icon?: React.ReactNode;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-surface-2 disabled:opacity-50 ${
        danger ? 'text-red' : 'text-fg'
      }`}
    >
      {icon}
      {children}
    </button>
  );
}