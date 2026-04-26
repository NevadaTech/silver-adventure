import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default async function AppleIcon() {
  const svg = await readFile(
    join(process.cwd(), 'public', 'brand', 'imagotipo.svg'),
    'utf-8',
  )
  const logoSrc = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#ffffff',
      }}
    >
      <img
        src={logoSrc}
        alt="Ruta C Conecta"
        style={{ width: 156, height: 64 }}
      />
    </div>,
    { ...size },
  )
}
