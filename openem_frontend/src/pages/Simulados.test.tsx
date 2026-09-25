// Testes do montador de simulado por tema, dos simulados salvos e do PDF.
import { StrictMode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Simulados from './Simulados';
import { api } from '../api';

vi.mock('../api', () => ({
  api: {
    simulationTemplates: vi.fn(),
    subjects: vi.fn(),
    startSimulation: vi.fn(),
    simulationPreview: vi.fn(),
    simulation: vi.fn(),
    saveSimulationTemplate: vi.fn(),
    deleteSimulationTemplate: vi.fn(),
    pdfThemes: vi.fn(),
    simulationPdf: vi.fn(),
  },
}));
vi.mock('../gamification', () => ({
  useGamification: () => ({ refresh: vi.fn(), summary: null }),
}));

const AREA_MAT = {
  id: 'area-mat',
  name: 'Matemática e suas Tecnologias',
};

const SUBJECTS = [
  {
    id: 'subj-mat',
    name: 'Matemática',
    subjectArea: AREA_MAT,
    topics: [
      { id: 'topic-funcoes', name: 'Funções' },
      { id: 'topic-prob', name: 'Probabilidade' },
    ],
  },
];

const PREVIEW = {
  available: 142,
  classified: 37,
  questionCount: 10,
  timeLimitMin: 30,
  description: 'Matemática · 10 questões',
};

const START_RESPONSE = {
  id: 'sim-1',
  startedAt: new Date().toISOString(),
  timeLimitMin: 30,
  questionCount: 1,
  questions: [
    {
      id: 'q1',
      statement: 's',
      difficulty: 1,
      topic: { id: 't', name: 'T', subject: { id: 'subj-mat', name: 'S' } },
      alternatives: [{ id: 'a', text: 'x', letter: 'A' }],
    },
  ],
};

function renderPage() {
  return render(
    <MemoryRouter>
      <Simulados />
    </MemoryRouter>,
  );
}

/** Espera a prévia chegar — ela é debounced, então nada acontece na hora. */
async function aguardaPreview() {
  await waitFor(() => expect(api.simulationPreview).toHaveBeenCalled());
}

describe('Simulados — montador por tema', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(api.simulationTemplates).mockResolvedValue([]);
    vi.mocked(api.subjects).mockResolvedValue(SUBJECTS as never);
    vi.mocked(api.startSimulation).mockResolvedValue(START_RESPONSE as never);
    vi.mocked(api.simulationPreview).mockResolvedValue(PREVIEW as never);
    vi.mocked(api.pdfThemes).mockResolvedValue([
      { key: 'default', label: 'Padrão', brand: '#e0234e', surface: '#fff' },
      { key: 'forest', label: 'Verde', brand: '#16a34a', surface: '#fff' },
    ] as never);
  });

  it('mostra quantas questões o recorte tem antes de começar', async () => {
    renderPage();
    await aguardaPreview();
    expect(
      await screen.findByText(/142 questões disponíveis/),
    ).toBeInTheDocument();
  });

  it('conta as questões mesmo no StrictMode (monta, desmonta, monta)', async () => {
    // Em dev o React monta o efeito duas vezes. Uma versão anterior guardava a
    // última chave num ref e, na segunda montagem, desistia de agendar a
    // consulta — a tela ficava em "Calculando…" para sempre.
    render(
      <StrictMode>
        <MemoryRouter>
          <Simulados />
        </MemoryRouter>
      </StrictMode>,
    );
    expect(
      await screen.findByText(/142 questões disponíveis/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Calculando/)).not.toBeInTheDocument();
  });

  it('área, matéria e assunto são somados nos filtros do start', async () => {
    renderPage();
    // Área (o chip mostra o nome curto).
    fireEvent.click(await screen.findByRole('button', { name: 'Matemática' }));
    // Matéria inteira.
    const select = await screen.findByRole('combobox');
    fireEvent.change(select, { target: { value: 'subj-mat' } });
    fireEvent.click(await screen.findByText('Matéria inteira'));
    // Assunto.
    fireEvent.click(await screen.findByText('Funções'));

    fireEvent.click(screen.getByText('Iniciar simulado'));

    await waitFor(() =>
      expect(api.startSimulation).toHaveBeenCalledWith(null, {
        subjectAreaIds: ['area-mat'],
        subjectIds: ['subj-mat'],
        topicIds: ['topic-funcoes'],
        questionCount: 10,
        pareto: true,
      }),
    );
  });

  it('clicar de novo no tema o remove da seleção', async () => {
    renderPage();
    const chip = await screen.findByRole('button', { name: 'Matemática' });
    fireEvent.click(chip);
    // O chip escolhido ganha o ícone de check, então é buscado pelo prefixo.
    fireEvent.click(screen.getAllByRole('button', { name: /^Matemática/ })[0]);
    fireEvent.click(screen.getByText('Iniciar simulado'));

    await waitFor(() =>
      expect(api.startSimulation).toHaveBeenCalledWith(null, {
        questionCount: 10,
        pareto: true,
      }),
    );
  });

  it('recorte vazio bloqueia o início e explica o motivo', async () => {
    vi.mocked(api.simulationPreview).mockResolvedValue({
      ...PREVIEW,
      available: 0,
    } as never);
    renderPage();
    expect(
      await screen.findByText(/Nenhuma questão combina com esse recorte/),
    ).toBeInTheDocument();
    expect(screen.getByText('Iniciar simulado')).toBeDisabled();
  });

  it('exibe erro quando o start falha', async () => {
    vi.mocked(api.startSimulation).mockRejectedValueOnce(
      new Error('Sem questões para este filtro'),
    );
    renderPage();
    fireEvent.click(await screen.findByText('Iniciar simulado'));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Sem questões para este filtro');
  });

  it('salva o recorte como simulado do aluno', async () => {
    vi.mocked(api.saveSimulationTemplate).mockResolvedValue({
      id: 'tpl-1',
      name: 'Só funções',
    } as never);
    renderPage();
    const select = await screen.findByRole('combobox');
    fireEvent.change(select, { target: { value: 'subj-mat' } });
    fireEvent.click(await screen.findByText('Funções'));
    fireEvent.click(screen.getByText('Salvar'));
    fireEvent.change(screen.getByLabelText(/Nome do simulado/), {
      target: { value: 'Só funções' },
    });
    fireEvent.click(screen.getAllByText('Salvar')[1]);

    await waitFor(() =>
      expect(api.saveSimulationTemplate).toHaveBeenCalledWith('Só funções', {
        topicIds: ['topic-funcoes'],
        questionCount: 10,
        pareto: true,
      }),
    );
  });
});

describe('Simulados — simulados salvos', () => {
  const SALVO = {
    id: 'tpl-1',
    name: 'Genética pesada',
    scope: 'CUSTOM',
    questionCount: 20,
    timeLimitMin: 60,
    subject: null,
    owned: true,
    filters: { topicIds: ['t-gen'] },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(api.subjects).mockResolvedValue(SUBJECTS as never);
    vi.mocked(api.simulationPreview).mockResolvedValue(PREVIEW as never);
    vi.mocked(api.startSimulation).mockResolvedValue(START_RESPONSE as never);
    vi.mocked(api.simulationTemplates).mockResolvedValue([SALVO] as never);
    vi.mocked(api.deleteSimulationTemplate).mockResolvedValue({
      id: 'tpl-1',
      archived: false,
    } as never);
  });

  it('lista o simulado salvo e inicia por ele', async () => {
    renderPage();
    expect(await screen.findByText('Genética pesada')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Iniciar'));
    await waitFor(() =>
      expect(api.startSimulation).toHaveBeenCalledWith('tpl-1', undefined),
    );
  });

  it('apaga o simulado salvo e recarrega a lista', async () => {
    renderPage();
    await screen.findByText('Genética pesada');
    fireEvent.click(screen.getByLabelText('Apagar Genética pesada'));
    await waitFor(() =>
      expect(api.deleteSimulationTemplate).toHaveBeenCalledWith('tpl-1'),
    );
  });
});

describe('Simulados — caderno em PDF', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(api.subjects).mockResolvedValue(SUBJECTS as never);
    vi.mocked(api.simulationPreview).mockResolvedValue(PREVIEW as never);
    vi.mocked(api.simulationTemplates).mockResolvedValue([]);
    vi.mocked(api.pdfThemes).mockResolvedValue([
      { key: 'default', label: 'Padrão', brand: '#e0234e', surface: '#fff' },
      { key: 'forest', label: 'Verde', brand: '#16a34a', surface: '#fff' },
    ] as never);
    vi.mocked(api.simulationPdf).mockResolvedValue({
      blob: new Blob(['%PDF-'], { type: 'application/pdf' }),
      filename: 'openem-simulado.pdf',
    } as never);
    // jsdom não implementa createObjectURL.
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:fake');
    globalThis.URL.revokeObjectURL = vi.fn();
  });

  it('abre o diálogo, escolhe o tema e gera o arquivo', async () => {
    renderPage();
    fireEvent.click(await screen.findByText('Baixar PDF'));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();
    fireEvent.click(await screen.findByLabelText('Tema Verde'));
    fireEvent.click(screen.getByText('Gerar PDF'));

    await waitFor(() => expect(api.simulationPdf).toHaveBeenCalled());
    const [options] = vi.mocked(api.simulationPdf).mock.calls[0];
    expect(options.theme).toBe('forest');
    expect(options.cover).toBe(true);
    expect(options.answerSheet).toBe(true);
  });

  it('desligar a capa e o gabarito chega na requisição', async () => {
    renderPage();
    fireEvent.click(await screen.findByText('Baixar PDF'));
    await screen.findByRole('dialog');

    fireEvent.click(screen.getByText('Capa'));
    fireEvent.click(screen.getByText('Gabarito'));
    fireEvent.click(screen.getByText('Gerar PDF'));

    await waitFor(() => expect(api.simulationPdf).toHaveBeenCalled());
    const [options] = vi.mocked(api.simulationPdf).mock.calls[0];
    expect(options.cover).toBe(false);
    expect(options.answerKey).toBe(false);
  });
});

describe('Simulados — provas oficiais do ENEM', () => {
  const prova = (
    slug: string,
    year: number,
    day: number,
    isReapplication = false,
  ) => ({
    id: `enem-${slug}-dia${day}`,
    name: `ENEM ${year} · ${day}º dia`,
    scope: 'EXAM',
    questionCount: day === 1 ? 89 : 88,
    timeLimitMin: day === 1 ? 330 : 300,
    subject: null,
    exam: { slug, year, label: `ENEM ${year}`, isReapplication },
    day,
    areas:
      day === 1
        ? [
            'Linguagens, Códigos e suas Tecnologias',
            'Ciências Humanas e suas Tecnologias',
          ]
        : [
            'Ciências da Natureza e suas Tecnologias',
            'Matemática e suas Tecnologias',
          ],
  });

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(api.subjects).mockResolvedValue(SUBJECTS as never);
    vi.mocked(api.simulationPreview).mockResolvedValue(PREVIEW as never);
    vi.mocked(api.startSimulation).mockResolvedValue(START_RESPONSE as never);
  });

  it('agrupa por ano, com os dois dias, áreas, questões e tempo oficial', async () => {
    vi.mocked(api.simulationTemplates).mockResolvedValue([
      prova('2023', 2023, 1),
      prova('2023', 2023, 2),
      prova('2023-reaplicacao', 2023, 1, true),
    ] as never);
    renderPage();

    expect(await screen.findByText('ENEM 2023')).toBeInTheDocument();
    expect(screen.getByText('Aplicação regular')).toBeInTheDocument();
    expect(screen.getByText('Reaplicação')).toBeInTheDocument();
    expect(screen.getAllByText('1º dia')).toHaveLength(2);
    // Regular e reaplicação têm 1º dia com 89 questões; o 2º dia, 88.
    expect(screen.getAllByText('89 questões')).toHaveLength(2);
    expect(screen.getByText('88 questões')).toBeInTheDocument();
    // 330 min vira "5h30"; 300 vira "5h".
    expect(screen.getAllByText('5h30').length).toBeGreaterThan(0);
    expect(screen.getByText('5h')).toBeInTheDocument();
    // Nomes curtos das áreas do dia.
    expect(screen.getAllByText('Linguagens').length).toBeGreaterThan(0);
    expect(screen.getByText('Natureza')).toBeInTheDocument();
  });

  it('iniciar um dia chama o start com o template da prova', async () => {
    vi.mocked(api.simulationTemplates).mockResolvedValue([
      prova('2023', 2023, 1),
      prova('2023', 2023, 2),
    ] as never);
    renderPage();

    const segundoDia = (await screen.findAllByText('2º dia'))[0].closest(
      'div',
    )!;
    fireEvent.click(
      segundoDia.querySelector('button.btn-primary') as HTMLElement,
    );

    await waitFor(() =>
      expect(api.startSimulation).toHaveBeenCalledWith(
        'enem-2023-dia2',
        undefined,
      ),
    );
  });

  it('cada dia pode ser baixado em PDF', async () => {
    vi.mocked(api.simulationTemplates).mockResolvedValue([
      prova('2023', 2023, 1),
    ] as never);
    vi.mocked(api.pdfThemes).mockResolvedValue([] as never);
    renderPage();

    fireEvent.click(
      await screen.findByLabelText('Baixar o 1º dia de 2023 em PDF'),
    );
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('mostra só os três anos mais recentes até pedir todos', async () => {
    vi.mocked(api.simulationTemplates).mockResolvedValue(
      [2025, 2024, 2023, 2022, 2021].flatMap((ano) => [
        prova(String(ano), ano, 1),
      ]) as never,
    );
    renderPage();

    expect(await screen.findByText('ENEM 2025')).toBeInTheDocument();
    expect(screen.queryByText('ENEM 2022')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText(/Ver todas as provas/));

    expect(screen.getByText('ENEM 2022')).toBeInTheDocument();
    expect(screen.getByText('ENEM 2021')).toBeInTheDocument();
  });
});

describe('Simulados — retomar', () => {
  const SALVO_LOCAL = {
    start: START_RESPONSE,
    answers: {},
    timeSpent: {},
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(api.subjects).mockResolvedValue(SUBJECTS as never);
    vi.mocked(api.simulationPreview).mockResolvedValue(PREVIEW as never);
    vi.mocked(api.simulationTemplates).mockResolvedValue([]);
    localStorage.setItem('openem.simulado.ativo', JSON.stringify(SALVO_LOCAL));
  });

  it('oferece retomar o simulado que ficou aberto', async () => {
    vi.mocked(api.simulation).mockResolvedValue({
      id: 'sim-1',
      finishedAt: null,
    } as never);
    renderPage();
    expect(
      await screen.findByText('Retomar simulado em andamento'),
    ).toBeInTheDocument();
  });

  it('some com o simulado que já foi finalizado no servidor', async () => {
    vi.mocked(api.simulation).mockResolvedValue({
      id: 'sim-1',
      finishedAt: new Date().toISOString(),
    } as never);
    renderPage();

    await waitFor(() =>
      expect(
        screen.queryByText('Retomar simulado em andamento'),
      ).not.toBeInTheDocument(),
    );
    expect(localStorage.getItem('openem.simulado.ativo')).toBeNull();
  });
});

describe('Simulados — prova em andamento', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(api.simulationTemplates).mockResolvedValue([]);
    vi.mocked(api.subjects).mockResolvedValue(SUBJECTS as never);
    vi.mocked(api.startSimulation).mockResolvedValue(START_RESPONSE as never);
    vi.mocked(api.simulationPreview).mockResolvedValue(PREVIEW as never);
  });

  async function iniciar() {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Matemática' }));
    await aguardaPreview();
    fireEvent.click(screen.getByText('Iniciar simulado'));
    await screen.findByText(/Questão 1 de 1/);
  }

  it('entra em modo imersivo (sem a navegação do app) enquanto a prova corre', async () => {
    const { useIsImmersive } = await import('../immersive');
    const vistos: boolean[] = [];
    function Espiao() {
      vistos.push(useIsImmersive());
      return null;
    }
    render(<Espiao />);
    await iniciar();
    expect(vistos[vistos.length - 1]).toBe(true);
  });

  it('"Sair" pede confirmação e avisa que o relógio continua', async () => {
    await iniciar();
    fireEvent.click(screen.getByRole('button', { name: 'Sair' }));
    // Ainda na prova: o primeiro toque só arma a saída.
    expect(screen.getByText(/Questão 1 de 1/)).toBeInTheDocument();
    expect(
      screen.getByText(/o cronômetro continua correndo/),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Sair mesmo?' }));
    expect(
      await screen.findByText(/Retomar simulado em andamento/),
    ).toBeInTheDocument();
  });
});
