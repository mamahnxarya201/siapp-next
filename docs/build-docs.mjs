import { readFile, readdir, writeFile } from "node:fs/promises";
import { join, basename } from "node:path";
import { fileURLToPath } from "node:url";
import katex from "katex";

const directory = fileURLToPath(new URL(".", import.meta.url));
const files = (await readdir(directory))
  .filter((file) => file.endsWith(".md"))
  .sort((a, b) => (a === "README.md" ? -1 : b === "README.md" ? 1 : a.localeCompare(b)));

const katexDirectory = join(directory, "..", "node_modules", "katex", "dist");
let katexCss = await readFile(join(katexDirectory, "katex.min.css"), "utf8");
const katexFonts = new Set(
  [...katexCss.matchAll(/url\(fonts\/([^)]+)\)/g)].map((match) => match[1]),
);
for (const font of katexFonts) {
  const extension = font.split(".").at(-1);
  const mimeType =
    extension === "woff2"
      ? "font/woff2"
      : extension === "woff"
        ? "font/woff"
        : "font/ttf";
  const encoded = (await readFile(join(katexDirectory, "fonts", font))).toString(
    "base64",
  );
  katexCss = katexCss.replaceAll(
    `url(fonts/${font})`,
    `url(data:${mimeType};base64,${encoded})`,
  );
}

const renderMath = (source, displayMode) =>
  katex.renderToString(source, {
    displayMode,
    output: "htmlAndMathml",
    strict: "error",
    throwOnError: true,
  });

const escapeHtml = (value) => value
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

const slug = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const portalHref = (href) => {
  const match = href.match(/(?:^|\/)([^/]+\.md)(#[^)]+)?$/);
  return match && files.includes(match[1])
    ? `#doc-${slug(match[1])}${match[2] ?? ""}`
    : href;
};

const inline = (value) => {
  const protectedHtml = [];
  const source = value.replace(
    /`([^`]+)`|\$([^$\n]+)\$/g,
    (_, code, math) => {
      protectedHtml.push(
        code !== undefined
          ? `<code>${escapeHtml(code)}</code>`
          : renderMath(math, false),
      );
      return `\u0000${protectedHtml.length - 1}\u0000`;
    },
  );
  let result = escapeHtml(source);
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, href) => `<a href="${portalHref(href)}">${text}</a>`);
  result = result.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  result = result.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  return result.replace(
    /\u0000(\d+)\u0000/g,
    (_, index) => protectedHtml[Number(index)],
  );
};

function renderMarkdown(markdown) {
  const lines = markdown.replaceAll("\r\n", "\n").split("\n");
  const output = [];
  let paragraph = [];
  let list = null;
  let code = null;
  let table = null;
  let math = null;

  const flushParagraph = () => {
    if (paragraph.length) {
      output.push(`<p>${inline(paragraph.join(" "))}</p>`);
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list) {
      output.push(`<${list.type}>${list.items.map((item) => `<li>${inline(item)}</li>`).join("")}</${list.type}>`);
      list = null;
    }
  };
  const flushTable = () => {
    if (table) {
      const [header, ...rows] = table;
      output.push(`<div class="table-wrap"><table><thead><tr>${header.map((cell) => `<th scope="col">${inline(cell.trim())}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${inline(cell.trim())}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
      table = null;
    }
  };

  for (const line of lines) {
    if (line.startsWith("```")) {
      flushParagraph(); flushList(); flushTable();
      if (code) {
        output.push(`<pre><code>${escapeHtml(code.lines.join("\n"))}</code></pre>`);
        code = null;
      } else {
        code = { lines: [] };
      }
      continue;
    }
    if (code) {
      code.lines.push(line);
      continue;
    }
    if (line.trim() === "$$") {
      flushParagraph(); flushList(); flushTable();
      if (math) {
        output.push(
          `<div class="math-display">${renderMath(math.join("\n"), true)}</div>`,
        );
        math = null;
      } else {
        math = [];
      }
      continue;
    }
    if (math) {
      math.push(line);
      continue;
    }
    if (/^\|.*\|$/.test(line)) {
      flushParagraph(); flushList();
      const cells = line.slice(1, -1).split("|");
      if (cells.every((cell) => /^\s*:?-+:?\s*$/.test(cell))) continue;
      table ??= [];
      table.push(cells);
      continue;
    }
    flushTable();
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flushParagraph(); flushList();
      const level = Math.min(heading[1].length + 1, 6);
      const text = heading[2].trim();
      output.push(`<h${level} id="${slug(text)}">${inline(text)}</h${level}>`);
      continue;
    }
    const item = line.match(/^\s*[-*]\s+(.+)$/);
    if (item) {
      flushParagraph();
      list ??= { type: "ul", items: [] };
      list.items.push(item[1]);
      continue;
    }
    const ordered = line.match(/^\s*\d+\.\s+(.+)$/);
    if (ordered) {
      flushParagraph();
      list ??= { type: "ol", items: [] };
      list.items.push(ordered[1]);
      continue;
    }
    if (!line.trim()) {
      flushParagraph(); flushList();
      continue;
    }
    paragraph.push(line.trim());
  }
  if (math) throw new Error("Unclosed display-math block.");
  flushParagraph(); flushList(); flushTable();
  return output.join("\n");
}

const documents = await Promise.all(files.map(async (file) => {
  const source = await readFile(join(directory, file), "utf8");
  const title = source.match(/^#\s+(.+)$/m)?.[1] ?? basename(file, ".md");
  const headings = [...source.matchAll(/^#{2,3}\s+(.+)$/gm)].map((match) => match[1]);
  return { file, title, headings, html: renderMarkdown(source) };
}));

const nav = documents.map((document) => `<a href="#doc-${slug(document.file)}" data-doc-link>${escapeHtml(document.title)}</a>`).join("");
const articles = documents.map((document) => `<article id="doc-${slug(document.file)}" data-document><header class="article-header"><p class="eyebrow">${escapeHtml(document.file)}</p><h2>${escapeHtml(document.title)}</h2><p class="section-map">${document.headings.map(escapeHtml).join(" · ")}</p></header><div class="article-body">${document.html}</div></article>`).join("\n");

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="Searchable documentation for the experimental PMIS Gantt engine.">
<title>Experimental Gantt engine documentation</title>
<style>
${katexCss}
:root{--paper:#f4f1e9;--raised:#ebe6da;--ink:#161815;--muted:#65685f;--green:#1d6b4d;--blue:#315f80;--amber:#9a5d16;--line:rgba(22,24,21,.18);--max:1180px;--reading:760px;--sans:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;--serif:Iowan Old Style,Charter,Georgia,serif;--mono:"SFMono-Regular",Consolas,"Liberation Mono",monospace}
*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:88px;background:var(--paper)}body{margin:0;color:var(--ink);background:linear-gradient(to right,transparent calc(50% - .5px),rgba(22,24,21,.035) 50%,transparent calc(50% + .5px)),var(--paper);font:16px/1.65 var(--sans)}a{color:inherit;text-decoration-thickness:1px;text-underline-offset:3px}.skip{position:fixed;left:16px;top:-60px;z-index:5;padding:10px 14px;background:var(--ink);color:var(--paper)}.skip:focus{top:16px}.topbar{position:sticky;top:0;z-index:4;border-bottom:1px solid var(--line);background:color-mix(in srgb,var(--paper) 92%,transparent);backdrop-filter:blur(14px)}.topbar-inner{width:min(var(--max),calc(100% - 40px));min-height:64px;margin:auto;display:flex;align-items:center;justify-content:space-between;gap:20px}.brand{font-weight:700;letter-spacing:-.03em;text-decoration:none}.meta,.eyebrow{font:700 11px/1.4 var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--green)}.meta{color:var(--muted)}.layout{width:min(var(--max),calc(100% - 40px));margin:auto;display:grid;grid-template-columns:220px minmax(0,var(--reading));gap:clamp(32px,7vw,100px)}.rail{position:sticky;top:88px;align-self:start;max-height:calc(100vh - 112px);overflow:auto;padding:30px 0}.rail h2{margin:0 0 14px;font:700 11px/1.4 var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}.rail nav{display:grid;gap:8px}.rail a{font-size:13px;text-decoration:none}.rail a:hover,.rail a:focus{color:var(--green);text-decoration:underline}.search-row{display:flex;gap:8px;margin-top:8px}.search{min-width:0;flex:1;padding:10px 11px;border:1px solid var(--line);border-radius:0;background:var(--paper);color:var(--ink);font:14px var(--sans)}.search-button{padding:10px 11px;border:1px solid var(--ink);border-radius:0;background:var(--ink);color:var(--paper);font:700 12px var(--sans);cursor:pointer}.search-button:hover,.search-button:focus{background:var(--green)}.search:focus,.search-button:focus{outline:2px solid var(--green);outline-offset:2px}.hero{padding:82px 0 68px;border-bottom:1px solid var(--line)}h1,h2,h3{margin:0;text-wrap:pretty}h1{max-width:760px;font-size:clamp(50px,8vw,104px);font-weight:560;line-height:.94;letter-spacing:-.075em}.lead{max-width:720px;margin:28px 0 0;font:clamp(21px,2.3vw,30px)/1.35 var(--serif)}.facts{display:grid;grid-template-columns:repeat(3,1fr);margin-top:42px;border-top:1px solid var(--line)}.fact{padding:13px 14px 13px 0;border-bottom:1px solid var(--line)}.fact strong{display:block;font:700 11px var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}.fact span{display:block;margin-top:5px;font-size:14px}.article-header{padding:56px 0 20px;border-bottom:1px solid var(--line)}.article-header h2{font-size:clamp(30px,4vw,48px);line-height:1;letter-spacing:-.05em}.section-map{margin:14px 0 0;color:var(--muted);font:12px/1.5 var(--mono)}.article-body{padding:24px 0 70px}.article-body h3{margin:38px 0 10px;font-size:25px;letter-spacing:-.03em}.article-body h4,.article-body h5,.article-body h6{margin:28px 0 8px}.article-body p{max-width:var(--reading);margin:0 0 16px}.article-body ul,.article-body ol{max-width:var(--reading);padding-left:25px}.article-body li{padding-left:4px;margin:5px 0}.article-body code{padding:2px 5px;background:var(--raised);font:14px var(--mono)}.article-body pre{overflow:auto;margin:20px 0;padding:18px;background:var(--ink);color:var(--paper);font:13px/1.6 var(--mono)}.article-body pre code{padding:0;background:none;color:inherit}.table-wrap{overflow:auto;margin:20px 0}.article-body table{width:100%;border-collapse:collapse;font-size:14px}.article-body th,.article-body td{padding:9px 10px;text-align:left;vertical-align:top;border:1px solid var(--line)}.article-body th{background:var(--raised);font-weight:700}.empty{display:none;margin:25px 0;padding:14px;border-left:3px solid var(--amber);background:var(--raised)}body.searching article[data-document]{display:none}body.searching article[data-document].match{display:block}body.searching .empty.visible{display:block}.footer{padding:32px 0 70px;border-top:1px solid var(--line);color:var(--muted);font:12px var(--mono)}@media(max-width:820px){.layout{display:block}.rail{position:static;max-height:none;padding:20px 0;border-bottom:1px solid var(--line)}.rail nav{display:flex;flex-wrap:wrap}.rail a{padding:5px 8px;border:1px solid var(--line)}.search{max-width:420px}.facts{grid-template-columns:1fr}.hero{padding:58px 0 48px}}@media print{.topbar,.rail,.skip{display:none}.layout{display:block;width:auto}.hero{padding-top:0}.article-body{padding-bottom:20px}a{text-decoration:none}}
@media print{.topbar,.rail,.skip{display:none}.layout{display:block;width:auto}.hero{padding-top:0}.article-body{padding-bottom:20px}a{text-decoration:none}}
</style>
</head>
<body>
<a class="skip" href="#content">Skip to content</a>
<header class="topbar"><div class="topbar-inner"><a class="brand" href="#top">Experimental Gantt engine</a><span class="meta">PMIS / technical reference</span></div></header>
<div class="layout" id="top">
<aside class="rail" aria-label="Documentation navigation"><h2>Contents</h2><nav>${nav}</nav><p class="meta" style="margin-top:24px;line-height:1.6">Use your browser's built-in find command to search this page.</p></aside>
<main id="content">
<section class="hero"><p class="eyebrow">Documentation portal</p><h1>Read the engine as a system.</h1><p class="lead">A browser-ready reference for the isolated PMIS Gantt engine. The Markdown files beside this page are canonical; this page is their rendered reading surface.</p><div class="facts"><div class="fact"><strong>Runtime</strong><span>Vanilla DOM, SVG, and browser APIs</span></div><div class="fact"><strong>Boundary</strong><span>Gateway transport seam for future PHP</span></div><div class="fact"><strong>Scope</strong><span>Experimental migration slice, not React replacement</span></div></div></section>
${articles}
<footer class="footer">Generated from the Markdown files in <code>experimental/gantt-engine/docs</code>. Edit Markdown, then run <code>npm run docs:build</code> to refresh this page.</footer>
</main></div>
</body></html>
`;

await writeFile(join(directory, "index.html"), html);
console.log(`Generated docs/index.html from ${documents.length} Markdown files.`);
