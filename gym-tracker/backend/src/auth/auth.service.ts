import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import type { SignOptions } from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../shared/prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

export const REFRESH_COOKIE = 'refresh_token';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface PublicUser {
  id: string;
  email: string;
  displayName: string | null;
  weightUnit: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(
    dto: RegisterDto,
  ): Promise<{ tokens: AuthTokens; user: PublicUser }> {
    const email = dto.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('E-mail já cadastrado');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: { email, passwordHash, displayName: dto.displayName ?? null },
    });

    return {
      tokens: await this.issueTokens(user),
      user: this.toPublicUser(user),
    };
  }

  async login(
    dto: LoginDto,
  ): Promise<{ tokens: AuthTokens; user: PublicUser }> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('E-mail ou senha inválidos');
    }
    return {
      tokens: await this.issueTokens(user),
      user: this.toPublicUser(user),
    };
  }

  async refresh(
    refreshToken: string | undefined,
  ): Promise<{ tokens: AuthTokens; user: PublicUser }> {
    if (!refreshToken) {
      throw new UnauthorizedException('Sessão expirada');
    }
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string }>(
        refreshToken,
        {
          secret: this.config.get<string>('JWT_REFRESH_SECRET'),
        },
      );
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });
      if (!user) {
        throw new UnauthorizedException('Sessão expirada');
      }
      return {
        tokens: await this.issueTokens(user),
        user: this.toPublicUser(user),
      };
    } catch {
      throw new UnauthorizedException('Sessão expirada');
    }
  }

  async me(userId: string): Promise<{ user: PublicUser }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException();
    }
    return { user: this.toPublicUser(user) };
  }

  refreshCookieMaxAge(): number {
    const days = this.config.get<number>('REFRESH_COOKIE_MAX_AGE_DAYS', 30);
    return days * 24 * 60 * 60 * 1000;
  }

  private async issueTokens(user: User): Promise<AuthTokens> {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(
        { sub: user.id, email: user.email },
        {
          secret: this.config.get<string>('JWT_ACCESS_SECRET'),
          expiresIn: this.config.get<string>(
            'JWT_ACCESS_EXPIRES_IN',
            '15m',
          ) as SignOptions['expiresIn'],
        },
      ),
      this.jwt.signAsync(
        { sub: user.id },
        {
          secret: this.config.get<string>('JWT_REFRESH_SECRET'),
          expiresIn: this.config.get<string>(
            'JWT_REFRESH_EXPIRES_IN',
            '30d',
          ) as SignOptions['expiresIn'],
        },
      ),
    ]);
    return { accessToken, refreshToken };
  }

  private toPublicUser(user: User): PublicUser {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      weightUnit: user.weightUnit,
    };
  }
}
