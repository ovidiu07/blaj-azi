import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the Blaj Azi homepage with Romanian metadata", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<html lang="ro">/i);
  assert.match(html, /<title>Blaj Azi — Ghidul local al Blajului<\/title>/i);
  assert.match(html, /Tot ce contează în Blaj/);
  assert.match(html, /Conținut demonstrativ/);
  assert.match(html, /Wikimedia Commons/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("includes durable-data, moderation, SEO, and media foundations", async () => {
  const [hosting, schema, api, layout, attribution, packageJson] = await Promise.all([
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/submissions/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../public/images/ATTRIBUTIONS.md", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  assert.match(hosting, /"d1": "DB"/);
  assert.match(hosting, /"r2": "MEDIA"/);
  assert.match(schema, /submissions|moderationRecords|newsletterSubscriptions|promotedPlacements/);
  assert.match(api, /pending_review/);
  assert.match(layout, /openGraph|summary_large_image/);
  assert.match(layout, /Source_Serif_4|Inter/);
  assert.doesNotMatch(layout, /Cormorant_Garamond|Manrope/);
  assert.match(attribution, /CC BY-SA 4\.0|domeniul public/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await access(new URL("../public/og.png", import.meta.url));
  await access(new URL("../drizzle/0000_bumpy_vanisher.sql", import.meta.url));
});

test("renders first-party auth pages and protects account and admin routes", async () => {
  const login = await render("/conectare?return_to=%2Fcont");
  assert.equal(login.status, 200);
  assert.match(await login.text(), /Bine ai revenit|Conectează-te/);
  const registration = await render("/inregistrare");
  assert.equal(registration.status, 200);
  assert.match(await registration.text(), /Creează un cont Blaj Azi/);
  const account = await render("/cont");
  assert.equal(account.status, 307);
  assert.match(account.headers.get("location") ?? "", /^\/conectare\?return_to=/);
  const admin = await render("/admin");
  assert.equal(admin.status, 307);
  assert.match(admin.headers.get("location") ?? "", /^\/admin\/conectare\?return_to=/);
  const compatibility = await render("/signin-with-chatgpt?return_to=%2Fcont");
  assert.equal(compatibility.status, 307);
  assert.match(compatibility.headers.get("location") ?? "", /^\/conectare\?return_to=/);
});

test("keeps representative public routes renderable", async () => {
  for (const path of ["/descopera-blaj", "/descopera-blaj/campia-libertatii", "/evenimente", "/evenimente/seara-de-film", "/afaceri-si-servicii", "/oferte-locale", "/unde-mancam", "/locuri-de-munca", "/povesti-locale", "/informatii-utile", "/promovare", "/adauga", "/adauga-o-afacere"]) {
    const response = await render(path);
    assert.equal(response.status, 200, path);
    const html = await response.text();
    assert.equal((html.match(/<h1\b/gi) || []).length, 1, `${path} should have one H1`);
  }
});

test("renders URL-backed filters, safe search metadata, and type-specific forms", async () => {
  const events = await render("/evenimente?period=weekend&category=Cultur%C4%83");
  const eventsHtml = await events.text();
  assert.match(eventsHtml, /name="period"/);
  assert.match(eventsHtml, /Weekend/);
  assert.match(eventsHtml, /Filtre active/);
  const search = await render("/cauta?q=meditatii");
  const searchHtml = await search.text();
  assert.match(searchHtml, /name="q"/);
  assert.match(searchHtml, /noindex/i);
  const eventForm = await render("/adauga-un-eveniment");
  const eventHtml = await eventForm.text();
  assert.match(eventHtml, /name="startsAt"/);
  assert.match(eventHtml, /name="organizer"/);
  assert.match(eventHtml, /Europe\/Bucharest/);
  assert.match(eventHtml, /Publicare numai după moderare/);
});
