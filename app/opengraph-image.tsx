import { ImageResponse } from 'next/og';

/**
 * Open Graph image generated at the edge with next/og. Used as the link
 * preview card when the site is shared on social media and chat apps;
 * no static image asset is needed.
 */
export const runtime = 'edge';
export const alt = 'txtconv - 簡轉繁線上工具';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0f172a',
          color: '#ffffff',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ fontSize: 96, fontWeight: 700, display: 'flex' }}>
          简 → 繁
        </div>
        <div style={{ fontSize: 56, fontWeight: 700, marginTop: 40, display: 'flex' }}>
          txtconv 簡轉繁線上工具
        </div>
        <div style={{ fontSize: 32, color: '#94a3b8', marginTop: 24, display: 'flex' }}>
          字幕 .srt ・ 小說 .txt ・ .csv ・ .xml 一鍵簡體轉繁體
        </div>
        <div
          style={{
            marginTop: 48,
            fontSize: 28,
            color: '#00D1B2',
            display: 'flex',
          }}
        >
          txtconv.arpuli.com
        </div>
      </div>
    ),
    size
  );
}
