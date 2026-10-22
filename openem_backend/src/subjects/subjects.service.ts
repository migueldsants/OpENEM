import { Injectable } from '@nestjs/common';
import { CacheService } from '../cache/cache.service';
import { CATALOG_TTL_MS } from '../cache/catalog-invalidation';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SubjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  // Igual para todo aluno e só muda com o seed/classificação: cache de
  // catálogo, invalidado por eles.
  list() {
    return this.cache.getOrSet(
      ['subjects'],
      CATALOG_TTL_MS,
      () =>
        this.prisma.subject.findMany({
          orderBy: { name: 'asc' },
          select: {
            id: true,
            name: true,
            // A área acompanha a matéria: é por ela que a UI filtra as questões
            // oficiais que ainda não têm matéria/assunto classificados.
            subjectArea: { select: { id: true, name: true } },
            topics: {
              orderBy: { name: 'asc' },
              select: { id: true, name: true },
            },
          },
        }),
      { ns: 'catalog' },
    );
  }
}
