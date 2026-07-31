import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://conselho-em-foco-felip.fcm-fisica.chatgpt.site"),
  title: "Conselho em Foco",
  description:
    "Avaliações pedagógicas colaborativas com análises automáticas para o conselho de classe.",
  openGraph: {
    title: "Conselho em Foco",
    description: "Cada olhar importa. O conjunto orienta.",
    images: [{ url: "/og.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Conselho em Foco",
    description: "Cada olhar importa. O conjunto orienta.",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
