// Tipos para el sistema de logística courier

export interface ShipmentRecord {
  guia: string
  nombreDestinatario: string
  ciudad: string
  codigoGuia: string // Primeros 3 caracteres de la guía
  direccion?: string
  telefono?: string
  detalle?: string
  piezas?: string
  peso?: string
  originalData?: Record<string, string>
}

export interface ParsedExcelData {
  records: ShipmentRecord[]
  totalRecords: number
  headers: string[]
}

export interface ClassificationResult {
  bogota: ShipmentRecord[]
  otherCities: ShipmentRecord[]
  excludedWarehouse: ShipmentRecord[]
}

export interface DetectedProblem {
  type: 'address_mismatch' | 'payment_restriction' | 'unknown_city_code' | 'city_mismatch'
  record: ShipmentRecord
  description: string
  suggestion?: string
}

export interface AnalysisResult {
  classification: ClassificationResult
  problems: DetectedProblem[]
  summary: {
    totalRecords: number
    bogotaCount: number
    otherCitiesCount: number
    excludedCount: number
    problemsCount: number
  }
}

// Tipos para las tablas de la base de datos
export interface WarehouseClient {
  id: string
  client_name: string
  notes: string | null
  created_at: string
}

export interface SpecialAddress {
  id: string
  client_name: string
  expected_city: string
  expected_city_code: string
  notes: string | null
  created_at: string
}

export interface PaymentRestriction {
  id: string
  client_name: string
  restriction_type: string
  amount: number | null
  notes: string | null
  is_active: boolean
  created_at: string
}

export interface CityCode {
  id: string
  code: string
  city_name: string
  is_bogota: boolean
  created_at: string
}

export interface BusinessRule {
  id: string
  rule_type: string
  rule_name: string
  rule_config: Record<string, unknown>
  is_active: boolean
  created_at: string
  updated_at: string
}

// Estado del chat y Excel cargado
export interface ExcelState {
  data: ParsedExcelData | null
  fileName: string | null
  isLoading: boolean
  error: string | null
}
