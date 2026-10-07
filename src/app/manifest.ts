import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TapSynk — AI Smart Business Cards",
    short_name: "TapSynk",
    description: "Tap to share your business card. Let AI sell and book for you.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f4f5f8",
    theme_color: "#0f1426",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
