import { setRequestLocale } from 'next-intl/server'

import { InicioActivityTimeline } from '../_components/inicio-activity-timeline'
import { InicioConectorHero } from '../_components/inicio-conector-hero'
import { InicioGreeting } from '../_components/inicio-greeting'
import { InicioKpiGrid } from '../_components/inicio-kpi-grid'
import { InicioMiniCluster } from '../_components/inicio-mini-cluster'
import { InicioQuickActions } from '../_components/inicio-quick-actions'
import { mockCluster } from '../_data/mock-cluster'
import { mockConectorActivity } from '../_data/mock-conector-activity'
import { mockCurrentUser } from '../_data/mock-user'
import { mockRecomendaciones } from '../_data/mock-recomendaciones'

type Props = {
  params: Promise<{ locale: string }>
}

export default async function InicioPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)

  const heroReco = [...mockRecomendaciones]
    .filter((r) => r.estado === 'nueva')
    .sort((a, b) => b.score - a.score)[0]!

  const newRecosCount = mockRecomendaciones.filter(
    (r) => r.estado === 'nueva',
  ).length

  const stats = {
    newRecos: newRecosCount,
    activeConnections: mockCluster.conexionesActivas,
    clusterSize: mockCluster.size,
    centrality: mockCluster.miembros.find((m) => m.flag === 'self')?.score ?? 0,
  }

  const oportunidadesHoy = 3

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8 px-6 py-8">
      <InicioGreeting
        nombre={mockCurrentUser.nombre}
        oportunidades={oportunidadesHoy}
      />

      <InicioConectorHero reco={heroReco} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <InicioActivityTimeline
          events={mockConectorActivity}
          className="lg:col-span-2"
        />
        <div className="flex flex-col gap-6">
          <InicioKpiGrid stats={stats} />
          <InicioMiniCluster cluster={mockCluster} />
        </div>
      </div>

      <InicioQuickActions
        recoCount={mockRecomendaciones.length}
        conexionesCount={stats.activeConnections}
      />
    </div>
  )
}
