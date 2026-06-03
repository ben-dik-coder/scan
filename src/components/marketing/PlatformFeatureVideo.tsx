"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** Safari: original .mov. Chrome/Firefox/Edge: full .mp4 conversion (not hero-demo-play.mp4). */
const VIDEO_SOURCES = [
  { src: "/images/video/hero-demo.mov", type: "video/quicktime" },
  { src: "/images/video/hero-demo.mp4", type: "video/mp4" },
] as const;

type Props = {
  className?: string;
};

export function PlatformFeatureVideo({ className }: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;

    const io = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting && entry.intersectionRatio >= 0.05),
      { threshold: [0, 0.05, 0.15, 0.35, 0.6], rootMargin: "0px 0px 120px 0px" }
    );

    io.observe(box);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.setAttribute("webkit-playsinline", "true");

    if (!visible) {
      video.pause();
      return;
    }

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const tryPlay = () => {
      if (cancelled || !videoRef.current) return;

      void videoRef.current.play().catch(() => {
        if (!cancelled) {
          retryTimer = setTimeout(tryPlay, 200);
        }
      });
    };

    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      video.load();
    }

    tryPlay();

    const events = ["loadedmetadata", "loadeddata", "canplay", "canplaythrough"] as const;
    events.forEach((event) => video.addEventListener(event, tryPlay));

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      events.forEach((event) => video.removeEventListener(event, tryPlay));
    };
  }, [visible]);

  return (
    <div
      ref={boxRef}
      className={cn("w-full shrink-0 overflow-hidden bg-white", className)}
    >
      {/*
        Original hero-demo.mov / hero-demo.mp4 (not hero-demo-play.mp4).
        73% max width (27% smaller than full); white bg so object-contain letterboxing stays invisible.
      */}
      <div className="relative mx-auto aspect-video w-full max-w-[73%] min-h-[11rem] overflow-hidden bg-white sm:min-h-[12.5rem]">
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full bg-white object-contain object-center"
          muted
          loop
          playsInline
          preload="auto"
          disablePictureInPicture
          controls={false}
          aria-label="Demo — finn riktige firma i NyLead"
          onContextMenu={(e) => e.preventDefault()}
        >
          {VIDEO_SOURCES.map(({ src, type }) => (
            <source key={src} src={src} type={type} />
          ))}
        </video>
      </div>
    </div>
  );
}
