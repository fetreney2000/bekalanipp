declare module "better-sqlite3" {
  class Database {
    constructor(path: string, options?: { readonly?: boolean });
    prepare(sql: string): {
      all(...params: unknown[]): unknown[];
      get(...params: unknown[]): unknown;
      run(...params: unknown[]): unknown;
    };
    exec(sql: string): void;
    transaction(fn: () => void): () => void;
    close(): void;
  }
  export default Database;
}
