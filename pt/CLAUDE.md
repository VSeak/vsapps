# PT Pal

The owner's PT motivator: after each physical therapy set, tap a berry to feed their pal. Red **Sweetberry** = daily PT (counts toward the flame and a daily goal), gold **Cragberry** = climb day PT (names the user picked; the code and database still say `daily` and `climb`) (the owner has no set climbing days, so they pick which berry to throw). One user: only the owner's login gets in (`pt_owner`).

## How it's built

- Same shape as Kiddo Draw: `index.html` (header and shell), `styles.css`, plain JS in `js/` loaded as classic `<script>` tags that share one global scope; `boot()` runs last. No build step. supabase-js pinned from jsDelivr.
  - `core.js`, `app.js`: copied from Kiddo Draw (helpers, sign-in pages, `loadMe`, `route`, install banner). Routes: `#/` Feed, `#/history`, `#/settings`.
  - `pal.js`: `loadSettings`, `photoUrl` (downloads the private photo, kept as an object URL until `photo_at` changes), `loadFeeds` (all rows, 1000 at a time), day, streak, and flame math (`byDay`, `streakOf`, `bestStreak`, `flameOf`, in the phone's time zone), and the drawings (`berrySvg`, `flameSvg`, `foxSvg`).
  - `feed.js`: the Feed page. Daily berry bottom left, climb berry bottom right (the user asked). A tap saves a row right away (id made on the phone so Undo works at once), then `toss` throws the berry from its button into the pal: across linearly, up and over in an arc, and shrinking the whole way (the user asked: "starts close and large-ish… smaller and smaller until it disappears"). Three nested elements so each motion has its own easing (Web Animations API). Then `celebrate`: the pal bounces and six shake marks pop out around it and jiggle (the user asked for excitement). Undo bar for 5 seconds under the header. The line under the name: "would love a berry", "would love N more berries", "is full and happy" (goal met), "is stuffed!" (passed).
    Effects (the user asked), one half-second timer (`startFx`) that only runs on Feed with the app on screen: **goal passed** → the passing berry sets off a burst of sparkles, then one twinkles around the pal every ~1.5 s for the rest of the day (behind everything, stops at midnight); **a week at full flame** → the flame sways and sparks float up off it (`ember`). Reduced motion skips the throw, bounce, marks, sparkles, and sparks.
  - `history.js`: stats (current and best streak, full days, Sweetberry and Cragberry counts this month), a month calendar (filled = goal met, gold sparkle = passed, dots = Sweetberries, gold berry = Cragberry), a day dialog to delete a berry or add a forgotten one (noon that day, or now for today), and a month and year picker from the month name (the user asked; future months off, a dot on months with berries).
  - `settings.js`: the photo (upload, replace, remove), the pal's name, and the daily goal.
- **The flame** (the user designed it; no number beside it): 7 steps. 0 grey ember (start, and the floor: never gone), 1 the yellow core lights, 2 the red lights, 3–7 bigger each step. Each finished day: goal met → up one; some berries (Sweetberries below the goal, or only Cragberries) → holds; none → down one. Passing the goal still only goes up one. Today counts only once its goal is met. Worked out from every row since the first berry, with today's goal, so changing the goal changes the past too (the user was told; saving each day's goal would need SQL).
- **Streak** (History stats only): days in a row with at least one Sweetberry; today without one yet doesn't break it. Cragberries never count against anything.
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
