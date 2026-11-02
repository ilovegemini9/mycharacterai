function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

function cleanText(value, max = 500) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

export function renderCharacterPage(template, character) {
  const name = cleanText(character.name, 100);
  const role = cleanText(character.role, 120);
  const description = cleanText(character.desc, 300);
  const greeting = cleanText(character.greeting, 500);
  const canonical = "https://characterplay.online/character/" + encodeURIComponent(character.id);
  const title = name + " | AI Character Profile | mycharacter";
  const metaDescription = cleanText("Meet " + name + ": " + role + ". " + description, 155);
  const tags = (character.tags || []).filter((tag) => typeof tag === "string").slice(0, 12);
  let image = "";
  if (typeof character.image === "string") {
    try {
      const parsed = new URL(character.image);
      if (parsed.protocol === "https:" || parsed.protocol === "http:") image = parsed.toString();
    } catch {}
  }
  const html = [
    '<main id="character-seo-content" class="character-seo-content">',
    "<article>",
    "<header><h1>" + escapeHtml(name) + "</h1><p>" + escapeHtml(role) + "</p></header>",
    "<p>" + escapeHtml(description) + "</p>",
    greeting ? "<section><h2>Opening message</h2><blockquote>" + escapeHtml(greeting) + "</blockquote></section>" : "",
    tags.length ? '<section aria-label="Character categories"><h2>Categories</h2><ul>' + tags.map((tag) => "<li>" + escapeHtml(tag) + "</li>").join("") + "</ul></section>" : "",
    '<p><a href="/">Discover more AI characters on mycharacter</a></p>',
    "</article></main>"
  ].join("");
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    name: title,
    url: canonical,
    description: metaDescription,
    mainEntity: {
      "@type": "Thing",
      name,
      description,
      ...(image ? { image } : {})
    }
  }).replace(/</g, "\\u003c");
  let output = template;
  output = output.replace(/<title>[\s\S]*?<\/title>/i, "<title>" + escapeHtml(title) + "</title>");
  output = output.replace(/<meta name="description" content="[^"]*"\s*\/>/i, '<meta name="description" content="' + escapeHtml(metaDescription) + '" />');
  output = output.replace(/<link rel="canonical" href="[^"]*"\s*\/>/i, '<link rel="canonical" href="' + escapeHtml(canonical) + '" />');
  output = output.replace(/<meta property="og:title" content="[^"]*"\s*\/>/i, '<meta property="og:title" content="' + escapeHtml(title) + '" />');
  output = output.replace(/<meta property="og:description" content="[^"]*"\s*\/>/i, '<meta property="og:description" content="' + escapeHtml(metaDescription) + '" />');
  output = output.replace(/<meta property="og:url" content="[^"]*"\s*\/>/i, '<meta property="og:url" content="' + escapeHtml(canonical) + '" />');
  output = output.replace(/<meta property="og:image" content="[^"]*"\s*\/>/i, '<meta property="og:image" content="' + escapeHtml(image || "https://characterplay.online/favicon.svg") + '" />');
  output = output.replace(/<meta name="twitter:title" content="[^"]*"\s*\/>/i, '<meta name="twitter:title" content="' + escapeHtml(title) + '" />');
  output = output.replace(/<meta name="twitter:description" content="[^"]*"\s*\/>/i, '<meta name="twitter:description" content="' + escapeHtml(metaDescription) + '" />');
  output = output.replace(/<meta name="twitter:image" content="[^"]*"\s*\/>/i, '<meta name="twitter:image" content="' + escapeHtml(image || "https://characterplay.online/favicon.svg") + '" />');
  output = output.replace(/<meta name="robots" content="[^"]*"\s*\/>/i, '<meta name="robots" content="index,follow,max-image-preview:large" />');
  output = output.replace(/<meta name="googlebot" content="[^"]*"\s*\/>/i, '<meta name="googlebot" content="index,follow,max-image-preview:large" />');
  output = output.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/i, '<script type="application/ld+json">' + jsonLd + "</script>");
  output = output.replace('<div id="root"></div>', '<div id="root">' + html + "</div>");
  return output;
}
