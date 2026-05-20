import type { ShipmentRecord, ClassificationResult, DetectedProblem, AnalysisResult } from './types'
import type { WarehouseClient, SpecialAddress, PaymentRestriction, CityCode } from './types'

interface RulesData {
  warehouseClients: WarehouseClient[]
  specialAddresses: SpecialAddress[]
  paymentRestrictions: PaymentRestriction[]
  cityCodes: CityCode[]
}

export const DEFAULT_CITY_CODES: CityCode[] = [
  { id: 'default-bog', code: 'BOG', city_name: 'Bogotá', is_bogota: true, created_at: '' },
  { id: 'default-bar', code: 'BAR', city_name: 'Barranquilla', is_bogota: false, created_at: '' },
  { id: 'default-bug', code: 'BUG', city_name: 'Buga', is_bogota: false, created_at: '' },
  { id: 'default-cal', code: 'CAL', city_name: 'Cali', is_bogota: false, created_at: '' },
  { id: 'default-car', code: 'CAR', city_name: 'Cartagena', is_bogota: false, created_at: '' },
  { id: 'default-cuc', code: 'CUC', city_name: 'Cúcuta', is_bogota: false, created_at: '' },
  { id: 'default-env', code: 'ENV', city_name: 'Envigado', is_bogota: false, created_at: '' },
  { id: 'default-flo', code: 'FLO', city_name: 'Floridablanca', is_bogota: false, created_at: '' },
  { id: 'default-fun', code: 'FUN', city_name: 'Funza', is_bogota: false, created_at: '' },
  { id: 'default-ita', code: 'ITA', city_name: 'Itagui', is_bogota: false, created_at: '' },
  { id: 'default-jam', code: 'JAM', city_name: 'Jamundi', is_bogota: false, created_at: '' },
  { id: 'default-mde', code: 'MDE', city_name: 'Medellín', is_bogota: false, created_at: '' },
  { id: 'default-med', code: 'MED', city_name: 'Medellín', is_bogota: false, created_at: '' },
  { id: 'default-pal', code: 'PAL', city_name: 'Palmira', is_bogota: false, created_at: '' },
  { id: 'default-per', code: 'PER', city_name: 'Pereira', is_bogota: false, created_at: '' },
  { id: 'default-rio', code: 'RIO', city_name: 'Riohacha', is_bogota: false, created_at: '' },
  { id: 'default-san', code: 'SAN', city_name: 'San Marcos', is_bogota: false, created_at: '' },
  { id: 'default-sol', code: 'SOL', city_name: 'Soledad', is_bogota: false, created_at: '' },
  { id: 'default-val', code: 'VAL', city_name: 'Valledupar', is_bogota: false, created_at: '' },
  { id: 'default-vdl', code: 'VDL', city_name: 'Villa de Leyva', is_bogota: false, created_at: '' },
]

function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function getCityCodes(cityCodes: CityCode[]): CityCode[] {
  const customCodes = new Set(cityCodes.map(c => c.code.toUpperCase()))
  const fallbackCodes = DEFAULT_CITY_CODES.filter(c => !customCodes.has(c.code.toUpperCase()))
  return [...cityCodes, ...fallbackCodes]
}

function findCityCode(code: string, cityCodes: CityCode[]): CityCode | undefined {
  return getCityCodes(cityCodes).find(c => c.code.toUpperCase() === code.toUpperCase())
}

function isBogotaCode(code: string, cityCodes: CityCode[]): boolean {
  const cityCode = findCityCode(code, cityCodes)
  if (cityCode) {
    return cityCode.is_bogota
  }
  // Default: Si el código empieza con BOG, es Bogotá
  return code.toUpperCase().startsWith('BOG')
}

function isWarehouseClient(clientName: string, warehouseClients: WarehouseClient[]): boolean {
  const normalizedName = normalizeString(clientName)
  return warehouseClients.some(wc => 
    normalizeString(wc.client_name) === normalizedName ||
    normalizedName.includes(normalizeString(wc.client_name)) ||
    normalizeString(wc.client_name).includes(normalizedName)
  )
}

function findSpecialAddress(clientName: string, specialAddresses: SpecialAddress[]): SpecialAddress | undefined {
  const normalizedName = normalizeString(clientName)
  return specialAddresses.find(sa =>
    normalizeString(sa.client_name) === normalizedName ||
    normalizedName.includes(normalizeString(sa.client_name)) ||
    normalizeString(sa.client_name).includes(normalizedName)
  )
}

function findPaymentRestriction(clientName: string, paymentRestrictions: PaymentRestriction[]): PaymentRestriction | undefined {
  const normalizedName = normalizeString(clientName)
  return paymentRestrictions.find(pr =>
    normalizeString(pr.client_name) === normalizedName ||
    normalizedName.includes(normalizeString(pr.client_name)) ||
    normalizeString(pr.client_name).includes(normalizedName)
  )
}

function cityMatchesExpected(recordCity: string, expectedCity: string): boolean {
  const normalizedRecordCity = normalizeString(recordCity)
  const normalizedExpectedCity = normalizeString(expectedCity)

  if (!normalizedRecordCity || !normalizedExpectedCity) return true
  if (normalizedRecordCity === normalizedExpectedCity) return true
  if (normalizedRecordCity.includes(normalizedExpectedCity)) return true
  if (normalizedExpectedCity.includes(normalizedRecordCity)) return true

  const bogotaAliases = ['bogota', 'bogota d c']
  if (bogotaAliases.includes(normalizedExpectedCity)) {
    return bogotaAliases.includes(normalizedRecordCity)
  }

  const medellinAliases = ['medellin', 'aeropuerto medellin']
  if (medellinAliases.includes(normalizedExpectedCity)) {
    return medellinAliases.includes(normalizedRecordCity)
  }

  return false
}

export function classifyShipments(records: ShipmentRecord[], rulesData: RulesData): ClassificationResult {
  const bogota: ShipmentRecord[] = []
  const otherCities: ShipmentRecord[] = []
  const excludedWarehouse: ShipmentRecord[] = []

  for (const record of records) {
    // Primero verificar si es cliente de bodega
    if (isWarehouseClient(record.nombreDestinatario, rulesData.warehouseClients)) {
      excludedWarehouse.push(record)
      continue
    }

    // Clasificar por código de ciudad
    if (isBogotaCode(record.codigoGuia, rulesData.cityCodes)) {
      bogota.push(record)
    } else {
      otherCities.push(record)
    }
  }

  return { bogota, otherCities, excludedWarehouse }
}

export function detectProblems(records: ShipmentRecord[], rulesData: RulesData): DetectedProblem[] {
  const problems: DetectedProblem[] = []

  for (const record of records) {
    // Verificar direcciones especiales
    const specialAddress = findSpecialAddress(record.nombreDestinatario, rulesData.specialAddresses)
    if (specialAddress) {
      const expectedCode = specialAddress.expected_city_code.toUpperCase()
      if (record.codigoGuia.toUpperCase() !== expectedCode) {
        problems.push({
          type: 'address_mismatch',
          record,
          description: `El cliente "${record.nombreDestinatario}" tiene guía con código "${record.codigoGuia}" pero su dirección esperada es en ${specialAddress.expected_city} (código: ${expectedCode})`,
          suggestion: `Verificar manualmente si la dirección es correcta o si el paquete debe enviarse a ${specialAddress.expected_city}`
        })
      }
    }

    // Verificar restricciones de pago
    const paymentRestriction = findPaymentRestriction(record.nombreDestinatario, rulesData.paymentRestrictions)
    if (paymentRestriction) {
      problems.push({
        type: 'payment_restriction',
        record,
        description: `El cliente "${record.nombreDestinatario}" tiene restricción de pago: ${paymentRestriction.restriction_type}${paymentRestriction.amount ? ` ($${paymentRestriction.amount})` : ''}`,
        suggestion: paymentRestriction.notes || 'Verificar estado de pago antes de enviar'
      })
    }

    // Verificar códigos de ciudad desconocidos
    const knownCode = findCityCode(record.codigoGuia, rulesData.cityCodes)
    if (knownCode && !cityMatchesExpected(record.ciudad, knownCode.city_name)) {
      problems.push({
        type: 'city_mismatch',
        record,
        description: `La guía "${record.guia}" usa el código "${record.codigoGuia}" (${knownCode.city_name}), pero la columna Ciudad indica "${record.ciudad}"`,
        suggestion: 'Verificar si la ciudad del Excel o el prefijo de la guía están correctos antes de despachar'
      })
    }

    if (!knownCode && record.codigoGuia.length === 3) {
      problems.push({
        type: 'unknown_city_code',
        record,
        description: `Código de guía "${record.codigoGuia}" no está registrado en el sistema`,
        suggestion: `Considerar agregar el código "${record.codigoGuia}" con su ciudad correspondiente`
      })
    }
  }

  return problems
}

export function analyzeShipments(records: ShipmentRecord[], rulesData: RulesData): AnalysisResult {
  const classification = classifyShipments(records, rulesData)
  
  // Detectar problemas solo en los envíos que sí se van a despachar (no los de bodega)
  const activeRecords = [...classification.bogota, ...classification.otherCities]
  const problems = detectProblems(activeRecords, rulesData)

  return {
    classification,
    problems,
    summary: {
      totalRecords: records.length,
      bogotaCount: classification.bogota.length,
      otherCitiesCount: classification.otherCities.length,
      excludedCount: classification.excludedWarehouse.length,
      problemsCount: problems.length
    }
  }
}
