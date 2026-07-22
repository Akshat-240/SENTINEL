// sentinel_ai.js
document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const zoneSelector = document.getElementById('zone-selector');
    const riskScore = document.getElementById('context-risk-score');
    const gasPpm = document.getElementById('context-gas-ppm');
    const gasBarFill = document.getElementById('gas-bar-fill');
    const chatMessages = document.getElementById('chat-messages');
    const chatInput = document.getElementById('chat-input');
    const btnSend = document.getElementById('btn-send');
    const quickBtns = document.querySelectorAll('.quick-btn');
    
    let currentZoneId = 'ALL';
    let riskChart = null;

    // Initialization
    async function init() {
        try {
            const configRes = await fetch('/api/dashboard/config');
            if (configRes.ok) {
                const config = await configRes.json();
                populateZoneSelector(config.zones);
            }
            await updateTelemetry();
            
            // Auto-refresh telemetry every 5 seconds
            setInterval(updateTelemetry, 5000);

            // GSAP Intro
            if (typeof gsap !== 'undefined') {
                gsap.from('.terminal-panel', { x: 50, opacity: 0, duration: 0.8, ease: 'power3.out' });
                gsap.from('.telemetry-panel', { x: -50, opacity: 0, duration: 0.8, ease: 'power3.out', delay: 0.2 });
                gsap.from('.message', { y: 20, opacity: 0, duration: 0.5, stagger: 0.1, delay: 0.5 });
            }
        } catch (err) {
            console.error('Failed to init Sentinel AI:', err);
        }
    }

    function populateZoneSelector(zones) {
        if (!zones) return;
        zones.forEach(z => {
            const opt = document.createElement('option');
            opt.value = z.id;
            opt.textContent = `${z.name} (${z.id})`;
            zoneSelector.appendChild(opt);
        });
    }

    // Telemetry updates
    async function updateTelemetry() {
        try {
            // 1. Get zones for risk score
            const zonesRes = await fetch('/api/dashboard/zones');
            let riskValue = 0;
            if (zonesRes.ok) {
                const data = await zonesRes.json();
                let targetZone = null;
                if (currentZoneId === 'ALL') {
                    // Highest risk for GLOBAL
                    targetZone = data.reduce((prev, curr) => (curr.risk_score > prev.risk_score) ? curr : prev, data[0]);
                } else {
                    targetZone = data.find(z => z.id === currentZoneId);
                }
                
                if (targetZone) {
                    riskValue = targetZone.risk_score;
                    updateRiskUI(riskValue);
                } else {
                    riskScore.textContent = '--';
                }
            }

            // 2. Get trend for chart and gas PPM
            let trendId = currentZoneId;
            const trendRes = await fetch(`/api/risk/trend/${trendId}`);
            if (trendRes.ok) {
                const trendData = await trendRes.json();
                updateGasUI(trendData.current_gas_ppm);
                updateChart(trendData);
            }
        } catch (err) {
            console.error('Failed to update telemetry', err);
        }
    }

    function updateRiskUI(score) {
        riskScore.textContent = score.toFixed(1);
        
        // Dynamic coloring
        let color = '#00f3ff'; // Cyan
        if (score >= 80) color = '#ff003c'; // Red
        else if (score >= 50) color = '#ffaa00'; // Orange
        
        if (typeof gsap !== 'undefined') {
            gsap.to(riskScore, { color: color, textShadow: `0 0 15px ${color}`, duration: 0.5 });
        } else {
            riskScore.style.color = color;
            riskScore.style.textShadow = `0 0 15px ${color}`;
        }
    }

    function updateGasUI(ppm) {
        if (ppm === undefined || ppm === null) {
            gasPpm.textContent = '--';
            gasBarFill.style.width = '0%';
            return;
        }
        
        gasPpm.textContent = Number(ppm).toFixed(1) + ' PPM';
        // Assuming max gas is around 100 for visual bar, clamp it
        const percentage = Math.min(100, Math.max(0, (ppm / 100) * 100));
        gasBarFill.style.width = `${percentage}%`;
    }

    function updateChart(data) {
        const canvas = document.getElementById('risk-trend-chart');
        if (!canvas || !window.Chart) return;

        const slope = data.slope || 0;
        const cur = data.current_gas_ppm || 0;
        const pts = [
            Math.max(0, cur - slope * 4),
            Math.max(0, cur - slope * 3),
            Math.max(0, cur - slope * 2),
            Math.max(0, cur - slope),
            cur,
        ];

        let trendHex = '#00f3ff'; // default cyan
        if (data.trend === 'RISING') trendHex = '#ff003c';
        else if (data.trend === 'FALLING') trendHex = '#00f3ff';
        else trendHex = '#00ff88';

        if (riskChart) {
            riskChart.data.datasets[0].data = pts;
            riskChart.data.datasets[0].borderColor = trendHex;
            
            const ctx = canvas.getContext('2d');
            const grad = ctx.createLinearGradient(0, 0, 0, 80);
            grad.addColorStop(0, trendHex + '66');
            grad.addColorStop(1, trendHex + '00');
            riskChart.data.datasets[0].backgroundColor = grad;
            
            riskChart.update();
        } else {
            const ctx = canvas.getContext('2d');
            const grad = ctx.createLinearGradient(0, 0, 0, 80);
            grad.addColorStop(0, trendHex + '66');
            grad.addColorStop(1, trendHex + '00');

            riskChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: ['T-4', 'T-3', 'T-2', 'T-1', 'Now'],
                    datasets: [{
                        data: pts,
                        borderColor: trendHex,
                        borderWidth: 2,
                        backgroundColor: grad,
                        fill: true,
                        tension: 0.4,
                        pointRadius: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: { duration: 800 },
                    plugins: { legend: { display: false }, tooltip: { enabled: false } },
                    scales: {
                        x: { display: false },
                        y: { display: false, min: 0 }
                    }
                }
            });
        }
    }

    zoneSelector.addEventListener('change', (e) => {
        currentZoneId = e.target.value;
        updateTelemetry();
    });

    // Chat Logic
    function appendUserMessage(text) {
        const msg = document.createElement('div');
        msg.className = 'message user-message';
        msg.innerHTML = `
            <div class="message-content">
                <div class="message-meta">OPERATOR</div>
                <div class="msg-text">${escapeHTML(text)}</div>
            </div>
        `;
        chatMessages.appendChild(msg);
        if (typeof gsap !== 'undefined') {
            gsap.fromTo(msg, { opacity: 0, x: 20 }, { opacity: 1, x: 0, duration: 0.3 });
        } else {
            msg.style.opacity = '1';
        }
        scrollToBottom();
    }

    function appendThinking() {
        const id = 'think-' + Date.now();
        const msg = document.createElement('div');
        msg.className = 'message ai-message';
        msg.id = id;
        msg.innerHTML = `
            <div class="message-border"></div>
            <div class="message-content">
                <div class="message-meta">SYSTEM [SENTINEL AI]</div>
                <div class="msg-text"><span class="typing-indicator">Processing Request</span></div>
            </div>
        `;
        chatMessages.appendChild(msg);
        if (typeof gsap !== 'undefined') {
            gsap.fromTo(msg, { opacity: 0, x: -20 }, { opacity: 1, x: 0, duration: 0.3 });
        } else {
            msg.style.opacity = '1';
        }
        scrollToBottom();
        return id;
    }

    function removeMessage(id) {
        const el = document.getElementById(id);
        if (el) el.remove();
    }

    function appendAIMessage(response, sources) {
        const msg = document.createElement('div');
        msg.className = 'message ai-message';
        
        let sourcesHTML = '';
        if (sources && sources.length > 0) {
            sourcesHTML = `<div class="sources-container">`;
            sources.forEach(src => {
                sourcesHTML += `<span class="source-chip">${escapeHTML(src)}</span>`;
            });
            sourcesHTML += `</div>`;
        }

        const rawHTML = `
            <div class="message-border"></div>
            <div class="message-content">
                <div class="message-meta">SYSTEM [SENTINEL AI]</div>
                <div class="msg-text"></div>
                ${sourcesHTML}
            </div>
        `;
        msg.innerHTML = rawHTML;
        chatMessages.appendChild(msg);
        
        const textContainer = msg.querySelector('.msg-text');
        
        // Simple Markdown parsing for bold, code, code blocks
        let formattedText = escapeHTML(response)
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
            .replace(/`(.*?)`/g, '<code>$1</code>')
            .replace(/\n/g, '<br>');

        textContainer.innerHTML = formattedText;
        
        if (typeof gsap !== 'undefined') {
            gsap.fromTo(msg, { opacity: 0, x: -20 }, { opacity: 1, x: 0, duration: 0.4 });
        } else {
            msg.style.opacity = '1';
        }
        scrollToBottom();
    }

    function scrollToBottom() {
        chatMessages.scrollTo({
            top: chatMessages.scrollHeight,
            behavior: 'smooth'
        });
    }

    async function sendMessage(text) {
        if (!text.trim()) return;
        
        appendUserMessage(text);
        chatInput.value = '';
        
        const thinkId = appendThinking();

        try {
            const res = await fetch('/api/rag/sentinel_ai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: text,
                    zone_id: currentZoneId === 'ALL' ? null : currentZoneId
                })
            });
            
            removeMessage(thinkId);

            if (res.ok) {
                const data = await res.json();
                appendAIMessage(data.response || 'No response generated.', data.sources || []);
            } else {
                appendAIMessage('Error: Unable to connect to SENTINEL AI core.', []);
            }
        } catch (err) {
            removeMessage(thinkId);
            appendAIMessage('Error: Network failure communicating with Sentinel AI backend.', []);
        }
    }

    // Event Listeners
    btnSend.addEventListener('click', () => {
        sendMessage(chatInput.value);
    });

    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage(chatInput.value);
        }
    });

    quickBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const q = btn.getAttribute('data-q');
            chatInput.value = q;
            chatInput.focus();
            sendMessage(q);
        });
    });

    function escapeHTML(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // Startup
    init();
});