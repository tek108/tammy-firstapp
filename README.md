<div dir="rtl">

# 🎮 AI Game Changer — Vibe Coding Template

טמפלייט production-ready לבניית אפליקציות AI-first עם **Next.js 16 + shadcn/ui + Supabase + Vercel AI Gateway**.
נבנה במיוחד לתלמידי הקורס **Game Changer** — עם Claude Code מחובר, skills, MCPs, והכל מוכן ל-Vibe Coding.

---

## ✨ איך מתחילים? שני שלבים. תמיד.

> 🎯 **הדרך הנכונה להתחיל פרויקט חדש היא תמיד שני השלבים האלה — יחד, בסדר הזה, בלי דילוגים.**
> כל מה שמעבר (AI, GitHub, Vercel) זה **תוספות** שמוסיפים אחר כך לפי הצורך.

---

### 🟢 שלב 1 — העתקת הטמפלייט והתקנה (בטרמינל)

> 🔤 **לפני שמריצים** — החליפו את `my-app` בשם הפרויקט שלכם (אותיות קטנות באנגלית, מקפים, בלי רווחים). זה גם יהיה שם התיקייה וגם שם הפרויקט ב-`package.json` — הסקריפט **לא** ישאל על זה שוב.

**🍎 Mac / Linux** — הפקודה תיצור תיקיית `projects` על ה-Desktop (אם לא קיימת), תיכנס אליה, ותשכפל לתוכה:

```bash
APP_NAME=my-app && mkdir -p ~/Desktop/projects && cd ~/Desktop/projects && git clone https://github.com/RanNahmany/game-changer-app-template.git "$APP_NAME" && cd "$APP_NAME" && npm run setup
```

**🪟 Windows — PowerShell** (ברירת המחדל ב-Windows 10/11 — פתחו **Windows PowerShell** או **Terminal**):

```powershell
$app="my-app"; $d="$env:USERPROFILE\Desktop\projects"; New-Item -ItemType Directory -Force -Path $d | Out-Null; Set-Location $d; git clone https://github.com/RanNahmany/game-changer-app-template.git $app; Set-Location $app; npm run setup
```

> 📌 בסיום הסקריפט תחזרו לתיקייה שממנה הרצתם — פשוט פתחו את `Desktop\projects\my-app` ב-Claude Code והמשיכו לשלב 2.

> 💡 הפקודה עובדת מכל מקום בטרמינל — היא תמיד תיצור את התיקייה ב-Desktop ותשכפל לשם.

<details>
<summary><b>מה הסקריפט עושה בשבילך?</b></summary>

- 🧹 מנקה את היסטוריית ה-git של הטמפלייט
- 🆕 מאתחל git repo חדש על שמך
- 📦 מתקין dependencies
- 🔐 יוצר `.env.local` מתוך `.env.example`
- ▲ מתקין את **Vercel plugin** ל-Claude Code
- ✅ יוצר commit ראשון

</details>

---

### 🟣 שלב 2 — הגדרת הפרויקט ב-Claude Code (חובה!)

אחרי שהסקריפט הסתיים, פתחו Claude Code בתוך התיקייה והריצו:

```bash
/start-from-template
```

> ⚠️ **אל תדלגו על השלב הזה.** בלעדיו אין Supabase, אין DB, אין auth — הפרויקט פשוט לא עובד.

הפקודה תעביר אתכם תהליך אינטראקטיבי (בעברית) שמחבר:
1. **Supabase** — עם ה-API keys החדשים (`publishable` + `secret`), לא ה-legacy
2. **Supabase MCP** — נותן ל-Claude Code גישה ישירה ל-DB שלך
3. **דף בית ראשוני** — משהו יפה להתחיל איתו

🎉 **זהו. אתם מוכנים לקוד.** כל מה שמופיע למטה זה תוספות אופציונליות.

---

## ➕ תוספות אופציונליות

אחרי שני השלבים הראשונים — תוכלו להוסיף מה שצריך, מתי שצריך.

### 🤖 הוספת AI לפרויקט

```bash
/setup-vercel-ai
```

מחבר **Vercel AI Gateway** — גישה מאוחדת ל-Claude, GPT, Gemini וכל המודלים, עם **5$ קרדיט חינם כל חודש**.
כולל התקנת `ai` + `@ai-sdk/gateway`, יצירת route צ'אט, ואופציונלית UI צ'אט עם shadcn.

---

### 🚢 דיפלוי לפרודקשן (GitHub → Vercel עם CI/CD)

מסלול deploy מובנה: **כל `git push` ל-`main` = production deploy אוטומטי**.

#### שלב א׳ — GitHub

```bash
/setup-github
```

- יוצר repository ב-GitHub (public / private)
- דוחף את הקוד ומחבר `origin`
- דורש `gh` CLI (`brew install gh` ו-`gh auth login`)

#### שלב ב׳ — Vercel

```bash
/setup-vercel
```

- מחבר את הפרויקט ל-Vercel + GitHub
- מסנכרן environment variables (כולל ה-Supabase keys)
- מעדכן Redirect URLs ב-Supabase לפרודקשן
- מפעיל את הדיפלוי הראשון **דרך `git push`**

> ⚠️ `/setup-github` חייב לרוץ **לפני** `/setup-vercel` — בלי GitHub repo אין CI/CD.

מעכשיו:
- **`git push origin main`** → production deploy
- **`git push origin <branch>`** → preview deploy אוטומטי לכל branch/PR

---

## 📦 מה יש בטמפלייט?

### Stack
- ⚡ **Next.js 16** (App Router + Turbopack)
- 🎨 **Tailwind CSS 4** + **shadcn/ui** + **Base UI**
- 🌙 **next-themes** — dark mode מוכן
- 📊 **Recharts** — גרפים
- 🔔 **Sonner** — toasts
- 📅 **date-fns** + **react-day-picker**
- 🎠 **Embla Carousel**, **Vaul** (drawers), **CMDK** (command palette)

### Claude Code Integration
- 📚 **Skills** מותקנים: `shadcn`, ועוד (ראה `.agents/skills/`)
- 🔌 **MCP-ready** — מוכן ל-Supabase MCP ו-Context7
- ⚙️ **Slash commands** — `/start-from-template` לאתחול, `/setup-vercel-ai` לחיבור AI

### איכות קוד
- 🔍 **TypeScript** strict mode
- 🧹 **ESLint** + **Prettier** + **prettier-plugin-tailwindcss**
- ✨ `npm run format` ו-`npm run typecheck` מוכנים

---

## 🛠️ Scripts זמינים

| Script | מה זה עושה |
|--------|------------|
| `npm run setup` | אתחול ראשוני של הפרויקט (רצים פעם אחת) |
| `npm run dev` | שרת פיתוח עם Turbopack |
| `npm run build` | build לפרודקשן |
| `npm run start` | הרצת הפרודקשן build מקומית |
| `npm run lint` | בדיקת ESLint |
| `npm run format` | עיצוב קוד עם Prettier |
| `npm run typecheck` | בדיקת TypeScript בלי build |

---

## 🔐 Environment Variables

הקובץ `.env.local` נוצר אוטומטית בהרצת `npm run setup`, והערכים נמלאים ב-`/start-from-template`. המשתנים:

```env
# Supabase — מפתחות חדשים (2026), לא ה-legacy anon/service_role!
# Dashboard → Project Settings → API Keys → "Publishable and secret API keys"
NEXT_PUBLIC_SUPABASE_URL=                  # https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=      # sb_publishable_...  (בטוח לדפדפן)
SUPABASE_SECRET_KEY=                       # sb_secret_...       (שרת בלבד!)

# Vercel AI Gateway — 5$ חינם כל חודש
AI_GATEWAY_API_KEY=

NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**⚠️ אל תעלה את `.env.local` ל-git!** (זה כבר ב-`.gitignore`)

### 🤖 MCP (Model Context Protocol)

`/start-from-template` יצור עבורך גם `.mcp.json` שמחבר את **Supabase MCP** — שנותן ל-Claude Code גישה ישירה לטבלאות, migrations ו-schema. הקובץ ב-`.gitignore` כי מכיל Personal Access Token. תבנית בטוחה: [.mcp.example.json](.mcp.example.json).

---

## 📂 מבנה הפרויקט

```bash
.
├── app/                    # Next.js App Router
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── components/             # components שלך
│   └── ui/                 # shadcn components (כל ה-components מותקנים מראש)
├── hooks/                  # React hooks
├── lib/                    # utilities (cn, וכו')
├── public/                 # קבצים סטטיים
├── scripts/
│   └── setup.mjs           # סקריפט האתחול
├── .claude/
│   └── commands/
│       ├── start-from-template.md   # /start-from-template — Supabase + MCP + UI
│       ├── setup-github.md          # /setup-github — יצירת GitHub repo
│       ├── setup-vercel.md          # /setup-vercel — CI/CD deploy דרך GitHub
│       └── setup-vercel-ai.md       # /setup-vercel-ai — Vercel AI Gateway
├── .agents/skills/         # Claude Code skills
├── .env.example            # תבנית ל-environment variables
└── .mcp.example.json       # תבנית ל-MCP (Supabase + Context7)
```

---

## 🆘 בעיות נפוצות

<details>
<summary><b>Node version שגוי</b></summary>

הטמפלייט דורש **Node 20+** (מומלץ 24 LTS). בדוק עם:
```bash
node --version
```
אם צריך, התקן nvm והרץ `nvm install 24`.
</details>

<details>
<summary><b>npm run setup נכשל על git commit</b></summary>

כנראה לא מוגדר לך `user.email` / `user.name` ב-git. הגדר:
```bash
git config --global user.name "השם שלך"
git config --global user.email "email@example.com"
```
ואז הרץ שוב את הסקריפט או סתם הרץ `git commit` ידנית.
</details>

<details>
<summary><b>Claude Code לא מותקן</b></summary>

```bash
npm install -g @anthropic-ai/claude-code
```
ואז `claude` בתיקיית הפרויקט.
</details>

---

## 📚 מקורות

- [Next.js Docs](https://nextjs.org/docs)
- [shadcn/ui](https://ui.shadcn.com)
- [Supabase](https://supabase.com/docs)
- [Vercel AI SDK](https://ai-sdk.dev)
- [Claude Code](https://docs.claude.com/en/docs/claude-code)

---

<div align="center">

**Built with 💜 for Game Changer students**

`Vibe Coding = Happy Coding 🎮`

</div>

</div>
