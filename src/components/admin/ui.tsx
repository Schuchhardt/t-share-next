"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

/**
 * Las piezas que comparten todas las pantallas del panel.
 *
 * El panel es una herramienta interna, no parte del sitio: vive de tablas,
 * campos apretados y botones sin adorno. Aun así usa los mismos tokens de
 * color que el resto (`--color-ink`, `--color-lav`…), para que no parezca otra
 * aplicación pegada con alambre.
 */

export function Label({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="text-[13px] font-bold text-ink">
      {children}
    </label>
  );
}

export function Field({
  name,
  label,
  type = "text",
  defaultValue,
  placeholder,
  required,
  hint,
  autoComplete,
}: {
  name: string;
  label: string;
  type?: string;
  defaultValue?: string | number | null;
  placeholder?: string;
  required?: boolean;
  hint?: string;
  autoComplete?: string;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        autoComplete={autoComplete}
        defaultValue={defaultValue ?? undefined}
        className="rounded-sm border border-lav-border bg-white px-3 py-2 text-[15px]"
      />
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </div>
  );
}

export function TextArea({
  name,
  label,
  defaultValue,
  rows = 4,
  hint,
  placeholder,
}: {
  name: string;
  label: string;
  defaultValue?: string | null;
  rows?: number;
  hint?: string;
  placeholder?: string;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <textarea
        id={name}
        name={name}
        rows={rows}
        placeholder={placeholder}
        defaultValue={defaultValue ?? undefined}
        className="rounded-sm border border-lav-border bg-white px-3 py-2 text-[15px] leading-[1.5]"
      />
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </div>
  );
}

export function Select({
  name,
  label,
  options,
  defaultValue,
  placeholder,
  required,
}: {
  name: string;
  label: string;
  options: { id: number; name: string }[];
  defaultValue?: number | null;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <select
        id={name}
        name={name}
        required={required}
        defaultValue={defaultValue != null ? String(defaultValue) : ""}
        className="rounded-sm border border-lav-border bg-white px-3 py-2 text-[15px]"
      >
        <option value="">{placeholder ?? "—"}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </div>
  );
}

export function Checkbox({
  name,
  label,
  defaultChecked,
  value,
  hint,
}: {
  name: string;
  label: string;
  defaultChecked?: boolean;
  value?: string | number;
  hint?: string;
}) {
  const id = value != null ? `${name}-${value}` : name;
  return (
    <label htmlFor={id} className="flex items-start gap-2 text-sm text-body">
      <input
        id={id}
        name={name}
        type="checkbox"
        value={value}
        defaultChecked={defaultChecked}
        className="mt-[3px] size-4 accent-[var(--color-indigo)]"
      />
      <span>
        {label}
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
    </label>
  );
}

/** Los mensajes que deja una acción: el error en rojo, la confirmación en verde. */
export function Messages({ error, notice }: { error?: string | null; notice?: string | null }) {
  if (!error && !notice) return null;
  return (
    <div aria-live="polite" className="grid gap-2">
      {error && (
        <p className="rounded-sm bg-[#fdecea] px-3 py-2 text-sm text-coral-ink">{error}</p>
      )}
      {notice && (
        <p className="rounded-sm bg-mint px-3 py-2 text-sm text-mint-strong">{notice}</p>
      )}
    </div>
  );
}

type ButtonTone = "primary" | "plain" | "danger";

const TONES: Record<ButtonTone, string> = {
  primary: "bg-indigo text-white hover:bg-ink",
  plain: "border border-lav-border bg-white text-ink hover:bg-lav",
  danger: "border border-[#e2a19c] bg-white text-coral-ink hover:bg-[#fdecea]",
};

/** Un botón de envío que se desactiva mientras la acción corre. */
export function Submit({
  children,
  pendingLabel,
  tone = "primary",
  formAction,
  disabled,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  tone?: ButtonTone;
  formAction?: (formData: FormData) => void | Promise<void>;
  /** Para un botón que todavía no tiene sobre qué actuar. */
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      formAction={formAction}
      disabled={pending || disabled}
      className={`rounded-sm px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${TONES[tone]}`}
    >
      {pending ? (pendingLabel ?? "Guardando…") : children}
    </button>
  );
}

/**
 * Un botón que pregunta antes, en un modal. Para lo que no tiene vuelta atrás.
 *
 * Era un `window.confirm`, que el navegador dibuja arriba del todo, sin formato
 * y sin sitio donde poner lo que la acción se lleva por delante — y en algunos
 * navegadores se puede silenciar para el resto de la sesión, que es la peor
 * forma posible de perder la única pregunta antes de un borrado.
 *
 * El modal es un `<dialog>` nativo: trae la trampa de foco, el fondo y la
 * tecla Escape puestos. El foco entra en "Cancelar" — apretar Enter sin leer
 * no borra nada.
 *
 * Al confirmar no se llama a la acción a mano: se envía el formulario con este
 * botón como emisor (`requestSubmit`), que es lo que hace que React use el
 * `formAction` de este botón y no el del formulario. Es lo que permite que la
 * barra de selección tenga tres botones, cada uno con lo suyo, en un solo
 * formulario.
 */
export function ConfirmSubmit({
  children,
  question,
  detail,
  tone = "danger",
  formAction,
  disabled,
  compact,
}: {
  children: React.ReactNode;
  /** La pregunta, que nombra sobre qué se actúa. */
  question: string;
  /** Lo que hay que saber antes de decir que sí: qué se lleva, si se deshace. */
  detail?: string;
  tone?: ButtonTone;
  formAction?: (formData: FormData) => void | Promise<void>;
  disabled?: boolean;
  /** Del tamaño de una fila de tabla, no de un formulario. */
  compact?: boolean;
}) {
  const { pending } = useFormStatus();
  const trigger = useRef<HTMLButtonElement>(null);
  const [asking, setAsking] = useState(false);

  return (
    <>
      <button
        ref={trigger}
        type="submit"
        formAction={formAction}
        disabled={pending || disabled}
        onClick={(event) => {
          // El envío lo hace el modal, si dicen que sí.
          event.preventDefault();
          setAsking(true);
        }}
        className={`rounded-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
          compact ? "px-2 py-1 text-xs" : "px-4 py-2 text-sm"
        } ${TONES[tone]}`}
      >
        {pending ? "…" : children}
      </button>

      {asking && (
        <ConfirmDialog
          question={question}
          detail={detail}
          confirmLabel={children}
          tone={tone}
          onCancel={() => setAsking(false)}
          onConfirm={() => {
            setAsking(false);
            const button = trigger.current;
            button?.form?.requestSubmit(button);
          }}
        />
      )}
    </>
  );
}

function ConfirmDialog({
  question,
  detail,
  confirmLabel,
  tone,
  onCancel,
  onConfirm,
}: {
  question: string;
  detail?: string;
  confirmLabel: React.ReactNode;
  tone: ButtonTone;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    // `showModal` sobre un diálogo ya abierto tira: en desarrollo React monta
    // el efecto dos veces a propósito.
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      // Escape. Dejar correr el suyo cerraría el elemento por debajo de React;
      // desmontarlo es el mismo resultado y deja una sola salida.
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      onClick={(event) => {
        // El propio elemento es el fondo alrededor del recuadro.
        if (event.target === ref.current) onCancel();
      }}
      className="m-auto w-[min(420px,92vw)] max-w-none rounded-md border border-line bg-white p-0 backdrop:bg-ink/60"
    >
      <div className="grid gap-2 p-5">
        <h2 className="text-[15px] font-bold text-pretty text-ink">{question}</h2>
        {detail && <p className="text-[13px] leading-[1.5] text-pretty text-muted">{detail}</p>}
      </div>
      <div className="flex justify-end gap-2 border-t border-line px-5 py-3">
        <button
          type="button"
          autoFocus
          onClick={onCancel}
          className={`rounded-sm px-4 py-2 text-sm font-semibold transition-colors ${TONES.plain}`}
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className={`rounded-sm px-4 py-2 text-sm font-semibold transition-colors ${TONES[tone]}`}
        >
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}

/** Un bloque con título, que es como se separan las secciones de un formulario. */
export function Panel({
  title,
  description,
  children,
  tone = "normal",
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  tone?: "normal" | "danger";
}) {
  return (
    <section
      className={`rounded-md border p-5 ${
        tone === "danger" ? "border-[#e2a19c] bg-[#fffaf9]" : "border-line bg-white"
      }`}
    >
      <h2 className="text-[15px] font-bold text-ink">{title}</h2>
      {description && <p className="mt-1 mb-4 text-[13px] text-muted">{description}</p>}
      <div className={description ? "" : "mt-4"}>{children}</div>
    </section>
  );
}
