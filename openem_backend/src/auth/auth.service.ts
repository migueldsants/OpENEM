import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

let dummyHashPromise: Promise<string> | null = null;

/** Hash argon2 de uma senha aleatória, calculado uma vez por processo. */
function dummyHash(): Promise<string> {
  dummyHashPromise ??= argon2.hash(randomBytes(16).toString('hex'));
  return dummyHashPromise;
}

export interface AuthResult {
  accessToken: string;
  user: { id: string; email: string };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResult> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('E-mail já cadastrado');
    }

    const passwordHash = await argon2.hash(dto.password);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        profile: {
          create: { displayName: dto.displayName },
        },
      },
    });

    return this.buildResult(user.id, user.email);
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    // Mensagem genérica: não revela se o e-mail existe.
    const invalid = new UnauthorizedException('Credenciais inválidas');
    if (!user) {
      // Sem conta, verifica a senha contra um hash falso: o tempo da resposta
      // não deixa ver quais e-mails já existem (com argon2, ~5 ms contra ~70 ms).
      await argon2.verify(await dummyHash(), dto.password);
      throw invalid;
    }

    const valid = await argon2.verify(user.passwordHash, dto.password);
    if (!valid) {
      throw invalid;
    }

    return this.buildResult(user.id, user.email);
  }

  private async buildResult(id: string, email: string): Promise<AuthResult> {
    const accessToken = await this.jwt.signAsync({ sub: id, email });
    return { accessToken, user: { id, email } };
  }
}
