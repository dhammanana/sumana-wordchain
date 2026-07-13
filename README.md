# WordChain 🧩

A real-time multiplayer word chain game for learning English vocabulary. Built with vanilla JavaScript, Supabase, and Tailwind CSS.

## Features

- **Multiplayer Word Chain** – Connect words by their last/first letters in real-time
- **Solo Practice** – Play against an AI bot opponent
- **Real-time Collaboration** – Powered by Supabase Realtime for live game updates
- **Built-in Dictionary** – Look up definitions without leaving the game
- **PWA Support** – Installable on mobile and desktop, works offline
- **GitHub Pages Ready** – Deploy with one click via GitHub Actions

## How to Play

1. **Create a group** or **join an existing game** with an invite code
2. **The first player** submits any valid English word (e.g., **APPLE**)
3. **The next player** must start their word with the **last letter** of the previous word
4. Example: Apple → **E**lephant → **T**rain
5. **No word can be repeated** in the same game!
6. The longer the word, the higher the score

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla JS (ES Modules + Vite) |
| Styling | Tailwind CSS + Plus Jakarta Sans + Work Sans |
| Backend | Supabase (PostgreSQL + Auth + Realtime) |
| Dictionary | Free Dictionary API + Wiktionary fallback |
| Hosting | GitHub Pages + GitHub Actions |
| PWA | vite-plugin-pwa + Workbox |

## Project Structure

```
wordchain/
├── index.html               # Entry point HTML
├── .github/workflows/       # GitHub Actions deploy workflow
├── public/
│   ├── favicon.svg
│   └── manifest.webmanifest
├── src/
│   ├── main.js              # App entry point
│   ├── style.css            # Tailwind & custom styles
│   ├── router.js            # Hash-based SPA router
│   ├── store.js             # Reactive state store
│   ├── supabase.js          # Supabase client & DB functions
│   ├── components/
│   │   └── DictionaryModal.js
│   ├── utils/
│   │   ├── dictionary.js    # Dictionary API with caching
│   │   └── words.js         # Word validation & scoring
│   └── views/
│       ├── HomeView.js      # Main menu & create/join
│       ├── JoinView.js      # Profile setup & join game
│       ├── LobbyView.js     # Waiting room with members
│       ├── PlayView.js      # Game arena
│       ├── HistoryView.js   # Game history
│       └── ProfileView.js   # User profile & settings
├── supabase/
│   └── schema.sql           # Database schema & RLS policies
├── package.json
├── vite.config.js
├── tailwind.config.js
└── postcss.config.js
```

## Setup Instructions

### 1. Clone & Install

```bash
git clone <your-repo-url>
cd wordchain
pnpm install
```

### 2. Set up Supabase

1. Create a free account at [supabase.com](https://supabase.com)
2. Create a new project
3. Go to **SQL Editor**, paste the contents of `supabase/schema.sql`, and run it
4. Go to **Project Settings → API** and copy your `Project URL` and `anon public key`
5. Edit `src/supabase.js` and replace the values:

```js
const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key';
```

### 3. Run Locally

```bash
pnpm dev
```

Open http://localhost:5173 in your browser.

### 4. Deploy to GitHub Pages

1. Push this repo to GitHub
2. Go to **Settings → Pages** and set source to **GitHub Actions**
3. The included workflow at `.github/workflows/deploy.yml` will build and deploy automatically on every push to `main`
4. Your app will be live at `https://<username>.github.io/wordchain/`

### 5. Set up Supabase Auth (Required)

WordChain uses Supabase **Anonymous Auth**, which must be enabled:

1. Go to **Authentication → Providers** in your Supabase dashboard
2. Find **Anonymous** and click the edit icon ✏️
3. Enable **Allow anonymous sign-ins**
4. Click **Save**

Without this step, users won't be able to sign in and the app won't work.

## Development

```bash
# Start dev server
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm preview
```

## License

MIT
