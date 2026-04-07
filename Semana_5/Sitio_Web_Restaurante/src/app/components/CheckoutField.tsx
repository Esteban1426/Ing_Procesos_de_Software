import type { ChangeEvent } from 'react';

type Props = {
  label: string;
  name: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  min?: string;
};

/** Componente de campo estable (no definir inline dentro de la página para no perder el foco al escribir). */
export function CheckoutField({
  label,
  name,
  value,
  onChange,
  error,
  type = 'text',
  placeholder,
  required,
  min,
}: Props) {
  return (
    <div>
      <label htmlFor={name} className="block text-white/60 text-xs mb-1.5">
        {label}
        {required && ' *'}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        min={min}
        autoComplete={type === 'email' ? 'email' : type === 'tel' ? 'tel' : undefined}
        className={`w-full bg-[#1A1A1A] border rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 focus:outline-none transition-colors ${
          error ? 'border-red-500/50' : 'border-white/10 focus:border-[#C9A84C]/50'
        }`}
      />
      {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
    </div>
  );
}
