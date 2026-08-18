import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';

interface ErrorBody {
  statusCode: number;
  message: string;
  error: string;
}

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(
    exception: Prisma.PrismaClientKnownRequestError,
    host: ArgumentsHost,
  ): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { statusCode, message, error } = this.mapError(exception);

    response.status(statusCode).json({
      statusCode,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }

  private mapError(exception: Prisma.PrismaClientKnownRequestError): ErrorBody {
    switch (exception.code) {
      case 'P2002':
        // Unique constraint violation (ex.: email duplicado)
        return {
          statusCode: HttpStatus.CONFLICT,
          message: 'Já existe um registro com esses dados',
          error: 'Conflict',
        };
      case 'P2025':
        // Record not found (ex.: update/delete de registro inexistente)
        return {
          statusCode: HttpStatus.NOT_FOUND,
          message: 'Registro não encontrado',
          error: 'Not Found',
        };
      case 'P2003':
        // Foreign key constraint violation
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Registro relacionado não encontrado ou em uso',
          error: 'Bad Request',
        };
      default:
        this.logger.error(
          `Prisma error ${exception.code}: ${exception.message}`,
          exception.stack,
        );
        return {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Erro interno do servidor',
          error: 'Internal Server Error',
        };
    }
  }
}
