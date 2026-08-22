"use client";

import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, CalendarDays, Check, ChevronRight, Clock3, MapPin, Search, Store, Tag, UtensilsCrossed } from "lucide-react";
import { useMemo, useState } from "react";
import type { PublicCatalog, PublicEvent, PublicRestaurant } from "../public-types";
import { cmsImageUrl, resolveCmsImage, safeInternalHref } from "../site-content";

type HomeCopy = Record<string, unknown>;
type RepeatableItem = { id?: string; value?: string; label?: string; href?: string; icon?: string; visible?: boolean; deleted?: boolean };
type Action = { href: string; label: string };

const icons = { calendar: CalendarDays, restaurant: UtensilsCrossed, services: Store, offers: Tag, jobs: BriefcaseBusiness, children: Check };
const value = (copy: HomeCopy, key: string) => String(copy[key] ?? "").trim();
const enabled = (copy: HomeCopy, key: string) => copy[key] !== false;
const items = (copy: HomeCopy, key: string) => (Array.isArray(copy[key]) ? copy[key] : []).map((item, index) => typeof item === "string" ? { id: `${key}-${index}`, value: item, visible: true, deleted: false } : item as RepeatableItem);
const visibleItems = (copy: HomeCopy, key: string) => items(copy, key).filter(item => item.visible !== false && item.deleted !== true);
const action = (copy: HomeCopy, labelKey: string, hrefKey: string): Action | null => {
  const label = value(copy, labelKey);
  const href = safeInternalHref(value(copy, hrefKey));
  return label && href ? { label, href } : null;
};

export function HomeExperience({ catalog, content }: { catalog: PublicCatalog; content: HomeCopy }) {
  const { businesses, events, jobs, offers, places, restaurants } = catalog;
  const eventFilters = visibleItems(content, "eventFilters").filter(item => String(item.value || "").trim());
  const foodFilters = visibleItems(content, "restaurantFilters").filter(item => String(item.value || "").trim());
  const [eventFilter, setEventFilter] = useState(() => filterId(eventFilters[0], "all"));
  const [foodFilter, setFoodFilter] = useState(() => filterId(foodFilters[0], "all"));
  const shownEvents = useMemo(() => events.filter(event => matchesEventFilter(event, eventFilters.find(item => filterId(item) === eventFilter))), [eventFilter, eventFilters, events]);
  const shownFood = useMemo(() => restaurants.filter(restaurant => matchesFoodFilter(restaurant, foodFilters.find(item => filterId(item) === foodFilter))), [foodFilter, foodFilters, restaurants]);
  const today = new Intl.DateTimeFormat("ro-RO", { day: "numeric", month: "long", year: "numeric" }).format(new Date());
  const hero = resolveCmsImage(content.heroImage);
  const heroHasImage = Boolean(hero.mediaId || hero.src);
  const editorial = resolveCmsImage(content.editorialImage);
  const editorialHasImage = Boolean(editorial.mediaId || editorial.src);
  const primaryAction = action(content, "primaryCtaLabel", "primaryCtaHref");
  const secondaryAction = action(content, "secondaryCtaLabel", "secondaryCtaHref");
  const searchVisible = enabled(content, "searchVisible") && Boolean(value(content, "searchLabel") && value(content, "searchButton"));
  const heroTitle = Boolean(value(content, "titleLine") || value(content, "emphasizedTitleLine"));
  const heroMeaningful = heroHasImage || heroTitle || Boolean(value(content, "kicker") || value(content, "intro") || searchVisible || primaryAction || secondaryAction);
  const quickCategories = visibleItems(content, "quickCategories").filter(item => String(item.label || "").trim() && safeInternalHref(String(item.href || "")));
  const eventsHead = sectionHead(content, "events");
  const discoverHead = sectionHead(content, "discover");
  const servicesHead = sectionHead(content, "services");
  const offersHead = sectionHead(content, "offers");
  const restaurantsHead = sectionHead(content, "restaurants");
  const jobsHead = sectionHead(content, "jobs");
  const emptyEventMeaningful = Boolean(value(content, "eventsEmptyTitle") || value(content, "eventsEmptyDescription"));
  const editorialAction = action(content, "editorialCtaLabel", "editorialCtaHref");
  const editorialText = Boolean(value(content, "editorialKicker") || value(content, "editorialTitle") || value(content, "editorialCopy") || editorialAction);
  const editorialMeaningful = editorialHasImage || editorialText;
  const discoverMediaAction = action(content, "discoverMediaLabel", "discoverMediaHref");
  const discoverMeaningful = Boolean(discoverHead || editorialMeaningful || places.length || discoverMediaAction);
  const finalAction = action(content, "finalCtaLabel", "finalCtaHref");
  const finalMeaningful = Boolean(value(content, "finalKicker") || value(content, "finalTitle") || value(content, "finalCopy") || finalAction);

  return <>
    {enabled(content, "heroVisible") && heroMeaningful && <section className={`hero ${heroHasImage ? "hero-with-image" : "hero-without-image"}`}>
      {heroHasImage && <><img className="hero-image" src={cmsImageUrl(hero)} alt={hero.decorative ? "" : hero.alt} style={{ objectPosition: hero.objectPosition }} width="1600" height="1067" fetchPriority="high" /><div className="hero-shade" /></>}
      <div className="hero-content">
        {value(content, "kicker") && <p className="kicker">{value(content, "kicker")}</p>}
        {heroTitle && <h1>{value(content, "titleLine") && <span>{value(content, "titleLine")}</span>}{value(content, "emphasizedTitleLine") && <em>{value(content, "emphasizedTitleLine")}</em>}</h1>}
        {value(content, "intro") && <p className="hero-copy">{value(content, "intro")}</p>}
        {searchVisible && <form className="hero-search" action="/cauta" method="get"><Search aria-hidden="true" /><label className="sr-only" htmlFor="hero-query">{value(content, "searchLabel")}</label><input id="hero-query" name="q" placeholder={value(content, "searchPlaceholder") || undefined} /><button type="submit">{value(content, "searchButton")}</button></form>}
        {(primaryAction || secondaryAction) && <div className="hero-actions">{primaryAction && <Link className="button" href={primaryAction.href}>{primaryAction.label} <ArrowRight size={18} /></Link>}{secondaryAction && <Link className="text-link light" href={secondaryAction.href}>{secondaryAction.label} <ChevronRight size={16} /></Link>}</div>}
        {heroHasImage && hero.showCredit && <ImageCredit image={hero} />}
      </div>
    </section>}

    {enabled(content, "quickCategoriesVisible") && quickCategories.length > 0 && <section className="category-strip" aria-label={value(content, "quickCategoriesLabel") || undefined}><div className="container category-grid">{quickCategories.map((item, index) => { const Icon = icons[item.icon as keyof typeof icons] || Check; return <Link href={String(item.href)} key={item.id || `${item.href}-${item.label}-${index}`}><Icon size={20} aria-hidden="true" /><span>{item.label}</span><ChevronRight size={16} aria-hidden="true" /></Link>; })}</div></section>}

    {enabled(content, "eventsVisible") && (eventsHead || events.length > 0 || emptyEventMeaningful) && <section className="section container home-section home-events">
      {eventsHead && <SectionHead {...eventsHead} />}
      {events.length > 0 && eventFilters.length > 0 && <div className="chips" role="group" aria-label={value(content, "eventsFiltersLabel") || undefined}>{eventFilters.map((filter, index) => { const id = filterId(filter, `event-${index}`); return <button type="button" aria-pressed={eventFilter === id} onClick={() => setEventFilter(id)} className={eventFilter === id ? "active" : ""} key={filter.id || `${filter.value}-${index}`}>{filter.value}</button>; })}</div>}
      {shownEvents.length > 0 && <div className="event-grid">{shownEvents.slice(0, 3).map((event, index) => <article className={`event-card ${index === 0 ? "event-featured" : ""}`} key={event.id}><div className="event-image"><img src={event.image} alt="" width="640" height="420" loading="lazy" />{event.isDemo && <span className="demo-badge">Conținut demonstrativ</span>}</div><div className="event-body"><div className="meta"><span>{event.category}</span><span>{event.price}</span></div><h3>{event.title}</h3><p><CalendarDays size={17} aria-hidden="true" /> {event.date}{event.time && ` · ${event.time}`}</p><p><MapPin size={17} aria-hidden="true" /> {event.place}</p>{value(content, "eventsDetailsLabel") && <Link className="card-link" href={`/evenimente/${event.id}`}>{value(content, "eventsDetailsLabel")} <ArrowRight size={16} /></Link>}</div></article>)}</div>}
      {shownEvents.length === 0 && emptyEventMeaningful && <div className="empty-state">{value(content, "eventsEmptyTitle") && <h3>{value(content, "eventsEmptyTitle")}</h3>}{value(content, "eventsEmptyDescription") && <p>{value(content, "eventsEmptyDescription")}</p>}</div>}
    </section>}

    {enabled(content, "discoverVisible") && discoverMeaningful && <section className="discover-section"><div className="container">
      {discoverHead && <SectionHead {...discoverHead} light />}
      {(editorialMeaningful || places.length > 0) && <div className={`editorial-grid ${!editorialMeaningful ? "editorial-grid-list-only" : ""}`}>
        {editorialMeaningful && <article className={`story-main ${editorialHasImage ? "story-main-with-image" : "story-main-no-image"}`}>{editorialHasImage && <img src={cmsImageUrl(editorial)} alt={editorial.decorative ? "" : editorial.alt} style={{ objectPosition: editorial.objectPosition }} width="900" height="600" loading="lazy" />}{editorialText && <div>{value(content, "editorialKicker") && <p className="kicker">{value(content, "editorialKicker")}</p>}{value(content, "editorialTitle") && <h3>{value(content, "editorialTitle")}</h3>}{value(content, "editorialCopy") && <p>{value(content, "editorialCopy")}</p>}{editorialAction && <Link className="button button-cream" href={editorialAction.href}>{editorialAction.label}</Link>}{editorialHasImage && editorial.showCredit && <ImageCredit image={editorial} />}</div>}</article>}
        {places.length > 0 && <div className="story-list">{places.slice(0, 3).map(place => <Link href={`/descopera-blaj/${place.id}`} className="story-row" key={place.id}><img src={place.image} alt="" width="232" height="176" loading="lazy" /><span>{place.eyebrow && <small>{place.eyebrow}</small>}<strong>{place.title}</strong></span><ArrowRight aria-hidden="true" /></Link>)}</div>}
      </div>}
      {discoverMediaAction && <div className="media-links"><Link href={discoverMediaAction.href}>{discoverMediaAction.label} <ArrowRight aria-hidden="true" /></Link></div>}
    </div></section>}

    {enabled(content, "servicesVisible") && businesses.length > 0 && <section className="section container home-section">{servicesHead && <SectionHead {...servicesHead} />}<div className="business-grid">{businesses.slice(0, 4).map(business => <article className="business-card" key={business.id}>{business.promoted && <span className="promoted">Promovat</span>}<div className="business-mark" aria-hidden="true">{business.name.charAt(0)}</div>{business.category && <p className="eyebrow">{business.category}</p>}<h3>{business.name}</h3>{business.locality && <p><MapPin size={16} aria-hidden="true" /> {business.locality}</p>}{business.isDemo && <span className="demo-line">Exemplu demonstrativ</span>}{value(content, "servicesProfileLabel") && <div className="card-actions"><Link href={`/afaceri-si-servicii/${business.id}`}>{value(content, "servicesProfileLabel")} <ArrowRight size={17} /></Link></div>}</article>)}</div></section>}

    {enabled(content, "offersVisible") && offers.length > 0 && <section className="section offer-section home-section"><div className="container">{offersHead && <SectionHead {...offersHead} />}<div className="offer-grid">{offers.slice(0, 3).map((offer, index) => <article className="offer-card" key={offer.id}><span className="offer-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>{offer.isDemo && <p className="demo-line">Exemplu demonstrativ</p>}<h3>{offer.title}</h3>{offer.business && <p>{offer.business}</p>}<div className="price">{offer.old && <del>{offer.old}</del>}<strong>{offer.price}</strong></div>{value(content, "offersUntilLabel") && offer.until && <p className="offer-until"><Clock3 size={16} aria-hidden="true" /> {value(content, "offersUntilLabel")} {offer.until}</p>}{value(content, "offersConditionsLabel") && <Link href={`/oferte-locale/${offer.id}`}>{value(content, "offersConditionsLabel")} <ArrowRight size={16} /></Link>}</article>)}</div></div></section>}

    {enabled(content, "restaurantsVisible") && restaurants.length > 0 && <section className="section container home-section">{restaurantsHead && <SectionHead {...restaurantsHead} eyebrow={restaurantsHead.eyebrow ? `${restaurantsHead.eyebrow}, ${today}` : ""} />}{foodFilters.length > 0 && <div className="chips" role="group" aria-label={value(content, "restaurantsFiltersLabel") || undefined}>{foodFilters.map((filter, index) => { const id = filterId(filter, `food-${index}`); return <button type="button" aria-pressed={foodFilter === id} onClick={() => setFoodFilter(id)} className={foodFilter === id ? "active" : ""} key={filter.id || `${filter.value}-${index}`}>{filter.value}</button>; })}</div>}<div className="food-list">{shownFood.slice(0, 5).map((restaurant, index) => <article className="food-card" key={restaurant.id}><div className="food-index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</div><div>{restaurant.type && <p className="eyebrow">{restaurant.type}{restaurant.isDemo ? " · Exemplu demonstrativ" : ""}</p>}<h3>{restaurant.name}</h3>{restaurant.dish && <p>{restaurant.dish}</p>}{restaurant.services && <small>{restaurant.services}</small>}</div>{restaurant.price && <strong>{restaurant.price}</strong>}{value(content, "restaurantsDetailsLabel") && <Link href={`/unde-mancam/${restaurant.id}`} aria-label={`${value(content, "restaurantsDetailsLabel")} — ${restaurant.name}`}><ArrowRight aria-hidden="true" /></Link>}</article>)}</div></section>}

    {enabled(content, "jobsVisible") && jobs.length > 0 && <section className="section jobs-section home-section"><div className="container">{jobsHead && <SectionHead {...jobsHead} light />}<div className="job-list">{jobs.slice(0, 4).map(job => <article className="job-row" key={job.id}><div>{job.isDemo && <span className="demo-badge">Exemplu demonstrativ</span>}<h3>{job.title}</h3><p>{[job.company, job.locality].filter(Boolean).join(" · ")}</p></div>{value(content, "jobsScheduleLabel") && <div><small>{value(content, "jobsScheduleLabel")}</small><strong>{[job.type, job.schedule].filter(Boolean).join(" · ")}</strong></div>}{value(content, "jobsSalaryLabel") && <div><small>{value(content, "jobsSalaryLabel")}</small><strong>{job.salary}</strong></div>}{value(content, "jobsDetailsLabel") && <Link href={`/locuri-de-munca/${job.id}`} aria-label={`${value(content, "jobsDetailsLabel")} — ${job.title}`}>{value(content, "jobsDetailsLabel")} <ArrowRight size={16} /></Link>}</article>)}</div></div></section>}

    {enabled(content, "finalVisible") && finalMeaningful && <section className="business-cta"><div className="container"><div>{value(content, "finalKicker") && <p className="kicker">{value(content, "finalKicker")}</p>}{value(content, "finalTitle") && <h2>{value(content, "finalTitle")}</h2>}{value(content, "finalCopy") && <p>{value(content, "finalCopy")}</p>}</div>{finalAction && <div><Link className="button button-cream" href={finalAction.href}>{finalAction.label}</Link></div>}</div></section>}
  </>;
}

function sectionHead(copy: HomeCopy, prefix: string) {
  const eyebrow = value(copy, `${prefix}Eyebrow`);
  const title = value(copy, `${prefix}Title`);
  const link = action(copy, `${prefix}LinkLabel`, `${prefix}LinkHref`);
  return eyebrow || title || link ? { eyebrow, title, action: link } : null;
}

function SectionHead({ eyebrow, title, action: sectionAction, light = false }: { eyebrow: string; title: string; action: Action | null; light?: boolean }) {
  return <div className={`section-head ${light ? "light" : ""}`}>{(eyebrow || title) && <div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}{title && <h2>{title}</h2>}</div>}{sectionAction && <Link className="text-link" href={sectionAction.href}>{sectionAction.label} <ArrowRight size={17} /></Link>}</div>;
}

function ImageCredit({ image }: { image: ReturnType<typeof resolveCmsImage> }) {
  const details = [image.caption, image.author ? `Foto: ${image.author}` : "", image.license].filter(Boolean);
  if (!details.length && !image.sourceUrl) return null;
  return <p className="image-credit">{details.join(" · ")}{details.length > 0 && image.sourceUrl && " · "}{image.sourceUrl && <a href={image.sourceUrl} target="_blank" rel="noreferrer">Sursă</a>}</p>;
}

function filterId(item?: RepeatableItem, fallback = "") {
  const explicit = String(item?.id || "").trim();
  if (explicit) return explicit;
  return normalize(String(item?.value || "")) || fallback;
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/\s+/g, "-");
}

function matchesEventFilter(event: PublicEvent, filter?: RepeatableItem) {
  const id = filterId(filter, "all");
  if (!filter || id === "all" || id === "toate") return true;
  if (id === "weekend") {
    const day = new Date(event.startDate).getDay();
    return day === 0 || day === 6;
  }
  return normalize(event.category).includes(normalize(String(filter.value || id)));
}

function matchesFoodFilter(restaurant: PublicRestaurant, filter?: RepeatableItem) {
  const id = filterId(filter, "all");
  if (!filter || id === "all" || id === "toate") return true;
  if (id === "delivery" || id === "livrare") return restaurant.delivery;
  if (id === "pickup" || id === "ridicare") return restaurant.pickup;
  if (id === "daily-menu" || id === "meniul-zilei") return Boolean(restaurant.dish && !/nu este publicat/i.test(restaurant.dish));
  const needle = normalize(String(filter.value || id));
  return normalize(`${restaurant.type} ${restaurant.services}`).includes(needle);
}
