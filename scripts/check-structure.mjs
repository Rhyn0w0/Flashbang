import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = fileURLToPath(new URL('../', import.meta.url));
const frontend = path.join(root, 'frontend');
const backend = path.join(root, 'backend');
const shared = path.join(root, 'shared');
const clientEntries = new Set([
  path.join(backend, 'convex/_generated/api.d.ts'),
  path.join(backend, 'convex/_generated/dataModel.d.ts'),
]);

const inside = (file, directory) => file.startsWith(`${directory}${path.sep}`);

async function sourceFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== '_generated') files.push(...(await sourceFiles(file)));
    } else if (/\.tsx?$/.test(entry.name)) {
      files.push(file);
    }
  }
  return files;
}

function compilerOptions(config) {
  const parsed = ts.getParsedCommandLineOfConfigFile(
    config,
    {},
    {
      ...ts.sys,
      onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
        throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
      },
    }
  );
  assert.ok(parsed, `Cannot read ${config}`);
  assert.equal(parsed.errors.length, 0, `Invalid TypeScript configuration: ${config}`);
  return parsed.options;
}

function moduleSpecifiers(source) {
  const imports = [];
  const visit = (node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      imports.push(node.moduleSpecifier.text);
    } else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === 'require')) &&
      node.arguments.length > 0 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      imports.push(node.arguments[0].text);
    } else if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      ts.isStringLiteral(node.argument.literal)
    ) {
      imports.push(node.argument.literal.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return imports;
}

const configurations = [
  {
    directory: path.join(frontend, 'src'),
    options: compilerOptions(path.join(frontend, 'tsconfig.json')),
  },
  {
    directory: path.join(backend, 'convex'),
    options: compilerOptions(path.join(backend, 'convex/tsconfig.json')),
  },
  { directory: shared, options: { moduleResolution: ts.ModuleResolutionKind.Bundler } },
];
let checked = 0;

for (const { directory, options } of configurations) {
  for (const file of await sourceFiles(directory)) {
    const source = ts.createSourceFile(
      file,
      await readFile(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true
    );
    for (const specifier of moduleSpecifiers(source)) {
      const resolved = ts.resolveModuleName(specifier, file, options, ts.sys).resolvedModule;
      // Stylesheets and images are handled by Metro rather than TypeScript.
      if (!resolved && /\.(css|png|svg)$/.test(specifier)) continue;
      assert.ok(resolved, `${path.relative(root, file)}: cannot resolve ${specifier}`);
      const target = path.resolve(resolved.resolvedFileName);
      if (inside(file, frontend) && inside(target, backend)) {
        assert.ok(
          clientEntries.has(target),
          `${path.relative(root, file)} imports server implementation: ${specifier}`
        );
      }
      if (inside(file, backend)) {
        assert.ok(
          !inside(target, frontend),
          `${path.relative(root, file)} imports frontend code: ${specifier}`
        );
      }
      if (inside(file, shared)) {
        assert.ok(
          inside(target, shared),
          `Shared code imports a platform dependency: ${specifier}`
        );
      }
    }
    checked += 1;
  }
}

console.log(
  `Checked ${checked} source files. Frontend, backend, and shared imports respect their boundaries.`
);
