import { ImageResponse } from "next/og";

export const alt = "TapSync — AI-powered NFC business cards";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#f4f5f8", padding: 72, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", flex: 1 }}>
          <div style={{ fontSize: 34, fontWeight: 700, color: "#0d1120", display: "flex" }}>TapSync</div>
          <div style={{ fontSize: 76, fontWeight: 800, color: "#0d1120", lineHeight: 1.05, marginTop: 24, display: "flex" }}>One tap.</div>
          <div style={{ fontSize: 76, fontWeight: 800, color: "#1d5bff", lineHeight: 1.05, display: "flex" }}>Your AI sells for you.</div>
          <div style={{ fontSize: 30, color: "#5d6679", marginTop: 28, display: "flex" }}>NFC business cards with an AI agent that books meetings.</div>
        </div>
        <div style={{ display: "flex", alignItems: "center" }}>
          <div
            style={{
              width: 380,
              height: 240,
              borderRadius: 28,
              background: "linear-gradient(145deg, #1b2240, #0b0f1d)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
              padding: 30,
              color: "white",
              boxShadow: "0 30px 60px rgba(15,20,38,0.45)",
            }}
          >
            <div style={{ width: 54, height: 38, borderRadius: 8, background: "#d8b35c", marginBottom: 18, display: "flex" }} />
            <div style={{ fontSize: 32, fontWeight: 700, display: "flex" }}>Alex Morgan</div>
            <div style={{ fontSize: 18, opacity: 0.7, display: "flex" }}>Founder · Northwind Studio</div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
