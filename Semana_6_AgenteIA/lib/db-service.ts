import { createClient } from '@/lib/supabase/server'
import type {
  WarehouseClient,
  SpecialAddress,
  PaymentRestriction,
  CityCode,
  BusinessRule
} from './types'
import { DEFAULT_CITY_CODES } from './shipment-analyzer'

const EMPTY_RULES_DATA = {
  warehouseClients: [] as WarehouseClient[],
  specialAddresses: [] as SpecialAddress[],
  paymentRestrictions: [] as PaymentRestriction[],
  cityCodes: DEFAULT_CITY_CODES
}

function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

// ===== Warehouse Clients =====
export async function getWarehouseClients(): Promise<WarehouseClient[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('warehouse_clients')
    .select('*')
    .order('client_name')
  
  if (error) throw new Error(`Error fetching warehouse clients: ${error.message}`)
  return data || []
}

export async function addWarehouseClient(clientName: string, notes?: string): Promise<WarehouseClient> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('warehouse_clients')
    .insert({ client_name: clientName, notes })
    .select()
    .single()
  
  if (error) throw new Error(`Error adding warehouse client: ${error.message}`)
  return data
}

export async function removeWarehouseClient(clientName: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('warehouse_clients')
    .delete()
    .ilike('client_name', clientName)
  
  if (error) throw new Error(`Error removing warehouse client: ${error.message}`)
}

// ===== Special Addresses =====
export async function getSpecialAddresses(): Promise<SpecialAddress[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('special_addresses')
    .select('*')
    .order('client_name')
  
  if (error) throw new Error(`Error fetching special addresses: ${error.message}`)
  return data || []
}

export async function addSpecialAddress(
  clientName: string,
  expectedCity: string,
  expectedCityCode: string,
  notes?: string
): Promise<SpecialAddress> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('special_addresses')
    .insert({
      client_name: clientName,
      expected_city: expectedCity,
      expected_city_code: expectedCityCode.toUpperCase(),
      notes
    })
    .select()
    .single()
  
  if (error) throw new Error(`Error adding special address: ${error.message}`)
  return data
}

export async function removeSpecialAddress(clientName: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('special_addresses')
    .delete()
    .ilike('client_name', clientName)
  
  if (error) throw new Error(`Error removing special address: ${error.message}`)
}

// ===== Payment Restrictions =====
export async function getPaymentRestrictions(): Promise<PaymentRestriction[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('payment_restrictions')
    .select('*')
    .eq('is_active', true)
    .order('client_name')
  
  if (error) throw new Error(`Error fetching payment restrictions: ${error.message}`)
  return data || []
}

export async function addPaymentRestriction(
  clientName: string,
  restrictionType: string,
  amount?: number,
  notes?: string
): Promise<PaymentRestriction> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('payment_restrictions')
    .insert({
      client_name: clientName,
      restriction_type: restrictionType,
      amount,
      notes,
      is_active: true
    })
    .select()
    .single()
  
  if (error) throw new Error(`Error adding payment restriction: ${error.message}`)
  return data
}

export async function removePaymentRestriction(clientName: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('payment_restrictions')
    .delete()
    .ilike('client_name', clientName)
  
  if (error) throw new Error(`Error removing payment restriction: ${error.message}`)
}

// ===== City Codes =====
export async function getCityCodes(): Promise<CityCode[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('city_codes')
    .select('*')
    .order('code')
  
  if (error) throw new Error(`Error fetching city codes: ${error.message}`)
  return data || []
}

export async function addCityCode(
  code: string,
  cityName: string,
  isBogota: boolean = false
): Promise<CityCode> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('city_codes')
    .insert({
      code: code.toUpperCase(),
      city_name: cityName,
      is_bogota: isBogota
    })
    .select()
    .single()
  
  if (error) throw new Error(`Error adding city code: ${error.message}`)
  return data
}

export async function removeCityCode(code: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('city_codes')
    .delete()
    .ilike('code', code)
  
  if (error) throw new Error(`Error removing city code: ${error.message}`)
}

// ===== Business Rules =====
export async function getBusinessRules(): Promise<BusinessRule[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('business_rules')
    .select('*')
    .eq('is_active', true)
    .order('rule_type')
  
  if (error) throw new Error(`Error fetching business rules: ${error.message}`)
  return data || []
}

export async function addBusinessRule(
  ruleType: string,
  ruleName: string,
  ruleConfig: Record<string, unknown>
): Promise<BusinessRule> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('business_rules')
    .insert({
      rule_type: ruleType,
      rule_name: ruleName,
      rule_config: ruleConfig,
      is_active: true
    })
    .select()
    .single()
  
  if (error) throw new Error(`Error adding business rule: ${error.message}`)
  return data
}

export async function updateBusinessRule(
  id: string,
  updates: Partial<Pick<BusinessRule, 'rule_name' | 'rule_config' | 'is_active'>>
): Promise<BusinessRule> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('business_rules')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  
  if (error) throw new Error(`Error updating business rule: ${error.message}`)
  return data
}

export async function removeBusinessRule(id: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('business_rules')
    .delete()
    .eq('id', id)
  
  if (error) throw new Error(`Error removing business rule: ${error.message}`)
}

// ===== Analysis Helpers =====
export async function getAllRulesData() {
  if (!isSupabaseConfigured()) {
    return EMPTY_RULES_DATA
  }

  try {
  const [warehouseClients, specialAddresses, paymentRestrictions, cityCodes] = await Promise.all([
    getWarehouseClients(),
    getSpecialAddresses(),
    getPaymentRestrictions(),
    getCityCodes()
  ])

  return {
    warehouseClients,
    specialAddresses,
    paymentRestrictions,
    cityCodes: cityCodes.length > 0 ? cityCodes : DEFAULT_CITY_CODES
  }
  } catch (error) {
    console.warn('Using local fallback rules because Supabase rules could not be loaded:', error)
    return EMPTY_RULES_DATA
  }
}
