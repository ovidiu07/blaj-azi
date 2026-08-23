import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

let homeContent = {};
let catalogRows = emptyCatalog();
const DB = {
  prepare(sql) {
    let bindings = [];
    return {
      bind(...values) { bindings = values; return this; },
      async first() {
        if (/FROM site_content_entries WHERE key=\?/i.test(sql)) {
          return bindings[0] === "home" ? { published_json: JSON.stringify(homeContent), schema_version: 3 } : null;
        }
        return null;
      },
      async all() {
        if (/JOIN events e/i.test(sql)) return { results: catalogRows.events };
        if (/JOIN businesses b/i.test(sql) && /c\.type='business'/i.test(sql)) return { results: catalogRows.businesses };
        if (/JOIN offers o/i.test(sql)) return { results: catalogRows.offers };
        if (/JOIN restaurants r/i.test(sql)) return { results: catalogRows.restaurants };
        if (/JOIN jobs j/i.test(sql)) return { results: catalogRows.jobs };
        if (/JOIN places p/i.test(sql)) return { results: catalogRows.places };
        if (/JOIN posts p/i.test(sql)) return { results: catalogRows.posts };
        return { results: [] };
      },
    };
  },
};

globalThis.__BLAJ_TEST_ENV__ = { DB };

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("homepage-optional", `${Date.now()}-${Math.random()}`);
  const { default: worker } = await import(workerUrl.href);
  const response = await worker.fetch(
    new Request("http://localhost/", { headers: { accept:"text/html" } }),
    { DB, ASSETS: { fetch: async () => new Response("Not found", { status:404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
  assert.equal(response.status,200);
  const html = await response.text();
  const match = html.match(/<main id="continut">([\s\S]*?)<\/main>/);
  assert.ok(match,"homepage main landmark should render");
  return match[1];
}

test("homepage omits hidden or empty sections, deleted items, empty wrappers, and nonfunctional actions", async () => {
  catalogRows = emptyCatalog();
  homeContent = {
    heroVisible:true,
    heroImage:{src:"",mediaId:null,alt:"",decorative:false,caption:"",author:"",sourceUrl:"",license:"",objectPosition:"center",showCredit:false},
    kicker:"",titleLine:"",emphasizedTitleLine:"",intro:"",heroTrust:"",searchVisible:true,searchLabel:"",searchPlaceholder:"",searchButton:"",
    primaryCtaLabel:"Acțiune fără destinație",primaryCtaHref:"",secondaryCtaLabel:"",secondaryCtaHref:"",
    quickCategoriesVisible:true,quickCategoriesLabel:"Categorii",quickCategories:[
      {id:"deleted",label:"Șters",href:"/evenimente",icon:"calendar",visible:false,deleted:true},
      {id:"hidden",label:"Ascuns",href:"/oferte-locale",icon:"offers",visible:false,deleted:false},
      {id:"empty",label:"",href:"",icon:"services",visible:true,deleted:false},
    ],
    eventsVisible:false,discoverVisible:false,servicesVisible:false,offersVisible:false,restaurantsVisible:false,jobsVisible:false,finalVisible:false,
  };
  const html = await render();
  assert.doesNotMatch(html, /<section class="home-hero\b/);
  assert.doesNotMatch(html, /home-command/);
  assert.doesNotMatch(html, /home-participation/);
  assert.doesNotMatch(html, /Acțiune fără destinație|Șters|Ascuns/);
  assert.doesNotMatch(html, /href=""|<h[1-6][^>]*>\s*<\/h[1-6]>|<p[^>]*>\s*<\/p>/);
});

test("homepage renders only complete visible repeatable links and complete actions", async () => {
  catalogRows = emptyCatalog();
  homeContent = {
    heroVisible:true,
    heroImage:{src:"",mediaId:null,alt:"",decorative:false,caption:"",author:"",sourceUrl:"",license:"",objectPosition:"center",showCredit:false},
    kicker:"",titleLine:"Titlu păstrat",emphasizedTitleLine:"",intro:"",searchVisible:false,
    primaryCtaLabel:"Vezi evenimentele",primaryCtaHref:"/evenimente",secondaryCtaLabel:"Fără link",secondaryCtaHref:"",
    quickCategoriesVisible:true,quickCategoriesLabel:"Categorii",quickCategories:[
      {id:"valid",label:"Evenimente",href:"/evenimente",icon:"calendar",visible:true,deleted:false},
      {id:"deleted",label:"Restaurante",href:"/unde-mancam",icon:"restaurant",visible:false,deleted:true},
    ],
    eventsVisible:false,discoverVisible:false,servicesVisible:false,offersVisible:false,restaurantsVisible:false,jobsVisible:false,finalVisible:false,
  };
  const html = await render();
  assert.match(html, /<h1>.*Titlu păstrat.*<\/h1>/s);
  assert.match(html, /href="\/evenimente"[^>]*>.*Vezi evenimentele/s);
  assert.match(html, /home-command/);
  assert.doesNotMatch(html, /Fără link|Restaurante/);
});

test("events render compact zero, intentional one, and organized multi-record states", async () => {
  homeContent = countHome({ eventsVisible: true });
  catalogRows = emptyCatalog();
  const empty = await render();
  assert.match(empty, /home-empty-strip/);
  assert.doesNotMatch(empty, /home-event-grid/);
  assert.match(empty, /Vezi calendarul|Adaugă un eveniment/);

  catalogRows = { ...emptyCatalog(), events: [eventRow(1)] };
  const one = await render();
  assert.match(one, /home-event-grid count-1" data-count="1"/);
  assert.equal((one.match(/class="home-event-card/g) || []).length, 1);

  catalogRows = { ...emptyCatalog(), events: [eventRow(1), eventRow(2), eventRow(3)] };
  const many = await render();
  assert.match(many, /home-event-grid count-3" data-count="3"/);
  assert.equal((many.match(/class="home-event-card/g) || []).length, 3);
});

test("discovery and services select count-aware layouts without blank media tracks", async () => {
  homeContent = countHome({
    discoverVisible: true,
    editorialImage: blankImage(), editorialKicker: "", editorialTitle: "", editorialCopy: "", editorialCtaLabel: "", editorialCtaHref: "", discoverMediaLabel: "", discoverMediaHref: "",
    servicesVisible: true,
  });

  catalogRows = { ...emptyCatalog(), places: [placeRow(1)], businesses: [businessRow(1)] };
  const one = await render();
  assert.match(one, /home-discovery-grid count-1" data-count="1"/);
  assert.match(one, /home-service-grid count-1" data-count="1"/);
  assert.doesNotMatch(one, /<img[^>]+src=""/);

  catalogRows = { ...emptyCatalog(), places: [placeRow(1), placeRow(2)], businesses: [businessRow(1), businessRow(2)] };
  const two = await render();
  assert.match(two, /home-discovery-grid count-2" data-count="2"/);
  assert.match(two, /home-service-grid count-2" data-count="2"/);

  catalogRows = { ...emptyCatalog(), places: [placeRow(1), placeRow(2), placeRow(3)], businesses: [businessRow(1), businessRow(2), businessRow(3)] };
  const many = await render();
  assert.match(many, /home-discovery-grid count-3" data-count="3"/);
  assert.match(many, /home-service-grid count-3" data-count="3"/);
});

test("homepage accessibility contract keeps one H1, named search, unique ids, and reduced motion", async () => {
  catalogRows = emptyCatalog();
  homeContent = countHome({
    heroVisible: true, titleLine: "Titlu principal", searchVisible: true, searchLabel: "Caută în Blaj", searchPlaceholder: "Ce cauți?", searchButton: "Caută",
  });
  const html = await render();
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  assert.match(html, /<label class="sr-only" for="hero-query">Caută în Blaj<\/label>/);
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length);
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /@media\s*\(prefers-reduced-motion:reduce\)/);
  assert.doesNotMatch(css, /\.home-hero\s*\{[^}]*height\s*:\s*100vh/s);
});

function countHome(overrides = {}) {
  return {
    heroVisible: false, quickCategoriesVisible: false, eventsVisible: false, discoverVisible: false, servicesVisible: false,
    offersVisible: false, restaurantsVisible: false, jobsVisible: false, finalVisible: false,
    ...overrides,
  };
}

function blankImage() { return { src: "", mediaId: null, alt: "", decorative: false, caption: "", author: "", sourceUrl: "", license: "", objectPosition: "center", showCredit: false }; }
function emptyCatalog() { return { events: [], businesses: [], offers: [], restaurants: [], jobs: [], places: [], posts: [] }; }
function eventRow(index) { return { slug: `eveniment-${index}`, title: `Eveniment ${index}`, starts_at: `2026-09-0${index}T17:00:00Z`, ends_at: `2026-09-0${index}T19:00:00Z`, venue: "Palatul Cultural", locality: "Blaj", category_name: "Cultură", ticket_info: "Intrare liberă", image_url: "/images/palatul-cultural.jpg", updated_at: "2026-08-23T10:00:00Z" }; }
function businessRow(index) { return { slug: `serviciu-${index}`, name: `Serviciu ${index}`, category_name: "Servicii locale", locality: "Blaj", verification_status: "verified", updated_at: "2026-08-23T10:00:00Z" }; }
function placeRow(index) { return { slug: `loc-${index}`, title: `Loc ${index}`, description: JSON.stringify([{ type: "paragraph", text: `Descriere ${index}` }]), locality: "Blaj", image_url: "/images/campia-libertatii.jpg", updated_at: "2026-08-23T10:00:00Z" }; }
