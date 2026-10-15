# FIRE Setup

FIRE uses the **same Supabase project as Sit Start and Top Out**, and the login you already have. About 5 minutes, once.

## 1. Create FIRE's tables

**SQL Editor → New query**, paste all of `fire/supabase/schema.sql`. Near the bottom (step 5), change `you@example.com` to the email you sign in to Sit Start and Top Out with. Then **Run**. You should see "Success. No rows returned".

That email is the only one that can use FIRE. Anyone else who signs in sees "No Access".

## 2. Put it online

Push to `main`. GitHub Pages publishes it at `https://vseak.github.io/vsapps/fire/`, and the home page has a FIRE card.

## 3. Try it

Sign in with your usual email and password. Then:

1. **Settings**: rename You and Partner, add both birth dates, and check the assumptions.
2. **Accounts**: add each account, then add updates with the balance on a date and what went in since the update before.

## Updates since

Run each of these once in the SQL Editor if your `schema.sql` predates it (a fresh `schema.sql` already has them):

- `fire/supabase/migrations/2026-10-15-contributions.sql`: contributions on accounts, and Paychecks on jobs.

## Good to know

- **Forgot Password** on the sign-in page changes your password for Sit Start and Top Out too, since they share one sign-in.
- **Rollovers**: when an old 401(k) moves to an IRA, put the amount in Moved on both (minus on the old one). It isn't new savings, so it doesn't count as a contribution.
