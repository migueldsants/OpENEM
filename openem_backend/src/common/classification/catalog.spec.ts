import {
  CATALOG_MIN_CONFIDENCE,
  CatalogEntry,
  CatalogTopic,
  catalogDecisions,
} from './catalog';

describe('catalogDecisions', () => {
  const topicos = new Map<string, CatalogTopic>([
    ['Matemática / Geometria espacial', { id: 't-geo', subjectAreaId: 'mat' }],
    ['Biologia / Ecologia', { id: 't-eco', subjectAreaId: 'nat' }],
  ]);
  const catalogo: Record<string, CatalogEntry> = {
    'enem:2023:136': {
      assunto: 'Matemática / Geometria espacial',
      confianca: 0.9,
    },
    'enem:2023:100': { assunto: 'Biologia / Ecologia', confianca: 0.4 },
    'enem:2023:101': {
      assunto: 'Biologia / Tema que não existe',
      confianca: 0.9,
    },
    'enem:2023:102': { assunto: 'Biologia / Ecologia', confianca: 0.9 },
  };

  it('grava o assunto da questão ainda sem assunto', () => {
    const { aplicar } = catalogDecisions(
      catalogo,
      [{ externalId: 'enem:2023:136', subjectAreaId: 'mat', topicId: null }],
      topicos,
    );
    expect(aplicar).toEqual([
      { externalId: 'enem:2023:136', topicId: 't-geo', confidence: 0.9 },
    ]);
  });

  it('nunca sobrescreve um assunto já gravado', () => {
    const r = catalogDecisions(
      catalogo,
      [{ externalId: 'enem:2023:136', subjectAreaId: 'mat', topicId: 'outro' }],
      topicos,
    );
    expect(r.aplicar).toEqual([]);
    expect(r.ignoradas).toEqual([]);
  });

  it('ignora e conta: baixa confiança, assunto fora da taxonomia, outra área', () => {
    const r = catalogDecisions(
      catalogo,
      [
        { externalId: 'enem:2023:100', subjectAreaId: 'nat', topicId: null },
        { externalId: 'enem:2023:101', subjectAreaId: 'nat', topicId: null },
        // a área da questão mudou depois da classificação
        { externalId: 'enem:2023:102', subjectAreaId: 'hum', topicId: null },
      ],
      topicos,
    );
    expect(r.aplicar).toEqual([]);
    expect(r.ignoradas.map((i) => i.motivo)).toEqual([
      'baixa confiança',
      'assunto inexistente',
      'área divergente',
    ]);
  });

  it('questão fora do catálogo não aparece em lugar nenhum', () => {
    const r = catalogDecisions(
      catalogo,
      [{ externalId: 'enem:2099:1', subjectAreaId: 'mat', topicId: null }],
      topicos,
    );
    expect(r).toEqual({ aplicar: [], ignoradas: [] });
  });

  it('o corte de confiança é o mesmo do db:classify', () => {
    expect(CATALOG_MIN_CONFIDENCE).toBe(0.6);
  });
});
