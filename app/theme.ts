export const themeFontOptions = ["inter", "source-serif-4", "system-sans", "georgia"] as const;
export type ThemeFont = typeof themeFontOptions[number];

export const defaultTheme = {
  canvas: "#faf8f4", surface: "#ffffff", primary: "#173f4b", primaryDark: "#0f3039",
  accent: "#b84b3b", accentDark: "#99382d", accentSoft: "#f3e3de", highlight: "#e2b85b",
  text: "#1e2426", textMuted: "#5c666a", border: "#dfe3e2", focus: "#b84b3b",
  headerBackground: "#f6f0e4", buttonText: "#ffffff",
  headingFont: "source-serif-4", bodyFont: "inter", interfaceFont: "inter",
  homeHeroBackground: "#0f3039", homeHeroText: "#ffffff", homeHeroMuted: "#e9f0f1",
  homeDarkSection: "#ffffff", homeDarkSectionText: "#1e2426", homeJobsBackground: "#e8f1f3", homeCardBackground: "#ffffff",
  homeAlternateBackground: "#e8f1f3", homeCtaBackground: "#f3e3de", homeCtaText: "#1e2426",
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
  for (const key of themeColorKeys) if (!/^#[0-9a-f]{6}$/i.test(theme[key])) throw new Error(`${key}: folosește o culoare HEX completă, de forma #173f4b.`);
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
    contrast("Text buton / accent", theme.buttonText, theme.accent),
    contrast("Text erou / fundal erou", theme.homeHeroText, theme.homeHeroBackground),
    contrast("Text secundar erou / fundal erou", theme.homeHeroMuted, theme.homeHeroBackground),
    contrast("Text secțiune închisă / fundal", theme.homeDarkSectionText, theme.homeDarkSection),
    contrast("Text secțiune joburi / fundal", theme.homeDarkSectionText, theme.homeJobsBackground),
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
  inter: "var(--font-sans), Inter, system-ui, sans-serif",
  "source-serif-4": "var(--font-display), 'Source Serif 4', Georgia, serif",
  "system-sans": "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  georgia: "Georgia, 'Times New Roman', serif",
};

export function themeCssProperties(value: unknown): Record<string, string> {
  const theme = normalizeTheme(value);
  return {
    "--color-canvas":theme.canvas, "--color-surface":theme.surface, "--color-primary":theme.primary,
    "--color-primary-dark":theme.primaryDark, "--color-accent":theme.accent, "--color-accent-dark":theme.accentDark,
    "--color-accent-soft":theme.accentSoft, "--color-highlight":theme.highlight, "--color-text":theme.text,
    "--color-text-muted":theme.textMuted, "--color-border":theme.border, "--color-focus":theme.focus,
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
