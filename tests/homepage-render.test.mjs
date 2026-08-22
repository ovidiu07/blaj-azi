import assert from "node:assert/strict";
import test from "node:test";

let homeContent = {};
const DB = {
  prepare(sql) {
    let bindings = [];
    return {
      bind(...values) { bindings = values; return this; },
      async first() {
        if (/FROM site_content_entries WHERE key=\?/i.test(sql)) {
          return bindings[0] === "home" ? { published_json: JSON.stringify(homeContent), schema_version: 2 } : null;
        }
        return null;
      },
      async all() { throw new Error("catalog fallback for isolated homepage render"); },
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
  homeContent = {
    heroVisible:true,
    heroImage:{src:"",mediaId:null,alt:"",decorative:false,caption:"",author:"",sourceUrl:"",license:"",objectPosition:"center",showCredit:false},
    kicker:"",titleLine:"",emphasizedTitleLine:"",intro:"",searchVisible:true,searchLabel:"",searchPlaceholder:"",searchButton:"",
    primaryCtaLabel:"Acțiune fără destinație",primaryCtaHref:"",secondaryCtaLabel:"",secondaryCtaHref:"",
    quickCategoriesVisible:true,quickCategoriesLabel:"Categorii",quickCategories:[
      {id:"deleted",label:"Șters",href:"/evenimente",icon:"calendar",visible:false,deleted:true},
      {id:"hidden",label:"Ascuns",href:"/oferte-locale",icon:"offers",visible:false,deleted:false},
      {id:"empty",label:"",href:"",icon:"services",visible:true,deleted:false},
    ],
    eventsVisible:false,discoverVisible:false,servicesVisible:false,offersVisible:false,restaurantsVisible:false,jobsVisible:false,finalVisible:false,
  };
  const html = await render();
  assert.doesNotMatch(html, /<section class="hero\b/);
  assert.doesNotMatch(html, /category-strip/);
  assert.doesNotMatch(html, /business-cta/);
  assert.doesNotMatch(html, /Acțiune fără destinație|Șters|Ascuns/);
  assert.doesNotMatch(html, /href=""|<h[1-6][^>]*>\s*<\/h[1-6]>|<p[^>]*>\s*<\/p>/);
});

test("homepage renders only complete visible repeatable links and complete actions", async () => {
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
  assert.match(html, /category-strip/);
  assert.doesNotMatch(html, /Fără link|Restaurante/);
});
