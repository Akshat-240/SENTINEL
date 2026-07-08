/* ==========================================================================
   SENTINEL — common.js
   Shared across every page: nav active-state, theme toggle,
   floating ai_assistant widget, and the shared click-to-expand pattern
   (used by Alert Panel cards here, and Replay timeline entries elsewhere).
   ========================================================================== */

(function () {
  'use strict';

  /* ---------- Active nav link ---------- */
  function setActiveNavLink() {
    const path = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.topbar__link').forEach((link) => {
      const href = link.getAttribute('href');
      link.classList.toggle('is-active', href === path);
    });
  }

  /* ---------- Theme toggle (day / night) ---------- */
  const THEME_KEY = 'sentinel_theme';

  function getStoredTheme() {
    try {
      return localStorage.getItem(THEME_KEY);
    } catch (e) {
      // localStorage unavailable (privacy mode, disabled storage, etc.)
      return null;
    }
  }

  function storeTheme(theme) {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (e) {
      // Fail silently — theme just won't persist this session.
    }
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const btn = document.querySelector('.theme-toggle');
    if (btn) btn.textContent = theme === 'day' ? 'NIGHT MODE' : 'DAY MODE';
  }

  function initTheme() {
// The inline head-script already applied the
// correct theme to <html> before paint, to avoid a flash.
// Here we just read that same value back so the toggle button
// label and stored state agree with what's on screen.
let theme = document.documentElement.getAttribute('data-theme') || getStoredTheme() || 'day';
    applyTheme(theme);

    const btn = document.querySelector('.theme-toggle');
    if (btn) {
      btn.addEventListener('click', () => {
        theme = theme === 'day' ? 'night' : 'day';
        storeTheme(theme);
        applyTheme(theme);
      });
    }
  }
  /* ---------- Replay Mode (global state, mirrors theme's localStorage pattern) ----------
     State shape in localStorage:
       { mode: 'live' }
       { mode: 'replay', timestamp: '09:10' }
     Any page can call SentinelReplay.enter(timestamp) to freeze the whole
     app at that moment, and SentinelReplay.resumeLive() to snap back —
     from anywhere, since this lives in common.js like the theme toggle.
  */
  const REPLAY_KEY = 'sentinel_replay_state';

  function getReplayState() {
    try {
      const raw = localStorage.getItem(REPLAY_KEY);
      if (!raw) return { mode: 'live' };
      const parsed = JSON.parse(raw);
      return parsed && parsed.mode ? parsed : { mode: 'live' };
    } catch (e) {
      return { mode: 'live' }; // localStorage unavailable — default to live
    }
  }

  function storeReplayState(state) {
    try {
      localStorage.setItem(REPLAY_KEY, JSON.stringify(state));
    } catch (e) {
      // Fail silently — replay just won't persist across pages this session.
    }
  }

  function enterReplay(timestamp) {
    storeReplayState({ mode: 'replay', timestamp });
    renderReplayBar();
    document.dispatchEvent(new CustomEvent('sentinel:replay-changed', { detail: getReplayState() }));
  }

  function resumeLive() {
    storeReplayState({ mode: 'live' });
    renderReplayBar();
    document.dispatchEvent(new CustomEvent('sentinel:replay-changed', { detail: getReplayState() }));
  }

  // Renders the top-bar indicator: normal Live pill vs "Replay • [time]" +
  // a Resume Live button. Expects the topbar to have a #globalReplayBar
  // container (see markup snippet) — falls back to no-op if it's missing,
  // so pages that haven't added the markup yet don't break.
  function renderReplayBar() {
    const bar = document.getElementById('globalReplayBar');
    if (!bar) return;
    const state = getReplayState();

    if (state.mode === 'replay') {
      bar.innerHTML = `
        <span class="pill replay-pill">
          <span class="pill__dot"></span>Replay &middot; ${state.timestamp}
        </span>
        <button class="mode-bar__return" id="globalResumeLiveBtn" type="button">Resume Live</button>
      `;
      const btn = document.getElementById('globalResumeLiveBtn');
      if (btn) btn.addEventListener('click', resumeLive);
    } else {
      bar.innerHTML = `
        <span class="pill" style="--pill-bg: var(--risk-normal-tint); --pill-fg: var(--risk-normal);">
          <span class="pill__dot"></span>Live
        </span>
      `;
    }
  }

  window.SentinelReplay = {
    getState: getReplayState,
    enter: enterReplay,
    resumeLive,
    isReplay: () => getReplayState().mode === 'replay',
  };
  /* ---------- Live clock, 24hr with seconds ---------- */
  function pad(n) { return n.toString().padStart(2, '0'); }

  function tickClock() {
    const el = document.querySelector('.topbar__clock');
    if (!el) return;
    const now = new Date();
    el.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  }

  /* ---------- Shared click-to-expand pattern ----------
     Reused by: Alert Panel cards (alerts.js) and Replay timeline entries.
     Usage: SentinelExpand.attach(gridSelector, cardSelector)
  */
  const SentinelExpand = {
    attach(gridSelector, cardSelector) {
      const grid = document.querySelector(gridSelector);
      if (!grid) return;

      grid.querySelectorAll(cardSelector).forEach((card) => {
        card.addEventListener('click', (e) => {
          e.stopPropagation();
          const alreadyOpen = card.classList.contains('is-open');
          grid.querySelectorAll(cardSelector).forEach((c) => c.classList.remove('is-open'));
          grid.classList.remove('is-expanded');

          if (!alreadyOpen) {
            grid.classList.add('is-expanded');
            card.classList.add('is-open');
          }
        });
      });

      // Click outside collapses
      document.addEventListener('click', (e) => {
        if (!grid.contains(e.target)) {
          grid.classList.remove('is-expanded');
          grid.querySelectorAll(cardSelector).forEach((c) => c.classList.remove('is-open'));
        }
      });
    },
  };
  window.SentinelExpand = SentinelExpand;

  /* ---------- Floating ai_assistant widget ---------- */
  function initAiAssistantFab() {
    const fab = document.querySelector('.ai_assistant-fab');
    if (!fab) return;
    const button = fab.querySelector('.ai_assistant-fab__button');

    button.addEventListener('click', () => {
      fab.classList.toggle('is-open');
    });

    document.addEventListener('click', (e) => {
      if (!fab.contains(e.target)) fab.classList.remove('is-open');
    });
  }

  /* ---------- Init ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    setActiveNavLink();
    initTheme();
    tickClock();
    setInterval(tickClock, 1000);
    initAiAssistantFab();
  });
})();