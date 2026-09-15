"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { StarRating, StarRatingInput } from "@/components/star-rating";
import { addComment } from "@/lib/activity-actions";
import { formatDate } from "@/lib/format";
import type { Comment } from "@/lib/comments";
import { initials } from "@/lib/types";

/** Comments on an activity, plus the box to add one. */
export function CommentThread({
  activityId,
  comments,
  signedIn,
}: {
  activityId: number;
  comments: Comment[];
  signedIn: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  // El puntaje vive acá y no en el DOM porque `form.reset()` devuelve los
  // radios a su estado inicial pero no le avisa a las estrellas.
  const [rating, setRating] = useState(0);
  const [state, formAction] = useActionState(
    async (prev: { ok: boolean; error: string | null }, formData: FormData) => {
      const result = await addComment(prev, formData);
      if (result.ok) {
        formRef.current?.reset();
        setRating(0);
      }
      return result;
    },
    { ok: true, error: null },
  );

  return (
    <div className="grid gap-3.5">
      <span className="eyebrow">
        Comentarios{comments.length > 0 ? ` (${comments.length})` : ""}
      </span>

      {signedIn ? (
        <form ref={formRef} action={formAction} className="grid gap-2.5">
          <input type="hidden" name="activityId" value={activityId} />
          <label htmlFor="comment-body" className="sr-only">
            Escribe un comentario
          </label>
          <textarea
            id="comment-body"
            name="body"
            rows={3}
            required
            minLength={3}
            placeholder="¿Cómo te resultó en la sala?"
            className="field resize-y"
          />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
            <StarRatingInput name="rating" label="Puntaje" value={rating} onChange={setRating} />
            <SubmitComment />
            <span aria-live="polite" className="text-sm text-coral-ink">
              {state.error}
            </span>
          </div>
        </form>
      ) : (
        <p className="text-sm text-muted">
          <Link href={`/entrar?next=/actividades/detalle/${activityId}`}>Entra</Link> para
          comentar esta actividad.
        </p>
      )}

      {comments.length === 0 && (
        <p className="py-2 text-sm text-muted">Todavía no hay comentarios.</p>
      )}

      {comments.map((comment) => (
        <article key={comment.id} className="grid gap-1.5 border-t border-line py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="flex size-[26px] items-center justify-center rounded-full bg-lav text-[11px] font-semibold text-indigo">
              {initials(comment.author?.name ?? "?")}
            </span>
            <span className="text-sm font-semibold text-ink">
              {comment.author?.name ?? "Profesor/a"}
            </span>
            <span className="text-xs text-muted">{formatDate(comment.createdAt)}</span>
            {comment.rating !== null && <StarRating value={comment.rating} />}
          </div>
          <p className="text-[15px] leading-[1.6] whitespace-pre-line text-pretty text-body">
            {comment.body}
          </p>
        </article>
      ))}
    </div>
  );
}

function SubmitComment() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-sm border-none bg-indigo px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-ink disabled:opacity-60"
    >
      {pending ? "Publicando…" : "Comentar"}
    </button>
  );
}
