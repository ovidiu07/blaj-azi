"use client";
/* eslint-disable @next/next/no-img-element -- CMS and D1/R2 URLs are runtime-controlled; intrinsic dimensions, sizes, loading, and approved media rules are handled explicitly. */

import Link from "next/link";
import {
  ArrowRight, BriefcaseBusiness, CalendarDays, Check, ChevronRight, Clock3,
  Image as ImageIcon, MapPin, Search, ShieldCheck, Store, Tag, UtensilsCrossed,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { PublicBusiness, PublicCatalog, PublicEvent, PublicPlace, PublicRestaurant } from "../public-types";
import { cmsImageUrl, resolveCmsImage, safeInternalHref } from "../site-content";

type HomeCopy = Record<string, unknown>;
type RepeatableItem = { id?: string; value?: string; label?: string; href?: string; icon?: string; visible?: boolean; deleted?: boolean };
type Action = { href: string; label: string };
type SectionHeading = { eyebrow: string; title: string; action: Action | null };

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
  const eventFilters = visibleItems(content, "eventFilters").filter(item => String(item.value ?? "").trim());
  const foodFilters = visibleItems(content, "restaurantFilters").filter(item => String(item.value ?? "").trim());
  const [eventFilter, setEventFilter] = useState(() => filterId(eventFilters[0], "all"));
  const [foodFilter, setFoodFilter] = useState(() => filterId(foodFilters[0], "all"));
  const shownEvents = useMemo(() => catalog.events.filter(event => matchesEventFilter(event, eventFilters.find(item => filterId(item) === eventFilter))), [catalog.events, eventFilter, eventFilters]);
  const shownFood = useMemo(() => catalog.restaurants.filter(restaurant => matchesFoodFilter(restaurant, foodFilters.find(item => filterId(item) === foodFilter))), [catalog.restaurants, foodFilter, foodFilters]);
  const quickCategories = visibleItems(content, "quickCategories").filter(item => String(item.label ?? "").trim() && safeInternalHref(String(item.href ?? "")));

  return <>
    <Hero content={content} />
    {enabled(content, "quickCategoriesVisible") && quickCategories.length > 0 && <QuickCategories content={content} categories={quickCategories} />}
    <EventsSection content={content} events={catalog.events} shownEvents={shownEvents} filters={eventFilters} activeFilter={eventFilter} onFilter={setEventFilter} />
    <DiscoverySection content={content} places={catalog.places} />
    <ServicesSection content={content} businesses={catalog.businesses} />
    <OffersSection content={content} offers={catalog.offers} />
    <RestaurantsSection content={content} restaurants={catalog.restaurants} shown={shownFood} filters={foodFilters} activeFilter={foodFilter} onFilter={setFoodFilter} />
    <JobsSection content={content} jobs={catalog.jobs} />
    <ParticipationSection content={content} />
  </>;
}

function Hero({ content }: { content: HomeCopy }) {
  const image = resolveCmsImage(content.heroImage);
  const hasImage = Boolean(image.mediaId || image.src);
  const primaryAction = action(content, "primaryCtaLabel", "primaryCtaHref");
  const secondaryAction = action(content, "secondaryCtaLabel", "secondaryCtaHref");
  const searchVisible = enabled(content, "searchVisible") && Boolean(value(content, "searchLabel") && value(content, "searchButton"));
  const hasTitle = Boolean(value(content, "titleLine") || value(content, "emphasizedTitleLine"));
  const hasHeroMeta = Boolean(primaryAction || secondaryAction || value(content, "heroTrust"));
  const meaningful = hasImage || hasTitle || Boolean(value(content, "kicker") || value(content, "intro") || value(content, "heroTrust") || searchVisible || primaryAction || secondaryAction);
  if (!enabled(content, "heroVisible") || !meaningful) return null;

  return <section className={`home-hero ${hasImage ? "home-hero-has-image" : "home-hero-no-image"}`}>
    <div className="container home-hero-grid">
      <div className="home-hero-copy">
        {value(content, "kicker") && <p className="home-eyebrow">{value(content, "kicker")}</p>}
        {hasTitle && <h1>{value(content, "titleLine") && <span>{value(content, "titleLine")}</span>}{value(content, "emphasizedTitleLine") && <em>{value(content, "emphasizedTitleLine")}</em>}</h1>}
        {value(content, "intro") && <p className="home-hero-intro">{value(content, "intro")}</p>}
        {searchVisible && <form className="home-search" action="/cauta" method="get">
          <Search aria-hidden="true" /><label className="sr-only" htmlFor="hero-query">{value(content, "searchLabel")}</label>
          <input id="hero-query" name="q" placeholder={value(content, "searchPlaceholder") || undefined} />
          <button type="submit">{value(content, "searchButton")}<ArrowRight size={18} aria-hidden="true" /></button>
        </form>}
        {hasHeroMeta && <div className="home-hero-meta">
          {(primaryAction || secondaryAction) && <div className="home-hero-actions">
            {primaryAction && <Link className="button" href={primaryAction.href}>{primaryAction.label}<ArrowRight size={18} aria-hidden="true" /></Link>}
            {secondaryAction && <Link className="home-inline-link" href={secondaryAction.href}>{secondaryAction.label}<ChevronRight size={17} aria-hidden="true" /></Link>}
          </div>}
          {value(content, "heroTrust") && <p className="home-trust"><ShieldCheck size={18} aria-hidden="true" />{value(content, "heroTrust")}</p>}
        </div>}
      </div>
      {hasImage ? <figure className="home-hero-visual">
        <img src={cmsImageUrl(image)} alt={image.decorative ? "" : image.alt} style={{ objectPosition: image.objectPosition }} width="1200" height="1500" fetchPriority="high" sizes="(max-width: 820px) calc(100vw - 28px), (max-width: 1100px) 44vw, (max-width: 1440px) 52vw, 720px" />
        <div className="home-hero-image-signal" aria-hidden="true"><span>Descoperă</span><strong>Blaj</strong></div>
        {image.showCredit && <ImageCredit image={image} />}
      </figure> : null}
    </div>
  </section>;
}

function QuickCategories({ content, categories }: { content: HomeCopy; categories: RepeatableItem[] }) {
  return <nav className="home-command" aria-label={value(content, "quickCategoriesLabel") || "Categorii rapide"}><div className="container home-command-grid">
    {categories.map((item, index) => { const Icon = icons[item.icon as keyof typeof icons] || Check; return <Link href={String(item.href)} key={item.id || `${item.href}-${item.label}-${index}`}><span className="home-command-icon"><Icon size={21} aria-hidden="true" /></span><span>{item.label}</span><ChevronRight size={16} aria-hidden="true" /></Link>; })}
  </div></nav>;
}

function EventsSection({ content, events, shownEvents, filters, activeFilter, onFilter }: { content: HomeCopy; events: PublicEvent[]; shownEvents: PublicEvent[]; filters: RepeatableItem[]; activeFilter: string; onFilter: (id: string) => void }) {
  const heading = sectionHead(content, "events");
  const emptyContribution = action(content, "eventsEmptyActionLabel", "eventsEmptyActionHref");
  const emptyMeaningful = Boolean(value(content, "eventsEmptyTitle") || value(content, "eventsEmptyDescription") || heading?.action || emptyContribution);
  if (!enabled(content, "eventsVisible") || !(heading || events.length || emptyMeaningful)) return null;
  const visible = shownEvents.slice(0, 3);

  return <section className={`home-module home-events ${visible.length === 0 ? "home-module-compact" : ""}`}><div className="container">
    {heading && <SectionHead {...heading} />}
    {events.length > 0 && filters.length > 0 && <div className="home-filters" role="group" aria-label={value(content, "eventsFiltersLabel") || undefined}>{filters.map((filter, index) => { const id = filterId(filter, `event-${index}`); return <button type="button" aria-pressed={activeFilter === id} onClick={() => onFilter(id)} className={activeFilter === id ? "active" : ""} key={filter.id || `${filter.value}-${index}`}>{filter.value}</button>; })}</div>}
    {visible.length > 0 ? <div className={`home-event-grid count-${Math.min(visible.length, 3)}`} data-count={visible.length}>{visible.map((event, index) => <EventCard event={event} detailsLabel={value(content, "eventsDetailsLabel")} key={event.id} emphasized={visible.length > 1 && index === 0} />)}</div> : emptyMeaningful && <div className="home-empty-strip">
      <span className="home-empty-icon" aria-hidden="true"><CalendarDays /></span><div>{value(content, "eventsEmptyTitle") && <h3>{value(content, "eventsEmptyTitle")}</h3>}{value(content, "eventsEmptyDescription") && <p>{value(content, "eventsEmptyDescription")}</p>}</div>
      {(heading?.action || emptyContribution) && <div className="home-empty-actions">{heading?.action && <Link href={heading.action.href}>{heading.action.label}</Link>}{emptyContribution && <Link href={emptyContribution.href}>{emptyContribution.label}</Link>}</div>}
    </div>}
  </div></section>;
}

function EventCard({ event, detailsLabel, emphasized }: { event: PublicEvent; detailsLabel: string; emphasized: boolean }) {
  return <article className={`home-event-card ${emphasized ? "is-leading" : ""}`}><Link className="home-card-surface" href={`/evenimente/${event.id}`}><div className="home-event-media"><img src={event.image} alt={event.imageAlt || ""} width="720" height="480" loading="lazy" sizes="(max-width: 700px) calc(100vw - 28px), (max-width: 1100px) 50vw, 420px" />{event.isDemo && <span className="demo-badge">Conținut demonstrativ</span>}</div><div className="home-event-body">
    <div className="home-event-meta"><span>{event.category}</span>{event.price && <span>{event.price}</span>}</div><h3>{event.title}</h3>
    <p><CalendarDays size={17} aria-hidden="true" /><time dateTime={event.startDate}>{event.date}{event.time && ` · ${event.time}`}</time></p>{event.place && <p><MapPin size={17} aria-hidden="true" />{event.place}</p>}
    {detailsLabel && <span className="home-card-link">{detailsLabel}<ArrowRight size={16} aria-hidden="true" /></span>}
  </div></Link></article>;
}

function DiscoverySection({ content, places }: { content: HomeCopy; places: PublicPlace[] }) {
  const heading = sectionHead(content, "discover");
  const editorial = resolveCmsImage(content.editorialImage);
  const editorialHasImage = Boolean(editorial.mediaId || editorial.src);
  const editorialAction = action(content, "editorialCtaLabel", "editorialCtaHref");
  const editorialText = Boolean(value(content, "editorialKicker") || value(content, "editorialTitle") || value(content, "editorialCopy") || editorialAction);
  const editorialMeaningful = editorialHasImage || editorialText;
  const mediaAction = action(content, "discoverMediaLabel", "discoverMediaHref");
  if (!enabled(content, "discoverVisible") || !(heading || editorialMeaningful || places.length || mediaAction)) return null;

  const shownPlaces = places.slice(0, 3);
  const leadPlace = editorialHasImage ? null : shownPlaces[0] || null;
  const supportingPlaces = editorialHasImage ? shownPlaces : shownPlaces.slice(1);
  const count = shownPlaces.length + (editorialMeaningful ? 1 : 0);

  return <section className="home-discovery"><div className="container">
    {heading && <SectionHead {...heading} />}
    {count > 0 && <div className={`home-discovery-grid count-${Math.min(count, 4)}`} data-count={count}>
      {editorialHasImage ? <article className="home-discovery-feature has-image"><img src={cmsImageUrl(editorial)} alt={editorial.decorative ? "" : editorial.alt} style={{ objectPosition: editorial.objectPosition }} width="1200" height="900" loading="lazy" sizes="(max-width: 900px) calc(100vw - 28px), 760px" />{editorialText && <DiscoveryCopy content={content} action={editorialAction} />}{editorial.showCredit && <ImageCredit image={editorial} />}</article> : leadPlace ? <PlaceFeature place={leadPlace} /> : editorialText ? <article className="home-discovery-intro"><DiscoveryCopy content={content} action={editorialAction} /></article> : null}
      {leadPlace && editorialText && <article className="home-discovery-intro"><DiscoveryCopy content={content} action={editorialAction} /></article>}
      {supportingPlaces.map(place => <PlaceTile place={place} key={place.id} />)}
    </div>}
    {mediaAction && <div className="home-discovery-footer"><Link href={mediaAction.href}><ImageIcon size={19} aria-hidden="true" />{mediaAction.label}<ArrowRight size={17} aria-hidden="true" /></Link></div>}
  </div></section>;
}

function DiscoveryCopy({ content, action: editorialAction }: { content: HomeCopy; action: Action | null }) {
  return <div className="home-discovery-copy">{value(content, "editorialKicker") && <p className="home-eyebrow">{value(content, "editorialKicker")}</p>}{value(content, "editorialTitle") && <h3>{value(content, "editorialTitle")}</h3>}{value(content, "editorialCopy") && <p>{value(content, "editorialCopy")}</p>}{editorialAction && <Link className="home-card-link" href={editorialAction.href}>{editorialAction.label}<ArrowRight size={16} aria-hidden="true" /></Link>}</div>;
}

function PlaceFeature({ place }: { place: PublicPlace }) {
  return <Link href={`/descopera-blaj/${place.id}`} className="home-discovery-feature"><img src={place.image} alt={place.imageAlt || ""} width="1200" height="900" loading="lazy" sizes="(max-width: 900px) calc(100vw - 28px), 760px" /><span><small>{place.eyebrow}</small><strong>{place.title}</strong>{place.text && <em>{place.text}</em>}<b>Descoperă locul<ArrowRight size={17} aria-hidden="true" /></b></span></Link>;
}

function PlaceTile({ place }: { place: PublicPlace }) {
  return <Link href={`/descopera-blaj/${place.id}`} className="home-place-tile"><img src={place.image} alt={place.imageAlt || ""} width="720" height="540" loading="lazy" sizes="(max-width: 700px) calc(100vw - 28px), 360px" /><span><small>{place.eyebrow}</small><strong>{place.title}</strong></span><ArrowRight aria-hidden="true" /></Link>;
}

function ServicesSection({ content, businesses }: { content: HomeCopy; businesses: PublicBusiness[] }) {
  const heading = sectionHead(content, "services");
  if (!enabled(content, "servicesVisible") || businesses.length === 0) return null;
  const shown = businesses.slice(0, 4);
  return <section className="home-module home-services"><div className="container">{heading && <SectionHead {...heading} />}<div className={`home-service-grid count-${Math.min(shown.length, 4)}`} data-count={shown.length}>{shown.map(business => <BusinessCard business={business} profileLabel={value(content, "servicesProfileLabel")} key={business.id} />)}</div></div></section>;
}

function BusinessCard({ business, profileLabel }: { business: PublicBusiness; profileLabel: string }) {
  return <article className="home-service-card"><Link className="home-card-surface" href={`/afaceri-si-servicii/${business.id}`}>{business.image ? <img src={business.image} alt={business.imageAlt || ""} width="720" height="480" loading="lazy" sizes="(max-width: 700px) calc(100vw - 28px), 360px" /> : <div className="home-service-mark" aria-hidden="true">{business.name.charAt(0)}</div>}<div>{business.promoted && <span className="promoted">Promovat</span>}{business.category && <p className="home-eyebrow">{business.category}</p>}<h3>{business.name}</h3>{business.locality && <p className="home-location"><MapPin size={16} aria-hidden="true" />{business.locality}</p>}{business.isDemo && <span className="demo-line">Exemplu demonstrativ</span>}{profileLabel && <span className="home-card-link">{profileLabel}<ArrowRight size={17} aria-hidden="true" /></span>}</div></Link></article>;
}

function OffersSection({ content, offers }: { content: HomeCopy; offers: PublicCatalog["offers"] }) {
  const heading = sectionHead(content, "offers");
  if (!enabled(content, "offersVisible") || offers.length === 0) return null;
  const shown = offers.slice(0, 3);
  return <section className="home-module home-offers"><div className="container">{heading && <SectionHead {...heading} />}<div className={`home-offer-grid count-${shown.length}`} data-count={shown.length}>{shown.map(offer => <article className="home-offer-card" key={offer.id}><Link className="home-card-surface" href={`/oferte-locale/${offer.id}`}>{offer.isDemo && <p className="demo-line">Exemplu demonstrativ</p>}<h3>{offer.title}</h3>{offer.business && <p>{offer.business}</p>}<div className="home-price">{offer.old && <del>{offer.old}</del>}<strong>{offer.price}</strong></div>{value(content, "offersUntilLabel") && offer.until && <p className="home-location"><Clock3 size={16} aria-hidden="true" />{value(content, "offersUntilLabel")} {offer.until}</p>}{value(content, "offersConditionsLabel") && <span className="home-card-link">{value(content, "offersConditionsLabel")}<ArrowRight size={16} aria-hidden="true" /></span>}</Link></article>)}</div></div></section>;
}

function RestaurantsSection({ content, restaurants, shown, filters, activeFilter, onFilter }: { content: HomeCopy; restaurants: PublicRestaurant[]; shown: PublicRestaurant[]; filters: RepeatableItem[]; activeFilter: string; onFilter: (id: string) => void }) {
  const heading = sectionHead(content, "restaurants");
  if (!enabled(content, "restaurantsVisible") || restaurants.length === 0) return null;
  const visible = shown.slice(0, 5);
  return <section className="home-module home-restaurants"><div className="container">{heading && <SectionHead {...heading} />}{filters.length > 0 && <div className="home-filters" role="group" aria-label={value(content, "restaurantsFiltersLabel") || undefined}>{filters.map((filter, index) => { const id = filterId(filter, `food-${index}`); return <button type="button" aria-pressed={activeFilter === id} onClick={() => onFilter(id)} className={activeFilter === id ? "active" : ""} key={filter.id || `${filter.value}-${index}`}>{filter.value}</button>; })}</div>}<div className={`home-food-list count-${Math.min(visible.length, 5)}`} data-count={visible.length}>{visible.map(restaurant => <article key={restaurant.id}><Link className={`home-food-row ${restaurant.image ? "has-image" : "no-image"}`} href={`/unde-mancam/${restaurant.id}`}>{restaurant.image && <img src={restaurant.image} alt={restaurant.imageAlt || ""} width="240" height="160" loading="lazy" sizes="(max-width: 700px) 88px, 120px" />}<div>{restaurant.type && <p className="home-eyebrow">{restaurant.type}{restaurant.isDemo ? " · Exemplu demonstrativ" : ""}</p>}<h3>{restaurant.name}</h3>{restaurant.dish && <p>{restaurant.dish}</p>}</div>{restaurant.price && <strong>{restaurant.price}</strong>}{value(content, "restaurantsDetailsLabel") && <span className="home-row-affordance"><ArrowRight aria-hidden="true" /></span>}</Link></article>)}</div></div></section>;
}

function JobsSection({ content, jobs }: { content: HomeCopy; jobs: PublicCatalog["jobs"] }) {
  const heading = sectionHead(content, "jobs");
  if (!enabled(content, "jobsVisible") || jobs.length === 0) return null;
  return <section className="home-module home-jobs"><div className="container">{heading && <SectionHead {...heading} />}<div className="home-job-list">{jobs.slice(0, 4).map(job => <article key={job.id}><Link className="home-job-row" href={`/locuri-de-munca/${job.id}`}><div>{job.isDemo && <span className="demo-badge">Exemplu demonstrativ</span>}<h3>{job.title}</h3><p>{[job.company, job.locality].filter(Boolean).join(" · ")}</p></div>{value(content, "jobsScheduleLabel") && <div><small>{value(content, "jobsScheduleLabel")}</small><strong>{[job.type, job.schedule].filter(Boolean).join(" · ")}</strong></div>}{value(content, "jobsSalaryLabel") && <div><small>{value(content, "jobsSalaryLabel")}</small><strong>{job.salary}</strong></div>}{value(content, "jobsDetailsLabel") && <span className="home-card-link">{value(content, "jobsDetailsLabel")}<ArrowRight size={16} aria-hidden="true" /></span>}</Link></article>)}</div></div></section>;
}

function ParticipationSection({ content }: { content: HomeCopy }) {
  const finalAction = action(content, "finalCtaLabel", "finalCtaHref");
  const meaningful = Boolean(value(content, "finalKicker") || value(content, "finalTitle") || value(content, "finalCopy") || finalAction);
  if (!enabled(content, "finalVisible") || !meaningful) return null;
  return <section className="home-participation"><div className="container"><div>{value(content, "finalKicker") && <p className="home-eyebrow">{value(content, "finalKicker")}</p>}{value(content, "finalTitle") && <h2>{value(content, "finalTitle")}</h2>}{value(content, "finalCopy") && <p>{value(content, "finalCopy")}</p>}</div>{finalAction && <Link className="button home-participation-action" href={finalAction.href}>{finalAction.label}<ArrowRight size={18} aria-hidden="true" /></Link>}</div></section>;
}

function sectionHead(copy: HomeCopy, prefix: string): SectionHeading | null {
  const eyebrow = value(copy, `${prefix}Eyebrow`);
  const title = value(copy, `${prefix}Title`);
  const sectionAction = action(copy, `${prefix}LinkLabel`, `${prefix}LinkHref`);
  return eyebrow || title || sectionAction ? { eyebrow, title, action: sectionAction } : null;
}

function SectionHead({ eyebrow, title, action: sectionAction }: SectionHeading) {
  return <div className="home-section-head">{(eyebrow || title) && <div>{eyebrow && <p className="home-eyebrow">{eyebrow}</p>}{title && <h2>{title}</h2>}</div>}{sectionAction && <Link className="home-inline-link" href={sectionAction.href}>{sectionAction.label}<ArrowRight size={17} aria-hidden="true" /></Link>}</div>;
}

function ImageCredit({ image }: { image: ReturnType<typeof resolveCmsImage> }) {
  const details = [image.caption, image.author ? `Foto: ${image.author}` : "", image.license].filter(Boolean);
  if (!details.length && !image.sourceUrl) return null;
  return <figcaption className="home-image-credit">{details.join(" · ")}{details.length > 0 && image.sourceUrl && " · "}{image.sourceUrl && <a href={image.sourceUrl} target="_blank" rel="noreferrer">Sursă</a>}</figcaption>;
}

function filterId(item?: RepeatableItem, fallback = "") {
  const explicit = String(item?.id ?? "").trim();
  if (explicit) return explicit;
  return normalize(String(item?.value ?? "")) || fallback;
}

function normalize(input: string) { return input.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/\s+/g, "-"); }

function matchesEventFilter(event: PublicEvent, filter?: RepeatableItem) {
  const id = filterId(filter, "all");
  if (!filter || id === "all" || id === "toate") return true;
  if (id === "weekend") { const day = new Date(event.startDate).getDay(); return day === 0 || day === 6; }
  return normalize(event.category).includes(normalize(String(filter.value ?? id)));
}

function matchesFoodFilter(restaurant: PublicRestaurant, filter?: RepeatableItem) {
  const id = filterId(filter, "all");
  if (!filter || id === "all" || id === "toate") return true;
  if (id === "delivery" || id === "livrare") return restaurant.delivery;
  if (id === "pickup" || id === "ridicare") return restaurant.pickup;
  if (id === "daily-menu" || id === "meniul-zilei") return Boolean(restaurant.dish && !/nu este publicat/i.test(restaurant.dish));
  return normalize(`${restaurant.type} ${restaurant.services}`).includes(normalize(String(filter.value ?? id)));
}
