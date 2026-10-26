# Kiddo Draw Setup

Kiddo Draw uses the **same Supabase project as the other apps**, and the login you already have. About 2 minutes, once.

## 1. Create its tables

**SQL Editor → New query**, paste all of `christmas/supabase/schema.sql`. Near the bottom (step 5), change `you@example.com` to the email you sign in to FIRE with. Then **Run**. You should see "Success. No rows returned".

That email is the only one that can use Kiddo Draw. Anyone else who signs in sees "No Access".

## 2. Put it online

Push to `main`. GitHub Pages publishes it at `https://vseak.github.io/vsapps/christmas/`. Its home page card shows once you've signed in there on that device, or tap Welcome 5 times.

## 3. Try it

Sign in, open **People**, and add the adults and kids (several at once with commas). Then **Draw** → **Draw Names** → **Save**.
