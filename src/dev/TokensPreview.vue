<script setup lang="ts">
/* eslint-disable no-useless-assignment */
/**
 * Dev-only token preview. Renders one of each component class defined in
 * src/styles/tokens.css.
 */

interface ShelfSample {
  readonly name: string;
  readonly count: number;
  readonly top?: boolean;
  readonly added?: boolean;
}

const shelfSamples: readonly ShelfSample[] = [
  { name: 'Latte', count: 12, top: true },
  { name: 'Pane', count: 9, top: true },
  { name: 'Mele', count: 7 },
  { name: 'Yogurt', count: 6 },
  { name: 'Uova', count: 5 },
  { name: 'Pasta', count: 4 },
  { name: 'Caffè', count: 3, added: true },
  { name: 'Tonno', count: 2 },
];
</script>

<template>
  <main class="preview">
    <header class="preview__head">
      <h1 class="preview__title">
        Tokens Preview
      </h1>
      <p class="label">
        Editorial Cream / Lovable — single visual direction. Dev reference only.
      </p>
    </header>

    <section
      class="preview__group"
      aria-labelledby="grp-buttons"
    >
      <h2
        id="grp-buttons"
        class="sec-h"
      >
        <span>Buttons</span>
      </h2>
      <div class="preview__row">
        <button
          class="btn btn--dark"
          type="button"
        >
          Dark
        </button>
        <button
          class="btn btn--accent"
          type="button"
        >
          Accent
        </button>
        <button
          class="btn btn--ghost"
          type="button"
        >
          Ghost
        </button>
        <button
          class="btn btn--cream"
          type="button"
        >
          Cream
        </button>
      </div>
      <div class="preview__row">
        <button
          class="btn btn--dark btn--full"
          type="button"
        >
          Full width
        </button>
      </div>
    </section>

    <section
      class="preview__group"
      aria-labelledby="grp-input"
    >
      <h2
        id="grp-input"
        class="sec-h"
      >
        <span>Input</span>
      </h2>
      <input
        class="input"
        type="text"
        placeholder="Aggiungi un articolo…"
      >
    </section>

    <section
      class="preview__group"
      aria-labelledby="grp-chips"
    >
      <h2
        id="grp-chips"
        class="sec-h"
      >
        <span>Chips</span>
      </h2>
      <div class="preview__row">
        <span class="chip">Default</span>
        <span class="chip chip--cream">Cream</span>
        <span class="chip chip--dark">Dark</span>
      </div>
    </section>

    <section
      class="preview__group"
      aria-labelledby="grp-divider"
    >
      <h2
        id="grp-divider"
        class="sec-h"
      >
        <span>Divider</span>
      </h2>
      <hr class="divider">
    </section>

    <section
      class="preview__group"
      aria-labelledby="grp-rowcard"
    >
      <h2
        id="grp-rowcard"
        class="sec-h"
      >
        <span>Row card</span>
      </h2>
      <article class="row-card">
        <span class="wordmark">La spesa di casa</span>
        <span class="label">12 articoli · aggiornata 2h fa</span>
      </article>
    </section>

    <section
      class="preview__group"
      aria-labelledby="grp-appbar"
    >
      <h2
        id="grp-appbar"
        class="sec-h"
      >
        <span>App bar / Tab bar / Icon button</span>
      </h2>
      <nav
        class="appbar"
        aria-label="App bar preview"
      >
        <button
          class="iconbtn"
          type="button"
          aria-label="Back"
        >
          ←
        </button>
        <span class="wordmark">Buy The Way</span>
        <button
          class="iconbtn"
          type="button"
          aria-label="More"
        >
          ⋯
        </button>
      </nav>
      <nav
        class="tabbar"
        aria-label="Tab bar preview"
      >
        <button
          class="iconbtn"
          type="button"
          aria-label="Home"
        >
          ⌂
        </button>
        <button
          class="iconbtn"
          type="button"
          aria-label="Search"
        >
          ⌕
        </button>
        <button
          class="iconbtn"
          type="button"
          aria-label="Settings"
        >
          ⚙
        </button>
      </nav>
    </section>

    <section
      class="preview__group"
      aria-labelledby="grp-items"
    >
      <h2
        id="grp-items"
        class="sec-h"
      >
        <span>List items</span>
      </h2>
      <div
        class="item"
        data-checked="false"
      >
        <span aria-hidden="true">○</span>
        <span>Latte intero</span>
      </div>
      <div
        class="item"
        data-checked="true"
      >
        <span aria-hidden="true">●</span>
        <span>Pane integrale</span>
      </div>
    </section>

    <section
      class="preview__group"
      aria-labelledby="grp-shelf"
    >
      <h2
        id="grp-shelf"
        class="sec-h"
      >
        <span>Shelf (MostUsedShelf)</span>
      </h2>
      <div class="shelf">
        <button
          v-for="entry in shelfSamples"
          :key="entry.name"
          type="button"
          class="shelf__cell"
          :data-rank="entry.top ? 'top' : undefined"
          :data-added="entry.added ? '' : undefined"
        >
          <span>{{ entry.name }}</span>
          <span class="label">×{{ entry.count }}</span>
        </button>
      </div>
    </section>

    <section
      class="preview__group"
      aria-labelledby="grp-banner"
    >
      <h2
        id="grp-banner"
        class="sec-h"
      >
        <span>Banner / Toast</span>
      </h2>
      <div
        class="banner-offline"
        role="status"
      >
        Offline — modifiche locali
      </div>
      <div class="preview__row">
        <div
          class="toast"
          role="status"
        >
          Aggiunto alla lista
        </div>
      </div>
    </section>

    <section
      class="preview__group"
      aria-labelledby="grp-phone"
    >
      <h2
        id="grp-phone"
        class="sec-h"
      >
        <span>Phone preview frame</span>
      </h2>
      <div class="phone">
        <div class="statusbar">
          <span>9:41</span>
          <span>BTW</span>
        </div>
        <div class="scroll">
          <p class="wordmark">
            Buy The Way
          </p>
          <p class="label">
            375 × 750 dev preview frame.
          </p>
        </div>
        <div
          class="home-ind"
          aria-hidden="true"
        />
      </div>
    </section>

    <button
      class="fab"
      type="button"
      aria-label="Aggiungi lista"
    >
      +
    </button>
  </main>
</template>

<style scoped>
.preview {
  padding: var(--space-6) var(--space-4) var(--space-16);
  max-width: 720px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
}

.preview__head {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.preview__title {
  font-size: var(--text-xl);
  font-weight: 600;
  margin: 0;
  color: var(--charcoal);
}

.preview__group {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.preview__row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  align-items: center;
}
</style>
