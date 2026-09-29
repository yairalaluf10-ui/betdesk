# BetDesk — לוח לקוחות

אפליקציית ווב לניהול לקוחות בסגנון אתר הימורים, מחוברת ל-Supabase (Postgres, Auth, Storage).
HTML, CSS ו-JavaScript טהורים, בלי build ובלי תלויות מלבד `supabase-js` מ-CDN.

![stack](https://img.shields.io/badge/Supabase-Postgres%20%7C%20Auth%20%7C%20Storage-3ECF8E) ![stack](https://img.shields.io/badge/frontend-HTML%20%2F%20CSS%20%2F%20JS-f5c518)

## תכונות

- **לוח לקוחות** — רשימת לקוחות בסגנון שורות משחקים, סינון לפי ליגה וסוג הימור, חיפוש, מחזור חודשי עם מגמה, כרטיס לקוח.
- **התחברות** — אימייל וסיסמה (Supabase Auth), החלפת סיסמה חובה בכניסה ראשונה למשתמש זמני.
- **פאנל ניהול (admin)** — הוספה, עריכה ומחיקה של לקוחות, ניהול תפקידי משתמשים.
- **אמצעי זיהוי** — העלאת דרכון / תעודת זהות ל-Storage פרטי, צפייה דרך קישור חתום, מחיקה.

## מבנה

```
index.html            מבנה הדף (RTL)
style.css             עיצוב
app.js                חיבור ל-Supabase, לוגיקה, auth, פאנל ניהול, Storage
supabase/
  config.toml         הגדרות Supabase CLI
  migrations/         כל השינויים במסד לפי הסדר
```

## מסד הנתונים

| טבלה | תיאור |
|---|---|
| `customers` | `id`, `name`, `email` (ייחודי), `preferred_league` |
| `preferred_bets` | סוג ההימור המועדף, שורה אחת ללקוח |
| `bet_volumes` | מחזור הימורים חודשי ללקוח (`customer_id`, `month`, `amount`) |
| `customer_documents` | מטא-דאטה של מסמכי זיהוי; הקבצים עצמם ב-bucket `id-documents` |

כל הטבלאות מקושרות ל-`customers` עם `on delete cascade`.

### הרשאות (RLS)

התפקיד נשמר ב-`app_metadata.role` של המשתמש — שדה שרק השרת יכול לשנות.

| תפקיד | קריאת נתונים | כתיבה | מסמכי זיהוי | ניהול משתמשים |
|---|---|---|---|---|
| `admin` | ✅ | ✅ | ✅ | ✅ |
| `staff` | ✅ | ❌ | ❌ | ❌ |
| מחובר בלי תפקיד | ❌ | ❌ | ❌ | ❌ |
| לא מחובר | ❌ | ❌ | ❌ | ❌ |

ניהול המשתמשים עובר דרך שתי פונקציות `security definer` שבודקות שהקורא הוא admin:
`admin_list_users()` ו-`admin_set_user_role(target_user, new_role)`.

## הרצה מקומית

```bash
python -m http.server 8080 --bind 127.0.0.1
```

ואז לפתוח http://127.0.0.1:8080/.

המפתח ב-`app.js` הוא ה-publishable key של Supabase — הוא מיועד להיות גלוי בדפדפן, וכל ההגנה על הנתונים נעשית ב-RLS.

## פריסת המסד

```bash
supabase link --project-ref <project-ref>
supabase db push
```

משתמשים ותפקידים נוצרים דרך הדשבורד או ה-Auth Admin API (עם service role key, **לא** מהדפדפן), למשל:

```json
{ "email": "someone@example.com", "password": "…", "email_confirm": true, "app_metadata": { "role": "staff" } }
```

## הערות

- הנתונים בטבלאות הם **סינטטיים** לצורך הדגמה.
- ב-`config.toml` מוגדר `enable_signup = false`, אבל ההגדרה **לא נדחפה** לפרויקט המרוחק. יש לכבות הרשמה ציבורית ידנית בדשבורד: Authentication → Sign In / Providers.
