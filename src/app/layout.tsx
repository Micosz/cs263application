import type { Metadata, Viewport } from "next";
import { Anuphan, JetBrains_Mono } from "next/font/google";
import { KeyboardInset } from "@/components/KeyboardInset";
import "./globals.css";

const anuphan = Anuphan({
  variable: "--font-anuphan",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["500"],
});

export const metadata: Metadata = {
  title: { default: "ระบบติดตามครุภัณฑ์", template: "%s · ระบบติดตามครุภัณฑ์" },
  description: "ระบบติดตามครุภัณฑ์ สาขาวิชาวิทยาการคอมพิวเตอร์ มหาวิทยาลัยธรรมศาสตร์",
  icons: { icon: "/tu-seal.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // ให้เบราว์เซอร์ Android ย่อพื้นที่เมื่อคีย์บอร์ดขึ้น ปุ่มยืนยันจึงไม่ถูกบัง
  interactiveWidget: "resizes-content",
  themeColor: "#FFFFFF",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className={`${anuphan.variable} ${mono.variable}`}>
      <body>
        <KeyboardInset />
        {children}
      </body>
    </html>
  );
}
