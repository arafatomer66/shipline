import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EpicsService {
  constructor(private prisma: PrismaService) {}

  async create(projectId: string, name: string) {
    const count = await this.prisma.epic.count({ where: { projectId } });
    return this.prisma.epic.create({
      data: { projectId, name, order: count },
    });
  }

  remove(id: string) {
    return this.prisma.epic.delete({ where: { id } });
  }
}
