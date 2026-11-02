import fs from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import { renderCharacterPage } from "./character-html.mjs";

const SOURCE_FILE = path.resolve("client/src/pages/CharacterHub.tsx");
const OUTPUT_DIR = path.resolve("dist/public");

function readLiteral(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(readLiteral);
  if (ts.isObjectLiteralExpression(node)) {
    const result = {};
    for (const property of node.properties) {
      if (!ts.isPropertyAssignment(property) || !(
        ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)
      )) throw new Error("Starter character data must contain only literal properties.");
      result[property.name.text] = readLiteral(property.initializer);
    }
    return result;
  }
  throw new Error("Unsupported expression in starter character data: " + node.getText());
}

async function readStarterCharacters() {
  const source = await fs.readFile(SOURCE_FILE, "utf8");
  const ast = ts.createSourceFile(SOURCE_FILE, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let value;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === "starterCharacters") {
      value = readLiteral(node.initializer);
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  if (!Array.isArray(value)) throw new Error("Could not read starterCharacters from CharacterHub.tsx");
  return value;
}

const template = await fs.readFile(path.join(OUTPUT_DIR, "index.html"), "utf8");
const characters = await readStarterCharacters();
let generated = 0;
for (const character of characters) {
  if (!character || typeof character.id !== "string" || !/^[a-zA-Z0-9_-]+$/.test(character.id)) continue;
  const directory = path.join(OUTPUT_DIR, "character", character.id);
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, "index.html"), renderCharacterPage(template, character), "utf8");
  generated++;
}
console.log("Prerendered " + generated + " public character pages.");
