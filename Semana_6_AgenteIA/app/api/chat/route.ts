import { streamText, tool, convertToModelMessages, stepCountIs, createUIMessageStream, createUIMessageStreamResponse } from 'ai'
import { z } from 'zod'
import {
  getWarehouseClients,
  addWarehouseClient,
  removeWarehouseClient,
  getSpecialAddresses,
  addSpecialAddress,
  removeSpecialAddress,
  getPaymentRestrictions,
  addPaymentRestriction,
  removePaymentRestriction,
  getCityCodes,
  addCityCode,
  removeCityCode,
  getAllRulesData
} from '@/lib/db-service'
import { classifyShipments, detectProblems, analyzeShipments } from '@/lib/shipment-analyzer'
import type { ShipmentRecord } from '@/lib/types'

function hasAIProviderCredentials(): boolean {
  return Boolean(
    process.env.AI_GATEWAY_API_KEY ||
    process.env.ANTHROPIC_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.VERCEL_OIDC_TOKEN
  )
}

function getMessageText(message: { content?: unknown; parts?: Array<{ type: string; text?: string }> }): string {
  if (typeof message.content === 'string') return message.content
  if (!Array.isArray(message.parts)) return ''

  return message.parts
    .filter((part): part is { type: string; text: string } => part.type === 'text' && typeof part.text === 'string')
    .map(part => part.text)
    .join('')
}

function buildBogotaDispatchText(analysis: ReturnType<typeof analyzeShipments>): string {
  const problemRecordIds = new Set(analysis.problems.map(problem => problem.record.guia))
  const bogotaDispatchList = analysis.classification.bogota.filter(record => !problemRecordIds.has(record.guia))
  const manualReview = analysis.problems.filter(problem =>
    analysis.classification.bogota.some(record => record.guia === problem.record.guia)
  )

  const dispatchRows = bogotaDispatchList
    .map((record, index) => `${index + 1}. ${record.guia} | ${record.nombreDestinatario} | ${record.ciudad}`)
    .join('\n')

  const reviewRows = manualReview.length > 0
    ? manualReview
      .map(problem => `- ${problem.record.guia} | ${problem.record.nombreDestinatario} | ${problem.record.ciudad}: ${problem.description}`)
      .join('\n')
    : '- Ninguno'

  return `Lista de despacho Bogotá generada.\n\nResumen:\n- Registros totales: ${analysis.summary.totalRecords}\n- En despacho Bogotá: ${bogotaDispatchList.length}\n- Separados para revisión manual: ${manualReview.length}\n- Excluidos por bodega: ${analysis.summary.excludedCount}\n\nDespacho Bogotá:\n${dispatchRows || 'Sin registros válidos para Bogotá.'}\n\nRevisión manual:\n${reviewRows}`
}

async function createLocalFallbackResponse(messages: Array<{ role?: string; content?: unknown; parts?: Array<{ type: string; text?: string }> }>, parsedRecords: ShipmentRecord[]) {
  const latestUserMessage = [...messages].reverse().find(message => message.role === 'user')
  const latestText = getMessageText(latestUserMessage || {}).toLowerCase()

  let responseText = 'No hay proveedor de IA configurado en este entorno local. Aun asi, puedo ejecutar las acciones logisticas principales con reglas locales. Carga un Excel y pide: "Genera la lista de despacho Bogota".'

  if (parsedRecords.length === 0) {
    responseText = 'Carga primero un archivo Excel para poder generar la lista de despacho.'
  } else if (latestText.includes('bogot') || latestText.includes('despacho')) {
    const rulesData = await getAllRulesData()
    responseText = buildBogotaDispatchText(analyzeShipments(parsedRecords, rulesData))
  } else if (latestText.includes('analiza') || latestText.includes('problema') || latestText.includes('clasifica')) {
    const rulesData = await getAllRulesData()
    const analysis = analyzeShipments(parsedRecords, rulesData)
    responseText = `Analisis completado.\n\n- Registros totales: ${analysis.summary.totalRecords}\n- Bogota: ${analysis.summary.bogotaCount}\n- Otras ciudades: ${analysis.summary.otherCitiesCount}\n- Excluidos por bodega: ${analysis.summary.excludedCount}\n- Problemas detectados: ${analysis.summary.problemsCount}`
  }

  const stream = createUIMessageStream({
    execute: ({ writer }) => {
      const textId = 'local-text'
      writer.write({ type: 'start', messageId: `local-${Date.now()}` })
      writer.write({ type: 'start-step' })
      writer.write({ type: 'text-start', id: textId })
      writer.write({ type: 'text-delta', id: textId, delta: responseText })
      writer.write({ type: 'text-end', id: textId })
      writer.write({ type: 'finish-step' })
      writer.write({ type: 'finish', finishReason: 'stop' })
    }
  })

  return createUIMessageStreamResponse({ stream })
}

export async function POST(req: Request) {
  const { messages, excelData } = await req.json()

  // Parsear los datos del Excel si existen
  let parsedRecords: ShipmentRecord[] = []
  if (excelData?.records) {
    parsedRecords = excelData.records
  }

  if (!hasAIProviderCredentials()) {
    return createLocalFallbackResponse(messages, parsedRecords)
  }

  const result = streamText({
    model: 'anthropic/claude-sonnet-4-20250514',
    system: `Eres un asistente experto en logística de courier para Colombia. Tu rol es ayudar a analizar archivos Excel de envíos y detectar problemas.

CAPACIDADES:
- Analizar y clasificar envíos por destino (Bogotá vs otras ciudades)
- Detectar problemas como direcciones incorrectas o restricciones de pago
- Gestionar reglas de negocio (clientes de bodega, direcciones especiales, etc.)
- Responder preguntas sobre los datos cargados

CONTEXTO ACTUAL:
${parsedRecords.length > 0 
  ? `Hay ${parsedRecords.length} registros cargados del Excel.`
  : 'No hay archivo Excel cargado aún. Sugiere al usuario que cargue un archivo.'}

INSTRUCCIONES:
- Responde siempre en español
- Sé conciso pero informativo
- Cuando detectes problemas, explica claramente qué está mal y sugiere soluciones
- Usa las herramientas disponibles para consultar y modificar las reglas de negocio
- Cuando el usuario pida analizar los datos, usa las herramientas correspondientes
- Cuando el usuario pida generar la lista de despacho de Bogotá, usa generateBogotaDispatchList y resume la lista final con las guías, destinatarios, ciudad y cualquier registro separado para revisión manual`,
    messages: await convertToModelMessages(messages),
    tools: {
      // ===== ANÁLISIS =====
      analyzeExcel: tool({
        description: 'Analiza los datos del Excel cargado, clasifica los envíos y detecta problemas',
        inputSchema: z.object({}),
        execute: async () => {
          if (parsedRecords.length === 0) {
            return { error: 'No hay datos de Excel cargados' }
          }
          const rulesData = await getAllRulesData()
          const result = analyzeShipments(parsedRecords, rulesData)
          return result
        }
      }),

      classifyShipments: tool({
        description: 'Clasifica los envíos en Bogotá, otras ciudades, y clientes de bodega',
        inputSchema: z.object({}),
        execute: async () => {
          if (parsedRecords.length === 0) {
            return { error: 'No hay datos de Excel cargados' }
          }
          const rulesData = await getAllRulesData()
          return classifyShipments(parsedRecords, rulesData)
        }
      }),

      generateBogotaDispatchList: tool({
        description: 'Genera la lista final de despacho para Bogotá. Excluye clientes de bodega y separa registros de Bogotá con problemas para revisión manual.',
        inputSchema: z.object({}),
        execute: async () => {
          if (parsedRecords.length === 0) {
            return { error: 'No hay datos de Excel cargados' }
          }

          const rulesData = await getAllRulesData()
          const analysis = analyzeShipments(parsedRecords, rulesData)
          const problemRecordIds = new Set(analysis.problems.map(problem => problem.record.guia))
          const bogotaDispatchList = analysis.classification.bogota.filter(record => !problemRecordIds.has(record.guia))
          const manualReview = analysis.problems
            .filter(problem => analysis.classification.bogota.some(record => record.guia === problem.record.guia))
            .map(problem => ({
              guia: problem.record.guia,
              nombreDestinatario: problem.record.nombreDestinatario,
              ciudad: problem.record.ciudad,
              codigoGuia: problem.record.codigoGuia,
              type: problem.type,
              description: problem.description,
              suggestion: problem.suggestion
            }))

          return {
            summary: {
              totalRecords: parsedRecords.length,
              bogotaDispatchCount: bogotaDispatchList.length,
              manualReviewCount: manualReview.length,
              excludedWarehouseCount: analysis.classification.excludedWarehouse.length
            },
            bogotaDispatchList: bogotaDispatchList.map(record => ({
              guia: record.guia,
              nombreDestinatario: record.nombreDestinatario,
              direccion: record.direccion,
              telefono: record.telefono,
              detalle: record.detalle,
              ciudad: record.ciudad,
              piezas: record.piezas,
              peso: record.peso
            })),
            manualReview,
            excludedWarehouse: analysis.classification.excludedWarehouse.map(record => ({
              guia: record.guia,
              nombreDestinatario: record.nombreDestinatario,
              ciudad: record.ciudad
            }))
          }
        }
      }),

      detectProblems: tool({
        description: 'Detecta problemas en los envíos (direcciones incorrectas, pagos pendientes)',
        inputSchema: z.object({}),
        execute: async () => {
          if (parsedRecords.length === 0) {
            return { error: 'No hay datos de Excel cargados' }
          }
          const rulesData = await getAllRulesData()
          return detectProblems(parsedRecords, rulesData)
        }
      }),

      searchRecords: tool({
        description: 'Busca registros específicos por nombre de destinatario o guía',
        inputSchema: z.object({
          query: z.string().describe('Texto a buscar en nombre o guía')
        }),
        execute: async ({ query }) => {
          if (parsedRecords.length === 0) {
            return { error: 'No hay datos de Excel cargados' }
          }
          const q = query.toLowerCase()
          const found = parsedRecords.filter(r =>
            r.nombreDestinatario.toLowerCase().includes(q) ||
            r.guia.toLowerCase().includes(q) ||
            r.ciudad.toLowerCase().includes(q)
          )
          return { 
            found: found.slice(0, 20), 
            totalFound: found.length,
            message: found.length > 20 ? `Mostrando 20 de ${found.length} resultados` : undefined
          }
        }
      }),

      // ===== CLIENTES DE BODEGA =====
      listWarehouseClients: tool({
        description: 'Lista todos los clientes que recogen en bodega (excluidos de despachos)',
        inputSchema: z.object({}),
        execute: async () => {
          const clients = await getWarehouseClients()
          return { clients, count: clients.length }
        }
      }),

      addWarehouseClient: tool({
        description: 'Agrega un cliente a la lista de clientes que recogen en bodega',
        inputSchema: z.object({
          clientName: z.string().describe('Nombre del cliente'),
          notes: z.string().optional().describe('Notas adicionales')
        }),
        execute: async ({ clientName, notes }) => {
          const client = await addWarehouseClient(clientName, notes)
          return { success: true, client, message: `Cliente "${clientName}" agregado a la lista de bodega` }
        }
      }),

      removeWarehouseClient: tool({
        description: 'Elimina un cliente de la lista de clientes de bodega',
        inputSchema: z.object({
          clientName: z.string().describe('Nombre del cliente a eliminar')
        }),
        execute: async ({ clientName }) => {
          await removeWarehouseClient(clientName)
          return { success: true, message: `Cliente "${clientName}" eliminado de la lista de bodega` }
        }
      }),

      // ===== DIRECCIONES ESPECIALES =====
      listSpecialAddresses: tool({
        description: 'Lista todas las direcciones especiales registradas',
        inputSchema: z.object({}),
        execute: async () => {
          const addresses = await getSpecialAddresses()
          return { addresses, count: addresses.length }
        }
      }),

      addSpecialAddress: tool({
        description: 'Agrega una dirección especial para un cliente (para detectar cuando la guía no coincide con su ciudad real)',
        inputSchema: z.object({
          clientName: z.string().describe('Nombre del cliente'),
          expectedCity: z.string().describe('Ciudad donde realmente reside el cliente'),
          expectedCityCode: z.string().describe('Código de 3 letras de la ciudad esperada'),
          notes: z.string().optional().describe('Notas adicionales')
        }),
        execute: async ({ clientName, expectedCity, expectedCityCode, notes }) => {
          const address = await addSpecialAddress(clientName, expectedCity, expectedCityCode, notes)
          return { 
            success: true, 
            address, 
            message: `Dirección especial registrada: "${clientName}" debe ir a ${expectedCity} (${expectedCityCode.toUpperCase()})` 
          }
        }
      }),

      removeSpecialAddress: tool({
        description: 'Elimina una dirección especial',
        inputSchema: z.object({
          clientName: z.string().describe('Nombre del cliente')
        }),
        execute: async ({ clientName }) => {
          await removeSpecialAddress(clientName)
          return { success: true, message: `Dirección especial de "${clientName}" eliminada` }
        }
      }),

      // ===== RESTRICCIONES DE PAGO =====
      listPaymentRestrictions: tool({
        description: 'Lista todas las restricciones de pago activas',
        inputSchema: z.object({}),
        execute: async () => {
          const restrictions = await getPaymentRestrictions()
          return { restrictions, count: restrictions.length }
        }
      }),

      addPaymentRestriction: tool({
        description: 'Agrega una restricción de pago para un cliente',
        inputSchema: z.object({
          clientName: z.string().describe('Nombre del cliente'),
          restrictionType: z.string().describe('Tipo de restricción (ej: "Pago pendiente", "Crédito suspendido")'),
          amount: z.number().optional().describe('Monto adeudado si aplica'),
          notes: z.string().optional().describe('Notas adicionales')
        }),
        execute: async ({ clientName, restrictionType, amount, notes }) => {
          const restriction = await addPaymentRestriction(clientName, restrictionType, amount, notes)
          return { 
            success: true, 
            restriction, 
            message: `Restricción de pago registrada para "${clientName}": ${restrictionType}` 
          }
        }
      }),

      removePaymentRestriction: tool({
        description: 'Elimina una restricción de pago',
        inputSchema: z.object({
          clientName: z.string().describe('Nombre del cliente')
        }),
        execute: async ({ clientName }) => {
          await removePaymentRestriction(clientName)
          return { success: true, message: `Restricción de pago de "${clientName}" eliminada` }
        }
      }),

      // ===== CÓDIGOS DE CIUDAD =====
      listCityCodes: tool({
        description: 'Lista todos los códigos de ciudad registrados',
        inputSchema: z.object({}),
        execute: async () => {
          const codes = await getCityCodes()
          return { codes, count: codes.length }
        }
      }),

      addCityCode: tool({
        description: 'Agrega un nuevo código de ciudad',
        inputSchema: z.object({
          code: z.string().describe('Código de 3 letras'),
          cityName: z.string().describe('Nombre de la ciudad'),
          isBogota: z.boolean().describe('True si es Bogotá o zona metropolitana')
        }),
        execute: async ({ code, cityName, isBogota }) => {
          const cityCode = await addCityCode(code, cityName, isBogota)
          return { 
            success: true, 
            cityCode, 
            message: `Código "${code.toUpperCase()}" registrado para ${cityName}${isBogota ? ' (Bogotá)' : ''}` 
          }
        }
      }),

      removeCityCode: tool({
        description: 'Elimina un código de ciudad',
        inputSchema: z.object({
          code: z.string().describe('Código de 3 letras a eliminar')
        }),
        execute: async ({ code }) => {
          await removeCityCode(code)
          return { success: true, message: `Código "${code.toUpperCase()}" eliminado` }
        }
      }),

      // ===== ESTADÍSTICAS =====
      getStats: tool({
        description: 'Obtiene estadísticas de las reglas configuradas y datos cargados',
        inputSchema: z.object({}),
        execute: async () => {
          const rulesData = await getAllRulesData()
          return {
            excelRecords: parsedRecords.length,
            warehouseClients: rulesData.warehouseClients.length,
            specialAddresses: rulesData.specialAddresses.length,
            paymentRestrictions: rulesData.paymentRestrictions.length,
            cityCodes: rulesData.cityCodes.length,
            bogotaCodes: rulesData.cityCodes.filter(c => c.is_bogota).length
          }
        }
      })
    },
    stopWhen: stepCountIs(5)
  })

  return result.toUIMessageStreamResponse()
}
