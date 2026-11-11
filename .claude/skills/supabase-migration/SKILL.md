---
name: supabase-migration
description: Write a Supabase SQL migration for a vsapps app (Sit Start, Top Out, FIRE, Kiddo Draw, or SQL shared by all) the way this repo does it, with a dated migration file, the same change in schema.sql, row-level security and policies, doc updates, and the SQL pasted in the reply. Use this whenever a change needs anything new or different in the database (a table, column, check, index, policy, function, trigger, grant, realtime publication or app_errors change), even when the user only describes a feature ("save timers", "let coaches see X", "add a field for Y") and doesn't say "migration" or "SQL".
---

# Supabase migration (vsapps)

Every vsapps app shares one Supabase project. Nothing runs SQL automatically: the user pastes each migration into Supabase's SQL Editor by hand. So a migration has to be **safe to read, safe to run once on the live project, and matched in `schema.sql`** so a fresh project gets the same result.

## 1. Work out where it goes

| App | Folder | Table names | Access helpers (wrap in `(select …)` in policies) |
|---|---|---|---|
| Sit Start | `sitstart/supabase/` | no prefix (`staff`, `students`, `plans`, …; see the root CLAUDE.md list) | `is_coach()`, `is_admin()`, `my_student_id()`, `my_staff_id()`, `is_self()`, `can_coach(student)` |
| Top Out | `topout/supabase/` | `team_*` | `team_is_staff()`, `team_is_admin()` |
| FIRE | `fire/supabase/` | `fire_*` | `fire_is_owner()` |
| Kiddo Draw | `christmas/supabase/` | `xmas_*` | `xmas_is_owner()` |
| Every app | `supabase-shared/` | no prefix (`app_errors`) | none |

Check that a new table name isn't used by another app: all four share the `public` schema. Before you write a policy, read the app's `CLAUDE.md` Data section and the related part of its `schema.sql`. The access rules there are deliberate and often subtle (for example, Sit Start's "only the student's current coach changes them"), and a new table usually has to follow the rules of the table it hangs off.

## 2. Write the migration file

Path: `<app>/supabase/migrations/YYYY-MM-DD-short-name.sql`, using today's date and a few plain words (`saved-timers`, `put-in-since`). Shared SQL goes in `supabase-shared/YYYY-MM-DD-short-name.sql`.

Start with a comment header in the repo's voice: plain sentences, what changes and why, crediting "the user asked" when they did. Then the run instructions:

```sql
-- Saved Hang Timers (the user asked): anyone signed in keeps their own timers to load again and edit.
-- Run once in Supabase: SQL Editor → New query → paste → Run.
-- (schema.sql already includes this for a fresh project.)
```

Habits that matter here, and why:

- **Every new table:** `alter table … enable row level security;` plus a `grant … to authenticated` for exactly the actions the app needs, plus a policy for each action. RLS is the only thing between the public publishable key and the data, since the page never holds a secret. A table with RLS on and no policies is deliberate in a few places (reached only through `security definer` functions); say so in a comment if you do that.
- **Policies:** use `(select auth.uid())` and `(select public.helper())`, not the bare call. Postgres then runs it once per query instead of once per row (`2026-09-29-faster-rules.sql`). Name policies by who and what: `"own: read"`, `"coach: change"`, `"owner"`.
- **Functions:** `security definer set search_path = ''` with every name schema-qualified (`public.x`, `auth.uid()`). Then `revoke execute … from public, anon;`, and grant to `authenticated` only if the page calls it. An empty search_path stops a caller's own objects from hijacking the function.
- **Limits in the database:** length checks on text (`check (length(trim(name)) between 1 and 40)`), ranges on numbers, unique indexes for "no duplicates ignoring case" (`lower(trim(name))`). The page checks too, but the database is what can't be bypassed. Turn errors the user may hit into a plain sentence with `raise exception 'You can save up to % timers. Delete one to save another.', most;`, because the page shows that text.
- **Changing existing tables:** prefer `add column if not exists` and similar where Postgres supports it, so a second run does no harm. For a check constraint, drop it by name and add the new one. Don't drop columns or tables unless the user asked; if they did, say plainly in the reply that the data goes too.
- **Keep comments short and on the line or block they explain.** Explain *why*, not what the SQL plainly says.
- **Kiddo Draw:** never put people's names in SQL, not even as examples. The repo is public.

`references/table-template.sql` has a complete new-table example (own rows only, with a limit trigger) to adapt.

## 3. Put the same change in `schema.sql`

`schema.sql` is what a brand-new project runs, so it has to end up exactly where the migrations lead. Add the new table, column or function to the matching section, written as if it had always been there (`create table` with the column inside it, not `alter table … add column`). Keep the comments.

## 4. Watch for these

- **A trigger on an `auth.*` table** (like `gate_signup` on `auth.users`): the nightly backup leaves out the `auth` schema, so a restore loses it. Tell the user it also has to go in `post-restore.sql` in the `vsapps-backup` repo, which is cloned next to this one, and offer to add it there.
- **`login_in_other_app()`** is replaced by several schemas, and Kiddo Draw's version must run last. If a migration touches it, keep every app's check and remind the user of the order.
- **`app_errors`**: if a new app or kind needs to log, the table's check constraint needs widening (see `supabase-shared/2026-10-03-app-errors.sql`).
- **Realtime:** a table the page listens to live needs `alter publication supabase_realtime add table …`.
- **Changing the shared auth email templates** isn't SQL. Point to `supabase-emails/build.sh` instead.

## 5. Update the docs

- **The app's `CLAUDE.md`, Data section:** add or update the table's line in the same style (columns, who can read and change what, and the migration's file name). Future sessions rely on this to understand the rules without reading SQL.
- **The app's `SETUP.md`:** add the migration to the list of ones to run if their `schema.sql` predates it, with a short note on what it adds.

## 6. Reply with the SQL itself

The user runs it by hand, so **paste the whole migration in the reply** in a fenced `sql` block with the file path above it. A path alone means opening the file to copy it. Then say in one or two lines:

- what to do: "SQL Editor → New query → paste → Run; you should see 'Success. No rows returned'"
- anything extra: a `post-restore.sql` change, a function to re-run in order, or that the change can't be undone
- that it hasn't been run yet (only the user can run it), and what is committed vs pushed (the user commits locally and pushes only when they ask)
