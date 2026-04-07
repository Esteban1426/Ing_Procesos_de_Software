/**
 * Validaciones compartidas para formularios públicos y administración.
 */

export const MAX_NOTES_LEN = 500;
export const MAX_DESCRIPTION_LEN = 2000;
export const MAX_PRODUCT_NAME_LEN = 120;

const EMAIL_RE =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

export function isValidEmail(email: string): boolean {
  const t = email.trim();
  if (!t || t.length > 254) return false;
  return EMAIL_RE.test(t);
}

/** Teléfono: al menos 7 dígitos, máximo razonable para internacional */
export function validatePhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 7) return 'Ingresa un teléfono válido (mínimo 7 dígitos)';
  if (digits.length > 15) return 'El teléfono no puede superar 15 dígitos';
  return null;
}

export function validatePersonName(name: string): string | null {
  const t = name.trim();
  if (t.length < 2) return 'El nombre debe tener al menos 2 caracteres';
  if (t.length > 120) return 'El nombre es demasiado largo';
  return null;
}

export function sanitizeNotes(notes: string, max = MAX_NOTES_LEN): string {
  return notes.replace(/\r\n/g, '\n').trim().slice(0, max);
}

export function validateOrderTrackingInput(id: string): string | null {
  const t = id.trim();
  if (!t) return 'Ingresa el ID de seguimiento de tu pedido';
  if (t.length < 4) return 'El ID parece incompleto';
  if (t.length > 80) return 'El ID ingresado no es válido';
  return null;
}

export function validateReservationDate(
  dateStr: string,
  todayIsoDate: string
): string | null {
  if (!dateStr) return 'La fecha es obligatoria';
  if (dateStr < todayIsoDate) return 'La fecha no puede ser anterior a hoy';
  return null;
}

export function validateUrlOptional(url: string): string | null {
  const t = url.trim();
  if (!t) return null;
  try {
    const u = new URL(t);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      return 'La URL de imagen debe comenzar con http:// o https://';
    }
    return null;
  } catch {
    return 'Ingresa una URL de imagen válida';
  }
}

export function validateProductPrice(priceStr: string): string | null {
  const n = Number(priceStr);
  if (!Number.isFinite(n) || n <= 0) return 'El precio debe ser un número mayor que cero';
  if (n > 1_000_000_000) return 'El precio no es válido';
  return null;
}

export function validateProductRating(ratingStr: string): string | null {
  const n = Number(ratingStr);
  if (!Number.isFinite(n)) return 'La calificación debe ser un número';
  if (n < 0 || n > 5) return 'La calificación debe estar entre 0 y 5';
  return null;
}
