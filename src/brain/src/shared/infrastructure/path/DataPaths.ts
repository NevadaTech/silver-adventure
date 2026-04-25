import path from 'node:path'

const REPO_ROOT = path.resolve(__dirname, '../../../../../../')
const DATA_DIR = path.join(REPO_ROOT, 'docs/hackathon/DATA')

export const DataPaths = {
  ciiuDianCsv: path.join(DATA_DIR, 'CIIU_DIAN.csv'),
  companiesCsv: path.join(DATA_DIR, 'REGISTRADOS_SII.csv'),
  clustersCsv: path.join(DATA_DIR, 'CLUSTERS.csv'),
  clusterActivitiesCsv: path.join(
    DATA_DIR,
    'CLUSTERS_ACTIVIDADESECONOMICAS.csv',
  ),
  clusterSectoresCsv: path.join(
    DATA_DIR,
    'CLUSTERS_SECTORES_SECCIONES_ACTIVIDADES.csv',
  ),
  clusterMembersCsv: path.join(
    DATA_DIR,
    'CLUSTERS_POSIBLES_MIEMBROS_POR_ACTIVIDAD_PRINCIPAL_DATOS.csv',
  ),
} as const
