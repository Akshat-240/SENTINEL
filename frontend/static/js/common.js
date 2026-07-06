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

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const btn = document.querySelector('.theme-toggle');
    if (btn) btn.textContent = theme === 'day' ? 'NIGHT MODE' : 'DAY MODE';
  }

  function initTheme() {
    // In-memory only for this session (no browser storage dependency).
    let theme = window.__sentinelTheme || 'day';
    applyTheme(theme);

    const btn = document.querySelector('.theme-toggle');
    if (btn) {
      btn.addEventListener('click', () => {
        theme = theme === 'day' ? 'night' : 'day';
        window.__sentinelTheme = theme;
        applyTheme(theme);
      });
    }
  }

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
  function initai_assistantFab() {
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
    initai_assistantFab();
  });
})();