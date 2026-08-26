import { defaultTheme, normalizeTheme, themeFontOptions } from "./theme";

export type SiteContentScope = "page" | "global" | "seo" | "auth" | "theme";

export type CmsImage = {
  src: string;
  mediaId: number | null;
  alt: string;
  decorative: boolean;
  caption: string;
  author: string;
  sourceUrl: string;
  license: string;
  objectPosition: "center" | "top" | "bottom" | "left" | "right";
  showCredit: boolean;
};

export type RichTextBlock = {
  type: "paragraph" | "heading2" | "heading3" | "bulleted-list" | "numbered-list" | "quote" | "link";
  text: string;
  href?: string;
};

export type CmsField = {
  path: string;
  label: string;
  kind: "short" | "multiline" | "internal-link" | "external-url" | "toggle" | "section-visibility" | "hidden" | "deletion-marker" | "enum" | "image" | "repeatable" | "richtext" | "color" | "font";
  required?: boolean;
  maxLength?: number;
  options?: readonly string[];
  itemFields?: readonly CmsField[];
  help?: string;
  group?: string;
  defaultValue?: string | boolean;
};

export type SiteContentDefinition = {
  key: string;
  scope: SiteContentScope;
  route: string;
  label: string;
  group: string;
  schemaVersion: number;
  defaults: Record<string, unknown>;
  fields: readonly CmsField[];
};

const image = (src: string, alt: string, author: string, sourceUrl: string, license: string): CmsImage => ({
  src, mediaId: null, alt, decorative: false, caption: "", author, sourceUrl, license,
  objectPosition: "center", showCredit: true,
});
const text = (path: string, label: string, kind: CmsField["kind"] = "short", maxLength = 240, required = true): CmsField => ({ path, label, kind, maxLength, required });
const linkFields = [text("label", "Etichetă", "short", 100), text("href", "Link intern", "internal-link", 300)] as const;
const optionalText = (path: string, label: string, kind: CmsField["kind"] = "short", maxLength = 240, group?: string): CmsField => ({ path, label, kind, maxLength, required: false, group });
const visibility = (path: string, group: string): CmsField => ({ path, label: group, kind: "section-visibility", group, defaultValue: true });
const repeatableState = [
  { path: "id", label: "Identificator", kind: "hidden", required: false, maxLength: 100 },
  { path: "visible", label: "Afișează elementul", kind: "toggle", defaultValue: true },
  { path: "deleted", label: "Element șters", kind: "deletion-marker", defaultValue: false },
] as const satisfies readonly CmsField[];

const listing = (key: string, route: string, label: string, eyebrow: string, title: string, intro: string, empty: string, ctaLabel: string, ctaHref: string): SiteContentDefinition => ({
  key, scope: "page", route, label, group: "Pagini de listare", schemaVersion: 1,
  defaults: { eyebrow, title, intro, emptyTitle: empty, emptyDescription: "Publicăm numai informații reale, după verificare.", ctaLabel, ctaHref, searchLabel: "Caută în rezultate", searchPlaceholder: "Titlu, categorie, localitate", sortLabel: "Ordonează", filtersLabel: "Filtre", localityLabel: "Localitate", categoryLabel: "Categorie", periodLabel: "Perioadă", accessLabel: "Acces", verificationLabel: "Verificare", serviceLabel: "Serviciu", salaryLabel: "Salariu", transportLabel: "Transport", applyFiltersLabel: "Aplică filtrele", resetFiltersLabel: "Resetează" },
  fields: [
    text("eyebrow", "Supratitlu"), text("title", "Titlu"), text("intro", "Introducere", "multiline", 1200),
    text("emptyTitle", "Titlu stare goală", "multiline", 500), text("emptyDescription", "Descriere stare goală", "multiline", 800),
    text("ctaLabel", "Etichetă acțiune"), text("ctaHref", "Link acțiune", "internal-link", 300),
    text("searchLabel", "Etichetă căutare"), text("searchPlaceholder", "Text orientativ căutare"), text("sortLabel", "Etichetă sortare"), text("filtersLabel", "Etichetă filtre"), text("localityLabel", "Etichetă localitate"), text("categoryLabel", "Etichetă categorie"), text("periodLabel", "Etichetă perioadă"), text("accessLabel", "Etichetă acces"), text("verificationLabel", "Etichetă verificare"), text("serviceLabel", "Etichetă serviciu"), text("salaryLabel", "Etichetă salariu"), text("transportLabel", "Etichetă transport"), text("applyFiltersLabel", "Buton aplicare filtre"), text("resetFiltersLabel", "Resetare filtre"),
  ],
});

const informativePage = (key: string, route: string, label: string, title: string, intro: string, paragraphs: string[]): SiteContentDefinition => ({
  key, scope: "page", route, label, group: "Pagini informative", schemaVersion: 1,
  defaults: { eyebrow: "Blaj Azi", title, intro, blocks: paragraphs.map(value => ({ type: "paragraph", text: value })) },
  fields: [
    text("eyebrow", "Supratitlu"), text("title", "Titlu"), text("intro", "Introducere", "multiline", 1600),
    { path: "blocks", label: "Conținut", kind: "richtext", required: true },
  ],
});

export const siteContentDefinitions: readonly SiteContentDefinition[] = [
  {
    key: "theme.site", scope: "theme", route: "*", label: "Aspect și identitate vizuală", group: "Aspect și identitate vizuală", schemaVersion: 4,
    defaults: { ...defaultTheme },
    fields: [
      {path:"canvas",label:"Pânză neagră",kind:"color",group:"Culori globale"},{path:"surface",label:"Suprafață ridicată",kind:"color",group:"Culori globale"},{path:"primary",label:"Acțiune principală",kind:"color",group:"Culori globale"},{path:"primaryDark",label:"Acțiune apăsată",kind:"color",group:"Culori globale"},{path:"accent",label:"Accent oțel",kind:"color",group:"Culori globale"},{path:"accentDark",label:"Accent oțel la interacțiune",kind:"color",group:"Culori globale"},{path:"accentSoft",label:"Suprafață grafit",kind:"color",group:"Culori globale"},{path:"highlight",label:"Metal luminos",kind:"color",group:"Culori globale"},{path:"decorativeAccent",label:"Accent arhitectural discret",kind:"color",group:"Culori globale"},{path:"text",label:"Text principal pe închis",kind:"color",group:"Culori globale"},{path:"textMuted",label:"Text secundar pe închis",kind:"color",group:"Culori globale"},{path:"border",label:"Contur solid",kind:"color",group:"Culori globale"},{path:"focus",label:"Indicator de focalizare",kind:"color",group:"Culori globale"},{path:"headerBackground",label:"Fundal antet",kind:"color",group:"Culori globale"},{path:"buttonText",label:"Text pe acțiunea principală",kind:"color",group:"Culori globale"},
      {path:"brandAction",label:"Accent cald de acțiune",kind:"color",group:"Accent cald"},{path:"brandActionHover",label:"Accent cald la trecere",kind:"color",group:"Accent cald"},{path:"brandActionActive",label:"Accent cald apăsat",kind:"color",group:"Accent cald"},{path:"brandActionSoft",label:"Suprafață caldă discretă",kind:"color",group:"Accent cald"},{path:"brandActionForeground",label:"Text pe accentul cald",kind:"color",group:"Accent cald"},
      {path:"headingFont",label:"Titluri",kind:"font",options:themeFontOptions,group:"Fonturi globale"},{path:"bodyFont",label:"Text curent",kind:"font",options:themeFontOptions,group:"Fonturi globale"},{path:"interfaceFont",label:"Interfață și butoane",kind:"font",options:themeFontOptions,group:"Fonturi globale"},
      {path:"homeHeroBackground",label:"Fundal erou",kind:"color",group:"Pagina principală"},{path:"homeHeroText",label:"Text erou",kind:"color",group:"Pagina principală"},{path:"homeHeroMuted",label:"Text secundar erou",kind:"color",group:"Pagina principală"},{path:"homeDarkSection",label:"Fundal secțiune editorială",kind:"color",group:"Pagina principală"},{path:"homeDarkSectionText",label:"Text secțiuni închise",kind:"color",group:"Pagina principală"},{path:"homeJobsBackground",label:"Fundal secțiune joburi",kind:"color",group:"Pagina principală"},{path:"homeCardBackground",label:"Fundal carduri",kind:"color",group:"Pagina principală"},{path:"homeAlternateBackground",label:"Fundal alternativ",kind:"color",group:"Pagina principală"},{path:"homeCtaBackground",label:"Fundal îndemn final",kind:"color",group:"Pagina principală"},{path:"homeCtaText",label:"Text îndemn final",kind:"color",group:"Pagina principală"},
    ],
  },
  {
    key: "home", scope: "page", route: "/", label: "Pagina principală", group: "Pagina principală", schemaVersion: 5,
    defaults: {
      heroVisible: true,
      heroImage: image("/images/campia-libertatii.jpg", "Câmpia Libertății din Blaj", "Țetcu Mircea Rareș", "https://commons.wikimedia.org/", "CC BY-SA 4.0"),
      kicker: "GHID LOCAL INDEPENDENT · BLAJ", titleLine: "Blajul,", emphasizedTitleLine: "la zi.",
      intro: "Evenimente, locuri, servicii și informații verificate, într-un singur loc.",
      heroTrust: "Verificat înainte de publicare.",
      searchVisible: true,
      searchLabel: "Caută în Blaj", searchPlaceholder: "Ce cauți în Blaj?", searchButton: "Caută",
      primaryCtaLabel: "Ce se întâmplă azi", primaryCtaHref: "/evenimente?period=today", secondaryCtaLabel: "Adaugă informație", secondaryCtaHref: "/adauga",
      quickCategoriesVisible: true, quickCategoriesLabel: "Categorii rapide",
      quickCategories: [
        { id: "events", label: "Evenimente", href: "/evenimente", icon: "calendar", visible: true, deleted: false }, { id: "restaurants", label: "Restaurante", href: "/unde-mancam", icon: "restaurant", visible: true, deleted: false },
        { id: "services", label: "Servicii", href: "/afaceri-si-servicii", icon: "services", visible: true, deleted: false }, { id: "offers", label: "Oferte", href: "/oferte-locale", icon: "offers", visible: true, deleted: false },
        { id: "jobs", label: "Joburi", href: "/locuri-de-munca", icon: "jobs", visible: true, deleted: false }, { id: "children", label: "Pentru copii", href: "/evenimente?category=Copii", icon: "children", visible: true, deleted: false },
      ],
      eventsVisible: true, eventsEyebrow: "Astăzi în Blaj", eventsTitle: "Ce se întâmplă în oraș", eventsLinkLabel: "Vezi calendarul", eventsLinkHref: "/evenimente", eventsFiltersLabel: "Filtre evenimente", eventsDetailsLabel: "Detalii", eventsEmptyTitle: "Nu sunt evenimente publicate pentru următoarele zile.", eventsEmptyDescription: "Calendarul se actualizează pe măsură ce informațiile sunt verificate.", eventsEmptyActionLabel: "Adaugă un eveniment", eventsEmptyActionHref: "/adauga-un-eveniment",
      eventFilters: [
        { id: "all", value: "Toate", visible: true, deleted: false }, { id: "weekend", value: "Weekend", visible: true, deleted: false }, { id: "children", value: "Copii", visible: true, deleted: false }, { id: "culture", value: "Cultură", visible: true, deleted: false }, { id: "community", value: "Comunitate", visible: true, deleted: false },
      ],
      discoverVisible: true, discoverEyebrow: "Orașul nostru", discoverTitle: "Descoperă Blaj", discoverLinkLabel: "Explorează toate locurile", discoverLinkHref: "/descopera-blaj", editorialImage: image("", "", "", "", ""), editorialKicker: "Povestea orașului", editorialTitle: "Un loc în care istoria rămâne vie", editorialCopy: "Reperele Blajului, poveștile oamenilor și locurile care merită privite pe îndelete.", editorialCtaLabel: "Începe explorarea", editorialCtaHref: "/descopera-blaj", discoverMediaLabel: "Vezi Blajul în imagini", discoverMediaHref: "/descopera-blaj#imagini",
      servicesVisible: true, servicesEyebrow: "Aproape de tine", servicesTitle: "Servicii locale", servicesLinkLabel: "Vezi toate serviciile", servicesLinkHref: "/afaceri-si-servicii", servicesProfileLabel: "Vezi profilul",
      offersVisible: true, offersEyebrow: "Merită văzut", offersTitle: "Oferte în Blaj", offersLinkLabel: "Toate ofertele", offersLinkHref: "/oferte-locale", offersConditionsLabel: "Vezi condițiile", offersUntilLabel: "Valabilă până la",
      restaurantsVisible: true, restaurantsEyebrow: "Astăzi", restaurantsTitle: "Unde mâncăm astăzi?", restaurantsLinkLabel: "Vezi toate localurile", restaurantsLinkHref: "/unde-mancam", restaurantsFiltersLabel: "Filtre restaurante", restaurantsDetailsLabel: "Detalii",
      restaurantFilters: [
        { id: "all", value: "Toate", visible: true, deleted: false }, { id: "daily-menu", value: "Meniul zilei", visible: true, deleted: false }, { id: "delivery", value: "Livrare", visible: true, deleted: false }, { id: "pickup", value: "Ridicare", visible: true, deleted: false }, { id: "cafe", value: "Cafenea", visible: true, deleted: false },
      ],
      jobsVisible: true, jobsEyebrow: "Oportunități locale", jobsTitle: "Locuri de muncă în apropiere", jobsLinkLabel: "Vezi toate joburile", jobsLinkHref: "/locuri-de-munca", jobsScheduleLabel: "Program", jobsSalaryLabel: "Salariu", jobsDetailsLabel: "Detalii",
      finalVisible: true,
      finalKicker: "Pentru comunitatea locală", finalTitle: "Ai o informație utilă?", finalCopy: "Adaugă o afacere, ofertă, slujbă, poveste sau un eveniment. Fiecare trimitere este verificată înainte de publicare.", finalCtaLabel: "Alege ce vrei să adaugi", finalCtaHref: "/adauga",
    },
    fields: [
      visibility("heroVisible", "Introducere și imagine principală"),
      { path: "heroImage", label: "Imagine principală", kind: "image", required: false, group: "Introducere și imagine principală" }, optionalText("kicker", "Supratitlu", "short", 240, "Introducere și imagine principală"), optionalText("titleLine", "Prima linie a titlului", "short", 240, "Introducere și imagine principală"), optionalText("emphasizedTitleLine", "Linia evidențiată", "short", 240, "Introducere și imagine principală"), optionalText("intro", "Introducere", "multiline", 1200, "Introducere și imagine principală"), optionalText("heroTrust", "Notă despre verificare", "short", 240, "Introducere și imagine principală"), optionalText("primaryCtaLabel", "Acțiune principală", "short", 240, "Introducere și imagine principală"), optionalText("primaryCtaHref", "Link acțiune principală", "internal-link", 300, "Introducere și imagine principală"), optionalText("secondaryCtaLabel", "Acțiune secundară", "short", 240, "Introducere și imagine principală"), optionalText("secondaryCtaHref", "Link acțiune secundară", "internal-link", 300, "Introducere și imagine principală"),
      visibility("searchVisible", "Căutare în pagina principală"), optionalText("searchLabel", "Etichetă accesibilă", "short", 240, "Căutare în pagina principală"), optionalText("searchPlaceholder", "Text orientativ", "short", 240, "Căutare în pagina principală"), optionalText("searchButton", "Text buton", "short", 240, "Căutare în pagina principală"),
      visibility("quickCategoriesVisible", "Categorii rapide"), optionalText("quickCategoriesLabel", "Etichetă accesibilă", "short", 240, "Categorii rapide"),
      { path: "quickCategories", label: "Categorii", kind: "repeatable", group: "Categorii rapide", itemFields: [...repeatableState, optionalText("label", "Etichetă", "short", 100), optionalText("href", "Link intern", "internal-link", 300), optionalText("icon", "Pictogramă", "enum", 30)], options: ["calendar", "restaurant", "services", "offers", "jobs", "children"] },
      visibility("eventsVisible", "Evenimente"), optionalText("eventsEyebrow", "Supratitlu", "short", 240, "Evenimente"), optionalText("eventsTitle", "Titlu", "short", 240, "Evenimente"), optionalText("eventsLinkLabel", "Etichetă acțiune", "short", 240, "Evenimente"), optionalText("eventsLinkHref", "Link acțiune", "internal-link", 300, "Evenimente"), optionalText("eventsFiltersLabel", "Etichetă accesibilă filtre", "short", 240, "Evenimente"), optionalText("eventsDetailsLabel", "Etichetă detalii", "short", 100, "Evenimente"), optionalText("eventsEmptyTitle", "Titlu stare goală", "short", 500, "Evenimente"), optionalText("eventsEmptyDescription", "Descriere stare goală", "multiline", 600, "Evenimente"), optionalText("eventsEmptyActionLabel", "Acțiune contribuție", "short", 160, "Evenimente"), optionalText("eventsEmptyActionHref", "Link contribuție", "internal-link", 300, "Evenimente"),
      { path: "eventFilters", label: "Filtre evenimente", kind: "repeatable", group: "Evenimente", itemFields: [...repeatableState, optionalText("value", "Etichetă", "short", 100)] },
      visibility("discoverVisible", "Editorial Descoperă Blaj"), optionalText("discoverEyebrow", "Supratitlu secțiune", "short", 240, "Editorial Descoperă Blaj"), optionalText("discoverTitle", "Titlu secțiune", "short", 240, "Editorial Descoperă Blaj"), optionalText("discoverLinkLabel", "Etichetă acțiune secțiune", "short", 240, "Editorial Descoperă Blaj"), optionalText("discoverLinkHref", "Link acțiune secțiune", "internal-link", 300, "Editorial Descoperă Blaj"), { path: "editorialImage", label: "Imagine editorială", kind: "image", required: false, group: "Editorial Descoperă Blaj" }, optionalText("editorialKicker", "Supratitlu editorial", "short", 240, "Editorial Descoperă Blaj"), optionalText("editorialTitle", "Titlu editorial", "short", 240, "Editorial Descoperă Blaj"), optionalText("editorialCopy", "Text editorial", "multiline", 1200, "Editorial Descoperă Blaj"), optionalText("editorialCtaLabel", "Acțiune editorială", "short", 240, "Editorial Descoperă Blaj"), optionalText("editorialCtaHref", "Link editorial", "internal-link", 300, "Editorial Descoperă Blaj"), optionalText("discoverMediaLabel", "Etichetă legătură imagini", "short", 240, "Editorial Descoperă Blaj"), optionalText("discoverMediaHref", "Link imagini", "internal-link", 300, "Editorial Descoperă Blaj"),
      visibility("servicesVisible", "Servicii"), optionalText("servicesEyebrow", "Supratitlu", "short", 240, "Servicii"), optionalText("servicesTitle", "Titlu", "short", 240, "Servicii"), optionalText("servicesLinkLabel", "Etichetă acțiune", "short", 240, "Servicii"), optionalText("servicesLinkHref", "Link acțiune", "internal-link", 300, "Servicii"), optionalText("servicesProfileLabel", "Etichetă profil", "short", 100, "Servicii"),
      visibility("offersVisible", "Oferte"), optionalText("offersEyebrow", "Supratitlu", "short", 240, "Oferte"), optionalText("offersTitle", "Titlu", "short", 240, "Oferte"), optionalText("offersLinkLabel", "Etichetă acțiune", "short", 240, "Oferte"), optionalText("offersLinkHref", "Link acțiune", "internal-link", 300, "Oferte"), optionalText("offersConditionsLabel", "Etichetă condiții", "short", 100, "Oferte"), optionalText("offersUntilLabel", "Etichetă valabilitate", "short", 100, "Oferte"),
      visibility("restaurantsVisible", "Restaurante"), optionalText("restaurantsEyebrow", "Supratitlu", "short", 240, "Restaurante"), optionalText("restaurantsTitle", "Titlu", "short", 240, "Restaurante"), optionalText("restaurantsLinkLabel", "Etichetă acțiune", "short", 240, "Restaurante"), optionalText("restaurantsLinkHref", "Link acțiune", "internal-link", 300, "Restaurante"), optionalText("restaurantsFiltersLabel", "Etichetă accesibilă filtre", "short", 240, "Restaurante"), optionalText("restaurantsDetailsLabel", "Etichetă detalii", "short", 100, "Restaurante"), { path: "restaurantFilters", label: "Filtre restaurante", kind: "repeatable", group: "Restaurante", itemFields: [...repeatableState, optionalText("value", "Etichetă", "short", 100)] },
      visibility("jobsVisible", "Locuri de muncă"), optionalText("jobsEyebrow", "Supratitlu", "short", 240, "Locuri de muncă"), optionalText("jobsTitle", "Titlu", "short", 240, "Locuri de muncă"), optionalText("jobsLinkLabel", "Etichetă acțiune", "short", 240, "Locuri de muncă"), optionalText("jobsLinkHref", "Link acțiune", "internal-link", 300, "Locuri de muncă"), optionalText("jobsScheduleLabel", "Etichetă program", "short", 100, "Locuri de muncă"), optionalText("jobsSalaryLabel", "Etichetă salariu", "short", 100, "Locuri de muncă"), optionalText("jobsDetailsLabel", "Etichetă detalii", "short", 100, "Locuri de muncă"),
      visibility("finalVisible", "Încheiere"), optionalText("finalKicker", "Supratitlu", "short", 240, "Încheiere"), optionalText("finalTitle", "Titlu", "short", 240, "Încheiere"), optionalText("finalCopy", "Text", "multiline", 1200, "Încheiere"), optionalText("finalCtaLabel", "Acțiune", "short", 240, "Încheiere"), optionalText("finalCtaHref", "Link", "internal-link", 300, "Încheiere"),
    ],
  },
  {
    key: "discover", scope: "page", route: "/descopera-blaj", label: "Descoperă Blaj", group: "Descoperă Blaj", schemaVersion: 1,
    defaults: { heroImage: image("/images/catedrala-blaj.jpg", "Catedrala Sfânta Treime din Blaj", "Țetcu Mircea Rareș", "https://commons.wikimedia.org/", "CC BY-SA 4.0"), kicker: "Istorie · cultură · oameni", title: "Descoperă Blajul", intro: "Repere locale prezentate cu sursa și atribuirea la vedere.", lead: "Blajul poate fi explorat prin locuri, arhive și surse publice verificate.", supportingCopy: "Programul, accesul și detaliile dependente de timp apar numai după confirmare.", sourceLabel: "Sursă: Municipiul Blaj", sourceUrl: "https://municipiulblaj.ro/comunitate/obiective-locale", sectionEyebrow: "Locuri și repere", sectionTitle: "Puncte de pornire", emptyTitle: "Pregătim arhiva locală", emptyCopy: "Publicăm repere numai după verificarea sursei și a drepturilor media.", galleryEyebrow: "Blaj în imagini", galleryTitle: "Orașul, privit cu atenție", contributionKicker: "Arhiva comunității", contributionTitle: "Ai fotografii sau povești despre Blaj?", contributionCopy: "Trimite o amintire sau o corectură. Nimic nu este publicat înainte de verificare.", contributionLabel: "Contribuie la arhivă", contributionHref: "/contribuie" },
    fields: [
      { path: "heroImage", label: "Imagine principală", kind: "image", required: false },
      optionalText("kicker", "Supratitlu"), optionalText("title", "Titlu"), optionalText("intro", "Introducere", "multiline", 1000),
      optionalText("lead", "Text introductiv", "multiline", 1200), optionalText("supportingCopy", "Text secundar", "multiline", 1200), optionalText("sourceLabel", "Etichetă sursă"), optionalText("sourceUrl", "Sursă", "external-url", 800),
      optionalText("sectionEyebrow", "Secțiune — supratitlu"), optionalText("sectionTitle", "Secțiune — titlu"), optionalText("emptyTitle", "Stare goală — titlu"), optionalText("emptyCopy", "Stare goală — text", "multiline", 800),
      optionalText("galleryEyebrow", "Galerie — supratitlu"), optionalText("galleryTitle", "Galerie — titlu"),
      optionalText("contributionKicker", "Contribuție — supratitlu"), optionalText("contributionTitle", "Contribuție — titlu"), optionalText("contributionCopy", "Contribuție — text", "multiline", 1000), optionalText("contributionLabel", "Contribuție — acțiune"), optionalText("contributionHref", "Contribuție — link", "internal-link", 300),
    ],
  },
  listing("listing.events", "/evenimente", "Evenimente", "Calendar local", "Evenimente în Blaj", "Activități actuale, ordonate după data de început și verificate înainte de publicare.", "Nu există încă evenimente publice care corespund filtrelor.", "Propune un eveniment", "/adauga-un-eveniment"),
  listing("listing.businesses", "/afaceri-si-servicii", "Afaceri și servicii", "Director local", "Afaceri și servicii", "Găsește servicii locale și vezi clar când au fost verificate.", "Nu există încă listări publice care corespund filtrelor.", "Adaugă o afacere", "/adauga-o-afacere"),
  listing("listing.offers", "/oferte-locale", "Oferte locale", "Economisește local", "Oferte în Blaj", "Doar oferte active, cu perioadă și condiții publicate clar.", "Nu există oferte active care corespund filtrelor.", "Propune o ofertă", "/adauga-o-oferta"),
  listing("listing.restaurants", "/unde-mancam", "Unde mâncăm", "Bun, aproape", "Unde mâncăm", "Localuri și meniuri actualizate, cu servicii și surse la vedere.", "Nu există încă localuri publice care corespund filtrelor.", "Adaugă un local", "/adauga-o-afacere"),
  listing("listing.jobs", "/locuri-de-munca", "Locuri de muncă", "Oportunități", "Locuri de muncă în apropiere", "Posturi active, cu termen, program și modalitate de aplicare.", "Nu există joburi active care corespund filtrelor.", "Publică un job", "/adauga-un-job"),
  listing("listing.useful", "/informatii-utile", "Informații utile", "De păstrat la îndemână", "Informații utile", "Legături practice către instituțiile responsabile. Confirmă informațiile dependente de timp la sursă.", "Nu există informații în această grupă.", "Semnalează o informație", "/contact"),
  listing("listing.stories", "/povesti-locale", "Povești locale", "Vocea comunității", "Povești și actualizări locale", "Materiale cu autor, sursă și drepturi verificate înainte de publicare.", "Arhiva nu are încă materiale publice. Poți contribui cu o poveste sau fotografie verificabilă.", "Contribuie la arhivă", "/contribuie"),
  informativePage("page.about", "/despre", "Despre", "Despre Blaj Azi", "Un ghid local independent, construit pentru informație ușor de găsit și verificat.", ["Punem utilitatea înaintea zgomotului.", "Conținutul neverificat, editorial și promovat este diferențiat vizibil.", "Corectăm informația când comunitatea semnalează o problemă."]),
  informativePage("page.privacy", "/confidentialitate", "Confidențialitate", "Politica de confidențialitate", "Această pagină trebuie completată cu datele operatorului și revizuită juridic înainte de lansarea completă.", ["De completat: identitatea și contactul operatorului.", "De completat: scopuri, temeiuri, retenție și destinatari.", "De completat: drepturile persoanelor și procedura de exercitare."]),
  informativePage("page.cookies", "/cookie-uri", "Cookie-uri", "Politica privind cookie-urile", "Elementele tehnice necesare funcționării trebuie documentate de operator.", ["Nu activa instrumente opționale înainte de consimțământ.", "Documentează durata, furnizorul și scopul fiecărui cookie.", "Oferă retragerea consimțământului la fel de ușor ca acordarea."]),
  informativePage("page.terms", "/termeni", "Termeni", "Termeni și condiții", "Condițiile finale depind de datele operatorului și necesită revizuire juridică.", ["Trimiterile utilizatorilor sunt moderate înainte de publicare.", "Conținutul plătit este etichetat clar.", "Materialele media trebuie să păstreze sursa, autorul și licența."]),
  { key: "page.contact", scope: "page", route: "/contact", label: "Contact", group: "Pagini informative", schemaVersion: 1, defaults: { eyebrow: "Trimite spre verificare", title: "Scrie-ne", intro: "Raportează o problemă sau trimite o propunere verificabilă." }, fields: [text("eyebrow", "Supratitlu"), text("title", "Titlu"), text("intro", "Introducere", "multiline", 1200)] },
  { key: "page.promotion", scope: "page", route: "/promovare", label: "Promovare", group: "Pagini informative", schemaVersion: 1, defaults: { eyebrow: "Promovare transparentă", title: "Pachetele de promovare nu sunt încă active", intro: "Nu afișăm prețuri sau opțiuni de plată până când durata, poziționarea și regulile sunt aprobate de operator.", noticeTitle: "Vrei să fii anunțat când serviciul este disponibil?", noticeCopy: "Trimite un mesaj general. Orice material promovat va fi etichetat vizibil.", ctaLabel: "Contactează echipa", ctaHref: "/contact" }, fields: [text("eyebrow", "Supratitlu"), text("title", "Titlu"), text("intro", "Introducere", "multiline", 1200), text("noticeTitle", "Mesaj — titlu"), text("noticeCopy", "Mesaj — text", "multiline", 1000), text("ctaLabel", "Acțiune"), text("ctaHref", "Link", "internal-link", 300)] },
  { key: "forms.hub", scope: "page", route: "/adauga", label: "Centru contribuții", group: "Formulare și contribuții", schemaVersion: 1, defaults: { eyebrow: "Contribuie", title: "Ce vrei să adaugi?", intro: "Alege tipul potrivit. Fiecare trimitere este verificată înainte de publicare.", cards: [{ label: "Afacere", href: "/adauga-o-afacere", description: "Profil local și servicii" }, { label: "Eveniment", href: "/adauga-un-eveniment", description: "Dată, loc și organizator" }, { label: "Ofertă", href: "/adauga-o-oferta", description: "Perioadă, preț și condiții" }, { label: "Loc de muncă", href: "/adauga-un-job", description: "Rol, program și aplicare" }, { label: "Poveste sau fotografie", href: "/contribuie", description: "Autor, sursă și drepturi" }, { label: "Corectură", href: "/contact", description: "Semnalează o informație" }] }, fields: [text("eyebrow", "Supratitlu"), text("title", "Titlu"), text("intro", "Introducere", "multiline", 1200), { path: "cards", label: "Opțiuni", kind: "repeatable", itemFields: [...linkFields, optionalText("description", "Descriere", "multiline", 500)] }] },
  { key: "forms.submissions", scope: "page", route: "/adauga", label: "Formulare de contribuție", group: "Formulare și contribuții", schemaVersion: 1, defaults: { eyebrow: "Trimite spre verificare", guidanceTitle: "Date clare", guidanceCopy: "Include informația de care cineva are nevoie ca să ia o decizie.", rightsTitle: "Sursă și drepturi", rightsCopy: "Nu trimite date personale inutile sau media fără permisiune.", moderationTitle: "Verificare", moderationCopy: "Un administrator poate cere modificări înainte de publicare.", consentCopy: "Sunt de acord cu prelucrarea datelor pentru verificarea trimiterii.", successTitle: "Mulțumim. Informația a intrat în verificare.", successCopy: "Nu va fi publicată automat. Păstrează referința pentru o discuție ulterioară.", types: [{ kind: "business", title: "Adaugă o afacere", intro: "Completează profilul local. Datele sunt verificate înainte de publicare." }, { kind: "event", title: "Adaugă un eveniment", intro: "Include data, locul, organizatorul și sursa oficială." }, { kind: "offer", title: "Publică o ofertă", intro: "Precizează perioada, prețul și toate condițiile." }, { kind: "job", title: "Publică un loc de muncă", intro: "Ajută candidații să înțeleagă rolul și modalitatea de aplicare." }, { kind: "contribution", title: "Contribuie la arhiva Blajului", intro: "Trimite o fotografie sau poveste cu sursă, autor și drepturi." }, { kind: "contact", title: "Scrie-ne", intro: "Raportează o problemă sau trimite o propunere verificabilă." }] }, fields: [text("eyebrow", "Supratitlu"), optionalText("guidanceTitle", "Ghid 1 — titlu"), optionalText("guidanceCopy", "Ghid 1 — text", "multiline", 800), optionalText("rightsTitle", "Ghid 2 — titlu"), optionalText("rightsCopy", "Ghid 2 — text", "multiline", 800), optionalText("moderationTitle", "Ghid 3 — titlu"), optionalText("moderationCopy", "Ghid 3 — text", "multiline", 800), text("consentCopy", "Explicație consimțământ", "multiline", 800), text("successTitle", "Succes — titlu"), text("successCopy", "Succes — text", "multiline", 1000), { path: "types", label: "Introduceri pe formular", kind: "repeatable", itemFields: [text("kind", "Tip", "enum", 40), text("title", "Titlu"), text("intro", "Introducere", "multiline", 1000)], options: ["business", "event", "offer", "job", "contribution", "contact"] }] },
  { key: "global.header", scope: "global", route: "*", label: "Navigație", group: "Navigație și subsol", schemaVersion: 1, defaults: { homeLabel: "Blaj Azi — Acasă", addLabel: "Adaugă", registerLabel: "Înregistrare", loginLabel: "Conectează-te", accountLabel: "Contul meu", adminLabel: "Administrare", menuLabel: "Deschide meniul", navigation: [{ label: "Descoperă Blaj", href: "/descopera-blaj" }, { label: "Evenimente", href: "/evenimente" }, { label: "Servicii", href: "/afaceri-si-servicii" }, { label: "Oferte", href: "/oferte-locale" }, { label: "Unde mâncăm", href: "/unde-mancam" }, { label: "Joburi", href: "/locuri-de-munca" }, { label: "Povești", href: "/povesti-locale" }], mobileSupplemental: [{ label: "Informații utile", href: "/informatii-utile" }, { label: "Despre", href: "/despre" }] }, fields: [text("homeLabel", "Etichetă Acasă"), text("addLabel", "Acțiune Adaugă"), text("registerLabel", "Înregistrare"), text("loginLabel", "Conectare"), text("accountLabel", "Cont"), text("adminLabel", "Administrare"), text("menuLabel", "Etichetă meniu"), { path: "navigation", label: "Navigație principală", kind: "repeatable", itemFields: linkFields }, { path: "mobileSupplemental", label: "Linkuri suplimentare mobile", kind: "repeatable", itemFields: linkFields }] },
  { key: "global.footer", scope: "global", route: "*", label: "Subsol", group: "Navigație și subsol", schemaVersion: 1, defaults: { intro: "Ghid local independent pentru Blaj și comunitățile din apropiere. Publicăm informații reale după verificare.", columns: [{ heading: "Explorează", links: [{ label: "Descoperă Blaj", href: "/descopera-blaj" }, { label: "Evenimente", href: "/evenimente" }, { label: "Afaceri și servicii", href: "/afaceri-si-servicii" }, { label: "Informații utile", href: "/informatii-utile" }] }, { heading: "Pentru comunitate", links: [{ label: "Adaugă informație", href: "/adauga" }, { label: "Adaugă un eveniment", href: "/adauga-un-eveniment" }, { label: "Trimite o fotografie sau poveste", href: "/contribuie" }, { label: "Raportează o informație", href: "/contact" }] }, { heading: "Despre", links: [{ label: "Despre proiect", href: "/despre" }, { label: "Promovare", href: "/promovare" }, { label: "Confidențialitate", href: "/confidentialitate" }, { label: "Cookie-uri", href: "/cookie-uri" }, { label: "Termeni", href: "/termeni" }] }], copyrightTemplate: "© {year} Blaj Azi", closing: "Făcut cu grijă pentru comunitatea din Blaj." }, fields: [text("intro", "Introducere", "multiline", 1200), { path: "columns", label: "Coloane", kind: "repeatable", itemFields: [text("heading", "Titlu coloană"), { path: "links", label: "Linkuri", kind: "repeatable", itemFields: linkFields }] }, text("copyrightTemplate", "Drepturi — folosește {year}"), text("closing", "Mesaj final")] },
  { key: "global.search", scope: "global", route: "/cauta", label: "Căutare", group: "Căutare", schemaVersion: 1, defaults: { overlayEyebrow: "Caută în ghidul local", title: "Ce cauți în Blaj?", intro: "Caută cu sau fără diacritice în titlu, categorie, localitate, rezumat și etichete aprobate.", placeholder: "restaurant, electrician, eveniment…", buttonLabel: "Caută", quickLabel: "Căutări rapide:", quickLinks: [{ label: "meniul zilei", href: "/unde-mancam" }, { label: "weekend", href: "/evenimente?period=weekend" }, { label: "joburi", href: "/locuri-de-munca" }], emptyTitle: "Nu am găsit rezultate.", emptyCopy: "Încearcă un termen mai general sau contribuie cu o informație verificabilă.", clearLabel: "Șterge căutarea" }, fields: [text("overlayEyebrow", "Supratitlu fereastră"), text("title", "Titlu"), text("intro", "Introducere", "multiline", 1200), text("placeholder", "Text orientativ"), text("buttonLabel", "Buton"), text("quickLabel", "Etichetă sugestii"), { path: "quickLinks", label: "Căutări rapide", kind: "repeatable", itemFields: linkFields }, text("emptyTitle", "Stare goală — titlu"), text("emptyCopy", "Stare goală — text", "multiline", 800), text("clearLabel", "Șterge căutarea")] },
  { key: "global.detail", scope: "global", route: "*", label: "Pagini de detaliu", group: "Pagini de listare", schemaVersion: 1, defaults: { backLabel: "Înapoi la listă", detailsTitle: "Detalii utile", storyTitle: "Povestea", actionsTitle: "Acțiuni rapide", sourceLabel: "Vezi sursa", shareLabel: "Distribuie", reportLabel: "Raportează o informație", editLabel: "Editează", adminLabel: "Deschide în administrare" }, fields: [text("backLabel", "Înapoi la listă"), text("detailsTitle", "Detalii utile"), text("storyTitle", "Titlu poveste"), text("actionsTitle", "Acțiuni rapide"), text("sourceLabel", "Sursă"), text("shareLabel", "Distribuire"), text("reportLabel", "Raportare"), text("editLabel", "Editare"), text("adminLabel", "Administrare")] },
  { key: "auth.login", scope: "auth", route: "/conectare", label: "Conectare", group: "Autentificare", schemaVersion: 1, defaults: { eyebrow: "Contul tău", title: "Bine ai revenit", intro: "Conectează-te pentru a administra materialele și afacerile tale.", benefits: ["Sesiune protejată pe server", "Datele tale nu sunt publicate automat", "Contribuțiile rămân moderate înainte de publicare"] }, fields: [text("eyebrow", "Supratitlu"), text("title", "Titlu"), text("intro", "Introducere", "multiline", 1000), { path: "benefits", label: "Beneficii", kind: "repeatable", itemFields: [text("value", "Text")] }] },
  { key: "auth.register", scope: "auth", route: "/inregistrare", label: "Înregistrare", group: "Autentificare", schemaVersion: 1, defaults: { eyebrow: "Cont Blaj Azi", title: "Creează un cont Blaj Azi", intro: "Păstrează-ți ciornele, urmărește moderarea și administrează afacerile autorizate.", benefits: ["Ciorne private și editabile", "Istoric clar al moderării", "Administrare de afacere pe bază de drepturi"] }, fields: [text("eyebrow", "Supratitlu"), text("title", "Titlu"), text("intro", "Introducere", "multiline", 1000), { path: "benefits", label: "Beneficii", kind: "repeatable", itemFields: [text("value", "Text")] }] },
  { key: "seo.defaults", scope: "seo", route: "*", label: "SEO și distribuire", group: "SEO și distribuire", schemaVersion: 1, defaults: { defaultTitle: "Blaj Azi — Ghidul local al Blajului", titleTemplate: "%s | Blaj Azi", description: "Evenimente, servicii, restaurante, oferte, joburi și locuri de descoperit în Blaj și împrejurimi.", openGraphTitle: "Blaj Azi", openGraphDescription: "Tot ce contează în Blaj, într-un singur loc.", openGraphImage: image("/og.png", "Blaj Azi — ghidul comunității locale", "", "", "Material propriu"), twitterCard: "summary_large_image", pages: [] }, fields: [text("defaultTitle", "Titlu implicit", "short", 180), text("titleTemplate", "Șablon titlu", "short", 180), text("description", "Descriere implicită", "multiline", 500), text("openGraphTitle", "Titlu Open Graph", "short", 180), text("openGraphDescription", "Descriere Open Graph", "multiline", 500), { path: "openGraphImage", label: "Imagine socială", kind: "image", required: true }, { path: "twitterCard", label: "Card X/Twitter", kind: "enum", options: ["summary", "summary_large_image"], required: true }, { path: "pages", label: "SEO pe pagină", kind: "repeatable", itemFields: [text("route", "Rută", "internal-link", 300), text("title", "Titlu", "short", 180), text("description", "Descriere", "multiline", 500), text("canonicalPath", "Cale canonică", "internal-link", 300), { path: "socialImage", label: "Imagine socială", kind: "image" }] }] },
];

export const siteContentByKey = new Map(siteContentDefinitions.map(definition => [definition.key, definition]));

export function defaultSiteContent(key: string): Record<string, unknown> {
  const definition = siteContentByKey.get(key);
  if (!definition) throw new Error(`Cheie CMS necunoscută: ${key}`);
  return structuredClone(definition.defaults);
}

export function safeInternalHref(value: string): string | null {
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
  try {
    const parsed = new URL(value, "https://blaj-azi.local");
    return parsed.origin === "https://blaj-azi.local" ? `${parsed.pathname}${parsed.search}${parsed.hash}` : null;
  } catch { return null; }
}

export function safeExternalHref(value: string): string | null {
  try { const parsed = new URL(value); return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : null; }
  catch { return null; }
}

export function resolveCmsImage(value: unknown): CmsImage {
  const input = value && typeof value === "object" ? value as Partial<CmsImage> : {};
  return {
    src: typeof input.src === "string" ? input.src : "", mediaId: Number.isInteger(input.mediaId) && Number(input.mediaId) > 0 ? Number(input.mediaId) : null,
    alt: typeof input.alt === "string" ? input.alt : "", decorative: input.decorative === true, caption: typeof input.caption === "string" ? input.caption : "",
    author: typeof input.author === "string" ? input.author : "", sourceUrl: typeof input.sourceUrl === "string" ? input.sourceUrl : "", license: typeof input.license === "string" ? input.license : "",
    objectPosition: ["center", "top", "bottom", "left", "right"].includes(String(input.objectPosition)) ? input.objectPosition as CmsImage["objectPosition"] : "center", showCredit: input.showCredit !== false,
  };
}

export function cmsImageUrl(value: unknown): string {
  const imageValue = resolveCmsImage(value);
  return imageValue.mediaId ? `/api/media/${imageValue.mediaId}` : imageValue.src;
}

export function validateSiteContent(key: string, raw: unknown): Record<string, unknown> {
  const definition = siteContentByKey.get(key);
  if (!definition) throw new Error("Cheie CMS necunoscută.");
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Conținutul trebuie să fie un obiect valid.");
  const validated = validateFields(definition.fields, raw as Record<string, unknown>, "");
  return key === "theme.site" ? normalizeTheme(validated) : validated;
}

function validateFields(fields: readonly CmsField[], raw: Record<string, unknown>, prefix: string): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const field of fields) {
    const value = raw[field.path];
    const label = prefix ? `${prefix} — ${field.label}` : field.label;
    if (field.kind === "toggle" || field.kind === "section-visibility" || field.kind === "deletion-marker") {
      output[field.path] = value === undefined ? field.defaultValue === true : value === true;
      continue;
    }
    if (field.kind === "repeatable") {
      if (!Array.isArray(value)) throw new Error(`${label}: lista nu este validă.`);
      if (value.length > 40) throw new Error(`${label}: sunt permise maximum 40 de elemente.`);
      output[field.path] = value.map((item, index) => {
        const normalized = typeof item === "string" ? { value: item } : item;
        if (!normalized || typeof normalized !== "object" || Array.isArray(normalized)) throw new Error(`${label}: element invalid.`);
        const validated = validateFields(field.itemFields || [], normalized as Record<string, unknown>, `${label} ${index + 1}`);
        return typeof item === "string" && field.itemFields?.length === 1 && field.itemFields[0].path === "value" ? String(validated.value ?? "") : validated;
      });
      continue;
    }
    if (field.kind === "richtext") {
      if (!Array.isArray(value) || value.length > 120) throw new Error(`${label}: structura textului nu este validă.`);
      output[field.path] = value.map((block, index) => validateRichTextBlock(block, `${label} ${index + 1}`));
      continue;
    }
    if (field.kind === "image") { output[field.path] = validateImage(value, label, field.required); continue; }
    const stringValue = typeof value === "string" ? value.trim() : typeof field.defaultValue === "string" ? field.defaultValue : "";
    if (field.required && !stringValue) throw new Error(`${label}: câmp obligatoriu.`);
    if (stringValue.length > (field.maxLength || 240)) throw new Error(`${label}: textul este prea lung.`);
    if (/[<>]/.test(stringValue)) throw new Error(`${label}: HTML-ul nu este permis.`);
    if (field.kind === "internal-link" && stringValue && !safeInternalHref(stringValue)) throw new Error(`${label}: linkul intern nu este sigur.`);
    if (field.kind === "external-url" && stringValue && !safeExternalHref(stringValue)) throw new Error(`${label}: adresa trebuie să folosească HTTP sau HTTPS.`);
    if ((field.kind === "enum" || field.kind === "font") && stringValue && field.options && !field.options.includes(stringValue)) throw new Error(`${label}: valoare neacceptată.`);
    if (field.kind === "color" && !/^#[0-9a-f]{6}$/i.test(stringValue)) throw new Error(`${label}: folosește o culoare HEX completă.`);
    output[field.path] = stringValue;
  }
  return output;
}

function validateImage(raw: unknown, label: string, required = false): CmsImage {
  const value = resolveCmsImage(raw);
  if (!value.mediaId && value.src && !safeInternalHref(value.src)) throw new Error(`${label}: imaginea trebuie să fie din biblioteca media sau din fișierele locale ale site-ului.`);
  if (required && !value.mediaId && !value.src) throw new Error(`${label}: imagine obligatorie.`);
  for (const [name, textValue, max] of [["text alternativ", value.alt, 500], ["legendă", value.caption, 1000], ["autor", value.author, 240], ["licență", value.license, 240]] as const) {
    if (textValue.length > max || /[<>]/.test(textValue)) throw new Error(`${label}: ${name} invalid.`);
  }
  if (value.sourceUrl && !safeExternalHref(value.sourceUrl)) throw new Error(`${label}: sursa trebuie să folosească HTTP sau HTTPS.`);
  return value;
}

function validateRichTextBlock(raw: unknown, label: string): RichTextBlock {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error(`${label}: bloc invalid.`);
  const input = raw as Partial<RichTextBlock>;
  const allowed = ["paragraph", "heading2", "heading3", "bulleted-list", "numbered-list", "quote", "link"];
  if (!allowed.includes(String(input.type))) throw new Error(`${label}: tip de bloc neacceptat.`);
  const value = String(input.text || "").trim();
  if (!value || value.length > 8000 || /[<>]/.test(value)) throw new Error(`${label}: text invalid.`);
  if (input.type === "link") {
    const href = String(input.href || "").trim();
    if (!safeInternalHref(href) && !safeExternalHref(href)) throw new Error(`${label}: link nesigur.`);
    return { type: input.type, text: value, href };
  }
  return { type: input.type as RichTextBlock["type"], text: value };
}

export function mergeWithSiteDefaults(key: string, value: unknown): Record<string, unknown> {
  const defaults = defaultSiteContent(key);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Conținutul trebuie să fie un obiect valid.");
  return validateSiteContent(key, deepMerge(defaults, migrateKnownDefaults(key, value as Record<string, unknown>)));
}

function migrateKnownDefaults(key: string, value: Record<string, unknown>): Record<string, unknown> {
  if (key === "theme.site") {
    const legacy: Record<string, readonly string[]> = {
      canvas:["#faf8f4"],surface:["#ffffff"],primary:["#173f4b"],primaryDark:["#0f3039"],accent:["#b84b3b"],accentDark:["#99382d"],accentSoft:["#f3e3de"],highlight:["#e2b85b"],
      text:["#1e2426","#173f4b"],textMuted:["#5c666a","#52666c"],border:["#dfe3e2","#d8dfde"],focus:["#ffffff"],headerBackground:["#f6f0e4","#ffffff"],buttonText:["#ffffff"],
      headingFont:["source-serif-4"],interfaceFont:["inter"],
      homeHeroBackground:["#0f3039","#eaf1ee"],homeHeroText:["#ffffff","#14201e"],homeHeroMuted:["#e9f0f1","#52615e"],homeDarkSection:["#ffffff","#102622"],homeDarkSectionText:["#1e2426","#f8fbf9"],
      homeJobsBackground:["#e8f1f3","#eaf1ee"],homeCardBackground:["#ffffff"],homeAlternateBackground:["#e8f1f3","#eaf1ee"],homeCtaBackground:["#f3e3de","#102622"],homeCtaText:["#1e2426","#f8fbf9"],
    };
    return Object.fromEntries(Object.entries(value).map(([field, current]) => [field, legacy[field]?.includes(String(current)) ? defaultTheme[field as keyof typeof defaultTheme] : current]));
  }
  if (key !== "home") return value;
  const knownHeroDefaults: Record<string, readonly string[]> = {
    kicker:["Ghidul comunității din Blaj"],
    titleLine:["Tot ce contează în Blaj,","Tot ce contează,"],
    emphasizedTitleLine:["într-un singur loc."],
    intro:["Descoperă oameni, locuri și lucruri utile — aproape de tine, explicate simplu și actualizate responsabil."],
    heroTrust:["Informații publicate după verificare."],
  };
  const migrated = { ...value };
  for (const [field, known] of Object.entries(knownHeroDefaults)) {
    if (known.includes(String(value[field]))) migrated[field] = defaultSiteContent("home")[field];
  }
  return migrated;
}

function deepMerge(defaults: Record<string, unknown>, value: Record<string, unknown>): Record<string, unknown> {
  const output = { ...defaults };
  for (const [key, item] of Object.entries(value)) {
    output[key] = item && typeof item === "object" && !Array.isArray(item) && defaults[key] && typeof defaults[key] === "object" && !Array.isArray(defaults[key])
      ? deepMerge(defaults[key] as Record<string, unknown>, item as Record<string, unknown>) : item;
  }
  return output;
}

export function referencedMediaIds(value: unknown, found = new Set<number>()): Set<number> {
  if (Array.isArray(value)) for (const item of value) referencedMediaIds(item, found);
  else if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (Number.isInteger(record.mediaId) && Number(record.mediaId) > 0) found.add(Number(record.mediaId));
    for (const item of Object.values(record)) referencedMediaIds(item, found);
  }
  return found;
}
