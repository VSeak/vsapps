# PT Pal Setup

PT Pal uses the **same Supabase project as the other apps**, and the login you already have. About 2 minutes, once.

## 1. Create its tables and photo bucket

**SQL Editor → New query**, paste all of `pt/supabase/schema.sql`. Near the bottom (step 6), change `you@example.com` to the email you sign in to FIRE with. Then **Run**. You should see "Success. No rows returned".

That email is the only one that can use PT Pal. Anyone else who signs in sees "No Access". Run it after the other apps' schemas: its `login_in_other_app()` covers all of them.

## 2. Put it online

Push to `main`. GitHub Pages publishes it at `https://vseak.github.io/vsapps/pt/`. Its home page card shows once you've signed in there on that device, or tap Welcome 5 times.

## Later changes

If you ran `schema.sql` before these were added, run each once (SQL Editor → New query → paste → Run):

- `pt/supabase/migrations/2026-11-13-window-location.sql`: saves a rounded location for the window's real sunrise and sunset.

## 3. Try it

Sign in, open **Settings**, upload a photo, name your pal, and set the daily goal. Then go to **Feed** and tap a berry after each PT set.
