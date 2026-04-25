import fs from 'node:fs/promises'
import Papa from 'papaparse'

export class CsvLoader {
  static async load<T = Record<string, string>>(
    filePath: string,
    rowMapper?: (row: Record<string, string>) => T,
  ): Promise<T[]> {
    const content = await fs.readFile(filePath, 'utf-8')
    const result = Papa.parse<Record<string, string>>(content, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
    })

    if (result.errors.length > 0) {
      const fatal = result.errors.filter(
        (e) => e.type === 'Quotes' || e.type === 'Delimiter',
      )
      if (fatal.length > 0) {
        throw new Error(
          `CSV parse errors in ${filePath}: ${JSON.stringify(fatal.slice(0, 3))}`,
        )
      }
    }

    return rowMapper
      ? result.data.map(rowMapper)
      : (result.data as unknown as T[])
  }
}
