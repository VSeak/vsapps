# Kiddo Draw

The owner's Christmas draw: each year, every kid is given to one adult to shop for, with the adults' counts differing by at most one. It started as a Python script (private repo `VSeak/christmasrandomizer`, `ChristmasRandomizer.py`). One user: only the owner's login gets in (`xmas_owner`).

## How it's built

- Same shape as FIRE: `index.html` (header and shell), `styles.css`, plain JS in `js/` loaded as classic `<script>` tags that share one global scope; `boot()` runs last. No build step. supabase-js pinned from jsDelivr.
  - `core.js`: `CONFIG`, helpers copied from FIRE (`esc`, `flash`, `ask`, `busy`, `crumbs`, field errors, `markRequired`, `logError`, install banner), `thisYear`, `plural`.
  - `app.js`: `boot`, `loadMe`, `route`, the leave check, sign-in pages (copied from FIRE).
  - `draw.js`: Home (`#/`). This year's card: Draw Names → a draw shown but **not saved** (`pending`; Draw Again, Save <year>, and Keep Saved when one exists), or the saved draw (Copy, Redraw). Past Years fold below (Copy, Delete). `drawPicks` deals the kids out in a random order, each to a random adult with room who didn't have them in the latest saved year before this one; 200 tries, fewest repeats wins (marked ↺ if any can't be avoided). Shuffles use `crypto.getRandomValues`. Copy gives "Christmas 2026" and one line per adult, for a family chat.
  - `people.js`: `#/people`, Adults and Kids. A tick = in this year's draw (`active`); adding takes several names with commas; Edit renames, changes Adult/Kid, or deletes (only someone never in a saved year; Adult/Kid is locked once they are).
- **Same Supabase project as the other apps** (same URL and key). Tables are all `xmas_*`; `supabase/schema.sql` creates them. Every table's rule is `xmas_is_owner()`: the signed-in email is in `xmas_owner` (one row, set in the SQL Editor; the same email as `fire_owner`). Any other login sees "No Access". No sign-up or invite.
- **Names live only in Supabase**, never in the code: the vsapps repo is public (the user chose this). Don't hardcode names, even as examples or seed data.
- `login_in_other_app()` is replaced here to answer for `team_staff`, `fire_owner` and `xmas_owner`. If Top Out's or FIRE's schema is ever re-run, re-run that function from this schema after it.
- Errors go to the shared `app_errors` with `app = 'christmas'` (the schema widens its check).
- The root home page hides its card unless `localStorage` `vsapps.xmasOwner` is set (`loadMe` sets or clears it, Sign Out clears it). On a new device, tapping Welcome 5 times shows it along with FIRE's. Looks only; the tables are what keep it private.

## Data

- `xmas_people(id, name, kind, active, position)`: `kind` adult or kid. `position` is unused (lists sort by name).
- `xmas_picks(year, kid_id, adult_id, saved_at)`: a saved year, one row per kid. People in it can't be deleted (`on delete restrict`; `msgOf` explains). Saving over a year upserts every pick and deletes that year's kids not in the new draw.

## Conventions

- Look: "Pine & Cranberry": snowy cream page, deep pine ink, cranberry accent, gold; candy-cane stripe on the year card. DM Serif Display headings, Karla body. Tokens on `:root` with dark mode. Logo: a gift box (`icon.svg`, inline in the header and on the root home card).
- Works at ~400px wide. Title case for buttons, headings and labels; sentence case for hints and messages.
