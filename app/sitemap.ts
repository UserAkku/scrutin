import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  return [
    "",
    "/sample",
    "/login",
    "/signup"
  ].map((path) => ({
    url: `${base}${path}`,
    lastModified: new Date()
  }));
}
