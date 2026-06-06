"use client";

import { useMemo, useState } from "react";

type CurrencyInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "defaultValue" | "name" | "type" | "value" | "onChange" | "inputMode"
> & {
  name: string;
  defaultValue?: React.InputHTMLAttributes<HTMLInputElement>["defaultValue"] | null;
};

function normalizeDigits(value: React.InputHTMLAttributes<HTMLInputElement>["defaultValue"] | null | undefined) {
  const source = Array.isArray(value) ? value[0] : value;
  const digits = String(source ?? "").replace(/\D/g, "");
  return digits.replace(/^0+(?=\d)/, "");
}

function formatThousands(value: string) {
  if (!value) {
    return "";
  }

  return value.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function CurrencyInput({
  name,
  defaultValue,
  className,
  disabled,
  required,
  placeholder = "0",
  ...inputProps
}: CurrencyInputProps) {
  const initialValue = useMemo(() => normalizeDigits(defaultValue), [defaultValue]);
  const [rawValue, setRawValue] = useState(initialValue);

  return (
    <>
      <input type="hidden" name={name} value={rawValue} disabled={disabled} />
      <input
        {...inputProps}
        className={className}
        disabled={disabled}
        inputMode="numeric"
        placeholder={placeholder}
        required={required}
        type="text"
        value={formatThousands(rawValue)}
        onChange={(event) => setRawValue(normalizeDigits(event.target.value))}
      />
    </>
  );
}
