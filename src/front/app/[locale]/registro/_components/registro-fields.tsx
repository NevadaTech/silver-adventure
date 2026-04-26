'use client'

import { useId, type ReactNode } from 'react'

type FieldProps = {
  label: string
  hint?: string
  error?: string
  required?: boolean
  htmlFor?: string
  children: (id: string, hasError: boolean) => ReactNode
}

export function Field({
  label,
  hint,
  error,
  required,
  htmlFor,
  children,
}: FieldProps) {
  const generatedId = useId()
  const id = htmlFor ?? generatedId
  const hasError = Boolean(error)

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="text-text flex items-baseline justify-between gap-2 text-sm font-semibold"
      >
        <span>
          {label}
          {required ? <span className="text-error ml-1">*</span> : null}
        </span>
        {hint ? (
          <span className="text-text-muted text-xs font-normal">{hint}</span>
        ) : null}
      </label>
      {children(id, hasError)}
      {error ? (
        <p className="text-error text-xs font-medium" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}

const baseInputClass =
  'border-2 bg-surface text-text placeholder:text-text-muted w-full rounded-xl px-4 py-3 text-base outline-none transition-colors focus:border-secondary'

const errorRing = 'border-error'
const okRing = 'border-border-soft'

type TextInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  hasError?: boolean
}

export function TextInput({ hasError, className, ...props }: TextInputProps) {
  return (
    <input
      {...props}
      className={`${baseInputClass} ${hasError ? errorRing : okRing} ${className ?? ''}`}
    />
  )
}

type TextAreaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  hasError?: boolean
}

export function TextArea({ hasError, className, ...props }: TextAreaProps) {
  return (
    <textarea
      {...props}
      className={`${baseInputClass} min-h-[100px] resize-none ${hasError ? errorRing : okRing} ${className ?? ''}`}
    />
  )
}

type Option = { value: string; label: string }

type SelectInputProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  options: readonly Option[]
  placeholder?: string
  hasError?: boolean
}

export function SelectInput({
  options,
  placeholder,
  hasError,
  className,
  value,
  ...props
}: SelectInputProps) {
  return (
    <select
      {...props}
      value={value ?? ''}
      className={`${baseInputClass} appearance-none bg-[right_1rem_center] bg-no-repeat pr-10 ${hasError ? errorRing : okRing} ${className ?? ''}`}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='%23747780' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>\")",
      }}
    >
      {placeholder ? (
        <option value="" disabled>
          {placeholder}
        </option>
      ) : null}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}

type WhatsappInputProps = Omit<TextInputProps, 'type'> & {
  prefix?: string
}

export function WhatsappInput({
  prefix = '+57',
  hasError,
  className,
  ...props
}: WhatsappInputProps) {
  return (
    <div
      className={`bg-surface focus-within:border-secondary flex w-full items-stretch overflow-hidden rounded-xl border-2 transition-colors ${hasError ? errorRing : okRing}`}
    >
      <span className="bg-bg-tertiary text-text-secondary flex items-center px-4 text-sm font-semibold">
        {prefix}
      </span>
      <input
        {...props}
        type="tel"
        inputMode="tel"
        className={`text-text placeholder:text-text-muted flex-1 bg-transparent px-4 py-3 text-base outline-none ${className ?? ''}`}
      />
    </div>
  )
}

export type ChoiceOption<T extends string = string> = {
  value: T
  label: string
  description?: string
}

type ChoiceCardsProps<T extends string> = {
  name: string
  options: readonly ChoiceOption<T>[]
  value: T | undefined
  onChange: (value: T) => void
  hasError?: boolean
}

export function ChoiceCards<T extends string>({
  name,
  options,
  value,
  onChange,
  hasError,
}: ChoiceCardsProps<T>) {
  return (
    <div
      role="radiogroup"
      className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${hasError ? 'ring-error/40 rounded-xl ring-2' : ''}`}
    >
      {options.map((option) => {
        const isSelected = value === option.value
        return (
          <label
            key={option.value}
            className={`flex cursor-pointer flex-col gap-1 rounded-xl border-2 p-4 transition-all ${
              isSelected
                ? 'border-secondary bg-secondary-soft/30 shadow-sm'
                : 'border-border-soft bg-surface hover:border-secondary/40'
            }`}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={isSelected}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            <span
              className={`font-display text-base font-bold ${
                isSelected ? 'text-secondary-hover' : 'text-text'
              }`}
            >
              {option.label}
            </span>
            {option.description ? (
              <span className="text-text-secondary text-xs leading-relaxed">
                {option.description}
              </span>
            ) : null}
          </label>
        )
      })}
    </div>
  )
}
