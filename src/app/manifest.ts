import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Momma's Meetup",
    short_name: "Mommas",
    description: "A private, group-based calendar for local toddler outings.",
    start_url: "/calendar",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#C0356E",
    icons: [
      {
        src: "/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
