/* ==========================================================================
   SENTINEL — copilot.js
   Full chat interface (copilot.html). Conversation state is shared with
   the floating widget via localStorage (same pattern as theme + replay
   state in common.js) so history carries over between the two, per
   sentinel_frontend.md section on copilot.html.

   Message send/receive is MOCKED here — swap getAssistantReply() for the
   real Gemini-backed endpoint once gemini/copilot.py is wired up
   (same "swap this one function" pattern as report.js / permits.js).
   ========================================================================== */

(function () {
  'use strict';

  const HISTORY_KEY = 'sentinel_copilot_history';

  const MOCK_SEED_MESSAGES = [
    {
      role: 'assistant',
      text: 'Ask about zone status, permits, or recommended actions.',
      time: '09:00',
    },
  ];

  // ---------- Shared history (localStorage, same as theme/replay state) ----------
  function getHistory() {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (!raw) return MOCK_SEED_MESSAGES.slice();
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) && parsed.length ? parsed : MOCK_SEED_MESSAGES.slice();
    } catch (e) {
      return MOCK_SEED_MESSAGES.slice(); // localStorage unavailable — in-memory only this session
    }
  }

  function storeHistory(history) {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch (e) {
      // Fail silently — history just won't persist across pages/reloads this session.
    }
  }

  // ---------- Mock assistant reply (swap for real Gemini call later) ----------
  async function getAssistantReply(userText) {
    // TEMP (mock): canned reply based on loose keyword match.
    const lower = userText.toLowerCase();
    if (lower.includes('permit')) {
      return 'Zone B currently has 1 Hot Work permit flagged and 1 Confined Space permit blocked. Check the Permits page for full details.';
    }
    if (lower.includes('zone') || lower.includes('status')) {
      return 'Zone B is at CRITICAL (peak score 97). Zones A and C showed a secondary caution-level rise during the same window.';
    }
    if (lower.includes('action') || lower.includes('recommend')) {
      return 'Top recommended action: suspend all Hot Work and Confined Space permits in Zone B for a minimum of 4 hours following shutdown.';
    }
    return "I can help with zone status, permit checks, and recommended actions. Try asking something like \"What's the status of Zone B?\"";

    // LATER (real API):
    // const res = await fetch('/api/copilot', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ message: userText, history: getHistory() }),
    // });
    // if (!res.ok) throw new Error('Copilot request failed');
    // const data = await res.json();
    // return data.reply;
  }

  // ---------- Helpers ----------
  function nowTime() {
    const d = new Date();
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ---------- Render ----------
  function renderMessages(history, filterText) {
    const el = document.getElementById('copilotMessages');
    const query = (filterText || '').trim().toLowerCase();
    const filtered = query
      ? history.filter((m) => m.text.toLowerCase().includes(query))
      : history;

    if (!filtered.length) {
      el.innerHTML = `<div class="copilot-panel__empty">No messages match "${escapeHtml(filterText)}".</div>`;
      return;
    }

    el.innerHTML = filtered.map((m) => `
      <div class="copilot-msg is-${m.role}">
        <div class="copilot-msg__bubble">${escapeHtml(m.text)}</div>
        <div class="copilot-msg__time">${m.time}</div>
      </div>
    `).join('');

    if (!query) el.scrollTop = el.scrollHeight;
  }

  // ---------- Send flow ----------
  async function handleSend() {
    const input = document.getElementById('copilotInput');
    const text = input.value.trim();
    if (!text) return;

    let history = getHistory();
    history.push({ role: 'user', text, time: nowTime() });
    storeHistory(history);
    renderMessages(history, '');
    input.value = '';

    const reply = await getAssistantReply(text);

    history = getHistory();
    history.push({ role: 'assistant', text: reply, time: nowTime() });
    storeHistory(history);
    renderMessages(history, '');
  }

  // ---------- Wire up ----------
  function wireInput() {
    const input = document.getElementById('copilotInput');
    const sendBtn = document.getElementById('copilotSendBtn');
    sendBtn.addEventListener('click', handleSend);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleSend();
    });
  }

  function wireSearch() {
    const searchInput = document.getElementById('copilotSearchInput');
    searchInput.addEventListener('input', () => {
      renderMessages(getHistory(), searchInput.value);
    });
  }

  // ---------- Init ----------
  function init() {
    renderMessages(getHistory(), '');
    wireInput();
    wireSearch();
  }

  document.addEventListener('DOMContentLoaded', init);
})();