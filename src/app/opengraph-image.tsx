import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "days-count — count the days that count";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://days-count.com";

  const [iconData, kangarooData] = await Promise.all([
    fetch(`${baseUrl}/icons/icon-512x512.png`).then((r) => r.arrayBuffer()),
    fetch(`${baseUrl}/icons/kangaroo-like.png`).then((r) => r.arrayBuffer()),
  ]);

  const iconSrc = `data:image/png;base64,${Buffer.from(iconData).toString("base64")}`;
  const kangarooSrc = `data:image/png;base64,${Buffer.from(kangarooData).toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #1A3C2E 0%, #2D6B4F 50%, #1A3C2E 100%)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Subtle glow accents */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0.08,
            backgroundImage:
              "radial-gradient(circle at 25% 75%, #FF6D00 0%, transparent 50%), radial-gradient(circle at 75% 25%, #FF8C00 0%, transparent 50%)",
            display: "flex",
          }}
        />

        {/* Large kangaroo watermark bottom-right */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={kangarooSrc}
          alt=""
          width={420}
          height={420}
          style={{
            position: "absolute",
            bottom: -40,
            right: -20,
            opacity: 0.08,
          }}
        />

        {/* Orange accent bar top */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 6,
            background: "linear-gradient(90deg, #FF6D00, #FF8C00, #FF6D00)",
            display: "flex",
          }}
        />

        {/* Main content — horizontal layout */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 48,
          }}
        >
          {/* App icon */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={iconSrc}
            alt=""
            width={200}
            height={200}
            style={{
              borderRadius: 44,
              boxShadow: "0 12px 48px rgba(0,0,0,0.4)",
            }}
          />

          {/* Text block */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {/* App name */}
            <h1
              style={{
                fontSize: 68,
                fontWeight: 900,
                color: "white",
                letterSpacing: "-2px",
                margin: 0,
                lineHeight: 1,
              }}
            >
              days-count
            </h1>

            {/* Divider */}
            <div
              style={{
                width: 80,
                height: 3,
                borderRadius: 2,
                background: "#FF6D00",
                marginTop: 8,
                display: "flex",
              }}
            />

            {/* Subtitle */}
            <p
              style={{
                fontSize: 28,
                color: "rgba(255,255,255,0.6)",
                margin: 0,
                marginTop: 4,
                letterSpacing: "1px",
              }}
            >
              count the days that count
            </p>

            {/* Feature pills */}
            <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
              {["Working Holiday", "Journal", "Community"].map((label) => (
                <div
                  key={label}
                  style={{
                    background: "rgba(255,109,0,0.15)",
                    border: "1px solid rgba(255,109,0,0.3)",
                    borderRadius: 20,
                    padding: "6px 18px",
                    fontSize: 16,
                    color: "#FF8C00",
                    fontWeight: 600,
                    display: "flex",
                  }}
                >
                  {label}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 6,
            background: "linear-gradient(90deg, #FF6D00, #FF8C00, #FF6D00)",
            display: "flex",
          }}
        />

        {/* Domain */}
        <p
          style={{
            position: "absolute",
            bottom: 24,
            right: 40,
            fontSize: 18,
            color: "rgba(255,255,255,0.3)",
            margin: 0,
          }}
        >
          days-count.com
        </p>
      </div>
    ),
    { ...size }
  );
}
