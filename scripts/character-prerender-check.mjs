import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

const hubPath = path.resolve("client/src/pages/CharacterHub.tsx");
const sitemapPath = path.resolve("api/sitemap.ts");
const outputDir = path.resolve("dist/public");

function readLiteral(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(readLiteral);
  if (ts.isObjectLiteralExpression(node)) {
    const value = {};
    for (const property of node.properties) {
      if (!ts.isPropertyAssignment(property) || !(
        ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)
      )) throw new Error("Starter character data must contain literal properties.");
      value[property.name.text] = readLiteral(property.initializer);
    }
    return value;
  }
  throw new Error("Unsupported starter character expression: " + node.getText());
}

const hubSource = await fs.readFile(hubPath, "utf8");
const hubAst = ts.createSourceFile(hubPath, hubSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let starters;
function visit(node) {
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === "starterCharacters") {
    starters = readLiteral(node.initializer);
  }
  ts.forEachChild(node, visit);
}
visit(hubAst);
assert.ok(Array.isArray(starters) && starters.length > 0, "starterCharacters must be a non-empty literal array");

const sitemapSource = await fs.readFile(sitemapPath, "utf8");
const starterMap = sitemapSource.match(/const STARTER_CHARACTER_IMAGES\s*:[^=]+ = \{([\s\S]*?)\n\};/);
assert.ok(starterMap, "Could not locate STARTER_CHARACTER_IMAGES in sitemap.ts");
const sitemapIds = new Set(Array.from(starterMap[1].matchAll(/["']([a-zA-Z0-9_-]+)["']\s*:/g), (match) => match[1]));

const ids = new Set();
const titles = new Set();
for (const character of starters) {
  assert.ok(character && typeof character.id === "string", "Every starter must have a string id");
  assert.match(character.id, /^[a-zA-Z0-9_-]+$/, "Starter id must be safe for a public route");
  assert.ok(!ids.has(character.id), "Duplicate starter id: " + character.id);
  ids.add(character.id);
  assert.ok(sitemapIds.has(character.id), "Starter missing from sitemap: " + character.id);

  const file = path.join(outputDir, "character", character.id, "index.html");
  const html = await fs.readFile(file, "utf8");
  const canonical = "https://characterplay.online/character/" + encodeURIComponent(character.id);
  const expectedTitle = character.name + " | AI Character Profile | mycharacter";
  assert.ok(html.includes("<title>" + expectedTitle + "</title>"), character.id + " must have a character-specific title");
  assert.ok(!titles.has(expectedTitle), "Duplicate starter SEO title: " + expectedTitle);
  titles.add(expectedTitle);
  assert.ok(html.includes('rel="canonical" href="' + canonical + '"'), character.id + " must have a self-referencing canonical");
  assert.ok(html.includes('property="og:url" content="' + canonical + '"'), character.id + " must have a matching Open Graph URL");
  assert.ok(html.includes('property="og:title" content="' + expectedTitle + '"'), character.id + " must have a matching Open Graph title");
  assert.ok(html.includes('name="twitter:title" content="' + expectedTitle + '"'), character.id + " must have a matching Twitter title");
  assert.match(html, /<h1>[^<]+<\/h1>/, character.id + " must have an H1 in raw HTML");
  assert.match(html, /"@type":"ProfilePage"/, character.id + " must have ProfilePage JSON-LD");
  assert.match(html, /<meta name="description" content="[^"]+"/, character.id + " must have a meta description");
  assert.ok(html.includes('id="root"><main id="character-seo-content"'), character.id + " SEO content must be present in initial HTML");
  assert.ok(!html.includes('rel="canonical" href="https://characterplay.online/"'), character.id + " must not use the homepage canonical");
  console.log("PASS " + character.id + " prerendered and listed in sitemap");
}

for (const id of sitemapIds) {
  assert.ok(ids.has(id), "Sitemap starter has no prerender source: " + id);
}
console.log("Prerender integration checks passed for " + starters.length + " starter characters.");
