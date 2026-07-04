"use client";

import { memo } from "react";
import Image from "next/image";

interface BannerCarouselProps {
  /** 旧Firestoreバナー用のフィルタ（現在は未使用・互換のため残置） */
  location?: string;
  /** フォールバック画像URL（現在は未使用・互換のため残置） */
  bannerImageUrl?: string;
}

export default memo(function BannerCarousel({}: BannerCarouselProps = {}) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gray-100">
      <Image
        src="/ad-banner.png"
        alt=""
        width={1024}
        height={576}
        className="w-full aspect-video object-cover"
      />
    </div>
  );
});
