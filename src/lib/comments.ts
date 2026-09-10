import "server-only";
import { T, db, unwrap } from "@/lib/supabase";
import { fileUrl } from "@/lib/storage";

/**
 * Comments on an activity, with their author.
 *
 * Only published rows are returned: `is_published` carries the legacy `status`
 * column, which moderators used to hide a comment without deleting it.
 */

export type Comment = {
  id: number;
  body: string;
  rating: number | null;
  createdAt: string;
  author: { id: number; name: string; avatarUrl: string | null } | null;
  likeCount: number;
};

type CommentRow = {
  id: number;
  body: string;
  rating: number | null;
  created_at: string;
  author: {
    id: number;
    first_name: string;
    last_name: string | null;
    avatar_key: string | null;
    avatar_url: string | null;
  } | null;
  reactions: { is_like: boolean }[];
};

export async function getComments(activityId: number): Promise<Comment[]> {
  if (!Number.isInteger(activityId) || activityId <= 0) return [];

  const rows = unwrap(
    await db()
      .from(T.comments)
      .select(
        `id, body, rating, created_at,
         author:${T.users} ( id, first_name, last_name, avatar_key, avatar_url ),
         reactions:${T.commentReactions} ( is_like )`,
      )
      .eq("activity_id", activityId)
      .eq("is_published", true)
      .order("created_at", { ascending: false })
      .limit(50),
    "comments",
  ) as unknown as CommentRow[];

  return Promise.all(
    rows.map(async (row) => ({
      id: row.id,
      body: row.body,
      rating: row.rating,
      createdAt: row.created_at,
      author: row.author
        ? {
            id: row.author.id,
            name:
              [row.author.first_name, row.author.last_name].filter(Boolean).join(" ").trim() ||
              "Profesor/a",
            avatarUrl: await fileUrl({ key: row.author.avatar_key, url: row.author.avatar_url }),
          }
        : null,
      likeCount: row.reactions.filter((r) => r.is_like).length,
    })),
  );
}
