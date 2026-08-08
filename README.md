# Blaj Azi

Platforma comunitară locală Blaj Azi, construită cu vinext/React și găzduită
pe Cloudflare. Conținutul public rămâne accesibil anonim, iar conturile,
publicarea, moderarea și administrarea folosesc Sign in with ChatGPT, D1 și R2.

## Dezvoltare locală

Necesită Node.js `>=22.13.0`.

```bash
npm install
npm run dev
```

Comenzi utile:

- `npm run build` — build-ul de producție;
- `npm run lint` — verificarea statică;
- `npm test` — build plus testele de migrare, securitate și flux editorial;
- `npm run db:generate` — generează o migrare Drizzle după schimbarea schemei.

## Date și autentificare

Schema D1 este definită în `db/schema.ts`, iar migrările versionate sunt în
`drizzle/`. Ele sunt singura sursă pentru crearea schemei și datele demo.

Identitatea vine exclusiv din headerele de încredere furnizate de platformă.
`ADMIN_EMAIL` este folosit doar la prima inițializare pentru a crea primul
platform owner; valoarea reală trebuie configurată în mediul găzduit și nu este
expusă clientului. Vezi `.env.example`.

Conținutul public poate fi citit anonim. Rutele `/cont/*` cer autentificare, iar
operațiile de administrare verifică rolul și starea utilizatorului pe server.

## Stocare

- `DB` — binding Cloudflare D1 pentru date structurate;
- `MEDIA` — binding Cloudflare R2 pentru fișiere media;
- `ADMIN_EMAIL` — secretul de bootstrap descris mai sus.

Configurația proiectului Sites și binding-urile sunt declarate în
`.openai/hosting.json`.
