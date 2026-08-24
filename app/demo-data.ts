import type { ContentInput, ContentType } from "./server/content";
import type { RichTextDocument } from "./rich-text";

export const DEMO_GENERATOR_VERSION = "2026.08.24-v1";
export const DEMO_VISIBILITY_SETTING = "demo_visibility";
export const DEMO_DELETE_CONFIRMATION = "ȘTERGE DATELE DEMONSTRATIVE";
export const DEMO_WARNING = "Acesta este conținut demonstrativ creat exclusiv pentru testarea platformei Blaj Azi. Nu reprezintă o afacere, un eveniment, o ofertă, un loc de muncă sau o informație operațională reală.";

export type DemoVisibility = "hidden" | "public";
export type DemoCategoryStrategy =
  | { source: "database"; databaseType: "business" | "event" | "post"; fallback: readonly string[] }
  | { source: "demo-only"; labels: readonly string[] };

export type DemoExampleDefinition = {
  suffix: "01" | "02";
  variant: "primary" | "secondary";
};

export type DemoManifestEntry = {
  type: ContentType;
  route: string;
  categoryStrategy: DemoCategoryStrategy;
  examples: readonly [DemoExampleDefinition, DemoExampleDefinition];
  requiredFields: readonly string[];
  publicationRule: "public-admin" | "public-admin-only";
  dateStrategy: string;
  imagePath: string;
  imageAlt: string;
  imageCredit: string;
  imageLicense: string;
  creationMode: "administrator" | "administrator-only-type";
};

const examples = [
  { suffix: "01", variant: "primary" },
  { suffix: "02", variant: "secondary" },
] as const;

export const demoManifest = [
  entry("business", "/afaceri-si-servicii", { source:"database", databaseType:"business", fallback:["Reparații și amenajări","Sănătate","Auto","Educație și meditații"] }, ["locality","address","phone","contactEmail","website","hours","accessibility"], "Fără expirare; data verificării este data generării."),
  entry("event", "/evenimente", { source:"database", databaseType:"event", fallback:["Copii","Comunitate","Cultură"] }, ["organizer","venue","startsAt","endsAt","ticketInfo","bookingUrl"], "Date viitoare deterministe, între +7 și +45 de zile."),
  entry("offer", "/oferte-locale", { source:"demo-only", labels:["Servicii","Gastronomie","Retail local"] }, ["businessId","startsAt","endsAt","price","terms","redemption"], "Valabilă de la data generării până la +30 de zile."),
  entry("job", "/locuri-de-munca", { source:"demo-only", labels:["HoReCa","Servicii","Comerț","Producție"] }, ["businessId","company","contractType","schedule","deadline","requirements","benefits","applicationMethod"], "Termen de aplicare la +30 sau +45 de zile."),
  entry("restaurant", "/unde-mancam", { source:"demo-only", labels:["Restaurant","Cafenea","Pizzerie și fast-food"] }, ["businessId","cuisine","delivery","pickup","hours","contact"], "Fără expirare; programul este etichetat demonstrativ."),
  entry("daily_menu", "/unde-mancam", { source:"demo-only", labels:["Meniu zilnic"] }, ["businessId","restaurantId","menuDate","dishes","price","availability"], "Primul exemplu pentru azi, al doilea pentru ziua următoare."),
  entry("place", "/descopera-blaj", { source:"demo-only", labels:["Istorie și patrimoniu","Cultură","Natură și recreere"] }, ["locality","address","accessibility","sourceUrl"], "Fără coordonate și fără afirmații istorice inventate."),
  entry("community_post", "/povesti-locale", { source:"database", databaseType:"post", fallback:["Povești locale","Actualizări de afaceri"] }, ["authorLabel","body","sourceUrl","rights"], "Dată aproximativă egală cu data generării."),
  entry("local_story", "/povesti-locale", { source:"database", databaseType:"post", fallback:["Povești locale","Actualizări de afaceri"] }, ["authorLabel","body","sourceUrl","rights"], "Dată aproximativă egală cu data generării."),
  entry("business_update", "/povesti-locale", { source:"database", databaseType:"post", fallback:["Povești locale","Actualizări de afaceri"] }, ["businessId","authorLabel","body","sourceUrl","rights"], "Actualizare sintetică fără valoare operațională."),
  entry("article", "/povesti-locale", { source:"database", databaseType:"post", fallback:["Povești locale","Actualizări de afaceri"] }, ["authorLabel","body","sourceUrl","rights"], "Articol creat exclusiv de administrator."),
] as const satisfies readonly DemoManifestEntry[];

function entry(
  type: ContentType,
  route: string,
  categoryStrategy: DemoCategoryStrategy,
  requiredFields: readonly string[],
  dateStrategy: string,
): DemoManifestEntry {
  const file = type.replaceAll("_", "-");
  return {
    type,
    route,
    categoryStrategy,
    examples,
    requiredFields,
    publicationRule: type === "article" ? "public-admin-only" : "public-admin",
    dateStrategy,
    imagePath: `/demo-fixtures/${file}.png`,
    imageAlt: `Grafică demonstrativă pentru tipul ${type}, marcată DEMO — IMAGINE DE TEST.`,
    imageCredit: "Blaj Azi — grafică demonstrativă",
    imageLicense: "Material demonstrativ creat pentru proiect",
    creationMode: type === "article" ? "administrator-only-type" : "administrator",
  };
}

export type ResolvedDemoCategory = { id: number | null; label: string; source: "database" | "demo-only" };
export type ResolvedDemoMatrixRow = {
  type: ContentType;
  route: string;
  categories: ResolvedDemoCategory[];
  recordsPerCategory: 2;
  expectedCount: number;
  imagePath: string;
};

export type DemoFixture = {
  seedKey: string;
  type: ContentType;
  category: ResolvedDemoCategory;
  route: string;
  example: DemoExampleDefinition;
  input: ContentInput;
  publishedSnapshot: string;
  imagePath: string;
  imageAlt: string;
  imageCredit: string;
  imageSource: string;
  imageLicense: string;
};

type FixtureRelations = { businessId?: number; restaurantId?: number };

export function demoSeedKey(type: ContentType, category: string, suffix: "01" | "02") {
  return `demo:${DEMO_GENERATOR_VERSION}:${type}:${slugPart(category)}:${suffix}`;
}

export function demoBatchId(version = DEMO_GENERATOR_VERSION) {
  return `demo-data-${slugPart(version)}`;
}

export function expectedDemoCount(matrix: readonly ResolvedDemoMatrixRow[]) {
  return matrix.reduce((total, row) => total + row.expectedCount, 0);
}

export function buildDemoFixture(
  manifest: DemoManifestEntry,
  category: ResolvedDemoCategory,
  example: DemoExampleDefinition,
  now: Date,
  relations: FixtureRelations = {},
): DemoFixture {
  const seedKey = demoSeedKey(manifest.type, category.label, example.suffix);
  const slug = seedKey.replaceAll(":", "-").replaceAll("_", "-");
  const title = `[DEMO] ${titleStem(manifest.type, category.label)} — exemplul ${example.suffix}`;
  const sourceUrl = `https://example.invalid/blaj-azi/${encodeURIComponent(seedKey)}`;
  const actionUrl = `${sourceUrl}/actiune`;
  const excerpt = richDocument([
    paragraph(DEMO_WARNING),
    paragraph(`Exemplul ${example.suffix} folosește categoria demonstrativă „${category.label}” pentru verificarea listelor, filtrelor și paginilor de detaliu.`),
  ]);
  const body = richDocument([
    paragraph(DEMO_WARNING),
    heading2("Scopul acestui exemplu"),
    paragraph("Înregistrarea conține informații sintetice, suficient de complete pentru verificarea randării, căutării, filtrelor, imaginilor și stărilor de publicare."),
    bullets(["Nu descrie o activitate reală.", "Nu acceptă rezervări, comenzi sau candidaturi.", "Datele de contact și adresa sunt rezervate testării."]),
    heading3("Condiții de utilizare"),
    paragraphWithLink("Folosește numai pentru testarea platformei. Vezi pagina demonstrativă.", sourceUrl),
  ]);
  const base: ContentInput = {
    type: manifest.type,
    title,
    slug,
    excerpt,
    body,
    locality: "Blaj — localitate demonstrativă",
    categoryId: category.id,
    businessId: relations.businessId ?? null,
    sourceUrl,
    seoTitle: `${title} | Blaj Azi`,
    seoDescription: `Exemplu demonstrativ Blaj Azi pentru ${category.label}. Nu reprezintă informație reală.`,
    primaryMediaId: null,
    primaryMediaAltText: manifest.imageAlt,
    primaryMediaState: "selected",
    details: commonDetails(seedKey, sourceUrl, actionUrl),
  };
  base.details = { ...base.details, ...typeDetails(manifest.type, category.label, example, now, relations, body, actionUrl) };
  const publishedSnapshot = JSON.stringify({ ...base, demo: true, seedKey, category: category.label, rights: manifest.imageLicense });
  return { seedKey, type:manifest.type, category, route:manifest.route, example, input:base, publishedSnapshot, imagePath:manifest.imagePath, imageAlt:manifest.imageAlt, imageCredit:manifest.imageCredit, imageSource:`${sourceUrl}/imagine`, imageLicense:manifest.imageLicense };
}

export function validateResolvedDemoManifest(matrix: readonly ResolvedDemoMatrixRow[]) {
  const expectedTypes = demoManifest.map(item => item.type);
  const actualTypes = matrix.map(item => item.type);
  if (new Set(actualTypes).size !== expectedTypes.length || expectedTypes.some(type => !actualTypes.includes(type))) throw new Error("Manifestul demonstrativ nu conține toate tipurile acceptate.");
  const seeds = new Set<string>();
  for (const row of matrix) {
    if (!row.categories.length) throw new Error(`Tipul ${row.type} nu are categorii demonstrative.`);
    if (row.recordsPerCategory !== 2 || row.expectedCount !== row.categories.length * 2) throw new Error(`Numărul de exemple pentru ${row.type} este invalid.`);
    for (const category of row.categories) for (const example of examples) {
      const seed = demoSeedKey(row.type, category.label, example.suffix);
      if (seeds.has(seed)) throw new Error(`Cheie demonstrativă duplicată: ${seed}.`);
      seeds.add(seed);
    }
  }
  return { expectedTypes, expectedCount: expectedDemoCount(matrix), seedCount: seeds.size };
}

function commonDetails(seedKey: string, sourceUrl: string, actionUrl: string) {
  return {
    demoNotice: DEMO_WARNING,
    demoPhone: "+40 700 000 000",
    demoPhoneLabel: "Număr demonstrativ — nu apelați",
    contactEmail: `demo+${slugPart(seedKey)}@example.invalid`,
    address: "Adresă demonstrativă — nu reprezintă o locație reală",
    website: sourceUrl,
    actionUrl,
    rights: "Material demonstrativ creat pentru proiect",
    authorLabel: "Autor demonstrativ Blaj Azi",
  };
}

function typeDetails(type: ContentType, category: string, example: DemoExampleDefinition, now: Date, relations: FixtureRelations, body: RichTextDocument, actionUrl: string): Record<string, unknown> {
  const secondary = example.variant === "secondary";
  if (type === "business") return { address:"Adresă demonstrativă — nu reprezintă o locație reală", phone:"+40 700 000 000", website:actionUrl, contactEmail:`demo+business-${example.suffix}@example.invalid`, whatsapp:"Număr demonstrativ — nu apelați", socialLinks:JSON.stringify({ demo:actionUrl }), hours:"Program demonstrativ: luni–vineri, 09:00–17:00; nu reprezintă ore reale.", accessibility:secondary?"Exemplu demonstrativ: acces la nivel și spațiu de manevră.":"Exemplu demonstrativ: informația de accesibilitate trebuie confirmată." };
  if (type === "event") { const startsAt=addDays(now, secondary?21:7, secondary?18:10); return { organizer:"Organizator demonstrativ — evenimentul nu va avea loc", venue:"Spațiu demonstrativ — nu reprezintă o locație reală", address:"Adresă demonstrativă — nu reprezintă o locație reală", startsAt:startsAt.toISOString(), endsAt:new Date(startsAt.getTime()+2*3600_000).toISOString(), ticketInfo:secondary?"Preț demonstrativ: 25 lei — nu se vând bilete":"Acces demonstrativ gratuit — evenimentul nu are loc", familyFriendly:!secondary, accessibility:"Condiții demonstrative de acces; verificați numai comportamentul interfeței.", bookingUrl:actionUrl }; }
  if (type === "offer") return { startsAt:dateOnly(now), endsAt:dateOnly(addDays(now,30)), price:secondary?89:49, oldPrice:secondary?119:69, terms:body, availability:"Activă numai pentru testare", redemption:"Nu există modalitate reală de revendicare.", businessName:"[DEMO] Afacere demonstrativă", actionUrl };
  if (type === "job") return { company:"[DEMO] Angajator demonstrativ — nu există un post vacant", contractType:category, workArrangement:secondary?"La sediu demonstrativ":"Hibrid demonstrativ", schedule:secondary?"Program demonstrativ în ture":"Program demonstrativ flexibil", shift:secondary?"Ture demonstrative":"Zi", salaryMin:secondary?null:3500, salaryMax:secondary?null:4200, transport:!secondary, responsibilities:body, requirements:body, benefits:body, applyUrl:actionUrl, applicationMethod:"Nu aplicați. Modalitate demonstrativă fără recrutare reală.", deadline:dateOnly(addDays(now,secondary?45:30)) };
  if (type === "restaurant") return { cuisine:category, delivery:!secondary, pickup:secondary, dietaryOptions:"Opțiuni demonstrative; nu reprezintă un meniu real.", hours:"Program demonstrativ: 10:00–20:00; nu reprezintă ore reale.", contact:"Număr demonstrativ — nu apelați" };
  if (type === "daily_menu") return { restaurantId:relations.restaurantId, menuDate:dateOnly(addDays(now,secondary?1:0)), soup:"Ciorbă demonstrativă — preparat inexistent", mainDish:"Fel principal demonstrativ — nu poate fi comandat", sideDish:"Garnitură demonstrativă", dessert:"Desert demonstrativ", price:secondary?39:35, orderDeadline:"11:00", availability:"active", conditions:"Meniu de test; nu se acceptă comenzi." };
  if (type === "place") return { address:"Adresă demonstrativă — nu reprezintă o locație reală", accessibility:secondary?"Exemplu de traseu accesibil, neconfirmat în teren.":"Exemplu de informație de accesibilitate, fără referire la un loc real.", latitude:null, longitude:null, category };
  return { authorLabel:"Autor demonstrativ Blaj Azi", approximateDate:dateOnly(now), rights:"Material demonstrativ creat pentru proiect", category, body, businessRelationship:type==="business_update"?"Legat numai de o afacere demonstrativă din același lot.":null };
}

function titleStem(type: ContentType, category: string) {
  const labels: Record<ContentType,string> = { business:`Serviciu local · ${category}`, community_post:`Postare comunitară · ${category}`, local_story:`Poveste locală · ${category}`, article:`Articol editorial · ${category}`, business_update:`Actualizare de afacere · ${category}`, event:`Eveniment · ${category}`, offer:`Ofertă de test · ${category}`, job:`Rol de test · ${category}`, restaurant:`Restaurant demonstrativ · ${category}`, daily_menu:"Meniu zilnic demonstrativ", place:`Loc sintetic · ${category}` };
  return labels[type];
}

function richDocument(blocks: RichTextDocument["blocks"]): RichTextDocument { return { version:1, type:"rich-text", blocks }; }
function paragraph(text: string): RichTextDocument["blocks"][number] { return { type:"paragraph", children:[{text}] }; }
function heading2(text: string): RichTextDocument["blocks"][number] { return { type:"heading2", children:[{text}] }; }
function heading3(text: string): RichTextDocument["blocks"][number] { return { type:"heading3", children:[{text}] }; }
function bullets(items: string[]): RichTextDocument["blocks"][number] { return { type:"bulletList", items:items.map(text=>[{text}]) }; }
function paragraphWithLink(text: string, href: string): RichTextDocument["blocks"][number] { return { type:"paragraph", children:[{text,href}] }; }
function slugPart(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,80); }
function addDays(value: Date, days: number, hour?: number) { const next=new Date(value);next.setUTCDate(next.getUTCDate()+days);if(hour!==undefined)next.setUTCHours(hour,0,0,0);return next; }
function dateOnly(value: Date) { return new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Bucharest",year:"numeric",month:"2-digit",day:"2-digit"}).format(value); }
