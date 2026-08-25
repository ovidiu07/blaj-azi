import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const businessRows = [
  {
    content_id: 101, entity_id: 201, is_demo: 1, slug: "serviciu-demonstrativ-cu-un-titlu-romanesc-foarte-lung",
    name: "Serviciu demonstrativ cu un titlu românesc foarte lung pentru verificarea împachetării corecte",
    category_name: "Servicii locale și consultanță", locality: "Blaj, cartierul foarte lung folosit pentru verificarea afișării",
    verification_status: "verified", primary_image: "/images/palatul-cultural.jpg", updated_at: "2026-08-25T10:00:00Z",
  },
  {
    content_id: 102, entity_id: 202, is_demo: 0, slug: "serviciu-fara-imagine", name: "Serviciu fără imagine",
    category_name: "Servicii locale", locality: "Blaj", verification_status: "pending", primary_image: null,
    updated_at: "2026-08-25T10:00:00Z",
  },
];

const DB = {
  prepare(sql) {
    return {
      bind() { return this; },
      async first() {
        if (/platform_settings/i.test(sql)) return { value: "public" };
        return null;
      },
      async all() {
        if (/JOIN businesses b/i.test(sql) && /c\.type='business'/i.test(sql)) return { results: businessRows };
        return { results: [] };
      },
    };
  },
};

globalThis.__BLAJ_TEST_ENV__ = { DB };

async function render(path) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("public-discovery-ux", `${Date.now()}-${Math.random()}`);
  const { default: worker } = await import(workerUrl.href);
  const response = await worker.fetch(
    new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }),
    { DB, ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
  assert.equal(response.status, 200, path);
  return response.text();
}

test("directory cards use one native detail link for image, title, location, status, and affordance", async () => {
  const html = await render("/afaceri-si-servicii?sort=title&verified=yes");
  const href = "/afaceri-si-servicii/serviciu-demonstrativ-cu-un-titlu-romanesc-foarte-lung";
  assert.equal((html.match(new RegExp(`href="${href}"`, "g")) || []).length, 1);
  const card = html.match(new RegExp(`<article class="result-card ">([\\s\\S]*?)</article>`))?.[1] || "";
  assert.match(card, new RegExp(`<a (?=[^>]*class="result-card-surface")(?=[^>]*href="${href}")[^>]*>`));
  assert.match(card, /<img[\s\S]*Serviciu demonstrativ[\s\S]*Blaj, cartierul foarte lung[\s\S]*Vezi detaliile[\s\S]*<\/a>/);
  assert.doesNotMatch(card, /<a[^>]*>[\s\S]*<a\b/);
  assert.match(html, /aria-controls="directory-filter-dialog"/);
  assert.match(html, /name="verified"[\s\S]*name="sort"/);
  assert.match(html, /href="\/afaceri-si-servicii\?sort=title"[^>]*>Resetează/);
});

test("missing-image and global-search results retain the single clickable surface", async () => {
  const directory = await render("/afaceri-si-servicii?q=fără+imagine");
  const missing = directory.match(/<article class="result-card ">([\s\S]*?Serviciu fără imagine[\s\S]*?)<\/article>/)?.[1] || "";
  assert.match(missing, /<a (?=[^>]*class="result-card-surface")(?=[^>]*href="\/afaceri-si-servicii\/serviciu-fara-imagine")[^>]*>/);
  assert.doesNotMatch(missing, /<img\b/);

  const search = await render("/cauta?q=serviciu");
  assert.match(search, /class="result-card search-result"/);
  assert.match(search, /<a (?=[^>]*class="result-card-surface")(?=[^>]*href="\/afaceri-si-servicii\/serviciu-fara-imagine")[^>]*>/);
  assert.match(search, /aria-live="polite" aria-atomic="true"/);
  assert.doesNotMatch(search, /role="tab"/);
});

test("navigation and interaction styles expose the responsive accessibility contract", async () => {
  const html = await render("/afaceri-si-servicii");
  assert.match(html, /aria-controls="site-mobile-menu"/);
  assert.match(html, /aria-controls="site-search-dialog"/);

  const [chrome, css, home, siteContent] = await Promise.all([
    readFile(new URL("../app/ui/SiteChrome.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/ui/HomeExperience.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/site-content.ts", import.meta.url), "utf8"),
  ]);
  for (const heading of ["Explorează", "Pentru comunitate", "Cont", "Administrare"]) assert.match(chrome, new RegExp(`>${heading}<`));
  assert.match(chrome, /useDialogFocus\(open[\s\S]*aria-modal="true"/);
  assert.match(css, /\.result-card-surface:focus-visible[^{]*\{[^}]*outline:3px solid var\(--color-focus-ring\)/s);
  assert.match(css, /@media \(max-width:1000px\)[\s\S]*\.desktop-filters \{ display:none; \}[\s\S]*\.mobile-filter-button \{ display:inline-flex; \}/);
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)[\s\S]*\.result-card-surface/);
  assert.doesNotMatch(home, /onClick=.*location|window\.location/);
  assert.match(siteContent, /titleLine: "Tot ce contează,"[\s\S]*emphasizedTitleLine: "într-un singur loc\."/);
});
