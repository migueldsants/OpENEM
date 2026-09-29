import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  api,
  type CommunityThemeSort,
  type SavedTheme,
} from '../api';
import { EmptyState } from '../components/EmptyState';
import { ErrorBanner } from '../components/ErrorBanner';
import {
  IconCheck,
  IconHeart,
  IconPalette,
  IconPen,
  IconPlus,
  IconShare,
  IconTrash,
} from '../components/icons';
import { PageHeader } from '../components/PageHeader';
import { SkeletonCard } from '../components/Skeleton';
import ThemeEditor from '../components/ThemeEditor';
import { ThemePreview } from '../components/ThemePreview';
import { paletteFromBrand } from '../lib/theme-derive';
import { fromOneSide, parseCustom, type CustomTheme } from '../theme-custom';
import { FAMILIES, THEME_GROUPS, useTheme, type ThemeVariant } from '../theme';

type Tab = 'galeria' | 'meus' | 'comunidade';

const TABS: { key: Tab; label: string }[] = [
  { key: 'galeria', label: 'Galeria' },
  { key: 'meus', label: 'Meus temas' },
  { key: 'comunidade', label: 'Comunidade' },
];

const PAGE = 24;

function message(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

/** Converte o tema do servidor para o formato local (revalidando as cores). */
function toCustom(t: SavedTheme, keepId: boolean): CustomTheme | null {
  const parsed = parseCustom({ name: t.name, light: t.light, dark: t.dark });
  if (!parsed) return null;
  return keepId ? { ...parsed, id: t.id } : parsed;
}

/** Mesmas cores nos dois lados: é o tema em uso. */
function sameColors(a: CustomTheme | null, t: SavedTheme) {
  return (
    !!a &&
    JSON.stringify([a.light, a.dark]) === JSON.stringify([t.light, t.dark])
  );
}

export default function Temas() {
  const theme = useTheme();
  const [tab, setTab] = useState<Tab>('galeria');
  const [editing, setEditing] = useState<CustomTheme | null>(null);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(id);
  }, [notice]);

  function startNew() {
    const base = theme.custom ?? fromOneSide(paletteFromBrand('#d91748', 'light'), 'light');
    // Tema novo nunca herda o id: salvar cria outro registro.
    const { id: _id, ...semId } = base;
    setEditing({ ...semId, name: theme.custom ? `${base.name} 2` : base.name });
    setEditError(null);
  }

  async function save(t: CustomTheme) {
    setSaving(true);
    setEditError(null);
    const input = { name: t.name, light: t.light, dark: t.dark };
    try {
      const saved = t.id ? await api.updateTheme(t.id, input) : await api.createTheme(input);
      theme.applyCustom({ ...t, id: saved.id, name: saved.name });
      setEditing(null);
      setTab('meus');
      setNotice(`"${saved.name}" salvo e em uso.`);
    } catch (err) {
      setEditError(message(err, 'Não foi possível salvar o tema.'));
    } finally {
      setSaving(false);
    }
  }

  function applyLocalOnly(t: CustomTheme) {
    theme.applyCustom(t);
    setEditing(null);
    setNotice('Tema aplicado só neste aparelho.');
  }

  if (editing) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={editing.id ? 'Editar tema' : 'Novo tema'}
          subtitle="Monte o lado claro e o escuro. O botão de sol/lua do topo alterna entre eles."
        />
        <ThemeEditor
          initial={editing}
          saving={saving}
          error={editError}
          onSave={(t) => void save(t)}
          onCancel={() => setEditing(null)}
        />
        {editError && (
          <p className="text-right text-xs text-muted">
            Sem conexão?{' '}
            <button
              type="button"
              className="font-semibold text-brand hover:underline"
              onClick={() => applyLocalOnly(editing)}
            >
              Usar só neste aparelho
            </button>
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Temas"
        subtitle="Escolha uma paleta, crie a sua com lado claro e escuro, ou use as da comunidade."
        actions={
          <button type="button" onClick={startNew} className="btn btn-primary">
            <IconPlus width={18} height={18} aria-hidden />
            Criar tema
          </button>
        }
      >
        <div className="seg" role="tablist" aria-label="Seções de temas">
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              data-active={tab === t.key}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </PageHeader>

      {notice && (
        <p className="rounded-lg bg-brand/10 px-3 py-2 text-sm text-brand" role="status">
          {notice}
        </p>
      )}

      {tab === 'galeria' && <Gallery onCreate={startNew} />}
      {tab === 'meus' && (
        <MyThemes
          onCreate={startNew}
          onEdit={(t) => {
            setEditError(null);
            setEditing(t);
          }}
          onNotice={setNotice}
        />
      )}
      {tab === 'comunidade' && <Community onNotice={setNotice} />}
    </div>
  );
}

function VariantSwitch() {
  const { variant, setVariant, effects, setEffects } = useTheme();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="seg" aria-label="Lado do tema">
        {(['light', 'dark'] as ThemeVariant[]).map((v) => (
          <button key={v} data-active={variant === v} onClick={() => setVariant(v)}>
            {v === 'light' ? 'Claro' : 'Escuro'}
          </button>
        ))}
      </div>
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={effects}
          onChange={(e) => setEffects(e.target.checked)}
          className="size-4 accent-[var(--brand)]"
        />
        Efeitos visuais
        <span className="text-xs text-muted">(brilho neon e scanlines)</span>
      </label>
    </div>
  );
}

function Gallery({ onCreate }: { onCreate: () => void }) {
  const { family, variant, custom, setFamily } = useTheme();
  return (
    <div className="space-y-8">
      <VariantSwitch />

      <section aria-labelledby="g-custom" className="space-y-3">
        <h2 id="g-custom" className="font-display text-lg font-bold">
          Personalizado
        </h2>
        {custom ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <ThemeOption
              label={custom.name}
              active={family === 'custom'}
              onClick={() => setFamily('custom')}
            >
              <ThemePreview tokens={custom[variant]} variant={variant} />
            </ThemeOption>
            <button
              type="button"
              onClick={onCreate}
              className="grid min-h-32 place-items-center rounded-2xl border border-dashed border-line p-3 text-sm font-semibold text-muted transition-colors hover:bg-surface-2 hover:text-fg"
            >
              <span className="flex items-center gap-2">
                <IconPlus width={18} height={18} aria-hidden />
                Criar outro
              </span>
            </button>
          </div>
        ) : (
          <EmptyState
            dense
            icon={IconPalette}
            title="Monte o seu tema"
            description="Escolha uma cor e o OpENEM gera os lados claro e escuro, já com contraste para leitura."
            action={{ label: 'Criar tema', onClick: onCreate }}
          />
        )}
      </section>

      {THEME_GROUPS.map((g) => (
        <section key={g.key} aria-labelledby={`g-${g.key}`} className="space-y-3">
          <div>
            <h2 id={`g-${g.key}`} className="font-display text-lg font-bold">
              {g.label}
            </h2>
            <p className="text-sm text-muted">{g.hint}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {FAMILIES.filter((f) => f.group === g.key).map((f) => (
              <ThemeOption
                key={f.key}
                label={f.label}
                active={family === f.key}
                onClick={() => setFamily(f.key)}
              >
                <ThemePreview theme={`${f.key}-${variant}`} />
              </ThemeOption>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function ThemeOption({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`group rounded-2xl border p-2 text-left transition-[transform,background-color] active:scale-[0.98] ${
        active ? 'border-brand ring-1 ring-brand' : 'border-line hover:bg-surface-2'
      }`}
    >
      {children}
      <span className="mt-2 flex items-center justify-between gap-2 px-0.5 text-sm font-semibold">
        <span className="truncate">{label}</span>
        {active && <IconCheck width={16} height={16} className="shrink-0 text-brand" aria-label="Em uso" />}
      </span>
    </button>
  );
}

function MyThemes({
  onCreate,
  onEdit,
  onNotice,
}: {
  onCreate: () => void;
  onEdit: (t: CustomTheme) => void;
  onNotice: (m: string) => void;
}) {
  const theme = useTheme();
  const [items, setItems] = useState<SavedTheme[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    api
      .myThemes()
      .then(setItems)
      .catch((err) => {
        setItems([]);
        setError(message(err, 'Não foi possível carregar seus temas.'));
      });
  }, []);

  useEffect(load, [load]);

  const local = theme.custom;
  const localUnsaved = local && !local.id;

  async function saveLocal() {
    if (!local) return;
    setBusy('local');
    try {
      const saved = await api.createTheme({ name: local.name, light: local.light, dark: local.dark });
      theme.applyCustom({ ...local, id: saved.id }, theme.family === 'custom' ? theme.variant : undefined);
      setItems((prev) => [saved, ...(prev ?? [])]);
      onNotice('Tema salvo na sua conta.');
    } catch (err) {
      setError(message(err, 'Não foi possível salvar.'));
    } finally {
      setBusy(null);
    }
  }

  async function togglePublic(t: SavedTheme) {
    setBusy(t.id);
    try {
      const updated = await api.updateTheme(t.id, { isPublic: !t.isPublic });
      setItems((prev) => prev?.map((x) => (x.id === t.id ? updated : x)) ?? null);
      onNotice(updated.isPublic ? 'Publicado na comunidade.' : 'Tema voltou a ser privado.');
    } catch (err) {
      setError(message(err, 'Não foi possível mudar a publicação.'));
    } finally {
      setBusy(null);
    }
  }

  async function remove(t: SavedTheme) {
    setBusy(t.id);
    try {
      await api.deleteTheme(t.id);
      setItems((prev) => prev?.filter((x) => x.id !== t.id) ?? null);
      setConfirmDelete(null);
      onNotice(`"${t.name}" apagado.`);
    } catch (err) {
      setError(message(err, 'Não foi possível apagar.'));
    } finally {
      setBusy(null);
    }
  }

  function activate(t: SavedTheme) {
    const c = toCustom(t, true);
    if (c) theme.applyCustom(c);
  }

  function edit(t: SavedTheme) {
    const c = toCustom(t, true);
    if (c) onEdit(c);
  }

  if (!items) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-busy>
        <SkeletonCard lines={2} />
        <SkeletonCard lines={2} />
        <SkeletonCard lines={2} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ErrorBanner message={error} onRetry={load} />

      {localUnsaved && (
        <div className="card flex flex-wrap items-center gap-4 p-4">
          <ThemePreview tokens={local[theme.variant]} variant={theme.variant} className="w-40" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{local.name}</p>
            <p className="text-sm text-muted">Está só neste aparelho. Salve para usar em qualquer lugar e poder publicar.</p>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy === 'local'}
            onClick={() => void saveLocal()}
          >
            Salvar na conta
          </button>
        </div>
      )}

      {items.length === 0 && !localUnsaved ? (
        <EmptyState
          icon={IconPalette}
          title="Nenhum tema salvo ainda"
          description="Crie um tema com lado claro e escuro. Depois, se quiser, publique para a comunidade curtir."
          action={{ label: 'Criar tema', onClick: onCreate }}
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((t) => {
            const inUse = theme.family === 'custom' && sameColors(theme.custom, t);
            return (
              <li key={t.id} className="card flex flex-col gap-3 p-3">
                <ThemePreview tokens={t[theme.variant]} variant={theme.variant} />
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{t.name}</p>
                    <p className="text-xs text-muted">
                      {t.isPublic ? `Publicado · ${t.likes} ${t.likes === 1 ? 'curtida' : 'curtidas'}` : 'Privado'}
                    </p>
                  </div>
                  {inUse && (
                    <span className="chip shrink-0" data-active="true">
                      Em uso
                    </span>
                  )}
                </div>
                <div className="mt-auto flex flex-wrap gap-2">
                  <button type="button" className="btn btn-primary text-sm" onClick={() => activate(t)} disabled={inUse}>
                    Usar
                  </button>
                  <button type="button" className="btn btn-ghost text-sm" onClick={() => edit(t)} aria-label={`Editar ${t.name}`}>
                    <IconPen width={16} height={16} aria-hidden />
                    Editar
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost text-sm"
                    onClick={() => void togglePublic(t)}
                    disabled={busy === t.id}
                  >
                    <IconShare width={16} height={16} aria-hidden />
                    {t.isPublic ? 'Despublicar' : 'Publicar'}
                  </button>
                  {confirmDelete === t.id ? (
                    <button
                      type="button"
                      className="btn btn-ghost text-sm text-danger"
                      onClick={() => void remove(t)}
                      disabled={busy === t.id}
                    >
                      Confirmar exclusão
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-ghost text-sm"
                      onClick={() => setConfirmDelete(t.id)}
                      aria-label={`Apagar ${t.name}`}
                    >
                      <IconTrash width={16} height={16} aria-hidden />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Community({ onNotice }: { onNotice: (m: string) => void }) {
  const theme = useTheme();
  const [sort, setSort] = useState<CommunityThemeSort>('popular');
  const [items, setItems] = useState<SavedTheme[] | null>(null);
  const [more, setMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liking, setLiking] = useState<string | null>(null);
  const [copying, setCopying] = useState<string | null>(null);

  const load = useCallback((s: CommunityThemeSort, skip = 0) => {
    setError(null);
    api
      .communityThemes(s, PAGE, skip)
      .then((page) => {
        setItems((prev) => (skip === 0 ? page : [...(prev ?? []), ...page]));
        setMore(page.length === PAGE);
      })
      .catch((err) => {
        setItems((prev) => prev ?? []);
        setError(message(err, 'Não foi possível carregar a comunidade.'));
      });
  }, []);

  useEffect(() => {
    setItems(null);
    load(sort);
  }, [sort, load]);

  async function like(t: SavedTheme) {
    if (liking || t.mine) return;
    setLiking(t.id);
    const flip = (x: SavedTheme, liked: boolean): SavedTheme => ({
      ...x,
      liked,
      likes: Math.max(0, x.likes + (liked ? 1 : -1)),
    });
    // Otimista: marca na hora e reconcilia com o total do servidor.
    setItems((prev) => prev?.map((x) => (x.id === t.id ? flip(x, !t.liked) : x)) ?? null);
    try {
      const res = await api.toggleThemeLike(t.id);
      setItems((prev) =>
        prev?.map((x) => (x.id === t.id ? { ...x, liked: res.liked, likes: res.likes } : x)) ?? null,
      );
    } catch (err) {
      setItems((prev) => prev?.map((x) => (x.id === t.id ? { ...x, liked: t.liked, likes: t.likes } : x)) ?? null);
      setError(message(err, 'Não foi possível curtir.'));
    } finally {
      setLiking(null);
    }
  }

  function activate(t: SavedTheme) {
    // Só o dono guarda o id (é ele quem pode editar o registro).
    const c = toCustom(t, t.mine);
    if (c) {
      theme.applyCustom(c);
      onNotice(`Usando "${t.name}".`);
    }
  }

  async function copy(t: SavedTheme) {
    setCopying(t.id);
    try {
      await api.createTheme({ name: t.name, light: t.light, dark: t.dark });
      onNotice(`"${t.name}" copiado para Meus temas.`);
    } catch (err) {
      setError(message(err, 'Não foi possível copiar.'));
    } finally {
      setCopying(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="seg" aria-label="Ordenar temas">
          <button data-active={sort === 'popular'} onClick={() => setSort('popular')}>
            Populares
          </button>
          <button data-active={sort === 'recent'} onClick={() => setSort('recent')}>
            Recentes
          </button>
        </div>
        <VariantSwitch />
      </div>

      <ErrorBanner message={error} onRetry={() => load(sort)} />

      {!items ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-busy>
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={IconPalette}
          title="Nenhum tema publicado ainda"
          description="Crie um tema em Meus temas e publique para ser o primeiro da lista."
        />
      ) : (
        <>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((t) => {
              const inUse = theme.family === 'custom' && sameColors(theme.custom, t);
              return (
                <li key={t.id} className="card flex flex-col gap-3 p-3">
                  <ThemePreview tokens={t[theme.variant]} variant={theme.variant} />
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{t.name}</p>
                      <p className="truncate text-xs text-muted">
                        {t.mine ? 'Seu tema' : `por ${t.author}`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void like(t)}
                      disabled={t.mine || liking === t.id}
                      aria-pressed={t.liked}
                      aria-label={
                        t.mine
                          ? `${t.likes} curtidas no seu tema`
                          : t.liked
                            ? `Descurtir ${t.name}`
                            : `Curtir ${t.name}`
                      }
                      title={t.mine ? 'Não dá para curtir o próprio tema' : undefined}
                      className={`flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold transition-colors disabled:cursor-default ${
                        t.liked ? 'bg-danger/12 text-danger' : 'bg-surface-2 text-muted hover:text-fg'
                      }`}
                    >
                      <IconHeart width={16} height={16} filled={t.liked} />
                      {t.likes}
                    </button>
                  </div>
                  <div className="mt-auto flex flex-wrap gap-2">
                    <button type="button" className="btn btn-primary text-sm" onClick={() => activate(t)} disabled={inUse}>
                      {inUse ? 'Em uso' : 'Usar'}
                    </button>
                    {!t.mine && (
                      <button
                        type="button"
                        className="btn btn-ghost text-sm"
                        onClick={() => void copy(t)}
                        disabled={copying === t.id}
                      >
                        Salvar em meus temas
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          {more && (
            <div className="flex justify-center">
              <button type="button" className="btn btn-ghost" onClick={() => load(sort, items.length)}>
                Carregar mais
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
