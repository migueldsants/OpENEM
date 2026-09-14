import { pdfFilename, SimulationPdfService } from './simulation-pdf.service';

describe('pdfFilename', () => {
  it('vira um nome ASCII, sem acento nem espaço', () => {
    expect(pdfFilename('ENEM 2023 · 1º dia')).toBe(
      'openem-enem-2023-1o-dia.pdf',
    );
  });

  it('título sem letra nenhuma ainda produz um nome usável', () => {
    expect(pdfFilename('!!!')).toBe('openem-simulado.pdf');
  });

  it('corta título gigante', () => {
    const nome = pdfFilename('a'.repeat(200));
    expect(nome.length).toBeLessThanOrEqual('openem-.pdf'.length + 60);
  });
});

describe('SimulationPdfService', () => {
  function make(pdfData: unknown, env: Record<string, string> = {}) {
    const simulations = { pdfData: jest.fn().mockResolvedValue(pdfData) };
    const config = { get: jest.fn((k: string) => env[k]) };
    return {
      service: new SimulationPdfService(simulations as never, config as never),
      simulations,
      config,
    };
  }

  const dados = {
    title: 'Simulado de Matemática',
    subtitle: 'Funções · 3 questões',
    timeLimitMin: 30,
    questions: [
      {
        number: 1,
        code: null,
        areaName: 'Matemática e suas Tecnologias',
        subjectName: 'Matemática',
        topicName: 'Funções',
        statement: 'Enunciado.',
        questionPrompt: null,
        explanation: null,
        alternatives: [
          { letter: 'A', text: 'a', imageUrl: null, isCorrect: true },
          { letter: 'B', text: 'b', imageUrl: null, isCorrect: false },
        ],
      },
    ],
  };

  it('gera o PDF e nomeia o arquivo pelo título', async () => {
    const { service } = make(dados);
    const res = await service.generate('u1', { theme: 'azure' });
    expect(res.buffer.subarray(0, 5).toString()).toBe('%PDF-');
    expect(res.filename).toBe('openem-simulado-de-matematica.pdf');
  });

  it('passa o recorte adiante para o serviço de simulados', async () => {
    const { service, simulations } = make(dados);
    await service.generate('u1', { topicIds: ['t1'] }, 'sim-9');
    expect(simulations.pdfData).toHaveBeenCalledWith(
      'u1',
      { topicIds: ['t1'] },
      'sim-9',
    );
  });

  it('usa ENEM_MEDIA_DIR quando configurado', async () => {
    const { service, config } = make(dados, { ENEM_MEDIA_DIR: '/data/enem' });
    await service.generate('u1', {});
    expect(config.get).toHaveBeenCalledWith('ENEM_MEDIA_DIR');
  });
});
