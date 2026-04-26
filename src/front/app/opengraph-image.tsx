import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export const alt = 'Ruta C Conecta — Cámara de Comercio de Santa Marta'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function OpenGraphImage() {
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
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '80px',
        background:
          'linear-gradient(135deg, #f8f9ff 0%, #eff4ff 50%, #e5eeff 100%)',
      }}
    >
      <img
        src={logoSrc}
        alt="Ruta C"
        style={{ width: 600, height: 245, marginBottom: 28 }}
      />
      <div
        style={{
          display: 'flex',
          fontSize: 62,
          fontWeight: 800,
          color: '#0b1c30',
          letterSpacing: '-0.02em',
          textAlign: 'center',
        }}
      >
        Ruta C&nbsp;
        <span style={{ color: '#00acc1' }}>Conecta</span>
      </div>
      <div
        style={{
          display: 'flex',
          fontSize: 28,
          color: '#3d494b',
          marginTop: 18,
          textAlign: 'center',
          maxWidth: 920,
        }}
      >
        Motor inteligente de clusters empresariales — Cámara de Comercio de
        Santa Marta
      </div>
    </div>,
    { ...size },
  )
}
