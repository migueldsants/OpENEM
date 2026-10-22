import { memoryCache } from '../cache/testing';
import * as stars from './github-stars';
import { TOOLS } from './tools-catalog';
import { ToolsService } from './tools.service';

describe('ToolsService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('devolve o catálogo com link e estrelas de cada repositório', async () => {
    const spy = jest
      .spyOn(stars, 'fetchGithubStars')
      .mockImplementation((repo) =>
        Promise.resolve(repo.endsWith('updated-enem-api') ? 12 : null),
      );
    const list = await new ToolsService(memoryCache()).list();

    expect(list.map((t) => t.repo)).toEqual(TOOLS.map((t) => t.repo));
    expect(list).toContainEqual(
      expect.objectContaining({
        repo: 'migueldsants/updated-enem-api',
        url: 'https://github.com/migueldsants/updated-enem-api',
        stars: 12,
      }),
    );
    expect(list).toContainEqual(
      expect.objectContaining({
        repo: 'migueldsants/AI-Skill-Corretor-Redacao-ENEM',
        stars: null,
      }),
    );
    // Só repositórios do catálogo são consultados.
    expect(spy.mock.calls.map(([r]) => r).sort()).toEqual(
      TOOLS.map((t) => t.repo).sort(),
    );
  });

  it('o catálogo tem repositórios válidos, sem repetição', () => {
    const repos = TOOLS.map((t) => t.repo);
    expect(new Set(repos).size).toBe(repos.length);
    for (const t of TOOLS) {
      expect(t.repo).toMatch(/^[\w.-]+\/[\w.-]+$/);
      expect(t.name.trim()).not.toBe('');
      expect(t.description.trim()).not.toBe('');
      expect(t.tags.length).toBeGreaterThan(0);
      for (const tag of t.tags) expect(tag.trim()).not.toBe('');
    }
  });
});
