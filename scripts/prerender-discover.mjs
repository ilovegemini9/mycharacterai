import fs from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

const SOURCE_FILE = path.resolve("client/src/pages/CharacterHub.tsx");
const OUTPUT_DIR = path.resolve("dist/public");
const CANONICAL = "https://characterplay.online/discover";
const TITLE = "Discover AI Characters for Chat & Roleplay | CharacterPlay";
const DESCRIPTION = "Explore trending, new, popular and roleplay AI characters on CharacterPlay. Find anime, fantasy, romance, gaming and more.";

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
  throw new Error("Unsupported starter character expression: " + node.getText());
}

async function readStarterCharacters() {
  const source = await fs.readFile(SOURCE_FILE, "utf8");
  const ast = ts.createSourceFile(SOURCE_FILE, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let characters;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === "starterCharacters") {
      characters = readLiteral(node.initializer);
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  if (!Array.isArray(characters)) throw new Error("Could not read starterCharacters.");
  return characters;
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

const template = await fs.readFile(path.join(OUTPUT_DIR, "index.html"), "utf8");
const characters = await readStarterCharacters();
const items = characters.filter((character) => character && typeof character.id === "string");
const content = [
  '<main id="discover-seo-content" class="discover-seo-content">',
  "<header><h1>Discover AI Characters</h1><p>Explore characters made for every story. Find your next conversation, world, or adventure.</p></header>",
  '<p class="discover-seo-count">Explore ' + items.length + " featured AI characters for chat and roleplay.</p>",
  "<section aria-label=\"Featured AI characters\"><ol>",
  ...items.map((character) => '<li><article><h2><a href="/character/' + encodeURIComponent(character.id) + '">' + escapeHtml(character.name) + "</a></h2><p>" + escapeHtml(character.role) + "</p><p>" + escapeHtml(character.desc) + "</p><ul>" + (character.tags || []).slice(0, 5).map((tag) => "<li>" + escapeHtml(tag) + "</li>").join("") + "</ul></article></li>"),
  "</ol></section>",
  '<p><a href="/">Visit CharacterPlay home</a> · <a href="/discover">Browse all characters</a></p>',
  "</main>"
].join("");
const jsonLd = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: TITLE,
  description: DESCRIPTION,
  url: CANONICAL,
  mainEntity: {
    "@type": "ItemList",
    itemListOrder: "https://schema.org/ItemListOrderAscending",
    numberOfItems: items.length,
    itemListElement: items.map((character, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: CANONICAL.replace("/discover", "/character/" + encodeURIComponent(character.id)),
      name: character.name
    }))
  }
}).replace(/</g, "\\u003c");

let output = template;
output = output.replace(/<title>[\s\S]*?<\/title>/i, "<title>" + escapeHtml(TITLE) + "</title>");
output = output.replace(/<meta name="description" content="[^"]*"\s*\/>/i, '<meta name="description" content="' + escapeHtml(DESCRIPTION) + '" />');
output = output.replace(/<link rel="canonical" href="[^"]*"\s*\/>/i, '<link rel="canonical" href="' + CANONICAL + '" />');
output = output.replace(/<meta property="og:title" content="[^"]*"\s*\/>/i, '<meta property="og:title" content="' + escapeHtml(TITLE) + '" />');
output = output.replace(/<meta property="og:description" content="[^"]*"\s*\/>/i, '<meta property="og:description" content="' + escapeHtml(DESCRIPTION) + '" />');
output = output.replace(/<meta property="og:url" content="[^"]*"\s*\/>/i, '<meta property="og:url" content="' + CANONICAL + '" />');
output = output.replace(/<meta name="twitter:title" content="[^"]*"\s*\/>/i, '<meta name="twitter:title" content="' + escapeHtml(TITLE) + '" />');
output = output.replace(/<meta name="twitter:description" content="[^"]*"\s*\/>/i, '<meta name="twitter:description" content="' + escapeHtml(DESCRIPTION) + '" />');
output = output.replace(/<meta name="robots" content="[^"]*"\s*\/>/i, '<meta name="robots" content="index,follow,max-image-preview:large" />');
output = output.replace(/<meta name="googlebot" content="[^"]*"\s*\/>/i, '<meta name="googlebot" content="index,follow,max-image-preview:large" />');
output = output.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/i, '<script type="application/ld+json">' + jsonLd + "</script>");
output = output.replace('<div id="root"></div>', '<div id="root">' + content + "</div>");

const directory = path.join(OUTPUT_DIR, "discover");
await fs.mkdir(directory, { recursive: true });
await fs.writeFile(path.join(directory, "index.html"), output, "utf8");
console.log("Prerendered Discover collection page with " + items.length + " starter characters.");
