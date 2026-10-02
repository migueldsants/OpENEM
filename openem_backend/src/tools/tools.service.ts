import { Injectable } from '@nestjs/common';
import { fetchGithubStars, StarsCache } from './github-stars';
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

@Injectable()
export class ToolsService {
  // Um cache por processo basta: são poucos repositórios e o número só
  // precisa estar perto do atual.
  private readonly stars = new StarsCache(fetchGithubStars);

  async list(): Promise<ToolView[]> {
    const stars = await this.stars.get(TOOLS.map((t) => t.repo));
    return TOOLS.map((t) => ({
      ...t,
      url: githubUrl(t.repo),
      stars: stars[t.repo] ?? null,
    }));
  }
}
