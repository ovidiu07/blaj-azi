# Blaj Azi

Platforma comunitară locală Blaj Azi, construită cu vinext/React și găzduită
pe Cloudflare. Conținutul public rămâne accesibil anonim, iar conturile folosesc
autentificare proprie cu e-mail/parolă sau identitatea de încredere furnizată de
platformă. Datele, moderarea și administrarea folosesc D1, iar media folosește R2.

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

Identitatea este rezolvată pe server dintr-o sesiune opacă proprie sau din
headerele de încredere furnizate de platformă. Parolele folosesc scrypt cu
parametri versionați, iar D1 păstrează numai hash-ul tokenului de sesiune.
`ADMIN_EMAIL` rămâne rezervat bootstrap-ului găzduit de încredere și nu
promovează niciodată o înregistrare publică.

Conținutul public poate fi citit anonim. Rutele `/cont/*` cer autentificare, iar
operațiile de administrare verifică rolul și starea utilizatorului pe server.

Generatorul administrativ, idempotency, vizibilitatea implicit ascunsă și
procedura de curățare a loturilor sintetice sunt documentate în
[`docs/demo-data.md`](docs/demo-data.md). Capabilitatea este oprită implicit.

## Stocare

- `DB` — binding Cloudflare D1 pentru date structurate;
- `MEDIA` — binding Cloudflare R2 pentru fișiere media;
- `ADMIN_EMAIL` — secretul de bootstrap descris mai sus.

Configurația proiectului Sites și binding-urile sunt declarate în
`.openai/hosting.json`.

## Provisionarea primului administrator cu parolă

Aplică mai întâi toate migrările. Pentru o bază D1 controlată prin Wrangler,
setează local (fără a salva în repository) `ADMIN_EMAIL` și `ADMIN_PASSWORD`,
apoi rulează:

```bash
read -r "ADMIN_EMAIL?E-mail administrator: "
read -rs "ADMIN_PASSWORD?Parolă (minimum 12 caractere): "; echo
export ADMIN_EMAIL ADMIN_PASSWORD
npm run admin:provision -- --remote NUMELE_BAZEI_D1
unset ADMIN_PASSWORD
```

Pentru baza SQLite locală folosită de preview, înlocuiește ultimul argument cu
`--local-file /cale/către/baza.sqlite`. Comanda refuză să creeze un al doilea
proprietar dacă există deja unul activ. Nu există parolă implicită sau backdoor.
Detaliile deciziei sunt în `docs/authentication-design.md`.
