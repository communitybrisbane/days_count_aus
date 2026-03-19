import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Days Count in AUS — count the days that count";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #1A3C2E 0%, #2D6B4F 50%, #1A3C2E 100%)",
          position: "relative",
        }}
      >
        {/* Subtle pattern overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0.06,
            backgroundImage:
              "radial-gradient(circle at 20% 80%, #FF6D00 0%, transparent 50%), radial-gradient(circle at 80% 20%, #FF8C00 0%, transparent 50%)",
            display: "flex",
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

        {/* Content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 20,
          }}
        >
          {/* App icon placeholder - rounded square */}
          <div
            style={{
              width: 120,
              height: 120,
              borderRadius: 28,
              background: "linear-gradient(135deg, #FF6D00, #FF8C00)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
            }}
          >
            <span style={{ fontSize: 64, color: "white" }}>&#x1F998;</span>
          </div>

          {/* App name */}
          <h1
            style={{
              fontSize: 72,
              fontWeight: 900,
              color: "white",
              letterSpacing: "-2px",
              textTransform: "lowercase",
              margin: 0,
              lineHeight: 1,
            }}
          >
            days count.
          </h1>

          {/* Subtitle */}
          <p
            style={{
              fontSize: 28,
              color: "rgba(255,255,255,0.6)",
              margin: 0,
              letterSpacing: "1px",
            }}
          >
            count the days that count
          </p>

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

          {/* Tagline */}
          <p
            style={{
              fontSize: 20,
              color: "rgba(255,255,255,0.4)",
              margin: 0,
              marginTop: 4,
            }}
          >
            Your working holiday journal in Australia
          </p>
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

        {/* Domain bottom right */}
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
