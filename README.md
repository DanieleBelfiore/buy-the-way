# Buy The Way

[![CI](https://github.com/DanieleBelfiore/buy-the-way/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/DanieleBelfiore/buy-the-way/actions/workflows/ci.yml)
[![Deploy](https://github.com/DanieleBelfiore/buy-the-way/actions/workflows/deploy.yml/badge.svg?branch=main)](https://github.com/DanieleBelfiore/buy-the-way/actions/workflows/deploy.yml)

Mobile-first PWA for real-time shared shopping lists. Built for couples and flatmates.

Production: _set after first Netlify deploy_ — e.g. `https://buy-the-way.netlify.app`

---

## Overview

Buy The Way lets you create and share grocery lists that update live across devices. Key traits:

- **Real-time sync** via Firestore — edits appear in under one second across collaborators
- **Offline-first** — IndexedDB persistence keeps lists readable and editable without a connection
- **Installable PWA** — add to home screen on iOS and Android; Lighthouse PWA score ≥ 90
- **MostUsedShelf** — surfaces your most-used items (recency-weighted) for one-tap re-adding
- **Google sign-in only** — no email/password, no Apple sign-in

Tech stack: Vue 3 + TypeScript + Pinia + Firebase (Auth + Firestore) + Vite + vite-plugin-pwa.

---

## License

MIT. See [LICENSE](LICENSE).
