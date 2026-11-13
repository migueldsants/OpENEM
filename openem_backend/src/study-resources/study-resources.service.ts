import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  MAX_CHECK_AGE_DAYS,
  parseBlocked,
  visibleResources,
  type ProviderKind,
  type ResourceLanguage,
  type ResourceType,
} from './study-resource-rules';
import { STUDY_PROVIDERS, STUDY_RESOURCES } from './study-resources-catalog';

export interface StudyResourceView {
  id: string;
  title: string;
  url: string;
  types: ResourceType[];
  subjects: string[];
  topics: string[];
  description: string;
  language: ResourceLanguage;
  checkedAt: string;
  provider: { id: string; name: string; kind: ProviderKind; about: string };
}

export interface StudyResourcesView {
  resources: StudyResourceView[];
  /** Validade da conferência, em dias: a tela explica a regra. */
  maxCheckAgeDays: number;
}

/**
 * Catálogo "Onde estudar". Lê o bloqueio de quem hospeda
 * (`STUDY_RESOURCES_BLOCKED`) uma vez, na subida; a validade da conferência
 * é conferida a cada pedido, então um link vencido some sem reiniciar.
 */
@Injectable()
export class StudyResourcesService {
  private readonly logger = new Logger(StudyResourcesService.name);
  private readonly blocked: Set<string>;

  constructor(config: ConfigService) {
    this.blocked = parseBlocked(config.get<string>('STUDY_RESOURCES_BLOCKED'));
    const desconhecidos = [...this.blocked].filter(
      (id) => !STUDY_RESOURCES.some((r) => r.id === id),
    );
    if (desconhecidos.length) {
      // Erro de digitação deixaria o link no ar achando que saiu.
      this.logger.warn(
        `STUDY_RESOURCES_BLOCKED cita ids que não existem: ${desconhecidos.join(', ')}`,
      );
    }
  }

  list(): StudyResourcesView {
    const providers = new Map(STUDY_PROVIDERS.map((p) => [p.id, p]));
    const resources = visibleResources(
      STUDY_RESOURCES,
      new Date(),
      this.blocked,
    )
      .map((r) => {
        const p = providers.get(r.provider);
        if (!p) return null;
        return {
          id: r.id,
          title: r.title,
          url: r.url,
          types: r.types,
          subjects: r.subjects,
          topics: r.topics,
          description: r.description,
          language: r.language,
          checkedAt: r.checkedAt,
          provider: { id: p.id, name: p.name, kind: p.kind, about: p.about },
        };
      })
      .filter((r): r is StudyResourceView => r !== null);
    return { resources, maxCheckAgeDays: MAX_CHECK_AGE_DAYS };
  }
}
