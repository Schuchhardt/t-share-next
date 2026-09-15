"use client";

import { useId, useState } from "react";

/**
 * El puntaje de una actividad, en estrellas.
 *
 * Un `<select>` con los números del 1 al 5 decía cuánto se podía puntuar pero
 * no qué significaba: nadie lee "3" como "regular" sin la escala al lado, y en
 * la lista de comentarios "3 / 5" obligaba a detenerse a leerlo. Las estrellas
 * traen la escala puesta y se ven de un vistazo.
 *
 * `StarRatingInput` sigue siendo un grupo de radios de verdad — sólo que la
 * marca visible es la estrella. Viaja al servidor como `rating` dentro del
 * mismo FormData, se recorre con las flechas del teclado y cada estrella se
 * anuncia como "3 de 5", así que la lectura en voz alta no depende del color.
 */

const SCORES = [1, 2, 3, 4, 5] as const;

/** Heroicons, `star` sólida. */
function Star({ on, className }: { on: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={`${on ? "text-star" : "text-lav-border"} ${className ?? ""}`}
    >
      <path d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354l-4.625 2.827c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006Z" />
    </svg>
  );
}

/** Un puntaje ya dado: sólo para mirar. */
export function StarRating({ value, className }: { value: number; className?: string }) {
  const filled = Math.round(value);
  return (
    <span
      role="img"
      aria-label={`${value} de 5`}
      className={`inline-flex items-center gap-px align-middle ${className ?? ""}`}
    >
      {SCORES.map((score) => (
        <Star key={score} on={score <= filled} className="size-[15px]" />
      ))}
    </span>
  );
}

/**
 * Las cinco estrellas para calificar.
 *
 * El puntaje es opcional, y un radio no se desmarca solo una vez marcado, así
 * que "Quitar" es la única forma de volver atrás sin recargar la página.
 */
export function StarRatingInput({
  name,
  label,
  value,
  onChange,
}: {
  name: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const labelId = useId();
  // Al pasar el mouse se pintan hasta donde está el cursor, para ver el
  // puntaje antes de comprometerse.
  const [hovered, setHovered] = useState(0);
  const shown = hovered || value;

  return (
    <span className="flex items-center gap-2.5">
      <span id={labelId} className="text-sm text-muted">
        {label}
      </span>

      <span
        role="radiogroup"
        aria-labelledby={labelId}
        className="flex items-center"
        onMouseLeave={() => setHovered(0)}
      >
        {SCORES.map((score) => (
          <label
            key={score}
            className="cursor-pointer px-px py-0.5"
            onMouseEnter={() => setHovered(score)}
          >
            <input
              type="radio"
              name={name}
              value={score}
              checked={value === score}
              onChange={() => onChange(score)}
              className="peer sr-only"
            />
            <Star
              on={score <= shown}
              className="size-[26px] rounded-xs transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-indigo"
            />
            <span className="sr-only">{score} de 5</span>
          </label>
        ))}
      </span>

      {value > 0 && (
        <button
          type="button"
          onClick={() => onChange(0)}
          className="border-none bg-transparent p-0 text-[13px] text-indigo hover:underline"
        >
          Quitar
        </button>
      )}
    </span>
  );
}
