# FIRE

The owner's household money tracker: salary history for them and their partner, investment accounts updated by hand, and how that compares with retiring at a normal age, a FIRE age and the S&P 500. One user: only the owner's login gets in (`fire_owner`). The partner is a person in the data, not a user. All money is pre-tax for now (the user chose this; no Roth vs pre-tax split yet).

## How it's built

- Same shape as Top Out: `index.html` (header and shell), `styles.css`, plain JS in `js/` loaded as classic `<script>` tags that share one global scope, in the order listed in `index.html`; `boot()` runs last. Don't declare the same top-level name in two files. No build step. supabase-js pinned from jsDelivr.
  - `core.js`: `CONFIG`, helpers copied from Top Out (`esc`, `flash`, `ask`, `busy`, `crumbs`, field errors, `markRequired`, `logError`, dates, install banner), money (`money`, `moneyShort`, `pct`, `num`), `sparkline`.
  - `app.js`: `boot`, `loadMe`, `route`, the leave check and Unsaved marks, sign-in pages, Home (`homePage`).
  - `accounts.js`: `#/accounts` (grouped by owner, then Closed) and `#/account/<id>` (balance chart, totals, updates).
  - `salary.js`: `#/salary` (Household: each year's pay for both, total, You Saved and Savings Rate; then a card per person: Pay Rate Now, Raises a Year, After Inflation, Lifetime Pay, jobs, By Year) and `#/job/<id>` (Pay Changes, Bonuses, By Year with W-2 totals). The math is plain functions: `payPeriods`, `rateOn`, `jobYear`, `personYears`, `rateGrowth`, `savedByYear`; dates are day numbers (`dnum`, UTC) so there are no time-zone surprises.
  - `settings.js`: `#/settings`: People (names, birth dates) and Assumptions (with Reset to Defaults).
- **Same Supabase project as Sit Start and Top Out** (same URL and key). Tables are all `fire_*`; `supabase/schema.sql` creates them. Every table's rule is `fire_is_owner()`: the signed-in email is in `fire_owner` (one row, set in the SQL Editor). Any other login signs in and sees "No Access". There is no sign-up and no invite: the owner uses the login they already have for the other apps.
- `login_in_other_app()` is replaced here to also answer for `fire_owner`, so Sit Start never deletes that login. If Top Out's schema is ever re-run, re-run that function from this schema too (it must check both `team_staff` and `fire_owner`).
- Errors go to the shared `app_errors` with `app = 'fire'` (the schema widens its check).

## Data

- `fire_people(id, name, birth_date, position)`: the two people (seeded as You and Partner; renamed in Settings). Birth dates turn dates into ages.
- `fire_settings`: one row of assumptions. A null column means the default in `DEFAULTS` (settings.js), so the defaults live in one place and Reset to Defaults sets every column to null (the user asked for a reset). Expected return is **after inflation** (real, default 7%), inflation 3%, withdrawal rate 4%, normal retirement age 65, salary history starts at age 22.
- `fire_accounts(owner_id, name, kind, institution, job_id, closed_on, notes, position)`: owner null = Joint. `kind` is a key of `KINDS` (accounts.js). `job_id` links an employer plan to its job (From Job in the account dialog). Closed accounts keep their history and list under Closed.
- `fire_updates(account_id, as_of, balance, contributed, employer, moved)`: an update any time (the user asked; not just yearly). `contributed` = what you put in since the last update, `employer` = match/profit sharing since the last update, `moved` = money moved in from another of your accounts (a rollover; minus for out), which is not new savings. Growth = balance − everything put in − moved. One update per account per day.
- `fire_jobs(person_id, employer, title, start_date, end_date)`: a person can have several jobs at once (the user has two). Add Job also takes the starting pay.
- `fire_pay(job_id, start_date, kind, amount, hours_per_week)`: pay changes (the user gets raises mid-year). `kind` salary (amount per year), hourly (amount per hour × hours per week × 52) or none (a gap). Each rate lasts until the job's next pay change or its end date. A year's estimate is each rate prorated by days, plus bonuses; the current year is estimated to Dec 31.
- `fire_bonuses(job_id, paid_on, amount, percent)`: dollars, or a percent of the job's yearly rate on that date.
- `fire_job_actuals(job_id, year, amount)`: the W-2 total for that job and year (the hint points to box 5, since box 1 leaves out pre-tax 401(k) money). It replaces the estimate, bonuses included; years without one show Est. (the user's second job is ~6 hrs/week but sporadic).
- Salary numbers: Pay Rate = every job's yearly rate on Dec 31 (today for this year), no bonuses. Raises a Year = growth of that rate from the first year with one to now; After Inflation uses the Inflation setting (no CPI data yet). Today's $ = earned × (1 + inflation) ^ years ago. Years run from the start age (or the first job) to now, gaps shown. You Saved = `contributed` only (not employer or moved), each update's money spread evenly over the days since the update before.
- Planned (table in the schema, screen not built yet): `fire_spending(year, amount)`: one number per year (the user agreed). The FI number = spending ÷ withdrawal rate.
- Still to build: Spending, Overview (FI number, % there, projected FIRE age with an extra-savings slider, salary-multiple milestones 1× at 30, 3× at 40, 6× at 50, 8× at 60, 10× at 67), Vs. S&P ("if every dollar had gone into the S&P on the same dates": a static monthly S&P 500 total-return file, contributions spread evenly over each update's months; says where the file ends; updated by hand).

## Conventions

- Look: "Ink & Ember": warm paper page, deep ink, ember-orange accent; Outfit headings, IBM Plex Sans body, tabular numbers for money. Tokens on `:root` with dark mode. Logo: a flame (`icon.svg`, inline in the header and on the root home card).
- Works at ~400px wide. Title case for buttons, headings and labels; sentence case for hints and messages.
- Dialogs use `ask()` like Top Out. Save buttons (`.primary`) grey until a field changes.
- Projections are labeled as assumptions, not advice.
