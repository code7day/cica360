import type { ApiErrorCode, ApiErrorShape } from './types';

/**
 * Error tipado del API Stamless. Se lanza desde `requestApi()` para
 * cualquier response con `success: false`, con el `status`/`code`/`fields`
 * ya normalizados — nunca hay que parsear el JSON crudo en el código que
 * llama a `src/lib/api.ts`.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode | 'unknown';
  readonly fields?: Record<string, string[]>;

  constructor(message: string, status: number, code: ApiErrorCode | 'unknown', fields?: Record<string, string[]>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }

  static fromEnvelope(status: number, message: string, errors?: ApiErrorShape): ApiError {
    return new ApiError(message, status, errors?.code ?? 'unknown', errors?.fields);
  }

  /** True si vale la pena reintentar el build (problema transitorio de red/servidor). */
  get isRetryable(): boolean {
    return this.status === 429 || this.status >= 500;
  }

  /** True si el token de build-time (content:read) está vencido/mal configurado. */
  get isAuthProblem(): boolean {
    return this.code === 'unauthenticated' || this.code === 'token_invalid';
  }
}

/** Error de red/parseo que nunca llegó a tener un envelope del API. */
export class ApiNetworkError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'ApiNetworkError';
  }
}
