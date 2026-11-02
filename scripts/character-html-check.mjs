import assert from "node:assert/strict";
import { renderCharacterPage } from "./character-html.mjs";

const template = [
  "<!doctype html>",
  "<html><head>",
  "<title>Homepage</title>",
  '<meta name="description" content="Homepage description" />',
  '<meta name="robots" content="index,follow" />',
  '<meta name="googlebot" content="index,follow" />',
  '<link rel="canonical" href="https://characterplay.online/" />',
  '<meta property="og:title" content="Homepage" />',
  '<meta property="og:description" content="Homepage description" />',
  '<meta property="og:url" content="https://characterplay.online/" />',
  '<meta property="og:image" content="https://characterplay.online/default.png" />',
  '<meta name="twitter:title" content="Homepage" />',
  '<meta name="twitter:description" content="Homepage description" />',
  '<meta name="twitter:image" content="https://characterplay.online/default.png" />',
  '<script type="application/ld+json">{"@type":"WebSite"}</script>',
  "</head><body><div id=\"root\"></div></body></html>"
].join("");

const html = renderCharacterPage(template, {
  id: "public-character_1",
  name: "<script>alert(1)</script>",
  role: "Fantasy companion",
  desc: "A curious character",
  greeting: "Hello <world>",
  tags: ["fantasy", "adventure"],
  image: "https://images.example.test/character.png"
});

assert.match(html, /<title>&lt;script&gt;alert\(1\)&lt;\/script&gt; \| AI Character Profile \| mycharacter<\/title>/);
assert.match(html, /rel="canonical" href="https:\/\/characterplay\.online\/character\/public-character_1"/);
assert.match(html, /property="og:image" content="https:\/\/images\.example\.test\/character\.png"/);
assert.match(html, /<h1>&lt;script&gt;alert\(1\)&lt;\/script&gt;<\/h1>/);
assert.match(html, /Hello &lt;world&gt;/);
assert.match(html, /<li>fantasy<\/li>.*<li>adventure<\/li>/s);
assert.match(html, /"@type":"ProfilePage"/);
assert.match(html, /name="robots" content="index,follow,max-image-preview:large"/);
assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
assert.doesNotMatch(html, /id="root"><\/div>/);

console.log("Character SEO renderer checks passed.");
