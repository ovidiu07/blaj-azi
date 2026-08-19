# Autentificare Blaj Azi — notă de proiectare

## Cauza problemei

Aplicația protejează în prezent `/cont` și `/admin` exclusiv prin headerele de
identitate `oai-authenticated-user-*` injectate de platforma de găzduire. În
mediul local, ruta rezervată `/signin-with-chatgpt` nu este preluată de acel
dispatcher, ajunge în ruta publică catch-all și afișează pagina generică
„Despre Blaj Azi”. Nu există o identitate cu parolă, un formular de conectare
sau o sesiune proprie aplicației.

## Abordarea aleasă

Păstrăm vinext, D1, schema de utilizatori și toate contractele de autorizare
existente. Adăugăm un modul intern, restrâns, pentru e-mail/parolă și sesiuni
opace. Nu introducem un framework de autentificare nou: Better Auth este activ
menținut și oferă protecții bune, dar ar adăuga propriile modele de utilizator,
cont și sesiune, plus o integrare de adaptor care nu este documentată pentru
combinația exactă vinext beta + Sites + schema D1 existentă. Migrarea acestor
contracte ar avea un risc mai mare decât extensia incrementală de aici.

Workers oferă Web Crypto nativ și suportă PBKDF2. Parolele vor folosi
`PBKDF2-HMAC-SHA-256`, o sare aleatoare unică, 600.000 de iterații și un format
versionat. Alegerea urmează recomandarea OWASP pentru PBKDF2-HMAC-SHA-256 și
evită module native incompatibile cu Workers. Comparația rezultatului derivat
este făcută în timp constant.

Surse primare și de securitate consultate:

- [Cloudflare Workers Web Crypto](https://developers.cloudflare.com/workers/runtime-apis/web-crypto/)
- [Cloudflare D1 `batch()` și prepared statements](https://developers.cloudflare.com/d1/worker-api/d1-database/)
- [vinext — suport App Router, route handlers și bindings Workers](https://github.com/cloudflare/vinext/blob/main/README.md)
- [Next.js — cookies în Route Handlers](https://nextjs.org/docs/app/api-reference/functions/cookies)
- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)

## Schimbări de schemă și compatibilitate

Adăugăm fără a redenumi sau recrea tabelele existente:

- `auth_identities` — furnizorul și subiectul extern, separat de utilizator;
- `password_credentials` — hash-ul versionat, sarea și parametrul de cost;
- `auth_sessions` — numai hash-ul tokenului, expirare și revocare;
- `auth_attempts` — evenimente cu chei pseudonimizate pentru limitarea abuzului;
- marcaje de acceptare a Termenilor și Politicii de confidențialitate pe
  utilizator.

Utilizatorii existenți rămân neschimbați. La următoarea autentificare găzduită,
identitatea ChatGPT existentă este înregistrată în `auth_identities`. Nu legăm
niciodată două identități doar pentru că șirurile de e-mail coincid. Un conflict
de e-mail între subiecte diferite este oprit explicit.

## Sesiuni

Browserul primește un token aleator de 256 biți, fără date despre utilizator.
În D1 se păstrează numai SHA-256(token). Cookie-ul este `HttpOnly`, host-only,
`SameSite=Lax`, `Path=/`, are expirare explicită și primește `Secure` în HTTPS.
Sesiunea normală expiră după 12 ore; opțiunea „Ține-mă minte” extinde perioada
la 30 de zile. O autentificare reușită înlocuiește sesiunea curentă, logout-ul o
revocă pe server și șterge cookie-ul, iar sesiunile expirate sau revocate nu
sunt acceptate.

## Identitate găzduită și precedență

Resolverul central verifică mai întâi sesiunea proprie. Dacă nu există o
sesiune validă, verifică headerele de încredere ale platformei. O sesiune cu
parolă nu poate suprascrie rolul din cookie — rolul și starea contului sunt
citite din D1 la fiecare rezolvare. Headerele găzduite sunt acceptate doar din
API-ul server-side existent; valorile trimise în formulare nu sunt identitate.

## Administratori și limite de securitate

Înregistrarea creează întotdeauna rolul `user` și ignoră orice câmp de rol,
proprietar sau membership furnizat de client. `/admin/*` folosește aceeași
autentificare, apoi verifică rolul în D1 pe server. API-urile `/cont/*` păstrează
verificările de identitate și proprietate; API-urile `/admin/*` păstrează
verificarea de rol și auditul privilegiat.

`ADMIN_EMAIL` nu promovează o înregistrare cu parolă. Bootstrap-ul găzduit
existent rămâne limitat identității ChatGPT de încredere. Pentru primul
administrator cu parolă adăugăm o comandă explicită de provisioning care
lucrează direct asupra bazei controlate de operator, nu o parolă implicită sau
o rută publică de promovare.

Înregistrarea și conectarea aplică limite persistente în D1 pe o cheie SHA-256
derivată din acțiune, e-mail normalizat și IP-ul furnizat de infrastructură.
Erorile de login sunt generice, inclusiv pentru cont inexistent, suspendat sau
parolă greșită. Toate mutațiile păstrează validarea same-origin/Fetch Metadata,
iar `return_to` acceptă numai căi relative same-origin și exclude rutele de
autentificare pentru a evita bucle și redirecturi deschise.
