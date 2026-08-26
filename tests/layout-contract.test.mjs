import assert from "node:assert/strict";
import test from "node:test";

let entries = {};
const DB = {
  prepare(sql) {
    let bindings = [];
    return {
      bind(...values) { bindings = values; return this; },
      async first() {
        if (/FROM site_content_entries WHERE key=\?/i.test(sql)) {
          const key = bindings[0];
          return Object.hasOwn(entries, key)
            ? { published_json: JSON.stringify(entries[key]), schema_version: key === "home" ? 5 : 1 }
            : null;
        }
        return null;
      },
      async all() { throw new Error("catalog fallback for isolated layout render"); },
    };
  },
};

globalThis.__BLAJ_TEST_ENV__ = { DB };

async function render(path, values) {
  entries = values;
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("layout-contract", `${Date.now()}-${Math.random()}`);
  const { default: worker } = await import(workerUrl.href);
  const response = await worker.fetch(
    new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }),
    { DB, ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
  assert.equal(response.status, 200, path);
  return response.text();
}

function minimalHome(overrides = {}) {
  return {
    heroVisible: true,
    heroImage: { src: "", mediaId: null, alt: "", decorative: false, caption: "", author: "", sourceUrl: "", license: "", objectPosition: "center", showCredit: false },
    kicker: "", titleLine: "Titlu principal", emphasizedTitleLine: "", intro: "Introducere", searchVisible: true, searchLabel: "Caută", searchPlaceholder: "Ce cauți?", searchButton: "Caută",
    primaryCtaLabel: "Acțiune principală", primaryCtaHref: "/evenimente", secondaryCtaLabel: "Acțiune secundară", secondaryCtaHref: "/descopera-blaj",
    quickCategoriesVisible: false, eventsVisible: false, discoverVisible: false, servicesVisible: false, offersVisible: false, restaurantsVisible: false, jobsVisible: false, finalVisible: false,
    ...overrides,
  };
}

test("hero optional elements are absent from the DOM and leave the deliberate no-image variant", async () => {
  const noImage = await render("/", { home: minimalHome() });
  assert.match(noImage, /home-hero-no-image/);
  assert.doesNotMatch(noImage, /home-hero-visual|home-hero-signal|home-image-credit/);

  const unavailableImage = await render("/", { home: minimalHome({ heroImage: { src:"", mediaId:404, alt:"Imagine indisponibilă", decorative:false, caption:"Credit orfan", author:"Autor", sourceUrl:"", license:"", objectPosition:"center", showCredit:true } }) });
  const unavailableMain = unavailableImage.match(/<main id="continut">([\s\S]*?)<\/main>/)?.[1] ?? "";
  assert.match(unavailableMain, /home-hero-no-image/);
  assert.doesNotMatch(unavailableMain, /home-hero-visual|home-image-credit|Credit orfan/);

  const noIntro = await render("/", { home: minimalHome({ intro: "" }) });
  assert.doesNotMatch(noIntro, /home-hero-intro/);
  assert.match(noIntro, /home-search/);

  const noSearch = await render("/", { home: minimalHome({ searchVisible: false }) });
  assert.doesNotMatch(noSearch, /home-search|hero-query/);

  const noPrimary = await render("/", { home: minimalHome({ primaryCtaLabel: "", primaryCtaHref: "" }) });
  assert.doesNotMatch(noPrimary, /Acțiune principală/);
  assert.match(noPrimary, /Acțiune secundară/);

  const noSecondary = await render("/", { home: minimalHome({ secondaryCtaLabel: "", secondaryCtaHref: "" }) });
  assert.match(noSecondary, /Acțiune principală/);
  assert.doesNotMatch(noSecondary, /Acțiune secundară/);

  const noActions = await render("/", { home: minimalHome({ primaryCtaLabel: "", primaryCtaHref: "", secondaryCtaLabel: "", secondaryCtaHref: "" }) });
  assert.doesNotMatch(noActions, /home-hero-actions/);

  const oneTitleLine = await render("/", { home: minimalHome({ titleLine: "", emphasizedTitleLine: "Linie păstrată" }) });
  assert.match(oneTitleLine, /<h1>.*Linie păstrată.*<\/h1>/s);
  assert.doesNotMatch(oneTitleLine, /<span>\s*<\/span>/);
});

test("image credit, empty page headers, and empty legal bodies do not render wrappers", async () => {
  const imageWithoutCredit = await render("/", { home: minimalHome({
    heroImage: { src: "/images/campia-libertatii.jpg", mediaId: null, alt: "Câmpia Libertății", decorative: false, caption: "", author: "", sourceUrl: "", license: "", objectPosition: "center", showCredit: true },
  }) });
  assert.match(imageWithoutCredit, /home-hero-has-image/);
  assert.doesNotMatch(imageWithoutCredit, /home-image-credit/);

  const imageWithCredit = await render("/", { home: minimalHome({
    titleLine:"Un titlu românesc suficient de lung pentru a verifica o coloană lizibilă",
    heroImage: { src:"/images/campia-libertatii.jpg", mediaId:null, alt:"Câmpia Libertății", decorative:false, caption:"Câmpia Libertății", author:"Autor", sourceUrl:"https://commons.wikimedia.org/", license:"CC BY-SA 4.0", objectPosition:"center", showCredit:true },
  }) });
  assert.match(imageWithCredit, /home-hero-has-image/);
  assert.match(imageWithCredit, /home-image-credit/);
  assert.match(imageWithCredit, /sizes="\(max-width: 820px\) calc\(100vw - 28px\), \(max-width: 1100px\) 44vw, \(max-width: 1440px\) 52vw, 720px"/);

  const legal = await render("/termeni", { "page.terms": { eyebrow: "Legal", title: "Termeni", intro: "Condiții de utilizare", blocks: [] } });
  assert.match(legal, /<h1>Termeni<\/h1>/);
  assert.doesNotMatch(legal, /prose-page|<p[^>]*>\s*<\/p>|<h[2-6][^>]*>\s*<\/h[2-6]>/);
});

test("discovery without hero media and forms without guidance use content-aware variants", async () => {
  const discover = await render("/descopera-blaj", { discover: {
    heroImage: { src: "", mediaId: null, alt: "", decorative: false, caption: "", author: "", sourceUrl: "", license: "", objectPosition: "center", showCredit: false },
    kicker: "Descoperă", title: "Blaj", intro: "Repere locale", lead: "", supportingCopy: "", sourceUrl: "", sourceLabel: "",
    sectionEyebrow: "", sectionTitle: "Locuri", galleryEyebrow: "", galleryTitle: "", contributionKicker: "", contributionTitle: "", contributionCopy: "", contributionHref: "", contributionLabel: "", emptyTitle: "", emptyCopy: "",
  } });
  const hero = discover.match(/<section class="discover-hero[\s\S]*?<\/section>/)?.[0] ?? "";
  assert.match(hero, /discover-hero-no-image/);
  assert.doesNotMatch(hero, /<img|<small/);
  assert.doesNotMatch(discover, /intro-editorial|contribute-band/);

  const form = await render("/contact", { "forms.submissions": {
    eyebrow: "Contact", guidanceTitle: "", guidanceCopy: "", rightsTitle: "", rightsCopy: "", moderationTitle: "", moderationCopy: "",
    consentCopy: "Consimțământ", successTitle: "Mulțumim", successCopy: "Mesaj primit", types: [{ kind: "contact", title: "Scrie-ne", intro: "Trimite un mesaj." }],
  } });
  assert.match(form, /form-layout-without-aside/);
  assert.doesNotMatch(form, /class="form-aside"|class="form-guidance"/);
});

test("card collections and directories render sparse, empty, and populated states without placeholder tracks", async () => {
  const oneCard = await render("/adauga", { "forms.hub": { eyebrow: "Contribuie", title: "Adaugă", intro: "Alege tipul", cards: [{ label: "Eveniment", href: "/adauga-un-eveniment", description: "" }] } });
  assert.match(oneCard, /class="container create-grid" data-count="1"/);
  assert.equal((oneCard.match(/<section class="container create-grid"/g) || []).length, 1);

  const twoCards = await render("/adauga", { "forms.hub": { eyebrow: "Contribuie", title: "Adaugă", intro: "Alege tipul", cards: [{ label: "Eveniment", href: "/adauga-un-eveniment", description: "" }, { label: "Job", href: "/adauga-un-job", description: "" }] } });
  assert.match(twoCards, /class="container create-grid" data-count="2"/);

  const emptyDirectory = await render("/evenimente?q=nu-exista", {});
  assert.match(emptyDirectory, /class="empty-state"/);
  const populatedDirectory = await render("/informatii-utile", {});
  assert.match(populatedDirectory, /class="utility-card"/);
});
