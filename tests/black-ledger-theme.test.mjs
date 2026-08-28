import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const theme = await import("../app/theme.ts");
const cms = await import("../app/site-content.ts");
const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
const richTextEditor = await readFile(new URL("../app/ui/RichText.tsx", import.meta.url), "utf8");
const siteChrome = await readFile(new URL("../app/ui/SiteChrome.tsx", import.meta.url), "utf8");

test("Black Ledger exposes every required semantic token and critical pairs pass AA", () => {
  const properties = theme.themeCssProperties(theme.defaultTheme);
  const expected = {
    "--color-canvas":"#050607", "--color-canvas-alt":"#080a0c", "--color-surface-1":"#0d0f12",
    "--color-surface-2":"#12161a", "--color-surface-3":"#181d22", "--color-surface-hover":"#1d2329",
    "--color-surface-inverse":"#f6f7f5", "--color-surface-inverse-muted":"#e9ebe9", "--color-surface-inverse-hover":"#ffffff",
    "--color-text-primary":"#f5f7f8", "--color-text-secondary":"#b8c0c8", "--color-text-tertiary":"#89929c",
    "--color-text-disabled":"#69717a", "--color-text-inverse":"#090b0d", "--color-text-inverse-secondary":"#4e565e",
    "--color-text-inverse-tertiary":"#68717a", "--color-border-inverse":"#d2d6d8", "--color-graphite":"#2a3036",
    "--color-metal":"#9ba5ae", "--color-metal-bright":"#d7dce1", "--color-steel-accent":"#a9bdc9",
    "--color-steel-accent-hover":"#c7d2d9", "--color-civic-accent":"#b9a27c", "--color-action":"#f4f6f7", "--color-action-hover":"#ffffff",
    "--color-action-active":"#dfe3e6", "--color-action-foreground":"#08090a", "--color-success":"#71d39b",
    "--color-brand-action":"#b84b3b", "--color-brand-action-hover":"#a63f32", "--color-brand-action-active":"#99382d",
    "--color-brand-action-soft":"#f3e3de", "--color-brand-action-foreground":"#ffffff",
    "--color-warning":"#e0b866", "--color-danger":"#ff7d82", "--color-info":"#7db4ea", "--color-focus":"#b84b3b",
  };
  for (const [token,value] of Object.entries(expected)) assert.equal(properties[token], value, token);
  for (const token of ["--color-border-subtle","--color-border-default","--color-border-strong","--color-focus","--color-focus-outer"]) assert.ok(properties[token], token);

  const pairs = [
    ["dark primary", "#f5f7f8", "#050607", 4.5],
    ["dark secondary", "#b8c0c8", "#050607", 4.5],
    ["inverse primary", "#090b0d", "#f6f7f5", 4.5],
    ["inverse secondary", "#4e565e", "#f6f7f5", 4.5],
    ["action", "#08090a", "#f4f6f7", 4.5],
    ["steel link", "#c7d2d9", "#0d0f12", 4.5],
    ["warm action label", "#ffffff", "#b84b3b", 4.5],
    ["warm focus on canvas", "#b84b3b", "#050607", 3],
    ["warm focus on inverse", "#b84b3b", "#f6f7f5", 3],
    ["success", "#71d39b", "#0d0f12", 4.5],
    ["warning", "#e0b866", "#0d0f12", 4.5],
    ["danger", "#ff7d82", "#0d0f12", 4.5],
    ["requested inline link", "#ff0435", "#050607", 4.5],
  ];
  for (const [label,foreground,background,minimum] of pairs) assert.ok(theme.contrastRatio(foreground,background) >= minimum, label);
});

test("legacy stock theme values migrate to Black Ledger without replacing custom values", () => {
  const legacy = {
    ...theme.defaultTheme,
    canvas:"#faf8f4", surface:"#ffffff", primary:"#173f4b", primaryDark:"#0f3039",
    accent:"#b84b3b", accentDark:"#99382d", accentSoft:"#f3e3de", highlight:"#e2b85b",
    text:"#173f4b", textMuted:"#52666c", border:"#d8dfde", focus:"#b84b3b",
    headerBackground:"#ffffff", buttonText:"#ffffff", homeHeroBackground:"#eaf1ee", homeHeroText:"#14201e",
    homeHeroMuted:"#52615e", homeDarkSection:"#102622", homeDarkSectionText:"#f8fbf9", homeJobsBackground:"#eaf1ee",
    homeCardBackground:"#ffffff", homeAlternateBackground:"#eaf1ee", homeCtaBackground:"#102622", homeCtaText:"#f8fbf9",
  };
  assert.deepEqual(cms.mergeWithSiteDefaults("theme.site", legacy), theme.defaultTheme);
  assert.equal(cms.mergeWithSiteDefaults("theme.site", { ...legacy, accent:"#abcdef" }).accent, "#abcdef");
  assert.equal(cms.mergeWithSiteDefaults("theme.site", legacy).decorativeAccent, "#b9a27c");
  const previousBlackLedger = { ...theme.defaultTheme, focus:"#ffffff" };
  for (const key of ["brandAction","brandActionHover","brandActionActive","brandActionSoft","brandActionForeground"]) delete previousBlackLedger[key];
  const migrated = cms.mergeWithSiteDefaults("theme.site", previousBlackLedger);
  assert.equal(migrated.brandAction,"#b84b3b");
  assert.equal(migrated.focus,"#b84b3b");
  assert.equal(cms.mergeWithSiteDefaults("theme.site",{...previousBlackLedger,focus:"#abcdef"}).focus,"#abcdef");
});

test("shared Black Ledger CSS enforces compact phone cards, focus, fields, consent, and reduced motion", () => {
  const compactCss = css.replace(/\s+/g, "");
  for (const token of [
    "--color-canvas:#050607", "--color-surface-1:#0d0f12", "--color-text-primary:#f5f7f8",
    "--radius-sm:8px", "--radius-md:12px", "--radius-lg:16px", "--radius-xl:22px",
    "--space-1:4px", "--space-9:96px", "--duration-fast:120ms", "--ease-standard:cubic-bezier(.2,0,0,1)",
  ]) assert.ok(css.includes(token), token);
  assert.match(css, /@media \(max-width:700px\)[\s\S]*\.result-card \.result-card-surface\s*\{[\s\S]*display:grid;[\s\S]*grid-template-columns:minmax\(0,1fr\);[\s\S]*width:100%;[\s\S]*\.result-card \.result-card-surface>img,\.result-card-media\s*\{[\s\S]*aspect-ratio:16\/10;[\s\S]*\.result-main\s*\{\s*width:100%;\s*min-width:0;/);
  assert.match(css, /\.consent,\.check-row,\.cms-toggle\s*\{[^}]*min-height:44px/);
  assert.match(css, /\.rte-toolbar button\s*\{[^}]*min-width:44px;[^}]*min-height:44px/);
  assert.match(css, /\.place-card \.place-card-surface\s*\{[^}]*display:grid/);
  assert.match(css, /:focus-visible\s*\{[^}]*outline:3px solid var\(--color-focus\)/);
  assert.match(css, /button:not\(\.danger-action\):not\(:disabled\):not\(\[aria-disabled="true"\]\):focus-visible[\s\S]*background:var\(--color-brand-action\);[\s\S]*color:var\(--color-brand-action-foreground\);/);
  assert.match(css, /button:focus-visible svg,[\s\S]*stroke:currentColor;/);
  assert.match(css, /button:disabled:focus-visible,[\s\S]*outline-color:var\(--color-text-disabled\)/);
  assert.match(css, /\.danger-action:focus-visible\s*\{[^}]*var\(--color-danger\)/);
  assert.match(css, /\.home-filters button\[aria-pressed="true"\],[\s\S]*\.search-facets button\[aria-pressed="true"\],[\s\S]*background:var\(--color-brand-action\);[\s\S]*font-weight:850;/);
  assert.match(css, /\.cms-section-visibility\.is-hidden button\s*\{[^}]*background:color-mix\([^}]*color:var\(--color-warning\)/);
  assert.match(css, /\.home-hero-grid\s*\{[^}]*grid-template-columns:minmax\(0,\.88fr\) minmax\(0,1\.12fr\)/);
  assert.match(css, /\.home-hero-visual\s*\{[^}]*max-width:720px/);
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)[\s\S]*transition-duration:\.01ms!important/);
  assert.match(css, /\.home-search\s*\{[\s\S]*linear-gradient\(180deg,#14191e 0%,#0d1115 54%,#090c0f 100%\)/);
  assert.match(css, /\.home-command-grid\s*\{[\s\S]*border-radius:20px/);
  assert.match(richTextEditor, /aria-pressed=\{pressed\}/);
  assert.match(richTextEditor, /pressed=\{activeFormats\.has\("bold"\)\}/);
  assert.ok(compactCss.includes(".site-header{background:linear-gradient(#888888f7,#06080af5);"));
  assert.match(css, /\.logo span\s*\{\s*color:#ff0000;/);
  assert.match(css, /\.logo b\s*\{[^}]*padding:1px 0 1px 8px;[^}]*background:transparent;[^}]*color:#ffffff;/);
  assert.match(css, /radial-gradient\(circle at 78% 4%,\s*#fff1,\s*#0000 34%\),\s*radial-gradient\(circle at 6% 68%,\s*#b9a27c0a,\s*#0000 30%\),\s*linear-gradient\(#050607 0%,\s*#313e4b 58%,\s*#050607 100%\)/);
  assert.ok(compactCss.includes(".home-events{background:linear-gradient(180deg,#40484f,#07090b);}"));
  assert.match(css, /\.home-discovery\s*\{\s*background:linear-gradient\(#b84b3b61,\s*#0d1115 48%,\s*#090c0f\);/);
  assert.ok(compactCss.includes(".home-services{background:#5c5f62b5;color:var(--color-text-primary);}"));
  assert.match(css, /\.home-services \.home-inline-link,\.home-offers \.home-inline-link\s*\{[^}]*min-height:44px;[^}]*background:#050607;[^}]*color:#ff0435;/);
  assert.match(siteChrome, /<Link className="logo" href="\/" aria-label=\{homeLabel\}><span>Blaj<\/span><b>Azi<\/b><\/Link>/);
  assert.doesNotMatch(css, /#000000\b|#faf8f4\b|#173f4b\b|#e2b85b\b|#dfe3e2\b|neon|glow/i);
});
