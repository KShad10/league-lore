import { ImageResponse } from 'next/og'

export const size = {
  width: 32,
  height: 32,
}
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 18,
          background: '#2D5016',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#F5F0E6',
          fontFamily: 'Georgia, serif',
          fontWeight: 'bold',
          borderRadius: 6,
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
