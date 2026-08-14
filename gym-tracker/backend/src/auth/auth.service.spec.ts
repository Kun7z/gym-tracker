import { ConfigService } from '@nestjs/config';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;

  const prismaMock = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  };

  const jwtMock = {
    signAsync: jest.fn(),
    verifyAsync: jest.fn(),
  };

  const configValues: Record<string, unknown> = {
    JWT_ACCESS_SECRET: 'a'.repeat(32),
    JWT_REFRESH_SECRET: 'b'.repeat(32),
    JWT_ACCESS_EXPIRES_IN: '15m',
    JWT_REFRESH_EXPIRES_IN: '30d',
    REFRESH_COOKIE_MAX_AGE_DAYS: 30,
  };
  const configMock = {
    get: jest.fn(
      (key: string, fallback?: unknown) => configValues[key] ?? fallback,
    ),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jwtMock.signAsync.mockResolvedValue('token-gerado');
    jwtMock.verifyAsync.mockResolvedValue({ sub: 'u1' });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: JwtService, useValue: jwtMock },
        { provide: ConfigService, useValue: configMock },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  it('register cria usuário com senha hasheada e e-mail normalizado', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    let createdData: { email: string; passwordHash: string } | undefined;
    prismaMock.user.create.mockImplementation(
      ({ data }: { data: { email: string; passwordHash: string } }) => {
        createdData = data;
        return Promise.resolve({
          id: 'u1',
          weightUnit: 'kg',
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        });
      },
    );

    const result = await service.register({
      email: 'Usuario@Exemplo.com',
      password: 'secret123',
    });

    expect(createdData?.email).toBe('usuario@exemplo.com');
    expect(createdData?.passwordHash).not.toBe('secret123');
    expect(
      await bcrypt.compare('secret123', createdData?.passwordHash ?? ''),
    ).toBe(true);
    expect(result.tokens.accessToken).toBe('token-gerado');
    expect(result.user.email).toBe('usuario@exemplo.com');
  });

  it('register lança ConflictException quando o e-mail já existe', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u1' });

    await expect(
      service.register({ email: 'a@b.com', password: 'secret123' }),
    ).rejects.toThrow(ConflictException);
  });

  it('login rejeita senha incorreta', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'u1',
      passwordHash: await bcrypt.hash('correta', 4),
    });

    await expect(
      service.login({ email: 'a@b.com', password: 'errada' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('refresh rejeita token inválido', async () => {
    jwtMock.verifyAsync.mockRejectedValue(new Error('token inválido'));

    await expect(service.refresh('token-invalido')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('refresh rejeita ausência de token', async () => {
    await expect(service.refresh(undefined)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
