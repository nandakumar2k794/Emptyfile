import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SIH26057 — AI Marine Debris Detection | Side-Scan Sonar Dashboard",
  description:
    "AI-Powered Automated Underwater Marine Debris Detection System using Side-Scan Sonar Imagery. Real-time tactical dashboard with YOLOv8-Seg inference, acoustic shadow analysis, and GeoJSON mapping.",
  keywords: [
    "marine debris detection",
    "side-scan sonar",
    "YOLOv8",
    "underwater",
    "AI",
    "Smart India Hackathon",
    "SIH26057",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        {/* Inter font for UI, JetBrains Mono for data readouts */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        {/* Mapbox GL JS CSS */}
        <link
          href="https://api.mapbox.com/mapbox-gl-js/v3.9.4/mapbox-gl.css"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
