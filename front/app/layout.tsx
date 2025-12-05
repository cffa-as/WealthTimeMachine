import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { PhoneFrame } from "@/components/phone-frame"
import "./globals.css"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "财务时光机 - 用故事规划你的未来",
  description: "智能财务规划工具，用温暖的故事帮助你看到未来的自己",
  generator: "v0.app",
  icons: {
    icon: "/icon.jpg",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-CN">
      <body className={`font-sans antialiased`}>
        <PhoneFrame>
          {children}
        </PhoneFrame>
      </body>
    </html>
  )
}
