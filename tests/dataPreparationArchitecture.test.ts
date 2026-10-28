import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { test } from "node:test";
import ts from "typescript";

const workspace = resolve(__dirname, "..");
const preparationRoot = join(workspace, "backend/dataPreparation");

function listTypeScriptFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...listTypeScriptFiles(path));
    } else if (entry.name.endsWith(".ts")) {
      files.push(path);
    }
  }
  return files;
}

function parseFile(file: string): ts.SourceFile {
  return ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
}

function isInside(file: string, directory: string): boolean {
  const path = relative(directory, file);
  return path !== ".." && !path.startsWith("..\\") && !path.startsWith("../") && !path.includes(":");
}

function describeNode(source: ts.SourceFile, node: ts.Node): string {
  const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
  return relative(workspace, source.fileName) + ":" + line;
}

test("preparation application dependencies point inward, including shared dependencies", () => {
  const application = join(preparationRoot, "application");
  const allowedRoots = [
    application,
    join(workspace, "shared/domain"),
    join(workspace, "backend/candidateData/models"),
    join(workspace, "backend/candidateData/ports"),
  ];
  const pending = listTypeScriptFiles(application);
  const visited = new Set<string>();
  while (pending.length > 0) {
    const file = pending.pop()!;
    if (visited.has(file)) {
      continue;
    }
    visited.add(file);
    const source = parseFile(file);
    function inspect(node: ts.Node): void {
      const location = describeNode(source, node);
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
        const specifier = node.moduleSpecifier;
        if (specifier && ts.isStringLiteral(specifier)) {
          // Preserve the existing pure input validator and its exact error format.
          if (file === join(application, "services/prepareCandidateFetchCheckpointService.ts") && specifier.text === "zod") {
            return;
          }
          assert.ok(specifier.text.startsWith("."), location + " imports an external package");
          const target = resolve(dirname(file), specifier.text + ".ts");
          assert.ok(allowedRoots.some((root) => isInside(target, root)), location + " reaches outside the application/domain boundary");
          if (isInside(file, join(application, "useCases"))) {
            assert.ok(!isInside(target, join(application, "services")), location + " use case must depend on a service port");
          }
          pending.push(target);
        }
      }
      if (ts.isCallExpression(node)) {
        assert.notEqual(node.expression.kind, ts.SyntaxKind.ImportKeyword, location + " uses a dynamic import");
        if (ts.isIdentifier(node.expression)) {
          assert.ok(!["require", "fetch", "setTimeout", "setInterval", "Date"].includes(node.expression.text), location + " performs environment work");
        }
        if (ts.isPropertyAccessExpression(node.expression)) {
          assert.ok(!["Date.now", "Math.random"].includes(node.expression.getText(source)), location + " reads an implicit clock/random source");
        }
      }
      if (ts.isNewExpression(node)) {
        assert.notEqual(node.expression.getText(source), "Date", location + " must receive time through a port");
      }
      if (ts.isIdentifier(node) && node.text === "process") {
        assert.fail(location + " must not read the process environment");
      }
      ts.forEachChild(node, inspect);
    }
    inspect(source);
  }
});

test("preparation classes use explicit access, braces, readable methods and camelCase filenames", () => {
  for (const file of listTypeScriptFiles(preparationRoot)) {
    const source = parseFile(file);
    function inspect(node: ts.Node): void {
      const location = describeNode(source, node);
      assert.ok(!ts.isConditionalExpression(node), location + " contains a ternary");
      if (ts.isIfStatement(node)) {
        assert.ok(ts.isBlock(node.thenStatement), location + " if needs braces");
        if (node.elseStatement) {
          assert.ok(ts.isBlock(node.elseStatement) || ts.isIfStatement(node.elseStatement), location + " else needs braces");
        }
      }
      if (ts.isForStatement(node) || ts.isForOfStatement(node) || ts.isForInStatement(node) || ts.isWhileStatement(node) || ts.isDoStatement(node)) {
        assert.ok(ts.isBlock(node.statement), location + " loop needs braces");
      }
      if (ts.isClassDeclaration(node)) {
        const name = node.name!.text;
        assert.equal(file, join(dirname(file), name[0].toLowerCase() + name.slice(1) + ".ts"));
        let hasPublicMethod = false;
        let hasPrivateMethod = false;
        for (const member of node.members) {
          if (ts.isMethodDeclaration(member) || ts.isConstructorDeclaration(member) || ts.isGetAccessor(member) || ts.isSetAccessor(member)) {
            const flags = ts.getCombinedModifierFlags(member);
            assert.ok(flags & (ts.ModifierFlags.Public | ts.ModifierFlags.Private), describeNode(source, member) + " needs an explicit access modifier");
            if (ts.isMethodDeclaration(member)) {
              hasPublicMethod = hasPublicMethod || !!(flags & ts.ModifierFlags.Public);
              hasPrivateMethod = hasPrivateMethod || !!(flags & ts.ModifierFlags.Private);
            }
            if (member.body && member.body.statements.length > 0) {
              const start = source.getLineAndCharacterOfPosition(member.body.getStart(source)).line;
              const end = source.getLineAndCharacterOfPosition(member.body.end).line;
              assert.notEqual(start, end, describeNode(source, member) + " contains a compressed method");
            }
          }
        }
        assert.ok(hasPublicMethod && hasPrivateMethod, location + " needs a public API and private implementation");
      }
      ts.forEachChild(node, inspect);
    }
    inspect(source);
  }
});


test("candidate domain models have no application, infrastructure or framework dependencies", () => {
  const domain = join(workspace, "shared/domain");
  for (const file of listTypeScriptFiles(domain)) {
    const source = parseFile(file);
    for (const statement of source.statements) {
      if (ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) {
        const specifier = statement.moduleSpecifier;
        if (specifier && ts.isStringLiteral(specifier)) {
          assert.ok(specifier.text.startsWith("."), file + " must not import a framework");
          assert.ok(isInside(resolve(dirname(file), specifier.text), domain), file + " must not depend on an outer layer");
        }
      } else {
        assert.ok(ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement), file + " must remain a pure domain data contract");
      }
    }
  }
});
