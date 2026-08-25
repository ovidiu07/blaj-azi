export const themeFontOptions = ["manrope", "inter", "source-serif-4", "system-sans", "georgia"] as const;
export type ThemeFont = typeof themeFontOptions[number];

export const defaultTheme = {
  canvas: "#050607", surface: "#0d0f12", primary: "#f4f6f7", primaryDark: "#dfe3e6",
  accent: "#a9bdc9", accentDark: "#c7d2d9", accentSoft: "#181d22", highlight: "#d7dce1",
  text: "#f5f7f8", textMuted: "#b8c0c8", border: "#3b4249", focus: "#ffffff",
  headerBackground: "#080a0c", buttonText: "#08090a",
  headingFont: "manrope", bodyFont: "inter", interfaceFont: "manrope",
  homeHeroBackground: "#050607", homeHeroText: "#f5f7f8", homeHeroMuted: "#b8c0c8",
  homeDarkSection: "#0d0f12", homeDarkSectionText: "#f5f7f8", homeJobsBackground: "#080a0c", homeCardBackground: "#12161a",
  homeAlternateBackground: "#f6f7f5", homeCtaBackground: "#f6f7f5", homeCtaText: "#090b0d",
} as const;

export type ThemeSettings = { -readonly [K in keyof typeof defaultTheme]: string };

export const themeColorKeys = Object.keys(defaultTheme).filter(key => !key.endsWith("Font")) as Array<keyof ThemeSettings>;

export function normalizeTheme(value: unknown): ThemeSettings {
  const raw = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const result = { ...defaultTheme } as ThemeSettings;
  for (const key of Object.keys(defaultTheme) as Array<keyof ThemeSettings>) {
    const next = raw[key];
    if (typeof next === "string") result[key] = next.trim().toLowerCase();
  }
  return result;
}

export function validateTheme(value: unknown): ThemeSettings {
  const theme = normalizeTheme(value);
  for (const key of themeColorKeys) if (!/^#[0-9a-f]{6}$/i.test(theme[key])) throw new Error(`${key}: folosește o culoare HEX completă, de forma #050607.`);
  for (const key of ["headingFont", "bodyFont", "interfaceFont"] as const) if (!themeFontOptions.includes(theme[key] as ThemeFont)) throw new Error(`${key}: font neacceptat.`);
  const failures = themeContrastChecks(theme).filter(check => !check.pass);
  if (failures.length) throw new Error(`Contrast insuficient: ${failures.map(item => `${item.label} ${item.ratio.toFixed(2)}:1`).join(", ")}. Pragul este 4.5:1.`);
  return theme;
}

export function themeContrastChecks(themeValue: unknown) {
  const theme = normalizeTheme(themeValue);
  return [
    contrast("Text principal / fundal", theme.text, theme.canvas),
    contrast("Text secundar / fundal", theme.textMuted, theme.canvas),
    contrast("Text buton / culoare principală", theme.buttonText, theme.primary),
    contrast("Text buton / accent", theme.buttonText, theme.accent),
    contrast("Text erou / fundal erou", theme.homeHeroText, theme.homeHeroBackground),
    contrast("Text secundar erou / fundal erou", theme.homeHeroMuted, theme.homeHeroBackground),
    contrast("Text secțiune închisă / fundal", theme.homeDarkSectionText, theme.homeDarkSection),
    contrast("Text secțiune joburi / fundal", theme.text, theme.homeJobsBackground),
    contrast("Text CTA / fundal CTA", theme.homeCtaText, theme.homeCtaBackground),
  ];
}

function contrast(label: string, foreground: string, background: string) {
  const ratio = contrastRatio(foreground, background);
  return { label, foreground, background, ratio, pass: ratio >= 4.5 };
}

export function contrastRatio(first: string, second: string) {
  const light = Math.max(luminance(first), luminance(second));
  const dark = Math.min(luminance(first), luminance(second));
  return (light + 0.05) / (dark + 0.05);
}

function luminance(hex: string) {
  const values = [1, 3, 5].map(index => Number.parseInt(hex.slice(index, index + 2), 16) / 255).map(value => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2];
}

const fontStacks: Record<ThemeFont, string> = {
  manrope: "var(--font-display), Manrope, system-ui, sans-serif",
  inter: "var(--font-sans), Inter, system-ui, sans-serif",
  "source-serif-4": "var(--font-display), 'Source Serif 4', Georgia, serif",
  "system-sans": "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  georgia: "Georgia, 'Times New Roman', serif",
};

export function themeCssProperties(value: unknown): Record<string, string> {
  const theme = normalizeTheme(value);
  return {
    "--color-canvas":theme.canvas, "--color-canvas-alt":"#080a0c",
    "--color-surface":theme.surface, "--color-surface-1":theme.surface, "--color-surface-2":"#12161a",
    "--color-surface-3":theme.accentSoft, "--color-surface-hover":"#1d2329",
    "--color-surface-inverse":"#f6f7f5", "--color-surface-inverse-muted":"#e9ebe9", "--color-surface-inverse-hover":"#ffffff",
    "--color-primary":theme.primary,
    "--color-primary-dark":theme.primaryDark, "--color-accent":theme.accent, "--color-accent-dark":theme.accentDark,
    "--color-accent-soft":theme.accentSoft, "--color-highlight":theme.highlight, "--color-text":theme.text,
    "--color-text-primary":theme.text, "--color-text-secondary":theme.textMuted, "--color-text-tertiary":"#89929c", "--color-text-disabled":"#69717a",
    "--color-text-inverse":"#090b0d", "--color-text-inverse-secondary":"#4e565e", "--color-text-inverse-tertiary":"#68717a",
    "--color-text-muted":theme.textMuted, "--color-border":theme.border, "--color-focus":theme.focus, "--color-focus-outer":"rgba(169,189,201,.62)",
    "--color-border-subtle":"rgba(255,255,255,.10)", "--color-border-default":"rgba(255,255,255,.17)", "--color-border-strong":"rgba(255,255,255,.28)", "--color-border-inverse":"#d2d6d8",
    "--color-graphite":"#2a3036", "--color-metal":"#9ba5ae", "--color-metal-bright":theme.highlight,
    "--color-steel-accent":theme.accent, "--color-steel-accent-hover":theme.accentDark,
    "--color-action":theme.primary, "--color-action-hover":"#ffffff", "--color-action-active":theme.primaryDark, "--color-action-foreground":theme.buttonText,
    "--color-success":"#71d39b", "--color-warning":"#e0b866", "--color-danger":"#ff7d82", "--color-info":"#7db4ea",
    "--color-header-background":theme.headerBackground, "--color-button-text":theme.buttonText,
    "--theme-font-heading":fontStacks[theme.headingFont as ThemeFont], "--theme-font-body":fontStacks[theme.bodyFont as ThemeFont],
    "--theme-font-interface":fontStacks[theme.interfaceFont as ThemeFont],
  };
}

export function homeThemeCssProperties(value: unknown): Record<string, string> {
  const theme = normalizeTheme(value);
  return {
    "--home-hero-background":theme.homeHeroBackground, "--home-hero-text":theme.homeHeroText,
    "--home-hero-muted":theme.homeHeroMuted, "--home-dark-section":theme.homeDarkSection,
    "--home-dark-section-text":theme.homeDarkSectionText, "--home-jobs-background":theme.homeJobsBackground, "--home-card-background":theme.homeCardBackground,
    "--home-alternate-background":theme.homeAlternateBackground, "--home-cta-background":theme.homeCtaBackground,
    "--home-cta-text":theme.homeCtaText,
  };
}
