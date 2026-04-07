import type { ReactNode } from 'react';

type Props = {
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
};

/** Contenedor de etiqueta + control para formularios (evita componentes inline que rompen el foco). */
export function LabeledField({ label, required, error, children }: Props) {
  return (
    <div>
      <label className="block text-white/60 text-xs mb-1.5">
        {label}
        {required && ' *'}
      </label>
      {children}
      {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
    </div>
  );
}
