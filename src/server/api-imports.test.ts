import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import * as ts from "typescript";
import { describe, expect, it } from "vitest";

function getApiEntryPoints(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const absolutePath = resolve(directory, entry);
    if (statSync(absolutePath).isDirectory()) {
      return getApiEntryPoints(absolutePath);
    }

    return extname(entry) === ".ts" ? [absolutePath] : [];
  });
}

function getRuntimeRelativeImports(filePath: string): string[] {
  const source = ts.createSourceFile(
    filePath,
    readFileSync(filePath, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const imports: string[] = [];

  for (const statement of source.statements) {
    if (
      (ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) &&
      statement.moduleSpecifier &&
      ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      const isTypeOnly =
        ts.isImportDeclaration(statement)
          ? statement.importClause?.isTypeOnly === true
          : statement.isTypeOnly;
      const specifier = statement.moduleSpecifier.text;

      if (!isTypeOnly && specifier.startsWith(".")) {
        imports.push(specifier);
      }
    }
  }

  return imports;
}

describe("Vercel API module imports", () => {
  it("uses resolvable .js specifiers throughout every API function graph", () => {
    const apiRoot = resolve(process.cwd(), "api");
    const pending = getApiEntryPoints(apiRoot);
    const visited = new Set<string>();
    const importGraphErrors: string[] = [];

    while (pending.length > 0) {
      const importer = pending.pop()!;
      if (visited.has(importer)) continue;
      visited.add(importer);

      for (const specifier of getRuntimeRelativeImports(importer)) {
        if (!specifier.endsWith(".js")) {
          importGraphErrors.push(`${importer} imports ${specifier} without a .js suffix`);
          continue;
        }

        const sourceModule = resolve(dirname(importer), `${specifier.slice(0, -3)}.ts`);
        if (!existsSync(sourceModule)) {
          importGraphErrors.push(`${importer} imports missing TypeScript source ${sourceModule}`);
          continue;
        }

        pending.push(sourceModule);
      }
    }

    expect(importGraphErrors).toEqual([]);
    expect(visited.size).toBeGreaterThan(getApiEntryPoints(apiRoot).length);
  });
});
