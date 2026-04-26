import { Entity } from '@/shared/domain/Entity'

interface CiiuActivityProps {
  titulo: string
  seccion: string
  division: string
  grupo: string
  tituloSeccion: string
  tituloDivision: string
  tituloGrupo: string
  macroSector: string | null
}

export interface CiiuActivityInput {
  code: string
  titulo: string
  seccion: string
  division: string
  grupo: string
  tituloSeccion: string
  tituloDivision: string
  tituloGrupo: string
  macroSector?: string | null
}

export class CiiuActivity extends Entity<string> {
  private readonly props: CiiuActivityProps

  private constructor(code: string, props: CiiuActivityProps) {
    super(code)
    this.props = Object.freeze(props)
  }

  static create(data: CiiuActivityInput): CiiuActivity {
    if (!/^\d{4}$/.test(data.code)) {
      throw new Error(`CIIU code must be 4 digits, got: ${data.code}`)
    }
    if (!/^[A-Z]$/.test(data.seccion)) {
      throw new Error(
        `CIIU seccion must be a single uppercase letter, got: ${data.seccion}`,
      )
    }
    if (!/^\d{2}$/.test(data.division)) {
      throw new Error(`CIIU division must be 2 digits, got: ${data.division}`)
    }

    return new CiiuActivity(data.code, {
      titulo: data.titulo,
      seccion: data.seccion,
      division: data.division,
      grupo: data.grupo,
      tituloSeccion: data.tituloSeccion,
      tituloDivision: data.tituloDivision,
      tituloGrupo: data.tituloGrupo,
      macroSector: data.macroSector ?? null,
    })
  }

  get code(): string {
    return this._id
  }
  get titulo(): string {
    return this.props.titulo
  }
  get seccion(): string {
    return this.props.seccion
  }
  get division(): string {
    return this.props.division
  }
  get grupo(): string {
    return this.props.grupo
  }
  get tituloSeccion(): string {
    return this.props.tituloSeccion
  }
  get tituloDivision(): string {
    return this.props.tituloDivision
  }
  get tituloGrupo(): string {
    return this.props.tituloGrupo
  }
  get macroSector(): string | null {
    return this.props.macroSector
  }
}
