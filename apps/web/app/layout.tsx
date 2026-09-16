import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KÖR | Digital menu",
  description: "A faster, calmer way to order at your table.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
