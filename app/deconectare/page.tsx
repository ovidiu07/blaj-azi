import type { Metadata } from "next";
import { AuthPage, LogoutForm } from "../ui/AuthForms";

export const metadata: Metadata = { title: "Deconectare", robots: { index: false, follow: false } };

export default function LogoutPage() {
  return <AuthPage eyebrow="Sesiunea ta" title="Vrei să te deconectezi?" copy="Sesiunea va fi revocată pe server și eliminată de pe acest dispozitiv."><LogoutForm /></AuthPage>;
}
