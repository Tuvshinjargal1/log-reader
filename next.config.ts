import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `next dev` ажиллаж байхад `next build` хийвэл ижил `.next` лүү бичээд dev
  // server-ыг эвддэг. NEXT_DIST_DIR-ээр тусад нь build хийж шалгах боломжтой:
  //   NEXT_DIST_DIR=.next-build npm run build
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
};

export default nextConfig;
