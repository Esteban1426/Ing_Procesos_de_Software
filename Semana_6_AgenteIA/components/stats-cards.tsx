'use client'

import { Package, MapPin, Building2, AlertTriangle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import type { ParsedExcelData, AnalysisResult } from '@/lib/types'

interface StatsCardsProps {
  excelData: ParsedExcelData | null
  analysisResult?: AnalysisResult | null
}

export function StatsCards({ excelData, analysisResult }: StatsCardsProps) {
  const stats = [
    {
      label: 'Total Registros',
      value: excelData?.totalRecords ?? 0,
      icon: Package,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      label: 'Bogota',
      value: analysisResult?.summary.bogotaCount ?? '-',
      icon: MapPin,
      color: 'text-accent',
      bgColor: 'bg-accent/10',
    },
    {
      label: 'Otras Ciudades',
      value: analysisResult?.summary.otherCitiesCount ?? '-',
      icon: Building2,
      color: 'text-chart-4',
      bgColor: 'bg-chart-4/10',
    },
    {
      label: 'Problemas',
      value: analysisResult?.summary.problemsCount ?? '-',
      icon: AlertTriangle,
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {stats.map((stat) => (
        <Card key={stat.label} className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
