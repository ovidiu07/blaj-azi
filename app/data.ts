export const routes = [
  ["descopera-blaj", "Descoperă Blaj"], ["evenimente", "Evenimente"], ["afaceri-si-servicii", "Afaceri și servicii"],
  ["oferte-locale", "Oferte locale"], ["unde-mancam", "Unde mâncăm"], ["locuri-de-munca", "Locuri de muncă"],
  ["informatii-utile", "Informații utile"], ["povesti-locale", "Povești locale"], ["adauga-o-afacere", "Adaugă o afacere"], ["adauga-un-eveniment", "Adaugă un eveniment"],
  ["adauga-o-oferta", "Adaugă o ofertă"], ["adauga-un-job", "Adaugă un job"], ["contribuie", "Contribuie"],
  ["promovare", "Promovare"], ["despre", "Despre Blaj Azi"], ["contact", "Contact"],
  ["confidentialitate", "Politica de confidențialitate"], ["cookie-uri", "Politica privind cookie-urile"], ["termeni", "Termeni și condiții"],
] as const;

export const events = [
  { id: "atelier-micilor-exploratori", title: "Atelierul micilor exploratori", date: "15 august 2026", startDate: "2026-08-15T10:30:00+03:00", time: "10:30", place: "Spațiu comunitar — locație demonstrativă", category: "Copii", price: "Gratuit", image: "/images/campia-libertatii.jpg" },
  { id: "seara-de-film", title: "Seară de film în aer liber", date: "22 august 2026", startDate: "2026-08-22T20:30:00+03:00", time: "20:30", place: "Blaj — locație în curs de confirmare", category: "Comunitate", price: "Acces liber", image: "/images/palatul-cultural.jpg" },
  { id: "tur-arhitectura", title: "Tur de arhitectură: centrul vechi", date: "29 august 2026", startDate: "2026-08-29T11:00:00+03:00", time: "11:00", place: "Piața 1848 — punct demonstrativ", category: "Cultură", price: "Pe bază de înscriere", image: "/images/catedrala-blaj.jpg" },
];

export const businesses = [
  { id: "atelierul-de-acasa", name: "Atelierul de Acasă", category: "Reparații și amenajări", locality: "Blaj", phone: "07xx xxx xxx", promoted: true },
  { id: "cabinet-pediatrie", name: "Cabinet Pediatrie Central", category: "Sănătate", locality: "Blaj", phone: "07xx xxx xxx", promoted: false },
  { id: "service-auto-tarnave", name: "Service Auto Târnave", category: "Auto", locality: "Sâncel", phone: "07xx xxx xxx", promoted: false },
  { id: "lectii-cu-ana", name: "Lecții cu Ana", category: "Educație și meditații", locality: "Blaj", phone: "07xx xxx xxx", promoted: false },
];

export const offers = [
  { id: "revizie-bicicleta", title: "Revizie de bază pentru bicicletă", business: "Atelier local demonstrativ", price: "79 lei", old: "99 lei", until: "31 august 2026" },
  { id: "meniu-familie", title: "Pachet de prânz pentru familie", business: "Bucătărie locală demonstrativă", price: "109 lei", old: "129 lei", until: "24 august 2026" },
  { id: "sedinta-foto", title: "Mini-ședință foto de familie", business: "Studio foto demonstrativ", price: "180 lei", old: "220 lei", until: "30 septembrie 2026" },
];

export const restaurants = [
  { id: "bucatarie-de-blaj", name: "Bucătărie de Blaj", type: "Meniul zilei", dish: "Ciorbă de legume · pui la cuptor cu cartofi", price: "34 lei", services: "Ridicare · Livrare" },
  { id: "cafeneaua-din-piata", name: "Cafeneaua din Piață", type: "Cafenea", dish: "Cafea de specialitate · desertul zilei", price: "de la 12 lei", services: "La locație · Ridicare" },
  { id: "cuptorul-bun", name: "Cuptorul Bun", type: "Brutărie", dish: "Pâine cu maia · produse de patiserie", price: "de la 7 lei", services: "Ridicare" },
];

export const jobs = [
  { id: "operator-productie", title: "Operator producție", company: "Companie demonstrativă", locality: "Blaj", type: "Normă întreagă", schedule: "Schimburi", salary: "Salariu comunicat la interviu", transport: true },
  { id: "asistent-vanzari", title: "Asistent vânzări", company: "Magazin local demonstrativ", locality: "Blaj", type: "Normă întreagă", schedule: "Program în ture", salary: "3.500–4.000 lei brut", transport: false },
  { id: "contabil-junior", title: "Contabil junior", company: "Birou demonstrativ", locality: "Jidvei", type: "Part-time", schedule: "Flexibil", salary: "Negociabil", transport: false },
];

export const places = [
  { id: "campia-libertatii", title: "Câmpia Libertății", eyebrow: "Memorie și identitate", image: "/images/campia-libertatii.jpg", text: "Un reper major al orașului, prezentat pe pagina oficială de obiective locale a Municipiului Blaj.", source: "https://municipiulblaj.ro/comunitate/obiective-locale" },
  { id: "catedrala-sfanta-treime", title: "Catedrala „Sfânta Treime”", eyebrow: "Arhitectură", image: "/images/catedrala-blaj.jpg", text: "Unul dintre reperele arhitecturale și spirituale centrale ale Blajului.", source: "https://municipiulblaj.ro/comunitate/obiective-locale" },
  { id: "palatul-cultural", title: "Palatul Cultural", eyebrow: "Cultură", image: "/images/palatul-cultural.jpg", text: "Spațiu cultural al orașului, inclus în lista oficială a obiectivelor locale.", source: "https://municipiulblaj.ro/comunitate/obiective-locale" },
  { id: "adunarea-1848", title: "Blajul anului 1848", eyebrow: "Arhivă vizuală", image: "/images/blaj-1848.jpg", text: "O imagine istorică aflată în domeniul public, păstrată în colecția Wikimedia Commons.", source: "https://commons.wikimedia.org/wiki/File:Blaj1848.jpg" },
];

export const useful = [
  { title: "Urgențe", text: "Pentru urgențe reale, apelează 112. Confirmă întotdeauna informația cu instituția responsabilă.", source: "https://www.sts.ro/ro/serviciul-112" },
  { title: "Primăria Municipiului Blaj", text: "Program, anunțuri, hotărâri și servicii publice disponibile pe site-ul oficial.", source: "https://municipiulblaj.ro" },
  { title: "Transport și mobilitate", text: "Consultă legăturile și orarele direct la operatorul de transport înainte de plecare.", source: "https://municipiulblaj.ro" },
  { title: "Sănătate și farmacii", text: "Verifică programul și serviciile direct cu unitatea medicală sau farmacia aleasă.", source: "https://www.ms.ro" },
];

export const demoNotice = "Exemplu demonstrativ — informația nu este încă verificată public.";
