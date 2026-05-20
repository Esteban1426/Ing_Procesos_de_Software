import * as XLSX from 'xlsx'
import type { ShipmentRecord, ParsedExcelData } from './types'

// Mapeo flexible de nombres de columnas
const COLUMN_MAPPINGS = {
  guia: ['guia', 'guía', 'guia#', 'guía#', 'numero guia', 'número guía', 'n° guia', 'n guia', 'tracking', 'tracking number', 'id'],
  nombreDestinatario: ['nombre destinatario', 'recipient name', 'destinatario', 'nombre', 'cliente', 'receptor', 'nombre cliente'],
  ciudad: ['ciudad', 'city', 'destino', 'ciudad destino', 'municipio'],
  direccion: ['direccion', 'dirección', 'address', 'direccion destinatario'],
  telefono: ['tel-1', 'telefono', 'teléfono', 'phone', 'celular'],
  detalle: ['detalle', 'detail', 'descripcion', 'descripción', 'contenido'],
  piezas: ['piezas', 'pieces', 'cantidad'],
  peso: ['peso-2', 'peso', 'weight']
}

function normalizeColumnName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

function findColumnMapping(headers: string[]): Record<string, number> {
  const mapping: Record<string, number> = {}
  const normalizedHeaders = headers.map(h => normalizeColumnName(h || ''))

  for (const [key, possibleNames] of Object.entries(COLUMN_MAPPINGS)) {
    const normalizedPossibleNames = possibleNames.map(normalizeColumnName)
    for (const possibleName of normalizedPossibleNames) {
      const index = normalizedHeaders.findIndex(h =>
        h.length > 0 && (h === possibleName || h.includes(possibleName) || possibleName.includes(h))
      )
      if (index !== -1) {
        mapping[key] = index
        break
      }
    }
  }

  return mapping
}

function hasRequiredColumns(mapping: Record<string, number>): boolean {
  return mapping.guia !== undefined &&
    mapping.nombreDestinatario !== undefined &&
    mapping.ciudad !== undefined
}

function findHeaderRow(jsonData: unknown[]): { headers: string[]; headerRowIndex: number; columnMapping: Record<string, number> } {
  const rowsToScan = Math.min(jsonData.length, 10)

  for (let i = 0; i < rowsToScan; i++) {
    const headers = (jsonData[i] as unknown[]).map(h => String(h || ''))
    const columnMapping = findColumnMapping(headers)

    if (hasRequiredColumns(columnMapping)) {
      return { headers, headerRowIndex: i, columnMapping }
    }
  }

  const headers = (jsonData[0] as unknown[]).map(h => String(h || ''))
  return { headers, headerRowIndex: 0, columnMapping: findColumnMapping(headers) }
}

function getOptionalValue(row: unknown[], mapping: Record<string, number>, key: string): string | undefined {
  const index = mapping[key]
  if (index === undefined) return undefined

  const value = String(row[index] || '').trim()
  return value || undefined
}

function getRowsFromCells(worksheet: XLSX.WorkSheet): unknown[][] {
  const cellRefs = Object.keys(worksheet).filter(key => !key.startsWith('!') && /^[A-Z]+[0-9]+$/i.test(key))
  if (cellRefs.length === 0) return []

  const cells = cellRefs.map(cellRef => {
    const address = XLSX.utils.decode_cell(cellRef)
    return {
      ...address,
      cellRef
    }
  })

  const minRow = Math.min(...cells.map(cell => cell.r))
  const maxRow = Math.max(...cells.map(cell => cell.r))
  const minCol = Math.min(...cells.map(cell => cell.c))
  const maxCol = Math.max(...cells.map(cell => cell.c))
  const rows: unknown[][] = []

  for (let rowIndex = minRow; rowIndex <= maxRow; rowIndex++) {
    const row: unknown[] = []
    let hasValue = false

    for (let colIndex = minCol; colIndex <= maxCol; colIndex++) {
      const cellAddress = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex })
      const cell = worksheet[cellAddress]
      const value = cell?.w ?? cell?.v ?? ''
      row.push(value)
      if (String(value).trim()) hasValue = true
    }

    if (hasValue) rows.push(row)
  }

  return rows
}

function getWorksheetRows(worksheet: XLSX.WorkSheet): unknown[][] {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
    header: 1,
    defval: '',
    blankrows: false,
    raw: false
  })

  if (rows.length >= 2) return rows

  const rowsFromCells = getRowsFromCells(worksheet)
  if (rowsFromCells.length > rows.length) return rowsFromCells

  const rangeRef = worksheet['!ref']
  if (!rangeRef) return []

  let range: XLSX.Range
  try {
    range = XLSX.utils.decode_range(rangeRef)
  } catch {
    return rowsFromCells
  }

  if (range.e.r - range.s.r > 100000 || range.e.c - range.s.c > 1000) {
    return rowsFromCells
  }

  const fallbackRows: unknown[][] = []

  for (let rowIndex = range.s.r; rowIndex <= range.e.r; rowIndex++) {
    const row: unknown[] = []
    let hasValue = false

    for (let colIndex = range.s.c; colIndex <= range.e.c; colIndex++) {
      const cellAddress = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex })
      const cell = worksheet[cellAddress]
      const value = cell?.w ?? cell?.v ?? ''
      row.push(value)
      if (String(value).trim()) hasValue = true
    }

    if (hasValue) fallbackRows.push(row)
  }

  return fallbackRows.length > rows.length ? fallbackRows : rows
}

function getWorkbookSheets(workbook: XLSX.WorkBook) {
  return workbook.SheetNames.map(sheetName => {
    const worksheet = workbook.Sheets[sheetName]
    const rows = worksheet ? getWorksheetRows(worksheet) : []
    const headerInfo = rows.length > 0 ? findHeaderRow(rows) : null

    return {
      sheetName,
      worksheet,
      rows,
      headerInfo,
      range: worksheet?.['!ref'] || 'sin rango'
    }
  })
}

export function parseExcelFile(buffer: ArrayBuffer): ParsedExcelData {
  if (buffer.byteLength === 0) {
    throw new Error('El archivo Excel esta vacio. Verifica que el archivo seleccionado se haya descargado completamente.')
  }

  const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' })
  const sheetCandidates = getWorkbookSheets(workbook)
  const selectedSheet = sheetCandidates.find(candidate =>
    candidate.headerInfo && hasRequiredColumns(candidate.headerInfo.columnMapping) && candidate.rows.length > candidate.headerInfo.headerRowIndex + 1
  ) || sheetCandidates.find(candidate => candidate.rows.length >= 2)

  if (!selectedSheet || !selectedSheet.headerInfo) {
    const sheetSummary = sheetCandidates
      .map(candidate => `${candidate.sheetName} (${candidate.range}, ${candidate.rows.length} filas leidas)`)
      .join('; ')

    throw new Error(`No se pudo leer una hoja con encabezados y datos. Hojas encontradas: ${sheetSummary || 'ninguna'}. Tamaño del archivo: ${buffer.byteLength} bytes. Verifica que estes subiendo el archivo completo con filas de datos, no una plantilla vacia o una copia truncada.`)
  }

  const jsonData = selectedSheet.rows
  const { headers, headerRowIndex, columnMapping } = selectedSheet.headerInfo

  // Verificar que tenemos las columnas necesarias
  const missingColumns: string[] = []
  if (columnMapping.guia === undefined) missingColumns.push('Guía')
  if (columnMapping.nombreDestinatario === undefined) missingColumns.push('Nombre Destinatario')
  if (columnMapping.ciudad === undefined) missingColumns.push('Ciudad')

  if (missingColumns.length > 0) {
    throw new Error(`No se encontraron las columnas requeridas: ${missingColumns.join(', ')}. Hoja leida: ${selectedSheet.sheetName}. Columnas encontradas: ${headers.join(', ')}`)
  }

  if (jsonData.length <= headerRowIndex + 1) {
    throw new Error(`La hoja "${selectedSheet.sheetName}" contiene encabezados pero no filas de datos. Rango leido: ${selectedSheet.range}.`)
  }

  const records: ShipmentRecord[] = []

  for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
    const row = jsonData[i] as unknown[]
    if (!row || row.length === 0) continue

    const guia = String(row[columnMapping.guia] || '').trim()
    const nombreDestinatario = String(row[columnMapping.nombreDestinatario] || '').trim()
    const ciudad = String(row[columnMapping.ciudad] || '').trim()

    // Saltar filas vacías
    if (!guia && !nombreDestinatario) continue

    const originalData = headers.reduce<Record<string, string>>((acc, header, index) => {
      if (header) acc[header] = String(row[index] || '').trim()
      return acc
    }, {})

    records.push({
      guia,
      nombreDestinatario,
      ciudad,
      codigoGuia: guia.substring(0, 3).toUpperCase(),
      direccion: getOptionalValue(row, columnMapping, 'direccion'),
      telefono: getOptionalValue(row, columnMapping, 'telefono'),
      detalle: getOptionalValue(row, columnMapping, 'detalle'),
      piezas: getOptionalValue(row, columnMapping, 'piezas'),
      peso: getOptionalValue(row, columnMapping, 'peso'),
      originalData
    })
  }

  if (records.length === 0) {
    throw new Error(`La hoja "${selectedSheet.sheetName}" no contiene registros validos despues de los encabezados. Verifica que existan valores en Guia y Nombre Destinatario.`)
  }

  return {
    records,
    totalRecords: records.length,
    headers
  }
}

export function exportToExcel(records: ShipmentRecord[], fileName: string): Blob {
  const worksheet = XLSX.utils.json_to_sheet(records.map(r => ({
    'Guía': r.guia,
    'Nombre Destinatario': r.nombreDestinatario,
    'Dirección': r.direccion || '',
    'Teléfono': r.telefono || '',
    'Detalle': r.detalle || '',
    'Ciudad': r.ciudad,
    'Piezas': r.piezas || '',
    'Peso': r.peso || '',
    'Código Guía': r.codigoGuia
  })))

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Despachos')

  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
  return new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}
