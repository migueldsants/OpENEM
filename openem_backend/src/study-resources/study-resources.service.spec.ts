import { ConfigService } from '@nestjs/config';
import { STUDY_RESOURCES } from './study-resources-catalog';
import { StudyResourcesService } from './study-resources.service';

function servico(blocked?: string): StudyResourcesService {
  const config = { get: () => blocked } as unknown as ConfigService;
  return new StudyResourcesService(config);
}

describe('StudyResourcesService', () => {
  afterEach(() => jest.useRealTimers());

  it('devolve o catálogo com a instituição de cada material', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-13T12:00:00Z'));
    const { resources, maxCheckAgeDays } = servico().list();
    expect(resources).toHaveLength(STUDY_RESOURCES.length);
    expect(maxCheckAgeDays).toBe(365);
    const khan = resources.find((r) => r.id === 'khan-em-algebra-1');
    expect(khan?.provider).toMatchObject({
      id: 'khan-academy',
      kind: 'sem-fins-lucrativos',
    });
    expect(khan?.url).toBe('https://pt.khanacademy.org/math/em-mat-algebra');
  });

  it('STUDY_RESOURCES_BLOCKED tira o material na hora', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-13T12:00:00Z'));
    const ids = servico('khan-em-algebra-1, RAE-DICCIONARIO')
      .list()
      .resources.map((r) => r.id);
    expect(ids).not.toContain('khan-em-algebra-1');
    expect(ids).not.toContain('rae-diccionario');
    expect(ids).toHaveLength(STUDY_RESOURCES.length - 2);
  });

  it('material de conferência vencida some sozinho', () => {
    jest.useFakeTimers().setSystemTime(new Date('2030-01-01T12:00:00Z'));
    expect(servico().list().resources).toEqual([]);
  });
});
