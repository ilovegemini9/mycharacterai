import fs from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

const SITE_URL = "https://characterplay.online";
const SOURCE_FILE = path.resolve("client/src/pages/CharacterHub.tsx");
const OUTPUT_DIR = path.resolve("dist/public");
const PAGE_SIZE = 1000;

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

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}
function cleanText(value, max = 500) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}
function toPublicCharacter(record) {
  return {
    id: record.id,
    name: record.name,
    role: record.role || "AI character",
    desc: record.description || "",
    image: record.image_url || "",
    tags: Array.isArray(record.tags) ? record.tags : [],
    greeting: record.greeting || "",
  };
}
function renderPage(template, character) {
  const name = cleanText(character.name, 100);
  const role = cleanText(character.role, 120);
  const description = cleanText(character.desc, 300);
  const greeting = cleanText(character.greeting, 500);
  const canonical = SITE_URL + "/character/" + encodeURIComponent(character.id);
  const title = name + " | AI Character Profile | mycharacter";
  const metaDescription = cleanText("Meet " + name + ": " + role + ". " + description, 155);
  const tags = (character.tags || []).filter((tag) => typeof tag === "string").slice(0, 12);
  const image = typeof character.image === "string" && /^https:\/\//i.test(character.image) ? character.image : "";
  const html = [
    '<main id="character-seo-content" class="character-seo-content">',
    '<article>',
    '<header><h1>' + escapeHtml(name) + '</h1><p>' + escapeHtml(role) + '</p></header>',
    '<p>' + escapeHtml(description) + '</p>',
    greeting ? '<section><h2>Opening message</h2><blockquote>' + escapeHtml(greeting) + '</blockquote></section>' : '',
    tags.length ? '<section aria-label="Character categories"><h2>Categories</h2><ul>' + tags.map((tag) => '<li>' + escapeHtml(tag) + '</li>').join("") + '</ul></section>' : '',
    '<p><a href="/">Discover more AI characters on mycharacter</a></p>',
    '</article></main>'
  ].join("");
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    "name": title,
    "url": canonical,
    "description": metaDescription,
    "mainEntity": {
      "@type": "Thing",
      "name": name,
      "description": description,
      ...(image ? { "image": image } : {})
    }
  }).replace(/</g, "\\u003c");
  let output = template;
  output = output.replace(/<title>[\s\S]*?<\/title>/i, '<title>' + escapeHtml(title) + '</title>');
  output = output.replace(/<meta name="description" content="[^"]*"\s*\/>/i, '<meta name="description" content="' + escapeHtml(metaDescription) + '" />');
  output = output.replace(/<link rel="canonical" href="[^"]*"\s*\/>/i, '<link rel="canonical" href="' + escapeHtml(canonical) + '" />');
  output = output.replace(/<meta property="og:title" content="[^"]*"\s*\/>/i, '<meta property="og:title" content="' + escapeHtml(title) + '" />');
  output = output.replace(/<meta property="og:description" content="[^"]*"\s*\/>/i, '<meta property="og:description" content="' + escapeHtml(metaDescription) + '" />');
  output = output.replace(/<meta property="og:url" content="[^"]*"\s*\/>/i, '<meta property="og:url" content="' + escapeHtml(canonical) + '" />');
  output = output.replace(/<meta property="og:image" content="[^"]*"\s*\/>/i, '<meta property="og:image" content="' + escapeHtml(image || SITE_URL + '/favicon.svg') + '" />');
  output = output.replace(/<meta name="twitter:title" content="[^"]*"\s*\/>/i, '<meta name="twitter:title" content="' + escapeHtml(title) + '" />');
  output = output.replace(/<meta name="twitter:description" content="[^"]*"\s*\/>/i, '<meta name="twitter:description" content="' + escapeHtml(metaDescription) + '" />');
  output = output.replace(/<meta name="twitter:image" content="[^"]*"\s*\/>/i, '<meta name="twitter:image" content="' + escapeHtml(image || SITE_URL + '/favicon.svg') + '" />');
  output = output.replace(/<meta name="robots" content="[^"]*"\s*\/>/i, '<meta name="robots" content="index,follow,max-image-preview:large" />');
  output = output.replace(/<meta name="googlebot" content="[^"]*"\s*\/>/i, '<meta name="googlebot" content="index,follow,max-image-preview:large" />');
  output = output.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/i, '<script type="application/ld+json">' + jsonLd + '</script>');
  output = output.replace('<div id="root"></div>', '<div id="root">' + html + '</div>');
  return output;
}

async function fetchPublicCharacters() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.warn("Prerender: Supabase env vars missing; generating starter character pages only.");
    return [];
  }
  const records = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const url = new URL("/rest/v1/character_discovery", supabaseUrl);
    url.searchParams.set("select", "id,name,role,description,greeting,image_url,tags,is_public,visibility");
    url.searchParams.set("is_public", "eq.true");
    url.searchParams.set("visibility", "eq.public");
    url.searchParams.set("order", "created_at.desc");
    url.searchParams.set("limit", String(PAGE_SIZE));
    url.searchParams.set("offset", String(offset));
    const response = await fetch(url, { headers: { apikey: supabaseKey, Authorization: "Bearer " + supabaseKey } });
    if (!response.ok) throw new Error("Public character fetch failed with HTTP " + response.status);
    const page = await response.json();
    if (!Array.isArray(page)) throw new Error("Supabase returned an invalid public character list.");
    records.push(...page.filter((item) => item && typeof item.id === "string" && item.is_public === true && item.visibility === "public").map(toPublicCharacter));
    if (page.length < PAGE_SIZE) break;
  }
  return records;
}

const template = await fs.readFile(path.join(OUTPUT_DIR, "index.html"), "utf8");
const starters = await readStarterCharacters();
const publicRecords = await fetchPublicCharacters();
const characters = Array.from(new Map([...starters, ...publicRecords].map((item) => [String(item.id), item])).values());
let generated = 0;
for (const character of characters) {
  if (!character || typeof character.id !== "string" || !/^[a-zA-Z0-9_-]+$/.test(character.id)) continue;
  const directory = path.join(OUTPUT_DIR, "character", character.id);
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, "index.html"), renderPage(template, character), "utf8");
  generated++;
}
console.log("Prerendered " + generated + " public character pages.");
