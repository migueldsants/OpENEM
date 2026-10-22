import { Injectable } from '@nestjs/common';
import { CacheService } from '../cache/cache.service';
import {
  fetchGithubStars,
  StarsCache,
  type StarsStore,
  type StoredStars,
} from './github-stars';
import { githubUrl, TOOLS } from './tools-catalog';

export interface ToolView {
  name: string;
  repo: string;
  description: string;
  tags: string[];
  url: string;
  /** null quando o GitHub ainda não respondeu. */
  stars: number | null;
}

/**
 * Quanto a contagem fica guardada. Bem mais que a hora da renovação: é o que
 * permite responder o último valor conhecido quando o GitHub falha.
 */
const STARS_KEEP_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class ToolsService {
  private readonly stars: StarsCache;

  constructor(cache: CacheService) {
    // No cache compartilhado, as instâncias dividem a contagem e o número de
    // chamadas ao GitHub não cresce com elas.
    const store: StarsStore = {
      get: (repo) => cache.get<StoredStars>(['stars', repo]),
      set: (repo, value) => cache.set(['stars', repo], value, STARS_KEEP_MS),
    };
    this.stars = new StarsCache(
      fetchGithubStars,
      Date.now,
      undefined,
      undefined,
      store,
    );
  }

  async list(): Promise<ToolView[]> {
    const stars = await this.stars.get(TOOLS.map((t) => t.repo));
    return TOOLS.map((t) => ({
      ...t,
      url: githubUrl(t.repo),
      stars: stars[t.repo] ?? null,
    }));
  }
}
