import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import OndeEstudar from './OndeEstudar';
import { api, type StudyResource } from '../api';
import { GUIA_MATERIAIS_URL, TERMOS_LINKS_URL } from '../lib/onde-estudar';

vi.mock('../api', () => ({ api: { studyResources: vi.fn() } }));

const khan: StudyResource = {
  id: 'khan-em-algebra-1',
  title: 'Matemática EM: Álgebra 1',
  url: 'https://pt.khanacademy.org/math/em-mat-algebra',
  types: ['curso', 'exercicios'],
  subjects: ['Matemática'],
  topics: ['Função afim'],
  description: 'Curso com vídeos e exercícios sobre funções.',
  language: 'pt',
  checkedAt: '2026-11-13',
  provider: {
    id: 'khan-academy',
    name: 'Khan Academy',
    kind: 'sem-fins-lucrativos',
    about: 'Organização sem fins lucrativos.',
  },
};
const bbc: StudyResource = {
  ...khan,
  id: 'bbc',
  title: 'BBC Learning English',
  url: 'https://www.bbc.co.uk/learningenglish/',
  subjects: ['Língua Estrangeira'],
  topics: [],
  language: 'en',
  provider: { id: 'bbc', name: 'BBC', kind: 'publico', about: 'Emissora pública.' },
};
const provas: StudyResource = {
  ...khan,
  id: 'provas',
  title: 'Provas e gabaritos do ENEM',
  url: 'https://www.gov.br/inep/provas',
  subjects: [],
  topics: [],
  provider: { id: 'inep', name: 'Inep', kind: 'publico', about: 'Autarquia do MEC.' },
};
const adulterado: StudyResource = {
  ...khan,
  id: 'adulterado',
  title: 'Link adulterado',
  url: 'javascript:alert(1)',
};

function abrir(rota = '/onde-estudar') {
  return render(
    <MemoryRouter initialEntries={[rota]}>
      <OndeEstudar />
    </MemoryRouter>,
  );
}

describe('OndeEstudar', () => {
  beforeEach(() => {
    vi.mocked(api.studyResources).mockReset();
    vi.mocked(api.studyResources).mockResolvedValue({
      resources: [provas, khan, bbc],
      maxCheckAgeDays: 365,
    });
  });

  it('agrupa por matéria, com "Para todas as matérias" no topo', async () => {
    abrir();
    const titulos = await screen.findAllByRole('heading', { level: 2 });
    expect(titulos.map((h) => h.textContent)).toEqual([
      'Para todas as matérias',
      'Matemática',
      'Língua Estrangeira',
      'Como escolhemos',
    ]);
  });

  it('o link abre numa aba nova, sem referrer e sem passar autoridade', async () => {
    abrir();
    const link = await screen.findByRole('link', { name: /Abrir Matemática EM: Álgebra 1/ });
    expect(link).toHaveAttribute('href', khan.url);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer nofollow');
    expect(link).toHaveAttribute('referrerpolicy', 'no-referrer');
    expect(link).toHaveAccessibleName(/pt\.khanacademy\.org/);
  });

  it('mostra a instituição, o tipo dela, a data da conferência e o idioma', async () => {
    abrir();
    const cartao = (await screen.findByRole('heading', { name: 'BBC Learning English' })).closest(
      'article',
    )!;
    expect(within(cartao as HTMLElement).getByText(/BBC · Instituição pública/)).toBeInTheDocument();
    expect(within(cartao as HTMLElement).getByText('Em inglês')).toBeInTheDocument();
    expect(within(cartao as HTMLElement).getByText(/Conferido em 13\/11\/2026/)).toBeInTheDocument();
  });

  it('endereço que não é https nunca vira link', async () => {
    vi.mocked(api.studyResources).mockResolvedValue({ resources: [adulterado], maxCheckAgeDays: 365 });
    abrir();
    expect(await screen.findByText('Link indisponível')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Abrir Link adulterado/ })).not.toBeInTheDocument();
  });

  it('a matéria do endereço filtra e mantém o material geral', async () => {
    abrir('/onde-estudar?materia=L%C3%ADngua%20Estrangeira');
    await screen.findByRole('heading', { name: 'BBC Learning English' });
    expect(screen.queryByRole('heading', { name: khan.title })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: provas.title })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Filtrar por matéria' })).toHaveValue(
      'Língua Estrangeira',
    );
  });

  it('a busca filtra e avisa quando não acha nada', async () => {
    abrir();
    const busca = await screen.findByRole('searchbox', { name: 'Buscar materiais' });
    fireEvent.change(busca, { target: { value: 'funcao afim' } });
    expect(screen.getByRole('heading', { name: khan.title })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: bbc.title })).not.toBeInTheDocument();
    fireEvent.change(busca, { target: { value: 'astrologia' } });
    expect(screen.getByText(/Nenhum material para essa busca/)).toBeInTheDocument();
  });

  it('explica as regras e aponta o canal de remoção e o guia', async () => {
    abrir();
    expect(await screen.findByText(/sai da lista sozinho/)).toHaveTextContent('365 dias');
    expect(screen.getByRole('link', { name: 'Veja como pedir a remoção' })).toHaveAttribute(
      'href',
      TERMOS_LINKS_URL,
    );
    expect(TERMOS_LINKS_URL).toMatch(/termos\/#links-e-materiais-de-outros-sites$/);
    expect(screen.getByRole('link', { name: 'Leia o guia de contribuição' })).toHaveAttribute(
      'href',
      GUIA_MATERIAIS_URL,
    );
  });

  it('erro de rede mostra o aviso', async () => {
    vi.mocked(api.studyResources).mockRejectedValue(new Error('offline'));
    abrir();
    expect(await screen.findByText(/Não foi possível carregar os materiais/)).toBeInTheDocument();
  });
});
