import fs from "node:fs/promises";
import assert from "node:assert/strict";

const html = await fs.readFile("dist/public/discover/index.html", "utf8");
assert.match(html, /<title>Discover AI Characters for Chat &amp; Roleplay \| CharacterPlay<\/title>/);
assert.match(html, /<meta name="description" content="Explore trending, new, popular and roleplay AI characters on CharacterPlay\./);
assert.match(html, /<link rel="canonical" href="https:\/\/characterplay\.online\/discover" \/>/);
assert.match(html, /<h1>Discover AI Characters<\/h1>/);
assert.match(html, /"@type":"CollectionPage"/);
assert.match(html, /"@type":"ItemList"/);
assert.match(html, /Akira Hayashi/);
assert.match(html, /Yuna Kisaragi/);
console.log("Discover prerender checks passed.");
