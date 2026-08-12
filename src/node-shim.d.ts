declare const process: {
  argv: string[];
  exit(code?: number): never;
  exitCode?: number;
};

declare module "node:fs/promises" {
  export function readFile(path: string): Promise<{ toString(encoding: string): string }>;
}

declare module "node:path" {
  export function basename(path: string): string;
}
