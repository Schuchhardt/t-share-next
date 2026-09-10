import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/**
 * The one Supabase client this app uses.
 *
 * It authenticates with the service role key, so it is server-only and holds
 * full read/write access. There is no Supabase Auth and no row-level security
 * in this project: authorisation lives in the route handlers and server
 * actions, which decide what the signed-in teacher may touch before they call
 * anything here.
 *
 * Table names all carry the `tshare_` prefix — the project is shared with
 * other apps.
 */

let cached: SupabaseClient | null = null;

export function db(): SupabaseClient {
  cached ??= createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "x-application-name": "t-share-next" } },
  });
  return cached;
}

/** Table names, in one place so a rename is a single edit. */
export const T = {
  users: "tshare_users",
  passwordResets: "tshare_password_resets",
  roles: "tshare_roles",
  userRoles: "tshare_user_roles",
  countries: "tshare_countries",
  labels: "tshare_labels",
  schools: "tshare_schools",
  schoolUsers: "tshare_school_users",
  subjects: "tshare_subjects",
  subjectEquivalences: "tshare_subject_equivalences",
  grades: "tshare_grades",
  subjectGrades: "tshare_subject_grades",
  units: "tshare_units",
  skills: "tshare_skills",
  sections: "tshare_sections",
  resourceTypes: "tshare_resource_types",
  suggestedMaterials: "tshare_suggested_materials",
  activities: "tshare_activities",
  activitySubjectGrades: "tshare_activity_subject_grades",
  activityUnits: "tshare_activity_units",
  activitySections: "tshare_activity_sections",
  activitySkills: "tshare_activity_skills",
  activityResources: "tshare_activity_resources",
  activityInstructions: "tshare_activity_instructions",
  activityMaterials: "tshare_activity_materials",
  savedActivities: "tshare_saved_activities",
  activityDownloads: "tshare_activity_downloads",
  activityAuthorizations: "tshare_activity_authorizations",
  comments: "tshare_comments",
  commentReactions: "tshare_comment_reactions",
  follows: "tshare_follows",
  userSubjects: "tshare_user_subjects",
  userGrades: "tshare_user_grades",
  userSkills: "tshare_user_skills",
  userGroups: "tshare_user_groups",
  messages: "tshare_messages",
  notifications: "tshare_notifications",
  events: "tshare_events",
  newsletterSubscribers: "tshare_newsletter_subscribers",
  plans: "tshare_plans",
  planFeatures: "tshare_plan_features",
  planRoles: "tshare_plan_roles",
  payments: "tshare_payments",
  purchaseItems: "tshare_purchase_items",
} as const;

/**
 * Unwraps a PostgREST result, turning its error into a thrown one.
 * Supabase returns `{ data, error }` rather than rejecting, which is easy to
 * ignore by accident.
 */
export function unwrap<T>(result: { data: T | null; error: { message: string } | null }, what: string): T {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
  if (result.data === null) throw new Error(`${what}: no data returned`);
  return result.data;
}
