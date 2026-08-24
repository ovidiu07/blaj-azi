# Sistemul de date demonstrative

Sistemul creează un lot determinist de conținut sintetic pentru verificarea locală a platformei Blaj Azi. Nu este activ implicit, nu rulează la pornirea aplicației și nu modifică nimic în producție fără o activare și o acțiune administrativă explicite.

## Garanții de bază

- Accesul este verificat server-side: utilizatorul trebuie să aibă rolul `admin` sau `platform_owner`.
- Capabilitatea trebuie activată server-side cu `DEMO_DATA_ADMIN_ENABLED=true`. Cu valoarea implicită `false`, ruta nu apare în meniul admin, iar serviciul răspunde ca funcționalitate indisponibilă.
- Vizibilitatea implicită este `hidden`. Filtrul public nu folosește doar `is_demo`; acceptă un exemplu demo numai când setarea este `public` și rândul are o intrare activă în `demo_data_items`, legată de un lot `active`.
- Datele demo vechi, fără manifest de lot, nu devin publice prin acest comutator și nu sunt șterse automat.
- Generatorul folosește aceleași validatoare de rich text, URL-uri, câmpuri obligatorii și aceiași scriitori pe tip ca fluxul real de conținut.
- Fiecare înregistrare are `is_demo=1`, titlu `[DEMO]`, avertisment în rezumat și corp, date de contact `example.invalid`, imagine cu marcaj vizibil și metadate media complete.
- Ștergerea refuză să pornească dacă legătura lot → manifest → content → tabel de tip → media → cheie R2 nu poate fi dovedită integral.
- Jurnalul `audit_logs` se păstrează. Înregistrările reale și demo-urile fără lot sunt santinele protejate.

## Matricea canonică

Manifestul se află în `app/demo-data.ts`. Sunt create exact două exemple pentru fiecare categorie rezolvată:

| Tip | Sursa categoriilor | Categorii în schema inițială | Total |
| --- | --- | ---: | ---: |
| `business` | tabelul `categories`, tip `business` | 4 | 8 |
| `event` | tabelul `categories`, tip `event` | 3 | 6 |
| `offer` | manifest exclusiv demo | 3 | 6 |
| `job` | manifest exclusiv demo | 4 | 8 |
| `restaurant` | manifest exclusiv demo | 3 | 6 |
| `daily_menu` | manifest exclusiv demo | 1 | 2 |
| `place` | manifest exclusiv demo | 3 | 6 |
| `community_post` | tabelul `categories`, tip `post` | 2 | 4 |
| `local_story` | tabelul `categories`, tip `post` | 2 | 4 |
| `business_update` | tabelul `categories`, tip `post` | 2 | 4 |
| `article` | tabelul `categories`, tip `post`; creare numai de administrator | 2 | 4 |
| **Total inițial** |  |  | **58** |

Dacă taxonomia persistentă se schimbă, ecranul admin recalculează matricea și totalul înainte de generare. Fallback-urile sunt folosite numai dacă o familie de categorii DB este complet goală și sunt etichetate ca `demo-only` în interfață.

## Imagini

Fișierele sursă se află în `public/demo-fixtures/`. Există câte un PNG pe tip, reutilizat ca sursă vizuală, dar copiat în R2 sub o cheie distinctă și deterministă pentru fiecare înregistrare:

```text
demo-data/<batch-id>/<seed-key>.png
```

Înainte de upload, codul citește bytes-ii prin binding-ul static `ASSETS` și folosește `inspectImage`, același validator ca upload-ul obișnuit. Sunt verificate semnătura și structura reală a PNG-ului, dimensiunile și limita de bytes; extensia sau `Content-Type` nu sunt considerate suficiente.

Imaginile au fost create cu generatorul bitmap integrat, folosind o familie coerentă de ilustrații editoriale, fără mărci sau persoane reale, și instrucțiunea obligatorie ca bannerul `DEMO — IMAGINE DE TEST` să fie mare, contrastant și lizibil. Prompturile au cerut scene distincte pentru afacere, eveniment, ofertă, job, restaurant, meniu zilnic, loc, postare comunitară, poveste locală, actualizare de afacere și articol.

Metadatele persistate includ alt text, autor/credit, licență, MIME, dimensiune, lățime, înălțime, proprietar admin și status `approved`. Hash-ul fixture-ului include manifestul complet și SHA-256-ul imaginii.

## Activare și utilizare locală

1. Aplică migrarea locală `drizzle/0010_demo_data_batches.sql` folosind fluxul local existent al proiectului. Nu aplica migrarea remote pentru o probă locală.
2. Setează `DEMO_DATA_ADMIN_ENABLED=true` numai în mediul local de rulare. Nu comite secrete și nu modifica binding-urile de producție.
3. Pornește aplicația prin comanda locală obișnuită și autentifică-te cu un cont admin local.
4. Deschide `/admin/date-demonstrative`.
5. Verifică matricea și totalul așteptat. Alege explicit `Ascunsă public` pentru pregătire sau `Vizibilă public` pentru verificarea rutelor publice locale.
6. Apasă `Generează datele demonstrative`. Mesajul final separă înregistrările create, actualizate și neschimbate.
7. Repetă acțiunea pentru proba de idempotency: la același manifest și aceeași dată operațională, nu apar duplicate.

Lotul are un ID derivat din `DEMO_GENERATOR_VERSION`, iar fiecare element are un `seed_key` unic. O singură operație poate deține lotul la un moment dat. Blocările de generare mai vechi de zece minute pot fi recuperate, însă scrierile continuă să fie condiționate de tokenul operației și de versiunea curentă a conținutului.

## Vizibilitate publică

Comutatorul nu rescrie statutul fiecărui rând. El actualizează `platform_settings.demo_visibility`, iar query-urile publice și livrarea media aplică aceeași regulă server-side:

```text
conținut real
SAU
(conținut demo + element de manifest activ + lot activ + setare public)
```

Exemplele vizibile au badge `Exemplu demonstrativ`. O afacere demo marcată tehnic ca verificată afișează `Verificare demonstrativă`, nu `Verificată`. Paginile de detaliu demo au `noindex` și omit JSON-LD pentru entități reale. Fallback-ul fără D1 întoarce colecții goale și nu publică automat vechile constante demo.

## Curățare sigură

Curățarea are două etape obligatorii:

1. `Previzualizează exact ce va fi șters` recitește loturile și dovedește fiecare țintă. Tokenul rezultat expiră după zece minute.
2. Administratorul bifează confirmarea și scrie exact `ȘTERGE DATELE DEMONSTRATIVE`.

Înainte de ștergere, vizibilitatea devine `hidden`. Obiectele R2 sunt șterse înaintea rândurilor D1. Dacă un delete R2 eșuează, D1 rămâne intact, lotul devine `failed`, iar operația poate fi previzualizată și reîncercată. Abia după ce toate obiectele au fost eliminate sunt șterse reviziile, moderările, dependențele create pentru conținut, rândul specific tipului, metadatele media și `content_records`.

Rândurile din `demo_data_items` și `demo_data_batches` rămân ca manifest de audit, cu starea `deleted`. Auditul operațional rămâne de asemenea disponibil.

## Validare

Testul dedicat poate fi rulat separat:

```bash
node --experimental-loader ./tests/cloudflare-loader.mjs --test tests/demo-data.test.mjs
```

El validează:

- cele 11 tipuri, totalul inițial 58 și unicitatea cheilor;
- bytes PNG reali pentru toate fixture-urile;
- rolul admin și feature flag-ul;
- prima generare, rerularea fără duplicate și comutarea hidden/public;
- imagini aprobate și selectate prin fluxul public;
- previzualizarea, fraza exactă, curățarea D1/R2 și păstrarea santinelelor reale/demo neadministrate;
- integritatea SQLite după curățare.

Pentru regresia completă:

```bash
npm run lint
npm test
```

Aceste probe sunt locale/mock pentru D1, R2 și ASSETS. Ele nu reprezintă dovadă de binding-uri hosted, sesiune admin hosted sau deploy.

## Limită de operare

Această implementare nu execută deploy, nu aplică migrări remote și nu scrie în D1/R2 hosted. Orice validare hosted sau activare în producție necesită o autorizare separată și o verificare explicită a mediului, binding-urilor, contului admin și planului de rollback.
