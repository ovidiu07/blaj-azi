export type PublicBase = {
  id: string;
  contentId?: number;
  entityId?: number;
  locality?: string;
  description?: string;
  source?: string;
  isDemo?: boolean;
  updatedAt?: string;
  verifiedAt?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  image?: string;
};

export type PublicEvent = PublicBase & {
  title: string; date: string; startDate: string; endDate?: string; time: string;
  place: string; venue?: string; organizer?: string; category: string; price: string;
  accessibility?: string; isFree: boolean; image: string;
};
export type PublicBusiness = PublicBase & { name: string; category: string; phone?: string; email?: string; website?: string; promoted: boolean; verified?: boolean };
export type PublicOffer = PublicBase & { title: string; business: string; category?: string; price: string; priceValue?: number; old: string; oldPriceValue?: number; startsAt: string; endsAt: string; until: string; terms?: string; availability?: string; promoted?: boolean };
export type PublicRestaurant = PublicBase & { name: string; type: string; dish: string; price: string; services: string; phone?: string; delivery: boolean; pickup: boolean; dietaryOptions?: string };
export type PublicJob = PublicBase & { title: string; company: string; type: string; schedule: string; salary: string; salaryDisclosed: boolean; transport: boolean; requirements?: string; benefits?: string; applicationMethod?: string; applyUrl?: string; deadline?: string };
export type PublicPlace = PublicBase & { title: string; eyebrow: string; image: string; text: string; source: string; accessibility?: string };
export type PublicPost = PublicBase & { title: string; excerpt: string; body: string; type: string; category?: string; author: string; business?: string };
export type PublicCatalog = { events: PublicEvent[]; businesses: PublicBusiness[]; offers: PublicOffer[]; restaurants: PublicRestaurant[]; jobs: PublicJob[]; places: PublicPlace[]; posts: PublicPost[] };
export type PublicViewer = { signedIn: boolean; canEdit: boolean; canAdmin: boolean };
