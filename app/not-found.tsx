import type { Metadata } from "next";
import { getNotFoundPage } from "@/lib/wp";
import { WpPage } from "./wp-page";

export const metadata: Metadata = {
  title: { absolute: "Page not found | Junayed Leon" },
  robots: { index: false },
};

export default async function NotFound() {
  const data = await getNotFoundPage();
  if (!data) return <p style={{ padding: 80, textAlign: "center" }}>Page not found.</p>;
  return <WpPage data={data} />;
}
