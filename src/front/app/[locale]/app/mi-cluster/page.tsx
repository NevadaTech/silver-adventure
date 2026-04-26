import { setRequestLocale } from 'next-intl/server'

import { ClusterMembers } from '../_components/cluster-members'
import { ClusterSummary } from '../_components/cluster-summary'
import { ClusterTraits } from '../_components/cluster-traits'
import { ClusterValueChains } from '../_components/cluster-value-chains'
import { mockCluster } from '../_data/mock-cluster'

type Props = {
  params: Promise<{ locale: string }>
}

export default async function MiClusterPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8 px-6 py-8">
      <ClusterSummary cluster={mockCluster} />
      <ClusterTraits centroide={mockCluster.centroide} />
      <ClusterMembers
        miembros={mockCluster.miembros}
        centroide={mockCluster.centroide}
      />
      <ClusterValueChains cadenas={mockCluster.cadenasDeValor} />
    </div>
  )
}
