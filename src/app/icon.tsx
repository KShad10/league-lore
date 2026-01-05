import { ImageResponse } from 'next/og'

export const size = {
  width: 32,
  height: 32,
}
export const contentType = 'image/png'

export default async function Icon() {
  // Load Libre Baskerville font
  const libreBaskerville = await fetch(
    new URL('https://fonts.gstatic.com/s/librebaskerville/v14/kmKnZrc3Hgbbcjq75U4uslyuy4kn0pNeYRI4CN2V.woff2')
  ).then((res) => res.arrayBuffer())

  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 20,
          background: '#2D5016',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#F5F0E6',
          fontFamily: 'Libre Baskerville',
          fontWeight: 700,
          borderRadius: 6,
          letterSpacing: '-1px',
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
