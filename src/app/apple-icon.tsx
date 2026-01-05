import { ImageResponse } from 'next/og'

export const size = {
  width: 180,
  height: 180,
}
export const contentType = 'image/png'

export default async function AppleIcon() {
  // Load Libre Baskerville font
  const libreBaskerville = await fetch(
    new URL('https://fonts.gstatic.com/s/librebaskerville/v14/kmKnZrc3Hgbbcjq75U4uslyuy4kn0pNeYRI4CN2V.woff2')
  ).then((res) => res.arrayBuffer())

  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 110,
          background: '#2D5016',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#F5F0E6',
          fontFamily: 'Libre Baskerville',
          fontWeight: 700,
          borderRadius: 36,
          letterSpacing: '-4px',
        }}
      >
        LL
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: 'Libre Baskerville',
          data: libreBaskerville,
          style: 'normal',
          weight: 700,
        },
      ],
    }
  )
}
