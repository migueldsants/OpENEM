import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SubjectsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.subject.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        topics: {
          orderBy: { name: 'asc' },
          select: { id: true, name: true },
        },
      },
    });
  }
}
