import type React from "react"
import type { Metadata } from "next"
import { Inter, Outfit } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { AuthProvider } from "@/contexts/auth-context"
import { Toaster } from "@/components/ui/sonner"

const inter = Inter({ subsets: ["latin"] })
const outfit = Outfit({ subsets: ["latin"], weight: ["500", "700"] })

export const metadata: Metadata = {
  title: "HomeHQ - Smart Home Management",
  description: "Manage your home with grocery lists, expense tracking, and family calendar",
  keywords: ["home management", "grocery lists", "expense tracking", "family calendar", "household management"],
  authors: [{ name: "" }],
  creator: "",
  publisher: "",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://homehq.app",
    title: "HomeHQ - Smart Home Management",
    description: "Manage your home with grocery lists, expense tracking, and family calendar",
    siteName: "HomeHQ",
  },
  twitter: {
    card: "summary_large_image",
    title: "HomeHQ - Smart Home Management",
    description: "Manage your home with grocery lists, expense tracking, and family calendar",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} overflow-x-hidden`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <AuthProvider>
            {children}
            <Toaster />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}



import './globals.css'