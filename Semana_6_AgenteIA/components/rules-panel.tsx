'use client'

import { useState, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Trash2, Warehouse, MapPinned, CreditCard, Hash, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { WarehouseClient, SpecialAddress, PaymentRestriction, CityCode } from '@/lib/types'

export function RulesPanel() {
  const [activeTab, setActiveTab] = useState('warehouse')
  const [isLoading, setIsLoading] = useState(true)
  const [warehouseClients, setWarehouseClients] = useState<WarehouseClient[]>([])
  const [specialAddresses, setSpecialAddresses] = useState<SpecialAddress[]>([])
  const [paymentRestrictions, setPaymentRestrictions] = useState<PaymentRestriction[]>([])
  const [cityCodes, setCityCodes] = useState<CityCode[]>([])

  // Form states
  const [newWarehouse, setNewWarehouse] = useState({ name: '', notes: '' })
  const [newAddress, setNewAddress] = useState({ name: '', city: '', code: '', notes: '' })
  const [newPayment, setNewPayment] = useState({ name: '', type: '', amount: '', notes: '' })
  const [newCity, setNewCity] = useState({ code: '', name: '', isBogota: false })

  const isSupabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
  const supabase = isSupabaseConfigured ? createClient() : null

  const fetchData = async () => {
    setIsLoading(true)
    if (!supabase) {
      setIsLoading(false)
      return
    }

    try {
      const [wc, sa, pr, cc] = await Promise.all([
        supabase.from('warehouse_clients').select('*').order('client_name'),
        supabase.from('special_addresses').select('*').order('client_name'),
        supabase.from('payment_restrictions').select('*').eq('is_active', true).order('client_name'),
        supabase.from('city_codes').select('*').order('code'),
      ])
      setWarehouseClients(wc.data || [])
      setSpecialAddresses(sa.data || [])
      setPaymentRestrictions(pr.data || [])
      setCityCodes(cc.data || [])
    } catch (error) {
      console.error('Error fetching data:', error)
    }
    setIsLoading(false)
  }

  useEffect(() => {
    fetchData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const addWarehouseClient = async () => {
    if (!supabase || !newWarehouse.name.trim()) return
    await supabase.from('warehouse_clients').insert({
      client_name: newWarehouse.name,
      notes: newWarehouse.notes || null,
    })
    setNewWarehouse({ name: '', notes: '' })
    fetchData()
  }

  const deleteWarehouseClient = async (id: string) => {
    if (!supabase) return
    await supabase.from('warehouse_clients').delete().eq('id', id)
    fetchData()
  }

  const addSpecialAddress = async () => {
    if (!supabase || !newAddress.name.trim() || !newAddress.city.trim() || !newAddress.code.trim()) return
    await supabase.from('special_addresses').insert({
      client_name: newAddress.name,
      expected_city: newAddress.city,
      expected_city_code: newAddress.code.toUpperCase(),
      notes: newAddress.notes || null,
    })
    setNewAddress({ name: '', city: '', code: '', notes: '' })
    fetchData()
  }

  const deleteSpecialAddress = async (id: string) => {
    if (!supabase) return
    await supabase.from('special_addresses').delete().eq('id', id)
    fetchData()
  }

  const addPaymentRestriction = async () => {
    if (!supabase || !newPayment.name.trim() || !newPayment.type.trim()) return
    await supabase.from('payment_restrictions').insert({
      client_name: newPayment.name,
      restriction_type: newPayment.type,
      amount: newPayment.amount ? parseFloat(newPayment.amount) : null,
      notes: newPayment.notes || null,
      is_active: true,
    })
    setNewPayment({ name: '', type: '', amount: '', notes: '' })
    fetchData()
  }

  const deletePaymentRestriction = async (id: string) => {
    if (!supabase) return
    await supabase.from('payment_restrictions').delete().eq('id', id)
    fetchData()
  }

  const addCityCode = async () => {
    if (!supabase || !newCity.code.trim() || !newCity.name.trim()) return
    await supabase.from('city_codes').insert({
      code: newCity.code.toUpperCase(),
      city_name: newCity.name,
      is_bogota: newCity.isBogota,
    })
    setNewCity({ code: '', name: '', isBogota: false })
    fetchData()
  }

  const deleteCityCode = async (id: string) => {
    if (!supabase) return
    await supabase.from('city_codes').delete().eq('id', id)
    fetchData()
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!isSupabaseConfigured) {
    return (
      <div className="rounded-lg border border-border bg-secondary/30 p-4 text-sm text-muted-foreground">
        La gestion de reglas esta en modo local porque Supabase no esta configurado. El analisis del Excel funciona con codigos de ciudad predeterminados y puedes probar el despacho de Bogota desde el chat.
      </div>
    )
  }

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid grid-cols-4 mb-4">
        <TabsTrigger value="warehouse" className="text-xs">
          <Warehouse className="h-3 w-3 mr-1" />
          Bodega
        </TabsTrigger>
        <TabsTrigger value="addresses" className="text-xs">
          <MapPinned className="h-3 w-3 mr-1" />
          Direcciones
        </TabsTrigger>
        <TabsTrigger value="payments" className="text-xs">
          <CreditCard className="h-3 w-3 mr-1" />
          Pagos
        </TabsTrigger>
        <TabsTrigger value="cities" className="text-xs">
          <Hash className="h-3 w-3 mr-1" />
          Ciudades
        </TabsTrigger>
      </TabsList>

      <TabsContent value="warehouse" className="space-y-4">
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Clientes de Bodega</CardTitle>
            <CardDescription className="text-xs">
              Clientes que recogen en bodega y se excluyen de despachos
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="Nombre del cliente"
                value={newWarehouse.name}
                onChange={(e) => setNewWarehouse({ ...newWarehouse, name: e.target.value })}
                className="text-sm"
              />
              <Input
                placeholder="Notas (opcional)"
                value={newWarehouse.notes}
                onChange={(e) => setNewWarehouse({ ...newWarehouse, notes: e.target.value })}
                className="text-sm"
              />
              <Button onClick={addWarehouseClient} size="icon" className="shrink-0">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {warehouseClients.map((client) => (
                <div
                  key={client.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-secondary/50 text-sm"
                >
                  <div>
                    <span className="font-medium">{client.client_name}</span>
                    {client.notes && (
                      <span className="text-muted-foreground ml-2">- {client.notes}</span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteWarehouseClient(client.id)}
                    className="h-8 w-8 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {warehouseClients.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No hay clientes de bodega registrados
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="addresses" className="space-y-4">
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Direcciones Especiales</CardTitle>
            <CardDescription className="text-xs">
              Clientes con direcciones conocidas diferentes al codigo de guia
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="Nombre cliente"
                value={newAddress.name}
                onChange={(e) => setNewAddress({ ...newAddress, name: e.target.value })}
                className="text-sm"
              />
              <Input
                placeholder="Ciudad esperada"
                value={newAddress.city}
                onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })}
                className="text-sm"
              />
              <Input
                placeholder="Codigo (3 letras)"
                value={newAddress.code}
                onChange={(e) => setNewAddress({ ...newAddress, code: e.target.value.slice(0, 3) })}
                className="text-sm"
                maxLength={3}
              />
              <div className="flex gap-2">
                <Input
                  placeholder="Notas"
                  value={newAddress.notes}
                  onChange={(e) => setNewAddress({ ...newAddress, notes: e.target.value })}
                  className="text-sm"
                />
                <Button onClick={addSpecialAddress} size="icon" className="shrink-0">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {specialAddresses.map((addr) => (
                <div
                  key={addr.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-secondary/50 text-sm"
                >
                  <div>
                    <span className="font-medium">{addr.client_name}</span>
                    <span className="text-accent ml-2">
                      {addr.expected_city} ({addr.expected_city_code})
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteSpecialAddress(addr.id)}
                    className="h-8 w-8 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {specialAddresses.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No hay direcciones especiales registradas
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="payments" className="space-y-4">
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Restricciones de Pago</CardTitle>
            <CardDescription className="text-xs">
              Clientes con pagos pendientes o restricciones de envio
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="Nombre cliente"
                value={newPayment.name}
                onChange={(e) => setNewPayment({ ...newPayment, name: e.target.value })}
                className="text-sm"
              />
              <Input
                placeholder="Tipo restriccion"
                value={newPayment.type}
                onChange={(e) => setNewPayment({ ...newPayment, type: e.target.value })}
                className="text-sm"
              />
              <Input
                placeholder="Monto (opcional)"
                type="number"
                value={newPayment.amount}
                onChange={(e) => setNewPayment({ ...newPayment, amount: e.target.value })}
                className="text-sm"
              />
              <div className="flex gap-2">
                <Input
                  placeholder="Notas"
                  value={newPayment.notes}
                  onChange={(e) => setNewPayment({ ...newPayment, notes: e.target.value })}
                  className="text-sm"
                />
                <Button onClick={addPaymentRestriction} size="icon" className="shrink-0">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {paymentRestrictions.map((pr) => (
                <div
                  key={pr.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-secondary/50 text-sm"
                >
                  <div>
                    <span className="font-medium">{pr.client_name}</span>
                    <span className="text-destructive ml-2">{pr.restriction_type}</span>
                    {pr.amount && (
                      <span className="text-muted-foreground ml-1">(${pr.amount})</span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deletePaymentRestriction(pr.id)}
                    className="h-8 w-8 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {paymentRestrictions.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No hay restricciones de pago registradas
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="cities" className="space-y-4">
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Codigos de Ciudad</CardTitle>
            <CardDescription className="text-xs">
              Codigos de 3 letras de las guias y su ciudad correspondiente
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="Codigo (3 letras)"
                value={newCity.code}
                onChange={(e) => setNewCity({ ...newCity, code: e.target.value.toUpperCase().slice(0, 3) })}
                className="text-sm w-24"
                maxLength={3}
              />
              <Input
                placeholder="Nombre ciudad"
                value={newCity.name}
                onChange={(e) => setNewCity({ ...newCity, name: e.target.value })}
                className="text-sm flex-1"
              />
              <label className="flex items-center gap-1 text-xs whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={newCity.isBogota}
                  onChange={(e) => setNewCity({ ...newCity, isBogota: e.target.checked })}
                  className="rounded"
                />
                Bogota
              </label>
              <Button onClick={addCityCode} size="icon" className="shrink-0">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {cityCodes.map((city) => (
                <div
                  key={city.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-secondary/50 text-sm"
                >
                  <div>
                    <span className="font-mono font-bold text-primary">{city.code}</span>
                    <span className="ml-2">{city.city_name}</span>
                    {city.is_bogota && (
                      <span className="ml-2 text-xs bg-accent/20 text-accent px-2 py-0.5 rounded">
                        Bogota
                      </span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteCityCode(city.id)}
                    className="h-8 w-8 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {cityCodes.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No hay codigos de ciudad registrados
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
}
