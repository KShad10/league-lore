import { ImageResponse } from 'next/og'

export const size = {
  width: 180,
  height: 180,
}
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 100,
          background: '#2D5016',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#F5F0E6',
          fontFamily: 'Georgia, serif',
          fontWeight: 'bold',
          borderRadius: 36,
        }}
      >
        LL
      </div>
    ),
    {
      ...size,
    }
  )
}
