import { TAXONOMY } from '../common/taxonomy';
import { isForbiddenHost, validateCatalog } from './study-resource-rules';
import { STUDY_PROVIDERS, STUDY_RESOURCES } from './study-resources-catalog';

const taxonomia = new Map<string, string[]>();
for (const materias of Object.values(TAXONOMY)) {
  for (const [materia, assuntos] of Object.entries(materias)) {
    taxonomia.set(
      materia,
      assuntos.map(([nome]) => nome),
    );
  }
}

describe('catálogo do Onde estudar', () => {
  it('passa em todas as regras', () => {
    expect(
      validateCatalog(STUDY_PROVIDERS, STUDY_RESOURCES, taxonomia, new Date()),
    ).toEqual([]);
  });

  it('toda matéria da taxonomia tem ao menos um material', () => {
    const cobertas = new Set(STUDY_RESOURCES.flatMap((r) => r.subjects));
    const faltando = [...taxonomia.keys()].filter((m) => !cobertas.has(m));
    expect(faltando).toEqual([]);
  });

  it('nenhum link vai para plataforma aberta, encurtador ou hospedagem de arquivo', () => {
    for (const r of STUDY_RESOURCES) {
      expect(isForbiddenHost(new URL(r.url).hostname)).toBe(false);
    }
  });

  it('material em outro idioma diz isso na descrição ou é de língua estrangeira', () => {
    for (const r of STUDY_RESOURCES.filter((x) => x.language !== 'pt')) {
      const avisa = /em inglês|em espanhol|todo em inglês/i.test(r.description);
      expect({
        id: r.id,
        ok: avisa || r.subjects.includes('Língua Estrangeira'),
      }).toEqual({
        id: r.id,
        ok: true,
      });
    }
  });
});
