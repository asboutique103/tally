import { useEffect, useState, type InputHTMLAttributes } from 'react';

interface NumberFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  /** Current numeric value. Pass `undefined` for an optional field with no value yet. */
  value: number | undefined;
  /** Called with the parsed number, or `undefined` while the field is empty / mid-typing (e.g. a lone "-" or ".").  */
  onChange: (value: number | undefined) => void;
}

/**
 * A controlled number input that displays an empty field instead of a literal "0".
 *
 * Why: with a plain `<input type="number" value={0} .../>`, the box always shows the
 * character "0". On many mobile keyboards the existing "0" isn't auto-selected on focus,
 * so the next digit is appended rather than replacing it — typing "1" turns "0" into "01",
 * and a hurried "100" becomes "0100". Showing blank instead of "0" removes the character
 * there is to glue onto, while still letting the user type "0.5" normally (the buffer keeps
 * whatever they've typed until it forms a full valid number).
 */
export function NumberField({ value, onChange, placeholder, ...rest }: NumberFieldProps) {
  const displayValue = (candidate: number | undefined) => (candidate === undefined || candidate === 0 ? '' : String(candidate));
  const [text, setText] = useState(() => displayValue(value));

  // Re-sync from the parent only when the value changed for a reason other than our own
  // last keystroke (e.g. the form was reset, or a different row was opened for editing).
  useEffect(() => {
    const parsed = text === '' || text === '-' ? undefined : Number(text);
    const same = parsed === value || (parsed === undefined && (value === undefined || value === 0));
    if (!same) setText(displayValue(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <input
      type="number"
      placeholder={placeholder ?? '0'}
      {...rest}
      value={text}
      onChange={(event) => {
        const raw = event.target.value;
        setText(raw);
        if (raw === '' || raw === '-' || raw === '.') { onChange(undefined); return; }
        const parsed = Number(raw);
        if (!Number.isNaN(parsed)) onChange(parsed);
      }}
    />
  );
}
