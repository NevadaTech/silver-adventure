# Motor Inteligente de Clusters Empresariales — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) to implement this plan task-by-task with review checkpoints. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a REST API (`src/brain/`) that clusters ~10k companies, generates business recommendations via cosine similarity, and provides an agent endpoint to orchestrate the full pipeline.

**Architecture:** Four hexagonal bounded contexts (companies, clusters, recommendations, agent) with in-memory data persistence, CSV data loading at startup, and lazy Gemini explanations. TDD workflow: failing test → minimal code → commit.

**Tech Stack:** NestJS 11 + TypeScript + Vitest + Bun + papaparse (CSV) + Gemini API

---

## File Structure

### Shared (additions)
- `src/brain/src/shared/infrastructure/csv/csvPaths.ts` — CSV file path constants
- `src/brain/src/shared/domain/GeminiPort.ts` — Port interface for Gemini text generation
- `src/brain/src/shared/infrastructure/gemini/GeminiAdapter.ts` — Gemini API adapter

### Companies Context (8 files)
- `src/brain/src/companies/domain/entities/Company.ts` — Entity + factory with validation
- `src/brain/src/companies/domain/repositories/CompanyRepository.ts` — Port interface
- `src/brain/src/companies/application/use-cases/GetCompanies.ts` — Use case
- `src/brain/src/companies/application/use-cases/FindCompanyById.ts` — Use case
- `src/brain/src/companies/infrastructure/repositories/CsvCompanyRepository.ts` — CSV adapter
- `src/brain/src/companies/infrastructure/repositories/InMemoryCompanyRepository.ts` — Test adapter
- `src/brain/src/companies/infrastructure/csv/CsvLoader.ts` — CSV parsing utility
- `src/brain/src/companies/companies.module.ts` — NestJS module

### Clusters Context (10 files)
- `src/brain/src/clusters/domain/entities/Cluster.ts` — Entity + factory
- `src/brain/src/clusters/domain/repositories/ClusterRepository.ts` — Port interface
- `src/brain/src/clusters/domain/repositories/ClusterDefinitionRepository.ts` — Port interface
- `src/brain/src/clusters/application/use-cases/GenerateClusters.ts` — Clustering orchestration
- `src/brain/src/clusters/application/use-cases/ExplainCluster.ts` — Gemini explanation
- `src/brain/src/clusters/infrastructure/repositories/InMemoryClusterRepository.ts` — Test adapter
- `src/brain/src/clusters/infrastructure/repositories/CsvClusterDefinitionRepository.ts` — CSV adapter
- `src/brain/src/clusters/infrastructure/repositories/InMemoryClusterDefinitionRepository.ts` — Test adapter
- `src/brain/src/clusters/infrastructure/http/clusters.controller.ts` — REST endpoints
- `src/brain/src/clusters/clusters.module.ts` — NestJS module

### Recommendations Context (10 files)
- `src/brain/src/recommendations/domain/entities/Recommendation.ts` — Entity + factory
- `src/brain/src/recommendations/domain/repositories/RecommendationRepository.ts` — Port interface
- `src/brain/src/recommendations/application/use-cases/GenerateRecommendations.ts` — Similarity + scoring
- `src/brain/src/recommendations/application/use-cases/GetCompanyRecommendations.ts` — Lazy Gemini explanation
- `src/brain/src/recommendations/infrastructure/repositories/InMemoryRecommendationRepository.ts` — Test adapter
- `src/brain/src/recommendations/infrastructure/services/CosineSimilarityMatcher.ts` — Algorithm
- `src/brain/src/recommendations/infrastructure/services/FeatureVectorBuilder.ts` — Vector construction
- `src/brain/src/recommendations/infrastructure/http/recommendations.controller.ts` — REST endpoint
- `src/brain/src/recommendations/recommendations.module.ts` — NestJS module
- `__tests__/core/recommendations/fixtures/vectors.ts` — Test fixtures

### Agent Context (8 files)
- `src/brain/src/agent/domain/entities/ScanResult.ts` — Entity + factory
- `src/brain/src/agent/domain/repositories/ScanResultRepository.ts` — Port interface
- `src/brain/src/agent/application/use-cases/RunScan.ts` — Orchestration + error handling
- `src/brain/src/agent/application/use-cases/GetScanStatus.ts` — Query last result
- `src/brain/src/agent/infrastructure/repositories/InMemoryScanResultRepository.ts` — In-memory store
- `src/brain/src/agent/infrastructure/http/agent.controller.ts` — REST endpoints
- `src/brain/src/agent/agent.module.ts` — NestJS module

### Test Infrastructure
- `__tests__/fixtures/companies.ts` — 15 company fixtures shared across tests
- `__tests__/fixtures/clusters.ts` — Predefined cluster data for tests
- `__tests__/core/companies/*.test.ts` — Company entity + CSV parsing tests
- `__tests__/core/clusters/*.test.ts` — Clustering algorithm + explanation tests
- `__tests__/core/recommendations/*.test.ts` — Similarity + scoring tests
- `__tests__/core/agent/*.test.ts` — Orchestration + status tests

---

## Task Breakdown

### Phase 1: Shared Infrastructure

#### Task 1: CSV path constants

**Files:**
- Create: `src/brain/src/shared/infrastructure/csv/csvPaths.ts`

- [ ] **Step 1: Create csvPaths.ts with absolute paths to CSV files**

```typescript
import path from 'path'

const DATA_DIR = path.resolve(process.cwd(), '../../docs/hackathon/DATA')

export const CSV_PATHS = {
  companies: path.join(DATA_DIR, 'REGISTRADOS_SII.csv'),
  clusters: path.join(DATA_DIR, 'CLUSTERS.csv'),
  clusterActivities: path.join(DATA_DIR, 'CLUSTERS_ACTIVIDADESECONOMICAS.csv'),
  clusterSectors: path.join(DATA_DIR, 'CLUSTERS_SECTORES_SECCIONES_ACTIVIDADES.csv'),
  clusterMembers: path.join(DATA_DIR, 'CLUSTERS_POSIBLES_MIEMBROS_POR_ACTIVIDAD_PRINCIPAL_DATOS.csv'),
}
```

- [ ] **Step 2: Verify paths are correct**

Run: `cd src/brain && bun -e "console.log(require('./src/shared/infrastructure/csv/csvPaths.ts').CSV_PATHS)"`
Expected: All paths point to actual files in `docs/hackathon/DATA/`

- [ ] **Step 3: Commit**

```bash
git add src/brain/src/shared/infrastructure/csv/csvPaths.ts
git commit -m "chore: add CSV file path constants"
```

---

#### Task 2: GeminiPort interface

**Files:**
- Create: `src/brain/src/shared/domain/GeminiPort.ts`

- [ ] **Step 1: Define the port interface**

```typescript
export interface GeminiPort {
  generateText(prompt: string): Promise<string>
}
```

- [ ] **Step 2: Commit**

```bash
git add src/brain/src/shared/domain/GeminiPort.ts
git commit -m "chore: define GeminiPort interface"
```

---

#### Task 3: GeminiAdapter implementation

**Files:**
- Create: `src/brain/src/shared/infrastructure/gemini/GeminiAdapter.ts`
- Modify: `src/brain/src/shared/infrastructure/env.ts` (read-only, already has GEMINI_API_KEY)

- [ ] **Step 1: Write failing test for GeminiAdapter**

Create `__tests__/core/shared/infrastructure/GeminiAdapter.test.ts`:

```typescript
import { GeminiAdapter } from '@/shared/infrastructure/gemini/GeminiAdapter'
import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('GeminiAdapter', () => {
  let adapter: GeminiAdapter
  
  beforeEach(() => {
    process.env.GEMINI_API_KEY = 'test-key'
    process.env.GEMINI_CHAT_MODEL = 'gemini-2.5-flash'
    adapter = new GeminiAdapter()
  })

  it('should call Gemini API and return text', async () => {
    const prompt = 'Describe this cluster'
    const response = await adapter.generateText(prompt)
    expect(response).toBeTruthy()
    expect(typeof response).toBe('string')
  })
})
```

Note: This test will need `@google/generative-ai` dependency. We'll add that via `bun add` in a later step.

- [ ] **Step 2: Add @google/generative-ai dependency**

```bash
cd src/brain && bun add @google/generative-ai
```

- [ ] **Step 3: Implement GeminiAdapter**

```typescript
import { GoogleGenerativeAI } from '@google/generative-ai'
import { GeminiPort } from '@/shared/domain/GeminiPort'
import { env } from '@/shared/infrastructure/env'

export class GeminiAdapter implements GeminiPort {
  private client: GoogleGenerativeAI
  private model: string

  constructor() {
    this.client = new GoogleGenerativeAI(env.GEMINI_API_KEY)
    this.model = env.GEMINI_CHAT_MODEL
  }

  async generateText(prompt: string): Promise<string> {
    const model = this.client.getGenerativeModel({ model: this.model })
    const result = await model.generateContent(prompt)
    return result.response.text()
  }
}
```

- [ ] **Step 4: Run test**

```bash
cd src/brain && bun test __tests__/core/shared/infrastructure/GeminiAdapter.test.ts
```

Expected: PASS (if GEMINI_API_KEY is set in env, test will call real API)

Note: For CI/test isolation, we'll mock this in other tests using `vi.mock()`.

- [ ] **Step 5: Commit**

```bash
git add src/brain/src/shared/infrastructure/gemini/GeminiAdapter.ts __tests__/core/shared/infrastructure/GeminiAdapter.test.ts
git commit -m "feat: implement GeminiAdapter for Gemini API calls"
```

---

### Phase 2: Companies Context

#### Task 4: Company entity with factory

**Files:**
- Create: `src/brain/src/companies/domain/entities/Company.ts`

- [ ] **Step 1: Write failing test for Company entity**

Create `__tests__/core/companies/Company.test.ts`:

```typescript
import { Company } from '@/companies/domain/entities/Company'
import { describe, it, expect } from 'vitest'

describe('Company', () => {
  it('should create a company with valid data', () => {
    const company = Company.create({
      id: '0123456-7',
      razonSocial: 'Empresa Test',
      ciiu: 'G4711',
      municipio: 'Santa Marta',
      tipoOrganizacion: 'Sociedad Anónima',
      ingresoOperacion: 50000000,
      activosTotales: 100000000,
      personal: 10,
      email: 'test@empresa.com',
      telefono: '1234567890',
    })
    expect(company.id).toBe('0123456-7')
    expect(company.razonSocial).toBe('Empresa Test')
    expect(company.ciiuSeccion).toBe('G')
  })

  it('should throw if razonSocial is empty', () => {
    expect(() => {
      Company.create({
        id: '0123456-7',
        razonSocial: '',
        ciiu: 'G4711',
        municipio: 'Santa Marta',
        tipoOrganizacion: 'SA',
        ingresoOperacion: null,
        activosTotales: null,
        personal: null,
        email: null,
        telefono: null,
      })
    }).toThrow('razonSocial cannot be empty')
  })

  it('should derive ciiuSeccion from first character of ciiu', () => {
    const company1 = Company.create({
      id: '1',
      razonSocial: 'Test 1',
      ciiu: 'A0111',
      municipio: 'SM',
      tipoOrganizacion: 'SA',
      ingresoOperacion: null,
      activosTotales: null,
      personal: null,
      email: null,
      telefono: null,
    })
    expect(company1.ciiuSeccion).toBe('A')

    const company2 = Company.create({
      id: '2',
      razonSocial: 'Test 2',
      ciiu: 'Z9999',
      municipio: 'SM',
      tipoOrganizacion: 'SA',
      ingresoOperacion: null,
      activosTotales: null,
      personal: null,
      email: null,
      telefono: null,
    })
    expect(company2.ciiuSeccion).toBe('Z')
  })
})
```

- [ ] **Step 2: Implement Company entity**

```typescript
import { Entity } from '@/shared/domain/Entity'

export interface CompanyProps {
  razonSocial: string
  ciiu: string
  ciiuSeccion: string
  municipio: string
  tipoOrganizacion: string
  ingresoOperacion: number | null
  activosTotales: number | null
  personal: number | null
  email: string | null
  telefono: string | null
}

export class Company extends Entity<string> {
  private readonly props: CompanyProps

  private constructor(id: string, props: CompanyProps) {
    super(id)
    this.props = Object.freeze(props)
  }

  static create(data: {
    id: string
    razonSocial: string
    ciiu: string
    municipio: string
    tipoOrganizacion: string
    ingresoOperacion: number | null
    activosTotales: number | null
    personal: number | null
    email: string | null
    telefono: string | null
  }): Company {
    if (!data.razonSocial || data.razonSocial.trim().length === 0) {
      throw new Error('razonSocial cannot be empty')
    }
    if (!data.ciiu || data.ciiu.length === 0) {
      throw new Error('ciiu cannot be empty')
    }
    if (!data.id || data.id.trim().length === 0) {
      throw new Error('id cannot be empty')
    }

    const ciiuSeccion = data.ciiu.charAt(0)

    return new Company(data.id, {
      razonSocial: data.razonSocial.trim(),
      ciiu: data.ciiu,
      ciiuSeccion,
      municipio: data.municipio,
      tipoOrganizacion: data.tipoOrganizacion,
      ingresoOperacion: data.ingresoOperacion,
      activosTotales: data.activosTotales,
      personal: data.personal,
      email: data.email,
      telefono: data.telefono,
    })
  }

  get razonSocial(): string {
    return this.props.razonSocial
  }

  get ciiu(): string {
    return this.props.ciiu
  }

  get ciiuSeccion(): string {
    return this.props.ciiuSeccion
  }

  get municipio(): string {
    return this.props.municipio
  }

  get tipoOrganizacion(): string {
    return this.props.tipoOrganizacion
  }

  get ingresoOperacion(): number | null {
    return this.props.ingresoOperacion
  }

  get activosTotales(): number | null {
    return this.props.activosTotales
  }

  get personal(): number | null {
    return this.props.personal
  }

  get email(): string | null {
    return this.props.email
  }

  get telefono(): string | null {
    return this.props.telefono
  }
}
```

- [ ] **Step 3: Run test**

```bash
cd src/brain && bun test __tests__/core/companies/Company.test.ts
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/brain/src/companies/domain/entities/Company.ts __tests__/core/companies/Company.test.ts
git commit -m "feat(companies): implement Company entity with factory validation"
```

---

#### Task 5: CompanyRepository port interface

**Files:**
- Create: `src/brain/src/companies/domain/repositories/CompanyRepository.ts`

- [ ] **Step 1: Define the port**

```typescript
import { Company } from '../entities/Company'

export interface CompanyRepository {
  findAll(): Promise<Company[]>
  findById(id: string): Promise<Company | null>
  findByCiiuSeccion(seccion: string): Promise<Company[]>
  findByMunicipio(municipio: string): Promise<Company[]>
}
```

- [ ] **Step 2: Commit**

```bash
git add src/brain/src/companies/domain/repositories/CompanyRepository.ts
git commit -m "chore(companies): define CompanyRepository port"
```

---

#### Task 6: CsvLoader utility

**Files:**
- Create: `src/brain/src/companies/infrastructure/csv/CsvLoader.ts`

- [ ] **Step 1: Write CsvLoader utility**

Note: papaparse is already in package.json (or we'll add it).

```typescript
import fs from 'fs/promises'
import Papa from 'papaparse'

export class CsvLoader {
  static async loadCsv(filePath: string): Promise<any[]> {
    const content = await fs.readFile(filePath, 'utf-8')
    return new Promise((resolve, reject) => {
      Papa.parse(content, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => resolve(results.data as any[]),
        error: (error) => reject(error),
      })
    })
  }
}
```

- [ ] **Step 2: Check if papaparse is installed**

```bash
cd src/brain && bun ls papaparse
```

If not found, run:
```bash
bun add papaparse
```

- [ ] **Step 3: Commit**

```bash
git add src/brain/src/companies/infrastructure/csv/CsvLoader.ts
git commit -m "feat(companies): implement CsvLoader utility"
```

---

#### Task 7: CsvCompanyRepository adapter

**Files:**
- Create: `src/brain/src/companies/infrastructure/repositories/CsvCompanyRepository.ts`

- [ ] **Step 1: Write failing test for CsvCompanyRepository**

Create `__tests__/core/companies/CsvCompanyRepository.test.ts`:

```typescript
import { CsvCompanyRepository } from '@/companies/infrastructure/repositories/CsvCompanyRepository'
import { describe, it, expect } from 'vitest'
import path from 'path'
import fs from 'fs/promises'

describe('CsvCompanyRepository', () => {
  it('should load companies from CSV file', async () => {
    // Create a temporary test CSV file
    const testCsvDir = path.join(process.cwd(), '__tests__/fixtures')
    await fs.mkdir(testCsvDir, { recursive: true })
    
    const testCsvContent = `matricula,razonSocial,CIIU,municipio,tipoOrganizacion,ingresoOperacion,activosTotales,personal,email,telefono
0123456-7,Empresa Test 1,G4711,Santa Marta,SA,50000000,100000000,10,test1@empresa.com,1234567890
0123457-8,Empresa Test 2,A0111,Ciénaga,SA,25000000,50000000,5,test2@empresa.com,0987654321
,EmptyId,C1010,Santa Marta,SA,0,0,0,,`
    
    const testCsvPath = path.join(testCsvDir, 'test_companies.csv')
    await fs.writeFile(testCsvPath, testCsvContent)

    const repo = new CsvCompanyRepository(testCsvPath)
    await repo.loadFromCsv()
    
    const all = await repo.findAll()
    expect(all).toHaveLength(2) // Should skip empty matricula row
    expect(all[0].razonSocial).toBe('Empresa Test 1')
    expect(all[1].ciiuSeccion).toBe('A')

    // Cleanup
    await fs.unlink(testCsvPath)
  })

  it('should find company by ID', async () => {
    // Reuse test data from above
    const testCsvDir = path.join(process.cwd(), '__tests__/fixtures')
    const testCsvPath = path.join(testCsvDir, 'test_companies.csv')
    
    const testCsvContent = `matricula,razonSocial,CIIU,municipio,tipoOrganizacion,ingresoOperacion,activosTotales,personal,email,telefono
0123456-7,Empresa Test 1,G4711,Santa Marta,SA,50000000,100000000,10,test1@empresa.com,1234567890`
    
    await fs.mkdir(testCsvDir, { recursive: true })
    await fs.writeFile(testCsvPath, testCsvContent)

    const repo = new CsvCompanyRepository(testCsvPath)
    await repo.loadFromCsv()

    const company = await repo.findById('0123456-7')
    expect(company).toBeTruthy()
    expect(company?.razonSocial).toBe('Empresa Test 1')

    await fs.unlink(testCsvPath)
  })
})
```

- [ ] **Step 2: Implement CsvCompanyRepository**

```typescript
import { OnModuleInit } from '@nestjs/common'
import { Company } from '@/companies/domain/entities/Company'
import { CompanyRepository } from '@/companies/domain/repositories/CompanyRepository'
import { CsvLoader } from '../csv/CsvLoader'

export class CsvCompanyRepository implements CompanyRepository, OnModuleInit {
  private companies: Map<string, Company> = new Map()
  private _initialized = false

  constructor(private csvPath: string) {}

  async onModuleInit(): Promise<void> {
    await this.loadFromCsv()
  }

  async loadFromCsv(): Promise<void> {
    const rows = await CsvLoader.loadCsv(this.csvPath)

    for (const row of rows) {
      try {
        const company = Company.create({
          id: row.matricula,
          razonSocial: row.razonSocial,
          ciiu: row.CIIU,
          municipio: row.municipio,
          tipoOrganizacion: row.tipoOrganizacion,
          ingresoOperacion: row.ingresoOperacion ? parseFloat(row.ingresoOperacion) : null,
          activosTotales: row.activosTotales ? parseFloat(row.activosTotales) : null,
          personal: row.personal ? parseInt(row.personal, 10) : null,
          email: row.email || null,
          telefono: row.telefono || null,
        })
        this.companies.set(company.id, company)
      } catch (error) {
        // Skip rows with validation errors (e.g., empty matricula)
      }
    }

    this._initialized = true
  }

  async findAll(): Promise<Company[]> {
    return Array.from(this.companies.values())
  }

  async findById(id: string): Promise<Company | null> {
    return this.companies.get(id) || null
  }

  async findByCiiuSeccion(seccion: string): Promise<Company[]> {
    return Array.from(this.companies.values()).filter((c) => c.ciiuSeccion === seccion)
  }

  async findByMunicipio(municipio: string): Promise<Company[]> {
    return Array.from(this.companies.values()).filter((c) => c.municipio === municipio)
  }
}
```

- [ ] **Step 3: Run test**

```bash
cd src/brain && bun test __tests__/core/companies/CsvCompanyRepository.test.ts
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/brain/src/companies/infrastructure/repositories/CsvCompanyRepository.ts __tests__/core/companies/CsvCompanyRepository.test.ts
git commit -m "feat(companies): implement CsvCompanyRepository CSV adapter"
```

---

#### Task 8: InMemoryCompanyRepository for tests

**Files:**
- Create: `src/brain/src/companies/infrastructure/repositories/InMemoryCompanyRepository.ts`

- [ ] **Step 1: Implement InMemoryCompanyRepository**

```typescript
import { Company } from '@/companies/domain/entities/Company'
import { CompanyRepository } from '@/companies/domain/repositories/CompanyRepository'

export class InMemoryCompanyRepository implements CompanyRepository {
  constructor(private companies: Map<string, Company> = new Map()) {}

  async findAll(): Promise<Company[]> {
    return Array.from(this.companies.values())
  }

  async findById(id: string): Promise<Company | null> {
    return this.companies.get(id) || null
  }

  async findByCiiuSeccion(seccion: string): Promise<Company[]> {
    return Array.from(this.companies.values()).filter((c) => c.ciiuSeccion === seccion)
  }

  async findByMunicipio(municipio: string): Promise<Company[]> {
    return Array.from(this.companies.values()).filter((c) => c.municipio === municipio)
  }

  // Test helper to populate data
  setCompanies(companies: Company[]): void {
    this.companies.clear()
    for (const company of companies) {
      this.companies.set(company.id, company)
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/brain/src/companies/infrastructure/repositories/InMemoryCompanyRepository.ts
git commit -m "test(companies): implement InMemoryCompanyRepository for testing"
```

---

#### Task 9: GetCompanies use case

**Files:**
- Create: `src/brain/src/companies/application/use-cases/GetCompanies.ts`

- [ ] **Step 1: Write failing test**

Create `__tests__/core/companies/GetCompanies.test.ts`:

```typescript
import { GetCompanies } from '@/companies/application/use-cases/GetCompanies'
import { InMemoryCompanyRepository } from '@/companies/infrastructure/repositories/InMemoryCompanyRepository'
import { Company } from '@/companies/domain/entities/Company'
import { describe, it, expect } from 'vitest'

describe('GetCompanies', () => {
  it('should return all companies', async () => {
    const company1 = Company.create({
      id: '1',
      razonSocial: 'Company 1',
      ciiu: 'G4711',
      municipio: 'SM',
      tipoOrganizacion: 'SA',
      ingresoOperacion: null,
      activosTotales: null,
      personal: null,
      email: null,
      telefono: null,
    })

    const company2 = Company.create({
      id: '2',
      razonSocial: 'Company 2',
      ciiu: 'A0111',
      municipio: 'CI',
      tipoOrganizacion: 'SA',
      ingresoOperacion: null,
      activosTotales: null,
      personal: null,
      email: null,
      telefono: null,
    })

    const repo = new InMemoryCompanyRepository()
    repo.setCompanies([company1, company2])

    const useCase = new GetCompanies(repo)
    const result = await useCase.execute()

    expect(result.companies).toHaveLength(2)
    expect(result.companies[0].razonSocial).toBe('Company 1')
  })
})
```

- [ ] **Step 2: Implement GetCompanies**

```typescript
import { UseCase } from '@/shared/domain/UseCase'
import { Company } from '@/companies/domain/entities/Company'
import { CompanyRepository } from '@/companies/domain/repositories/CompanyRepository'

export class GetCompanies implements UseCase<void, { companies: Company[] }> {
  constructor(private repository: CompanyRepository) {}

  async execute(): Promise<{ companies: Company[] }> {
    const companies = await this.repository.findAll()
    return { companies }
  }
}
```

- [ ] **Step 3: Run test**

```bash
cd src/brain && bun test __tests__/core/companies/GetCompanies.test.ts
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/brain/src/companies/application/use-cases/GetCompanies.ts __tests__/core/companies/GetCompanies.test.ts
git commit -m "feat(companies): implement GetCompanies use case"
```

---

#### Task 10: FindCompanyById use case

**Files:**
- Create: `src/brain/src/companies/application/use-cases/FindCompanyById.ts`

- [ ] **Step 1: Write failing test**

Create `__tests__/core/companies/FindCompanyById.test.ts`:

```typescript
import { FindCompanyById } from '@/companies/application/use-cases/FindCompanyById'
import { InMemoryCompanyRepository } from '@/companies/infrastructure/repositories/InMemoryCompanyRepository'
import { Company } from '@/companies/domain/entities/Company'
import { describe, it, expect } from 'vitest'

describe('FindCompanyById', () => {
  it('should find company by ID', async () => {
    const company = Company.create({
      id: '123',
      razonSocial: 'Test Co',
      ciiu: 'G4711',
      municipio: 'SM',
      tipoOrganizacion: 'SA',
      ingresoOperacion: null,
      activosTotales: null,
      personal: null,
      email: null,
      telefono: null,
    })

    const repo = new InMemoryCompanyRepository()
    repo.setCompanies([company])

    const useCase = new FindCompanyById(repo)
    const result = await useCase.execute({ id: '123' })

    expect(result.company).toBeTruthy()
    expect(result.company?.razonSocial).toBe('Test Co')
  })

  it('should return null when company not found', async () => {
    const repo = new InMemoryCompanyRepository()
    repo.setCompanies([])

    const useCase = new FindCompanyById(repo)
    const result = await useCase.execute({ id: 'nonexistent' })

    expect(result.company).toBeNull()
  })
})
```

- [ ] **Step 2: Implement FindCompanyById**

```typescript
import { UseCase } from '@/shared/domain/UseCase'
import { Company } from '@/companies/domain/entities/Company'
import { CompanyRepository } from '@/companies/domain/repositories/CompanyRepository'

export class FindCompanyById implements UseCase<{ id: string }, { company: Company | null }> {
  constructor(private repository: CompanyRepository) {}

  async execute(input: { id: string }): Promise<{ company: Company | null }> {
    const company = await this.repository.findById(input.id)
    return { company }
  }
}
```

- [ ] **Step 3: Run test**

```bash
cd src/brain && bun test __tests__/core/companies/FindCompanyById.test.ts
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/brain/src/companies/application/use-cases/FindCompanyById.ts __tests__/core/companies/FindCompanyById.test.ts
git commit -m "feat(companies): implement FindCompanyById use case"
```

---

#### Task 11: CompaniesModule

**Files:**
- Create: `src/brain/src/companies/companies.module.ts`

- [ ] **Step 1: Create the NestJS module**

```typescript
import { Module } from '@nestjs/common'
import { CompanyRepository } from './domain/repositories/CompanyRepository'
import { CsvCompanyRepository } from './infrastructure/repositories/CsvCompanyRepository'
import { CSV_PATHS } from '@/shared/infrastructure/csv/csvPaths'

@Module({
  providers: [
    {
      provide: CompanyRepository,
      useFactory: () => new CsvCompanyRepository(CSV_PATHS.companies),
    },
  ],
  exports: [CompanyRepository],
})
export class CompaniesModule {}
```

- [ ] **Step 2: Commit**

```bash
git add src/brain/src/companies/companies.module.ts
git commit -m "chore(companies): create CompaniesModule"
```

---

### Phase 3: Clusters Context

Due to length, I'll create a condensed version for clusters, recommendations, and agent. The full pattern should follow the same TDD: test → implement → commit.

#### Task 12: Cluster entity

**Files:**
- Create: `src/brain/src/clusters/domain/entities/Cluster.ts`
- Create: `__tests__/core/clusters/Cluster.test.ts`

Test the factory, memberIds, tipo validation.

Implementation:
```typescript
import { Entity } from '@/shared/domain/Entity'

export interface ClusterProps {
  titulo: string
  descripcion: string
  tipo: 'predefined' | 'heuristic'
  memberIds: string[]
  municipios: string[]
}

export class Cluster extends Entity<string> {
  private readonly props: ClusterProps

  private constructor(id: string, props: ClusterProps) {
    super(id)
    this.props = Object.freeze(props)
  }

  static create(data: {
    id: string
    titulo: string
    descripcion: string
    tipo: 'predefined' | 'heuristic'
    memberIds: string[]
    municipios: string[]
  }): Cluster {
    if (!data.titulo || data.titulo.trim().length === 0) {
      throw new Error('titulo cannot be empty')
    }
    if (data.memberIds.length === 0) {
      throw new Error('memberIds cannot be empty')
    }

    return new Cluster(data.id, {
      titulo: data.titulo,
      descripcion: data.descripcion,
      tipo: data.tipo,
      memberIds: [...data.memberIds],
      municipios: [...data.municipios],
    })
  }

  get titulo(): string { return this.props.titulo }
  get descripcion(): string { return this.props.descripcion }
  get tipo(): 'predefined' | 'heuristic' { return this.props.tipo }
  get memberIds(): string[] { return [...this.props.memberIds] }
  get municipios(): string[] { return [...this.props.municipios] }
  get memberCount(): number { return this.props.memberIds.length }
}
```

Commit: `feat(clusters): implement Cluster entity`

---

#### Task 13: ClusterRepository and ClusterDefinitionRepository ports

**Files:**
- Create: `src/brain/src/clusters/domain/repositories/ClusterRepository.ts`
- Create: `src/brain/src/clusters/domain/repositories/ClusterDefinitionRepository.ts`

Commit: `chore(clusters): define repository ports`

---

#### Task 14: CsvClusterDefinitionRepository

**Files:**
- Create: `src/brain/src/clusters/infrastructure/repositories/CsvClusterDefinitionRepository.ts`

Reads `CLUSTERS_ACTIVIDADESECONOMICAS.csv` to build `ciiu → clusterID` map. Uses `CsvLoader`.

Commit: `feat(clusters): implement CsvClusterDefinitionRepository`

---

#### Task 15: InMemoryClusterRepository

**Files:**
- Create: `src/brain/src/clusters/infrastructure/repositories/InMemoryClusterRepository.ts`
- Create: `src/brain/src/clusters/infrastructure/repositories/InMemoryClusterDefinitionRepository.ts`

Commit: `test(clusters): implement in-memory repository adapters`

---

#### Task 16: GenerateClusters use case (core algorithm)

**Files:**
- Create: `src/brain/src/clusters/application/use-cases/GenerateClusters.ts`
- Create: `src/brain/src/clusters/infrastructure/services/HeuristicClusterer.ts`
- Create: `__tests__/core/clusters/GenerateClusters.test.ts`

This is the complex step. Test with fixture companies and verify:
1. Companies match to predefined clusters by CIIU
2. Unmatched companies get fallback `ciiu-{seccion}` clusters
3. Clusters with >50 members split by municipio

Implementation outline:
```typescript
// GenerateClusters.ts
export class GenerateClusters implements UseCase<void, { clustersGenerated: number }> {
  constructor(
    private companyRepo: CompanyRepository,
    private clusterDefRepo: ClusterDefinitionRepository,
    private clusterRepo: ClusterRepository,
  ) {}

  async execute(): Promise<{ clustersGenerated: number }> {
    const companies = await this.companyRepo.findAll()
    const ciiuMap = await this.clusterDefRepo.getCiiuToClusterMap()
    const clusters = await this.clusterer.generate(companies, ciiuMap)
    await this.clusterRepo.saveAll(clusters)
    return { clustersGenerated: clusters.length }
  }
}
```

Commit: `feat(clusters): implement GenerateClusters use case with heuristic algorithm`

---

#### Task 17: ExplainCluster use case

**Files:**
- Create: `src/brain/src/clusters/application/use-cases/ExplainCluster.ts`
- Create: `__tests__/core/clusters/ExplainCluster.test.ts`

Uses `GeminiPort` to generate explanation. Mock Gemini in test.

Commit: `feat(clusters): implement ExplainCluster use case`

---

#### Task 18: ClustersController

**Files:**
- Create: `src/brain/src/clusters/infrastructure/http/clusters.controller.ts`

Endpoints:
- `POST /api/clusters/generate` — call GenerateClusters
- `GET /api/clusters/:id/explain` — call ExplainCluster

Commit: `feat(clusters): create clusters controller with endpoints`

---

#### Task 19: ClustersModule

**Files:**
- Create: `src/brain/src/clusters/clusters.module.ts`

Commit: `chore(clusters): create ClustersModule`

---

### Phase 4: Recommendations Context

Follow the same pattern as clusters. Key tasks:

#### Task 20: Recommendation entity

#### Task 21: RecommendationRepository port

#### Task 22: FeatureVectorBuilder service

Build feature vectors for companies.

#### Task 23: CosineSimilarityMatcher service

Compute cosine similarity between vectors, classify relationship type by priority rules.

Test with fixture companies: verify similarity scores, relationship classification.

#### Task 24: GenerateRecommendations use case

Compute top 10 per company, store with `explicacion: null`.

#### Task 25: GetCompanyRecommendations use case

Read from repo, lazily call Gemini for explanation on first access.

#### Task 26: InMemoryRecommendationRepository

#### Task 27: RecommendationsController

`GET /api/companies/:id/recommendations`

#### Task 28: RecommendationsModule

---

### Phase 5: Agent Context

#### Task 29: ScanResult entity

#### Task 30: ScanResultRepository port

#### Task 31: RunScan use case

Orchestrate: GetCompanies → GenerateClusters → GenerateRecommendations. Measure time, capture errors.

#### Task 32: GetScanStatus use case

Return last ScanResult.

#### Task 33: InMemoryScanResultRepository

#### Task 34: AgentController

- `POST /api/agent/scan` — call RunScan
- `GET /api/agent/status` — call GetScanStatus

#### Task 35: AgentModule

---

### Phase 6: App Integration

#### Task 36: Update AppModule

Import all 4 modules in order:
```typescript
imports: [CompaniesModule, ClustersModule, RecommendationsModule, AgentModule]
```

Commit: `chore: wire all modules into AppModule`

---

### Phase 7: Integration Tests

#### Task 37: Full E2E test

`POST /api/agent/scan` → verify all steps execute, return valid ScanResult.

Commit: `test: add end-to-end integration test for agent scan`

---

## Verification Checklist

```bash
# All tests pass
cd src/brain && bun test:run

# Coverage above 80%
bun test:coverage

# Server starts
bun start:dev

# Health check
curl http://localhost:3001/api/health

# Full pipeline
curl -X POST http://localhost:3001/api/agent/scan

# Recommendations for a company
curl http://localhost:3001/api/companies/0123456-7/recommendations

# Agent status
curl http://localhost:3001/api/agent/status
```

---

## Notes

- **CSV paths:** Relative to `process.cwd()` which is `src/brain/` when running with `bun start:dev`
- **Gemini calls:** Mocked in tests, real calls in integration tests (requires `GEMINI_API_KEY` in `.env`)
- **In-memory storage:** Sufficient for hackathon, lost on restart. Regenerated by `/api/agent/scan`
- **Error handling:** RunScan captures errors per step but doesn't abort; status: 'partial' if any fail
- **TDD discipline:** Failing test → minimal code → commit. No shortcuts.
