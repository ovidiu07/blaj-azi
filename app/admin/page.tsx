import type { Metadata } from "next";
import { AdminExperience } from "./AdminExperience";

export const metadata:Metadata={title:"Administrare",robots:{index:false,follow:false}};
export const dynamic="force-dynamic";
export default function AdminPage(){return <AdminExperience path={[]}/>}
