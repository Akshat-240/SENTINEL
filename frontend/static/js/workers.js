// workers.js

let allZones = [];
let zonesData = [];
let densityChart = null;

document.addEventListener('DOMContentLoaded', async () => {
    // Global Chart.js defaults
    Chart.defaults.color = 'rgba(255, 255, 255, 0.6)';
    Chart.defaults.font.family = "'Share Tech Mono', monospace";
    Chart.defaults.scale.grid.color = 'rgba(255, 255, 255, 0.05)';
    
    initDensityChart();

    await fetchConfig();
    await fetchZoneData();
    updateDashboard('all');

    document.getElementById('workers-zone-select').addEventListener('change', (e) => {
        updateDashboard(e.target.value);
    });

    // Initial load animation
    gsap.from(".hud-kpi-card", {
        y: 30,
        opacity: 0,
        duration: 0.8,
        stagger: 0.1,
        ease: "back.out(1.7)"
    });
    
    gsap.from(".hud-panel", {
        y: 40,
        opacity: 0,
        duration: 0.8,
        stagger: 0.15,
        delay: 0.2,
        ease: "power3.out"
    });
});

async function fetchConfig() {
    try {
        const response = await fetch('/api/dashboard/config');
        allZones = await response.json();
        
        const select = document.getElementById('workers-zone-select');
        allZones.forEach(zone => {
            const option = document.createElement('option');
            option.value = zone.zone_id;
            option.textContent = zone.name.toUpperCase();
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error fetching config:', error);
    }
}

async function fetchZoneData() {
    try {
        const response = await fetch('/api/dashboard/zones');
        zonesData = await response.json();
    } catch (error) {
        console.error('Error fetching zone data:', error);
    }
}

function initDensityChart() {
    const ctx = document.getElementById('density-chart').getContext('2d');
    
    // Gradient definitions
    const gradientSafe = ctx.createLinearGradient(0, 0, 0, 400);
    gradientSafe.addColorStop(0, 'rgba(0, 255, 136, 0.8)');
    gradientSafe.addColorStop(1, 'rgba(0, 255, 136, 0.1)');

    const gradientWarning = ctx.createLinearGradient(0, 0, 0, 400);
    gradientWarning.addColorStop(0, 'rgba(255, 140, 0, 0.8)');
    gradientWarning.addColorStop(1, 'rgba(255, 140, 0, 0.1)');

    const gradientDanger = ctx.createLinearGradient(0, 0, 0, 400);
    gradientDanger.addColorStop(0, 'rgba(255, 68, 68, 0.8)');
    gradientDanger.addColorStop(1, 'rgba(255, 68, 68, 0.1)');

    densityChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: 'Headcount',
                data: [],
                backgroundColor: [],
                borderColor: [],
                borderWidth: 1,
                borderRadius: 4,
                barPercentage: 0.6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(10, 15, 35, 0.9)',
                    titleFont: { family: "'Share Tech Mono', monospace", size: 14 },
                    bodyFont: { family: "'Exo 2', sans-serif", size: 13 },
                    padding: 12,
                    borderColor: 'rgba(0, 212, 255, 0.3)',
                    borderWidth: 1,
                    displayColors: false,
                    callbacks: {
                        label: function(context) {
                            return `Workers: ${context.raw}`;
                        }
                    }
                }
            },
            scales: {
                y: { 
                    beginAtZero: true,
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { font: { size: 11 } }
                },
                x: { 
                    grid: { display: false },
                    ticks: { font: { size: 10 } }
                }
            },
            animation: {
                duration: 1000,
                easing: 'easeOutQuart'
            }
        }
    });

    densityChart.gradientSafe = gradientSafe;
    densityChart.gradientWarning = gradientWarning;
    densityChart.gradientDanger = gradientDanger;
}

function animateValue(id, value, suffix = '') {
    const el = document.getElementById(id);
    if (!el || value === '--' || isNaN(value)) {
        if (el) el.textContent = value + suffix;
        return;
    }
    const currentVal = parseFloat(el.textContent) || 0;
    const target = { val: currentVal };
    
    gsap.to(target, {
        val: value,
        duration: 1.5,
        ease: "power3.out",
        onUpdate: function() {
            el.textContent = Math.floor(target.val) + suffix;
        }
    });
}

async function updateDashboard(zoneId) {
    let totalWorkers = 0;
    let atRiskWorkers = 0;
    let complianceRate = 95; 
    let chartData = [];

    if (zoneId === 'all') {
        zonesData.forEach(z => {
            const count = z.snapshot?.worker_count || 0;
            totalWorkers += count;
            if (z.final_score > 60) {
                atRiskWorkers += count;
            }
        });
        chartData = zonesData;
        
        // Mock multi-zone data for UI completeness
        complianceRate = 92;
        document.getElementById('val-active-permits').textContent = 'SYS';
        
        document.getElementById('permits-table').innerHTML = `
            <tr><td colspan="6" style="text-align: center; color: var(--text-b); padding: 24px; font-family: var(--f-mono);">
                GLOBAL MATRIX ENGAGED. SELECT A SPECIFIC ZONE TO VIEW LOCALIZED PERMITS.
            </td></tr>`;
        
        document.getElementById('compliance-matrix').innerHTML = `
            <div class="comp-item">
                <div class="comp-dot status-unknown"></div>
                <div class="comp-info">
                    <div class="comp-name">STANDBY MODE</div>
                    <div class="comp-desc">Awaiting localized zone selection...</div>
                </div>
            </div>`;
    } else {
        const zone = zonesData.find(z => z.zone_id === zoneId);
        if (zone) {
            totalWorkers = zone.snapshot?.worker_count || 0;
            if (zone.final_score > 60) {
                atRiskWorkers = totalWorkers;
            }
            chartData = [zone];
        }

        try {
            // Permits
            const permitRes = await fetch(`/api/permits/active/${zoneId}`);
            let permits = [];
            if (permitRes.ok) {
                permits = await permitRes.json();
            }
            animateValue('val-active-permits', permits.length);
            renderPermitsTable(permits);

            // Compliance
            const compRes = await fetch(`/api/permits/compliance/${zoneId}`);
            if (compRes.ok) {
                const compData = await compRes.json();
                renderCompliance(compData);
                // Calculate compliance rate from data if possible
                if (Object.keys(compData).length > 0) {
                    let passed = 0;
                    let total = 0;
                    for (const key in compData) {
                        const val = compData[key];
                        const status = val.status || (val === true ? 'ok' : 'danger');
                        if (status === 'ok') passed++;
                        total++;
                    }
                    complianceRate = Math.round((passed / total) * 100);
                } else {
                    complianceRate = 100;
                }
            }
        } catch (e) {
            console.error('Error fetching zone specifics:', e);
            document.getElementById('val-active-permits').textContent = 'ERR';
        }
    }

    animateValue('val-total-workers', totalWorkers);
    animateValue('val-risk-workers', atRiskWorkers);
    animateValue('val-compliance', complianceRate, '%');

    updateDensityChart(chartData);
}

function updateDensityChart(data) {
    if (!densityChart) return;
    
    const labels = data.map(z => z.name || z.zone_id);
    const counts = data.map(z => z.snapshot?.worker_count || 0);
    const bgColors = data.map(z => {
        if (z.final_score > 80) return densityChart.gradientDanger;
        if (z.final_score > 50) return densityChart.gradientWarning;
        return densityChart.gradientSafe;
    });
    const borderColors = data.map(z => {
        if (z.final_score > 80) return 'rgba(255, 68, 68, 1)';
        if (z.final_score > 50) return 'rgba(255, 140, 0, 1)';
        return 'rgba(0, 255, 136, 1)';
    });

    densityChart.data.labels = labels;
    densityChart.data.datasets[0].data = counts;
    densityChart.data.datasets[0].backgroundColor = bgColors;
    densityChart.data.datasets[0].borderColor = borderColors;
    densityChart.update();
}

function renderPermitsTable(permits) {
    const tbody = document.getElementById('permits-table');
    tbody.innerHTML = '';
    
    if (!permits || permits.length === 0) {
        tbody.innerHTML = `
            <tr><td colspan="6" style="text-align: center; color: var(--text-b); padding: 24px; font-family: var(--f-mono);">
                NO ACTIVE PERMITS DETECTED IN THIS SECTOR.
            </td></tr>`;
        return;
    }

    permits.forEach((p, i) => {
        const tr = document.createElement('tr');
        const statusClass = p.status === 'active' ? 'badge-active' : (p.status === 'pending' ? 'badge-pending' : 'badge-expired');
        tr.innerHTML = `
            <td style="color: var(--c-cyan)">${p.permit_id}</td>
            <td>${p.zone_id}</td>
            <td>${p.type}</td>
            <td><span class="badge ${statusClass}">${p.status.toUpperCase()}</span></td>
            <td style="font-family: var(--f-mono)">${p.worker_id || 'N/A'}</td>
            <td style="color: var(--text-b)">${new Date(p.created_at).toLocaleString()}</td>
        `;
        tbody.appendChild(tr);
        
        gsap.from(tr, {
            opacity: 0,
            x: -20,
            duration: 0.4,
            delay: i * 0.05,
            ease: "power2.out"
        });
    });
}

function renderCompliance(data) {
    const panel = document.getElementById('compliance-matrix');
    panel.innerHTML = '';

    if (!data || Object.keys(data).length === 0) {
        panel.innerHTML = `
            <div class="comp-item">
                <div class="comp-dot status-unknown"></div>
                <div class="comp-info">
                    <div class="comp-name">NO DATA</div>
                    <div class="comp-desc">No compliance metrics available.</div>
                </div>
            </div>`;
        return;
    }

    let delay = 0;
    for (const [key, value] of Object.entries(data)) {
        const status = value.status || (value === true ? 'ok' : 'danger');
        const desc = value.detail || (value === true ? 'Check Passed' : 'Check Failed');
        const statusClass = `status-${status}`;
        
        const item = document.createElement('div');
        item.className = `comp-item`;
        item.innerHTML = `
            <div class="comp-dot ${statusClass}"></div>
            <div class="comp-info">
                <div class="comp-name" style="color: ${status === 'ok' ? 'var(--c-safe)' : (status === 'danger' ? 'var(--c-critical)' : 'var(--c-warning)')}">
                    ${key.replace(/_/g, ' ')}
                </div>
                <div class="comp-desc">${desc}</div>
            </div>
        `;
        panel.appendChild(item);
        
        gsap.from(item, {
            opacity: 0,
            y: 15,
            duration: 0.4,
            delay: delay,
            ease: "back.out(1.5)"
        });
        delay += 0.08;
    }
}