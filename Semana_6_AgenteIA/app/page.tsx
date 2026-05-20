'use client'

import { useState } from 'react'
import { Truck, Settings, MessageSquare, FileSpreadsheet } from 'lucide-react'
import { ExcelUploader } from '@/components/excel-uploader'
import { ChatInterface } from '@/components/chat-interface'
import { StatsCards } from '@/components/stats-cards'
import { RulesPanel } from '@/components/rules-panel'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { ParsedExcelData } from '@/lib/types'

export default function HomePage() {
  const [excelData, setExcelData] = useState<ParsedExcelData | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [isLoadingExcel, setIsLoadingExcel] = useState(false)
  const [activeTab, setActiveTab] = useState('chat')

  const handleDataLoaded = (data: ParsedExcelData, name: string) => {
    setExcelData(data)
    setFileName(name)
    setIsLoadingExcel(false)
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
              <Truck className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold text-lg">LogiAgent</h1>
              <p className="text-xs text-muted-foreground">Optimizacion de Despachos</p>
            </div>
          </div>
          {fileName && (
            <div className="flex items-center gap-2 bg-secondary/50 px-3 py-1.5 rounded-lg">
              <FileSpreadsheet className="h-4 w-4 text-accent" />
              <span className="text-sm font-medium">{fileName}</span>
              <span className="text-xs text-muted-foreground">
                ({excelData?.totalRecords} registros)
              </span>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        <div className="grid lg:grid-cols-3 gap-6 h-full">
          {/* Left Column - Upload & Stats */}
          <div className="lg:col-span-1 space-y-6">
            {/* Upload Card */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4" />
                  Cargar Excel
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ExcelUploader
                  onDataLoaded={handleDataLoaded}
                  isLoading={isLoadingExcel}
                  currentFileName={fileName}
                />
              </CardContent>
            </Card>

            {/* Stats */}
            <StatsCards excelData={excelData} />

            {/* Mobile Tabs */}
            <div className="lg:hidden">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid grid-cols-2 mb-4">
                  <TabsTrigger value="chat" className="gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Chat
                  </TabsTrigger>
                  <TabsTrigger value="rules" className="gap-2">
                    <Settings className="h-4 w-4" />
                    Reglas
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="chat" className="mt-0">
                  <Card className="bg-card border-border h-[500px]">
                    <ChatInterface excelData={excelData} />
                  </Card>
                </TabsContent>
                <TabsContent value="rules" className="mt-0">
                  <RulesPanel />
                </TabsContent>
              </Tabs>
            </div>
          </div>

          {/* Right Column - Desktop Layout */}
          <div className="lg:col-span-2 hidden lg:grid lg:grid-rows-2 gap-6">
            {/* Chat */}
            <Card className="bg-card border-border row-span-1 flex flex-col min-h-[400px]">
              <CardHeader className="pb-3 flex-shrink-0">
                <CardTitle className="text-sm flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Asistente IA
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 p-0 overflow-hidden">
                <ChatInterface excelData={excelData} />
              </CardContent>
            </Card>

            {/* Rules */}
            <Card className="bg-card border-border row-span-1">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Gestion de Reglas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <RulesPanel />
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center text-xs text-muted-foreground">
          LogiAgent - Sistema de Optimizacion Logistica para Courier
        </div>
      </footer>
    </div>
  )
}
