import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Connectly | Modern Chat",
  description: "High-performance real-time messaging.",
  manifest: "/manifest.json",
};

export const viewport = {
  themeColor: "#202c33",
};

import { AuthProvider } from "@/context/AuthContext";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`font-sans h-screen antialiased`}
    >
      <body className="h-screen overflow-hidden flex flex-col">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
