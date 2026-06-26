declare module "better-sqlite3" {
  class Database {
    constructor(path: string, options?: { readonly?: boolean });
    prepare(sql: string): {
      all(...params: any[]): any[];
      get(...params: any[]): any;
      run(...params: any[]): any;
    };
    exec(sql: string): void;
    transaction(fn: () => void): () => void;
    close(): void;
  }
  export default Database;
}
