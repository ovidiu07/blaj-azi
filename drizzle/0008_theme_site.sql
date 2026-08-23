INSERT OR IGNORE INTO site_content_entries (key,scope,route,label,schema_version,draft_json,published_json,version,published_at)
VALUES (
  'theme.site','theme','*','Aspect și identitate vizuală',1,
  '{"canvas":"#faf8f4","surface":"#ffffff","primary":"#173f4b","primaryDark":"#0f3039","accent":"#b84b3b","accentDark":"#99382d","accentSoft":"#f3e3de","highlight":"#e2b85b","text":"#1e2426","textMuted":"#5c666a","border":"#dfe3e2","focus":"#b84b3b","headerBackground":"#f6f0e4","buttonText":"#ffffff","headingFont":"source-serif-4","bodyFont":"inter","interfaceFont":"inter","homeHeroBackground":"#0f3039","homeHeroText":"#ffffff","homeHeroMuted":"#e9f0f1","homeDarkSection":"#ffffff","homeDarkSectionText":"#1e2426","homeJobsBackground":"#e8f1f3","homeCardBackground":"#ffffff","homeAlternateBackground":"#e8f1f3","homeCtaBackground":"#f3e3de","homeCtaText":"#1e2426"}',
  '{"canvas":"#faf8f4","surface":"#ffffff","primary":"#173f4b","primaryDark":"#0f3039","accent":"#b84b3b","accentDark":"#99382d","accentSoft":"#f3e3de","highlight":"#e2b85b","text":"#1e2426","textMuted":"#5c666a","border":"#dfe3e2","focus":"#b84b3b","headerBackground":"#f6f0e4","buttonText":"#ffffff","headingFont":"source-serif-4","bodyFont":"inter","interfaceFont":"inter","homeHeroBackground":"#0f3039","homeHeroText":"#ffffff","homeHeroMuted":"#e9f0f1","homeDarkSection":"#ffffff","homeDarkSectionText":"#1e2426","homeJobsBackground":"#e8f1f3","homeCardBackground":"#ffffff","homeAlternateBackground":"#e8f1f3","homeCtaBackground":"#f3e3de","homeCtaText":"#1e2426"}',
  1,CURRENT_TIMESTAMP
);
--> statement-breakpoint
PRAGMA optimize;
