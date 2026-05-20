'use client'

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, FileSpreadsheet, AlertCircle } from 'lucide-react'
import { parseExcelFile } from '@/lib/excel-parser'
import type { ParsedExcelData } from '@/lib/types'
import { cn } from '@/lib/utils'

interface ExcelUploaderProps {
  onDataLoaded: (data: ParsedExcelData, fileName: string) => void
  isLoading: boolean
  currentFileName: string | null
}

export function ExcelUploader({ onDataLoaded, isLoading, currentFileName }: ExcelUploaderProps) {
  const [error, setError] = useState<string | null>(null)

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (!file) return

    setError(null)

    try {
      if (file.size === 0) {
        throw new Error('El archivo seleccionado esta vacio. Descarga el Excel nuevamente e intentalo otra vez.')
      }

      const buffer = await file.arrayBuffer()
      const data = parseExcelFile(buffer)
      onDataLoaded(data, file.name)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al procesar el archivo')
    }
  }, [onDataLoaded])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
    maxFiles: 1,
    disabled: isLoading,
  })

  return (
    <div className="space-y-3">
      <div
        {...getRootProps()}
        className={cn(
          'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all',
          'hover:border-primary/50 hover:bg-secondary/30',
          isDragActive && 'border-primary bg-primary/10',
          isLoading && 'opacity-50 cursor-not-allowed',
          error && 'border-destructive'
        )}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-2">
          {currentFileName ? (
            <>
              <FileSpreadsheet className="h-10 w-10 text-accent" />
              <p className="text-sm font-medium">{currentFileName}</p>
              <p className="text-xs text-muted-foreground">
                Arrastra otro archivo para reemplazar
              </p>
            </>
          ) : (
            <>
              <Upload className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm font-medium">
                {isDragActive ? 'Suelta el archivo aquí' : 'Arrastra tu archivo Excel'}
              </p>
              <p className="text-xs text-muted-foreground">
                o haz clic para seleccionar (.xlsx, .xls)
              </p>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  )
}
