# Priority

A personal "life balance" tracker. You log time and energy across life areas (gym, studies, work, social…), each with a weekly minimum (its "floor"). The app flags areas you're neglecting and areas that take up too much of your week.

Stack: Expo SDK 57, Expo Router, NativeWind v4, and Supabase (auth + Postgres).

## 1. Create the Supabase project

1. Go to <https://supabase.com/dashboard> and create a new project.
2. Open **Project Settings → API** and copy two values:
   - the **Project URL**
   - the **anon** public key (if the project shows a **publishable** key instead, use that one)

## 2. Run the migration

The schema, indexes and RLS policies are in [`supabase/migrations/`](supabase/migrations/). Run the files in order:

1. `20261012000000_init.sql`: tables and RLS
2. `20261013000000_area_ceiling.sql`: optional weekly ceiling per area
3. `20261014000000_reminders.sql`: reminders for the Plan tab

**Option A: SQL Editor (simplest)**
Open **SQL Editor → New query**, paste each file's contents in order and click **Run**.

**Option B: Supabase CLI** (applies every pending migration)

```bash
npx supabase login
```

```bash
npx supabase link --project-ref <your-project-ref>
```

```bash
npx supabase db push
```

Afterwards, **Table Editor** should list `areas` and `logs`, both marked "RLS enabled".

## 3. Enable email OTP (6-digit code)

The app signs you in with a code typed into the app, not a magic link.

1. **Authentication → Sign In / Providers → Email**: make sure the Email provider is enabled. If there's an **Email OTP Length** setting, set it to `6`.
2. **Authentication → Emails → Templates**: edit both the **Magic Link** and the **Confirm signup** templates so they contain the code. For example:

   ```html
   <h2>Your Priority sign-in code</h2>
   <p>Enter this code in the app: <strong>{{ .Token }}</strong></p>
   ```

   You can remove the `{{ .ConfirmationURL }}` link, since the app doesn't use it.
3. The built-in email sender has a low hourly rate limit, which is fine for personal use. If you hit it, set up custom SMTP under **Authentication → Emails → SMTP Settings**.

## 4. Set environment variables

Copy the example file and fill in the values from step 1:

```bash
cp .env.example .env
```

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-or-publishable-key
```

`.env` is git-ignored. Restart `npx expo start` after changing it.

## 5. Run on your phone with Expo Go

1. Install **Expo Go** from the App Store or Play Store.
2. Install dependencies and start the dev server:

   ```bash
   npm install
   ```

   ```bash
   npx expo start
   ```

3. Scan the QR code. On Android, use Expo Go's scanner. On iOS, use the Camera app.

Your phone and computer must be on the same Wi-Fi network. If that doesn't work (for example on a corporate or university network), use a tunnel instead:

```bash
npx expo start --tunnel
```

If the app shows a red screen about missing Supabase variables, check `.env` and restart with a cleared cache:

```bash
npx expo start -c
```

## Reminders & alerts

The **Plan** tab holds upcoming things like "Driving lesson tomorrow 10:00". Each reminder can have an area, planned minutes and an alert (at the time, 15 min, 1 h or 1 day before).

- **Permission:** the phone asks for notification permission the first time you save a reminder with an alert. If you deny it, reminders are still saved, but no alerts fire. You can turn notifications on later in your phone's settings.
- **Expo Go:** during development, the permission belongs to the Expo Go app, and alerts show Expo's icon.
- **How alerts are scheduled:** they're local notifications. The phone schedules them itself, with no server or push service. They're rebuilt from your reminder list when the app starts and whenever the Plan tab opens. Signing out clears them.
- **Done:** marking a reminder Done when it has an area opens the log sheet with its planned minutes pre-filled, so the time counts toward that area's floor.

## Development

```bash
npm test
```

```bash
npx tsc --noEmit
```

```bash
npx expo lint
```

## Project layout

```
src/
  app/                 Expo Router routes
    _layout.tsx        session gate: sign-in vs tabs
    sign-in.tsx        email → 6-digit code
    (tabs)/            Log (index), Plan, Week, Areas
  components/          LogSheet, ReminderSheet, AreaForm, TimeDonut, ProgressBar, AlertCard, Button
  lib/
    supabase.ts        client (AsyncStorage session, AppState auto-refresh)
    auth.ts, db.ts     the only modules that call Supabase
    stats.ts           pure week stats + alert logic (unit-tested)
    reminders.ts       pure reminder grouping + alert schedule (unit-tested)
    notifications.ts   the only module that touches expo-notifications
    session.tsx        session context
  types/db.ts          table types
supabase/migrations/   SQL schema + RLS
__tests__/             Jest (jest-expo)
```

## How the numbers work

- **Week:** Monday 00:00 to the next Monday 00:00, in Europe/Athens time (DST handled).
- **Floor progress:** for a "sessions" area, each log counts as one session. For a "minutes" area, durations are summed.
- **Neglect alert:** no logs in the last 5 × 24 h. Areas created less than 5 days ago are skipped.
- **Ceiling alert:** an area with a weekly ceiling (e.g. Work ≤ 45h) goes over it.
- **Dominance alert:** an area *without* a ceiling has more than 50% of this week's logged minutes. The ceiling replaces this rule, so a normal work week doesn't alert every week.
- **Logging in 3 taps:** area → duration → Save. Energy is pre-filled with the last value you used (3 the first time). "When" defaults to Today; Yesterday and 2 days ago keep the current time of day.
- **Fixing logs:** Undo appears for 5 seconds after saving. Tap any entry under "Recent logs" to edit its duration, energy or note, or to delete it.
