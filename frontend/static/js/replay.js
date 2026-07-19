const UI = {
    zoneSelect: document.getElementById('replay-zone-select'),
    btnPlay: document.getElementById('btn-play'),
    statTotal: document.getElementById('stat-total'),
    statCritical: document.getElementById('stat-critical'),
    statPeak: document.getElementById('stat-peak'),
    statZone: document.getElementById('stat-zone'),
    eventsPanel: document.getElementById('events-panel'),
    chartCanvas: document.getElementById('timeline-chart')
};

let chartInstance = null;
let isPlaying = false;
let playInterval = null;
let currentPlayIndex = 0;
let timelineDataCache = [];

async function init() {
    try {
        const configRes = await fetch('/api/dashboard/config');
        const config = await configRes.json();
        
        if (config && config.length > 0) {
            UI.zoneSelect.innerHTML = config.map(z => `<option value="${z.zone_id}">${z.name}</option>`).join('');
            UI.zoneSelect.addEventListener('change', () => loadZoneData(UI.zoneSelect.value));
            loadZoneData(config[0].zone_id);
        }
    } catch (error) {
        console.error('Error loading config:', error);
    }

    UI.btnPlay.addEventListener('click', togglePlay);
}

async function loadZoneData(zoneId) {
    stopPlay();
    UI.statZone.textContent = UI.zoneSelect.options[UI.zoneSelect.selectedIndex]?.text || zoneId;

    try {
        let timelineData = [];
        let criticalData = [];
        
        const tlRes = await fetch(`/api/replay/timeline/${zoneId}`);
        if(tlRes.ok) timelineData = await tlRes.json();
        
        const critRes = await fetch(`/api/replay/critical/${zoneId}`);
        if(critRes.ok) criticalData = await critRes.json();

        timelineDataCache = timelineData;
        updateStats(timelineData, criticalData);
        renderChart(timelineData, criticalData);
        renderEvents(criticalData);
    } catch (error) {
        console.error('Error loading zone data:', error);
    }
}

function updateStats(timeline, critical) {
    UI.statTotal.textContent = timeline.length;
    UI.statCritical.textContent = critical.length;
    const maxScore = timeline.reduce((max, pt) => Math.max(max, pt.risk_score), 0);
    UI.statPeak.textContent = maxScore.toFixed(1);
}

function renderChart(timeline, critical) {
    if (chartInstance) {
        chartInstance.destroy();
    }

    const labels = timeline.map(t => new Date(t.timestamp).toLocaleTimeString());
    const scores = timeline.map(t => t.risk_score);
    const gases = timeline.map(t => t.gas_ppm);

    // Annotations for critical events
    const ctx = UI.chartCanvas.getContext('2d');

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Risk Score',
                    data: scores,
                    borderColor: '#ff3366',
                    backgroundColor: 'rgba(255, 51, 102, 0.1)',
                    yAxisID: 'y',
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'Gas PPM',
                    data: gases,
                    borderColor: '#33ccff',
                    backgroundColor: 'transparent',
                    yAxisID: 'y1',
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: {
                    labels: { color: '#fff' }
                }
            },
            scales: {
                x: {
                    ticks: { color: '#888' },
                    grid: { color: 'rgba(255,255,255,0.05)' }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    ticks: { color: '#ff3366' },
                    grid: { color: 'rgba(255,255,255,0.05)' }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    ticks: { color: '#33ccff' },
                    grid: { drawOnChartArea: false }
                }
            }
        }
    });
}

function renderEvents(critical) {
    UI.eventsPanel.innerHTML = critical.map(ev => `
        <div class="event-card severity-${ev.severity}">
            <div class="event-time">${new Date(ev.timestamp).toLocaleTimeString()}</div>
            <div class="event-details">
                <div class="event-title">${ev.event_type}</div>
                <div class="event-desc">${ev.description}</div>
            </div>
            <div class="event-score">${ev.risk_score}</div>
        </div>
    `).join('');
}

function togglePlay() {
    if (isPlaying) {
        stopPlay();
    } else {
        startPlay();
    }
}

function startPlay() {
    if (timelineDataCache.length === 0) return;
    isPlaying = true;
    UI.btnPlay.textContent = 'PAUSE';
    
    if (currentPlayIndex >= timelineDataCache.length) {
        currentPlayIndex = 0;
    }

    playInterval = setInterval(() => {
        if (currentPlayIndex >= timelineDataCache.length) {
            stopPlay();
            return;
        }

        if (chartInstance) {
            chartInstance.setActiveElements([
                { datasetIndex: 0, index: currentPlayIndex },
                { datasetIndex: 1, index: currentPlayIndex }
            ]);
            chartInstance.tooltip.setActiveElements([
                { datasetIndex: 0, index: currentPlayIndex },
                { datasetIndex: 1, index: currentPlayIndex }
            ], { x: 0, y: 0 });
            chartInstance.update();
        }

        currentPlayIndex++;
    }, 1000); // 1s per step
}

function stopPlay() {
    isPlaying = false;
    UI.btnPlay.textContent = 'PLAY';
    if (playInterval) {
        clearInterval(playInterval);
        playInterval = null;
    }
}

document.addEventListener('DOMContentLoaded', init);