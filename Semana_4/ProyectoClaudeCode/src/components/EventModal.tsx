import { useCallback, useEffect, useState } from 'react'
import { useEvents } from '../context/EventsContext'
import type { CalendarEvent } from '../types'
import styles from './EventModal.module.css'

interface EventModalProps {
  open: boolean
  event: CalendarEvent | null
  onClose: () => void
  onSaved: () => void
}

export function EventModal({ open, event, onClose, onSaved }: EventModalProps) {
  const { addEvent, updateEvent } = useEvents()
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<'meeting' | 'event'>('event')

  const isEdit = Boolean(event?.id)

  useEffect(() => {
    if (event) {
      setTitle(event.title)
      setDate(event.date)
      setStartTime(event.startTime ?? '')
      setEndTime(event.endTime ?? '')
      setDescription(event.description ?? '')
      setType(event.type === 'meeting' ? 'meeting' : 'event')
    } else {
      setTitle('')
      setDate('')
      setStartTime('')
      setEndTime('')
      setDescription('')
      setType('event')
    }
  }, [event, open])

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      if (!title.trim() || !date) return

      if (isEdit && event) {
        updateEvent(event.id, {
          title: title.trim(),
          date,
          startTime: startTime || undefined,
          endTime: endTime || undefined,
          description: description.trim() || undefined,
          type,
        })
      } else {
        addEvent({
          title: title.trim(),
          date,
          startTime: startTime || undefined,
          endTime: endTime || undefined,
          description: description.trim() || undefined,
          type,
        })
      }
      onSaved()
    },
    [title, date, startTime, endTime, description, type, isEdit, event, addEvent, updateEvent, onSaved]
  )

  if (!open) return null

  return (
    <div className={styles.backdrop} onClick={onClose} role="dialog" aria-modal="true">
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2>{isEdit ? 'Editar evento' : 'Nuevo evento'}</h2>
        <form onSubmit={handleSubmit} className={styles.form}>
          <label>
            Título *
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="Reunión, cumpleaños..."
            />
          </label>
          <label>
            Fecha *
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </label>
          <div className={styles.row}>
            <label>
              Hora inicio
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </label>
            <label>
              Hora fin
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </label>
          </div>
          <label>
            Tipo
            <select value={type} onChange={(e) => setType(e.target.value as 'meeting' | 'event')}>
              <option value="event">Evento</option>
              <option value="meeting">Reunión</option>
            </select>
          </label>
          <label>
            Descripción
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Opcional"
            />
          </label>
          <div className={styles.actions}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className={styles.saveBtn}>
              {isEdit ? 'Guardar' : 'Crear'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
