import localFont from "next/font/local";

// Gotham — UI font family. Medium is the body default; bolder weights are
// available for headings/emphasis via Tailwind's font-bold / font-black classes.
export const gotham = localFont({
  src: [
    {
      path: "../../public/fonts/gotham/book/gotham-book-webfont.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/fonts/gotham/book/gotham-bookitalic-webfont.woff2",
      weight: "400",
      style: "italic",
    },
    {
      path: "../../public/fonts/gotham/medium/gotham-medium-webfont.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../public/fonts/gotham/medium/gotham-mediumitalic-webfont.woff2",
      weight: "500",
      style: "italic",
    },
    {
      path: "../../public/fonts/gotham/bold/gotham-bold-webfont.woff2",
      weight: "700",
      style: "normal",
    },
    {
      path: "../../public/fonts/gotham/bold/gotham-bolditalic-webfont.woff2",
      weight: "700",
      style: "italic",
    },
    {
      path: "../../public/fonts/gotham/black/gotham-black-webfont.woff2",
      weight: "900",
      style: "normal",
    },
    {
      path: "../../public/fonts/gotham/black/gotham-blackitalic-webfont.woff2",
      weight: "900",
      style: "italic",
    },
  ],
  variable: "--font-gotham",
  display: "swap",
});
