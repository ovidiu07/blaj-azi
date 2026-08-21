import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CreateHub, DetailPage, DiscoverPage, ListingPage, SearchPage, StaticPage, SubmissionPage } from "../ui/PublicPages";
import { routes } from "../data";
import { loadPublicCatalog } from "../server/public-data";
import { canManageEntity, getOptionalAccount, isAdmin } from "../server/platform";

type RawParams = Record<string, string | string[] | undefined>;
const filterKeys = new Set(["q","type","locality","category","period","cost","verified","service","salary","transport","sort"]);
function first(value:string|string[]|undefined){return Array.isArray(value)?value[0]:value;}
function safeParams(input:RawParams){const output:Record<string,string>={};for(const[key,value]of Object.entries(input)){const item=first(value)?.trim();if(filterKeys.has(key)&&item&&item.length<=120&&/^[\p{L}\p{N}\s.,+\-_/]{1,120}$/u.test(item))output[key]=item;}return output;}

export async function generateMetadata({params}:{params:Promise<{slug:string[]}>}):Promise<Metadata>{
  const {slug}=await params;const catalog=await loadPublicCatalog();const current=routes.find(([key])=>key===slug[0]);
  const pools:Record<string,Array<{id:string;title?:string;name?:string;description?:string;image?:string;isDemo?:boolean}>>={evenimente:catalog.events,"afaceri-si-servicii":catalog.businesses,"oferte-locale":catalog.offers,"unde-mancam":catalog.restaurants,"locuri-de-munca":catalog.jobs,"descopera-blaj":catalog.places,"povesti-locale":catalog.posts};
  const detail=slug[1]?pools[slug[0]]?.find(item=>item.id===slug[1]):undefined;const title=detail?.title||detail?.name||current?.[1]||(slug[0]==="cauta"?"Caută în Blaj":slug[0]==="adauga"?"Adaugă informație":"Blaj Azi");const description=detail?.description?.slice(0,155)||`${title} — informație locală clară și verificată pentru Blaj și împrejurimi.`;const image=detail?.image;
  return {title,description,alternates:{canonical:`/${slug.join("/")}`},robots:slug[0]==="cauta"||detail?.isDemo?{index:false,follow:true}:undefined,openGraph:{title,description,type:slug[0]==="povesti-locale"?"article":"website",url:`/${slug.join("/")}`,images:image?[{url:image,alt:title}]:[]},twitter:{card:image?"summary_large_image":"summary",title,description,images:image?[image]:[]}};
}

export default async function CatchAllPage({params,searchParams}:{params:Promise<{slug:string[]}>;searchParams:Promise<RawParams>}){
  const {slug}=await params;const raw=await searchParams;const query=safeParams(raw);const[section,id]=slug;const catalog=await loadPublicCatalog();
  if(id){const pools:Record<string,Array<{id:string;contentId?:number}>>={evenimente:catalog.events,"afaceri-si-servicii":catalog.businesses,"oferte-locale":catalog.offers,"unde-mancam":catalog.restaurants,"locuri-de-munca":catalog.jobs,"descopera-blaj":catalog.places,"povesti-locale":catalog.posts};const item=pools[section]?.find(entry=>entry.id===id);if(!item)notFound();const account=await getOptionalAccount().catch(()=>null);const canEdit=Boolean(account&&item.contentId&&await canManageEntity(account,item.contentId));return <DetailPage section={section} id={id} catalog={catalog} viewer={{signedIn:Boolean(account),canEdit,canAdmin:Boolean(account&&isAdmin(account))}}/>;}
  if(section==="descopera-blaj")return <DiscoverPage catalog={catalog}/>;
  if(["evenimente","afaceri-si-servicii","oferte-locale","unde-mancam","locuri-de-munca","informatii-utile","povesti-locale"].includes(section))return <ListingPage slug={section} catalog={catalog} initialFilters={query}/>;
  if(section==="cauta")return <SearchPage initial={query.q||""} initialType={query.type||"all"} catalog={catalog}/>;
  if(section==="adauga")return <CreateHub/>;
  if(["adauga-o-afacere","adauga-un-eveniment","adauga-o-oferta","adauga-un-job","contribuie","contact","promovare"].includes(section)){const account=await getOptionalAccount().catch(()=>null);const kinds:Record<string,string>={"adauga-o-afacere":"business","adauga-un-eveniment":"event","adauga-o-oferta":"offer","adauga-un-job":"job",contribuie:"contribution",contact:"contact",promovare:"promotion"};let context;const target=Number(first(raw.target));if(section==="contact"&&target){const item=[...catalog.events,...catalog.businesses,...catalog.offers,...catalog.restaurants,...catalog.jobs,...catalog.places,...catalog.posts].find(entry=>entry.contentId===target);if(item)context={targetContentId:target,targetTitle:"title" in item?item.title:item.name,targetUrl:first(raw.from)?.startsWith("/")?first(raw.from):undefined};}return <SubmissionPage kind={kinds[section]} account={account?{displayName:account.displayName,email:account.email}:null} context={context}/>;}
  if(["despre","confidentialitate","cookie-uri","termeni"].includes(section))return <StaticPage slug={section}/>;
  notFound();
}
