# PT Pal

The owner's PT motivator: after each physical therapy set, tap a berry to feed their pal. Red berry = daily PT (counts toward a streak and a daily goal), gold berry = PT done on a climbing day (the owner has no set climbing days, so they pick which berry to throw). One user: only the owner's login gets in (`pt_owner`).

## How it's built

- Same shape as Kiddo Draw: `index.html` (header and shell), `styles.css`, plain JS in `js/` loaded as classic `<script>` tags that share one global scope; `boot()` runs last. No build step. supabase-js pinned from jsDelivr.
  - `core.js`, `app.js`: copied from Kiddo Draw (helpers, sign-in pages, `loadMe`, `route`, install banner). Routes: `#/` Feed, `#/history`, `#/settings`.
  - `pal.js`: `loadSettings`, `photoUrl` (downloads the private photo, kept as an object URL until `photo_at` changes), `loadFeeds` (all rows, 1000 at a time), day and streak math (`byDay`, `streakOf`, `bestStreak`, in the phone's time zone), and the drawings (`berrySvg`, `flameSvg`, `foxSvg`).
  - `feed.js`: the Feed page. Daily berry bottom left, climb berry bottom right (the user asked). A tap saves a row right away (id made on the phone so Undo works at once), then `toss` throws the berry from its button into the pal: across linearly, up and over in an arc, and shrinking the whole way (the user asked: "starts close and large-ish… smaller and smaller until it disappears"). Three nested elements so each motion has its own easing (Web Animations API). Then `celebrate`: the pal bounces and six shake marks pop out around it and jiggle (the user asked for excitement). Undo bar for 5 seconds under the header. Reduced motion skips the throw, bounce, and marks.
  - `history.js`: stats (current and best streak, full days, daily and climb counts this month), a month calendar (filled = goal met, dots = daily berries, gold berry = climb PT), and a day dialog to delete a berry or add a forgotten one (noon that day, or now for today).
  - `settings.js`: the photo (upload, replace, remove), the pal's name, and the daily goal.
- **Streak:** days in a row with at least one daily berry; today without one yet doesn't break it. The flame grows every 3 days (5 sizes) and is a grey ember at 0, never gone. Climb berries never count against the streak or goal.
- **One photo at a time** (the user asked): it's always saved as `pal` in the private `pt-photo` bucket with `upsert`, so a new upload overwrites the old file. The phone shrinks it to about 600px (WebP, or PNG where WebP can't be made) first. No photo = the fox kit drawing. The user wanted their pal to look like a Pokémon; Claude doesn't draw that, so the app has a photo slot instead and the drawing is original.
- **Same Supabase project as the other apps.** Tables are all `pt_*`; `supabase/schema.sql` creates them and the bucket. Every rule is `pt_is_owner()`: the signed-in email is in `pt_owner` (one row, set in the SQL Editor; the same email as `fire_owner`). Any other login sees "No Access".
- `login_in_other_app()` is replaced here to answer for `team_staff`, `fire_owner`, `xmas_owner`, and `pt_owner`, so this schema's version must be the last one run. If another app's schema is ever re-run, re-run that function from this schema after it.
- Errors go to the shared `app_errors` with `app = 'pt'` (the schema widens its check).
- The root home page hides its card unless `localStorage` `vsapps.ptOwner` is set (`loadMe` sets or clears it, Sign Out clears it); tapping Welcome 5 times shows it.
- The photo is in Supabase Storage, not Postgres, so the nightly database backup doesn't hold it. The berries and settings are backed up.

## Data

- `pt_settings(id, name, daily_goal, photo_at)`: one row. `daily_goal` 1–10. `photo_at` null = no photo.
- `pt_feeds(id, kind, fed_at)`: one row per berry, `kind` daily or climb.
- Storage bucket `pt-photo` (private, 2 MB, PNG/JPG/WebP): one file, `pal`. Policies on `storage.objects` let only the owner read, add, change, or delete it, and only under that name.

## Conventions

- Look: "Berry & Ember": peach-cream page, deep plum ink, berry red accent, gold, and leaf green. Fredoka headings, Nunito body. Tokens on `:root` with dark mode. Logo: a red berry (`icon.svg`; PNG icons drawn with headless Edge, 180px shrunk with System.Drawing).
- Works at ~400px wide. Title case for buttons, headings, and labels; sentence case for hints and messages.
