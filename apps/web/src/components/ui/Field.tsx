import clsx from 'clsx';
import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react';

function Wrapper({
  label,
  help,
  error,
  counter,
  htmlFor,
  children,
}: {
  label: string;
  help?: ReactNode;
  error?: string;
  counter?: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-semibold">
        {label}
      </label>
      {help ? (
        <p id={`${htmlFor}-help`} className="mt-0.5 text-sm text-ink-muted">
          {help}
        </p>
      ) : null}
      <div className="mt-1.5">{children}</div>
      <div className="mt-1 flex justify-between gap-2 text-xs">
        {error ? (
          <p id={`${htmlFor}-error`} className="font-medium text-red-700">
            {error}
          </p>
        ) : (
          <span />
        )}
        {counter ? <span className="text-ink-muted">{counter}</span> : null}
      </div>
    </div>
  );
}

const CONTROL =
  'w-full rounded-xl border bg-white px-3 py-2.5 text-base placeholder:text-ink-muted/60 focus:border-accent-600';

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  help?: ReactNode;
  error?: string;
  counter?: string;
}

export function TextField({ label, help, error, counter, className, ...rest }: TextFieldProps) {
  const id = useId();
  return (
    <Wrapper label={label} help={help} error={error} counter={counter} htmlFor={id}>
      <input
        id={id}
        aria-describedby={help ? `${id}-help` : undefined}
        aria-invalid={error ? true : undefined}
        aria-errormessage={error ? `${id}-error` : undefined}
        className={clsx(CONTROL, error ? 'border-red-400' : 'border-black/15', className)}
        {...rest}
      />
    </Wrapper>
  );
}

export interface TextAreaFieldProps extends Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  'id'
> {
  label: string;
  help?: ReactNode;
  error?: string;
  counter?: string;
}

export function TextAreaField({
  label,
  help,
  error,
  counter,
  className,
  ...rest
}: TextAreaFieldProps) {
  const id = useId();
  return (
    <Wrapper label={label} help={help} error={error} counter={counter} htmlFor={id}>
      <textarea
        id={id}
        aria-describedby={help ? `${id}-help` : undefined}
        aria-invalid={error ? true : undefined}
        className={clsx(CONTROL, error ? 'border-red-400' : 'border-black/15', className)}
        {...rest}
      />
    </Wrapper>
  );
}

export function Toggle({
  label,
  help,
  checked,
  onChange,
}: {
  label: string;
  help?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-start gap-3">
      <button
        type="button"
        role="switch"
        id={id}
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={clsx(
          'mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors',
          checked ? 'bg-accent-600' : 'bg-black/20',
        )}
      >
        <span
          className={clsx(
            'block size-5 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-5.5' : 'translate-x-0.5',
          )}
        />
      </button>
      <label htmlFor={id} className="text-sm">
        <span className="font-semibold">{label}</span>
        {help ? <span className="block text-ink-muted">{help}</span> : null}
      </label>
    </div>
  );
}
