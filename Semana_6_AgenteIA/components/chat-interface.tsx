'use client'

import { useState, useRef, useEffect } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { Send, Bot, User, Loader2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ParsedExcelData } from '@/lib/types'

interface ChatInterfaceProps {
  excelData: ParsedExcelData | null
}

function getUIMessageText(msg: { parts?: Array<{ type: string; text?: string }> }): string {
  if (!msg.parts || !Array.isArray(msg.parts)) return ''
  return msg.parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('')
}

export function ChatInterface({ excelData }: ChatInterfaceProps) {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const excelDataRef = useRef<ParsedExcelData | null>(excelData)

  useEffect(() => {
    excelDataRef.current = excelData
  }, [excelData])

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
      prepareSendMessagesRequest: ({ id, messages }) => ({
        body: {
          messages,
          id,
          excelData: excelDataRef.current ? { records: excelDataRef.current.records } : null,
        },
      }),
    }),
  })

  const isLoading = status === 'streaming' || status === 'submitted'

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return
    sendMessage({ text: input })
    setInput('')
  }

  const suggestedQuestions = [
    'Analiza los datos del Excel',
    'Genera la lista de despacho Bogotá',
    'Clasifica los envíos por destino',
    'Detecta problemas en los despachos',
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Asistente de Logística</h3>
            <p className="text-muted-foreground text-sm mb-6 max-w-md">
              {excelData
                ? `Tienes ${excelData.totalRecords} registros cargados. Pregunta lo que necesites sobre tus envíos.`
                : 'Carga un archivo Excel para comenzar a analizar tus despachos.'}
            </p>
            
            {excelData && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-md">
                {suggestedQuestions.map((question) => (
                  <button
                    key={question}
                    onClick={() => {
                      setInput(question)
                    }}
                    className="text-left text-sm p-3 rounded-lg border border-border hover:bg-secondary/50 transition-colors"
                  >
                    {question}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          messages.map((message) => {
            const text = getUIMessageText(message)
            const isUser = message.role === 'user'
            
            return (
              <div
                key={message.id}
                className={cn(
                  'flex gap-3',
                  isUser && 'flex-row-reverse'
                )}
              >
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                    isUser ? 'bg-primary' : 'bg-accent'
                  )}
                >
                  {isUser ? (
                    <User className="h-4 w-4 text-primary-foreground" />
                  ) : (
                    <Bot className="h-4 w-4 text-accent-foreground" />
                  )}
                </div>
                <div
                  className={cn(
                    'max-w-[80%] rounded-lg p-3',
                    isUser
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-card border border-border'
                  )}
                >
                  <p className="text-sm whitespace-pre-wrap">{text}</p>
                </div>
              </div>
            )
          })
        )}
        
        {isLoading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center">
              <Bot className="h-4 w-4 text-accent-foreground" />
            </div>
            <div className="bg-card border border-border rounded-lg p-3">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-border p-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              excelData
                ? 'Pregunta sobre tus envíos...'
                : 'Carga un Excel primero...'
            }
            disabled={isLoading}
            className={cn(
              'flex-1 bg-input border border-border rounded-lg px-4 py-2 text-sm',
              'placeholder:text-muted-foreground',
              'focus:outline-none focus:ring-2 focus:ring-ring',
              'disabled:opacity-50'
            )}
          />
          <Button
            type="submit"
            disabled={isLoading || !input.trim()}
            size="icon"
            className="shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  )
}
