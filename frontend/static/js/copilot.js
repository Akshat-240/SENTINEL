/* ==========================================================================
   SENTINEL — copilot.js
   ========================================================================== */

(function () {
  'use strict';

  const chatWindow = document.getElementById('chatWindow');
  const chatInput = document.getElementById('chatInput');
  const chatBtn = document.getElementById('chatBtn');

  function appendMessage(sender, text, isError=false) {
    const div = document.createElement('div');
    div.style.marginBottom = '12px';
    div.style.whiteSpace = 'pre-wrap';
    
    let color = 'var(--text-secondary)';
    if (sender === 'USER') color = 'var(--text)';
    if (sender === 'SENTINEL') color = 'var(--risk-caution)';
    if (isError) color = 'var(--risk-critical)';
    
    div.style.color = color;
    div.textContent = `> ${sender}: ${text}`;
    
    chatWindow.appendChild(div);
    chatWindow.scrollTop = chatWindow.scrollHeight;
  }

  async function handleSend() {
    const query = chatInput.value.trim();
    if (!query) return;

    appendMessage('USER', query);
    chatInput.value = '';
    chatInput.disabled = true;
    chatBtn.disabled = true;
    
    appendMessage('SENTINEL', 'Processing...');

    try {
      const res = await fetch('http://localhost:5000/api/rag/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query, zone_id: 'ZONE_A' })
      });
      
      chatWindow.removeChild(chatWindow.lastChild); // Remove 'Processing...'

      if (!res.ok) throw new Error('API request failed');
      const data = await res.json();
      
      if (data.error) {
          appendMessage('SENTINEL', 'Unable to connect to intelligence pipeline. Check API configuration.', true);
      } else {
          let responseText = 'Query processed. Intelligence pipeline active.';
          
          if (data && data.length > 0) {
              responseText += '\n\nRETRIEVED DOCUMENTS:\n';
              data.forEach((match, idx) => {
                  const snippet = match.text ? match.text.substring(0, 100).replace(/\n/g, ' ') + '...' : '';
                  responseText += `[${idx+1}] ${match.source}: ${snippet}\n`;
              });
          }
          
          appendMessage('SENTINEL', responseText.trim());
      }
    } catch (err) {
      if (chatWindow.lastChild && chatWindow.lastChild.textContent.includes('Processing...')) {
          chatWindow.removeChild(chatWindow.lastChild);
      }
      appendMessage('SENTINEL', 'Unable to connect to intelligence pipeline. Check API configuration.', true);
    } finally {
      chatInput.disabled = false;
      chatBtn.disabled = false;
      chatInput.focus();
    }
  }

  chatBtn.addEventListener('click', handleSend);
  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSend();
  });
})();