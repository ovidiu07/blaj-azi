interface D1Result<T = Record<string, unknown>> {
    results: T[];
    success: boolean;
    meta: { changes?: number; last_row_id?: number; [key: string]: unknown };
  }
interface D1PreparedStatement {
    bind(...values: unknown[]): D1PreparedStatement;
    first<T = Record<string, unknown>>(): Promise<T | null>;
    all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
    run<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  }
interface D1Database {
    prepare(sql: string): D1PreparedStatement;
    batch<T = Record<string, unknown>>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  }
interface R2ObjectBody { body: ReadableStream; }
interface R2Bucket {
    put(key: string, value: ReadableStream | ArrayBuffer | ArrayBufferView, options?: unknown): Promise<unknown>;
    get(key: string): Promise<R2ObjectBody | null>;
    delete(key: string): Promise<void>;
  }
interface Fetcher { fetch(request: Request): Promise<Response>; }

declare module "cloudflare:workers" {
  export const env: {
    DB: D1Database;
    MEDIA: R2Bucket;
    ADMIN_EMAIL?: string;
    ASSETS?: Fetcher;
    IMAGES?: unknown;
    [key: string]: unknown;
  };
}
