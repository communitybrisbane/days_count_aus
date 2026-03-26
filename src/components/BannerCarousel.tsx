"use client";

import { useEffect, useState, useRef } from "react";
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface Banner {
  id: string;
  imageUrl: string;
  linkUrl?: string;
  order: number;
}

interface BannerCarouselProps {
  /** Firestore banners コレクションの location フィールドでフィルタ ("home" | "mypage" | "community") */
  location?: string;
  /** フォールバック画像URL */
  bannerImageUrl?: string;
}

export default function BannerCarousel({ location, bannerImageUrl }: BannerCarouselProps = {}) {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [current, setCurrent] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    async function fetchBanners() {
      try {
        const constraints = [
          where("active", "==", true),
          orderBy("order", "asc"),
        ];
        if (location) {
          constraints.unshift(where("location", "==", location));
        }
        const q = query(collection(db, "banners"), ...constraints);
        const snap = await getDocs(q);
        const items = snap.docs.map((d) => ({
          id: d.id,
          imageUrl: d.data().imageUrl || "",
          linkUrl: d.data().linkUrl || "",
          order: d.data().order || 0,
        }));
        setBanners(items.filter((b) => b.imageUrl));
      } catch (e) {
        console.error("Failed to fetch banners:", e);
      }
    }
    fetchBanners();
  }, [location]);

  // Auto-rotate every 5 seconds
  useEffect(() => {
    if (banners.length <= 1) return;
    timerRef.current = setInterval(() => {
      setCurrent((prev) => (prev + 1) % banners.length);
    }, 5000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [banners.length]);

  const defaultAd: Banner = { id: "default-ad", imageUrl: "/ad-banner.png", order: 0 };
  const displayBanners =
    banners.length > 0
      ? banners
      : bannerImageUrl
        ? [{ id: "config-banner", imageUrl: bannerImageUrl, order: 0 }]
        : [defaultAd];

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gray-100">
      <div
        className="flex transition-transform duration-500 ease-in-out"
        style={{ transform: `translateX(-${current * 100}%)` }}
      >
        {displayBanners.map((banner) => (
          <div key={banner.id} className="w-full shrink-0">
            {banner.linkUrl ? (
              <a href={banner.linkUrl} target="_blank" rel="noopener noreferrer">
                <img
                  src={banner.imageUrl}
                  alt=""
                  className="w-full aspect-video object-cover" loading="lazy"
                />
              </a>
            ) : (
              <img
                src={banner.imageUrl}
                alt=""
                className="w-full aspect-video object-cover" loading="lazy"
              />
            )}
          </div>
        ))}
      </div>
      {/* Dots */}
      {displayBanners.length > 1 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
          {displayBanners.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === current ? "bg-white w-4" : "bg-white/50 w-1.5"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
