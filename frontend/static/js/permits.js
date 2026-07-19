// permits.js
document.addEventListener('DOMContentLoaded', () => {
    let currentZone = null;
    let riskChart = null;

    const zoneSelect = document.getElementById('permits-zone-select');
    const permitsList = document.getElementById('active-permits-list');
    const compliancePanel = document.getElementById('compliance-status-panel');
    const permitForm = document.getElementById('permit-checker-form');
    const permitTypeInput = document.getElementById('permit-type-input');
    const permitResult = document.getElementById('permit-result');
    const gaugeScore = document.getElementById('gauge-score');
    const gaugeStatus = document.getElementById('gauge-status');
    const screenFlash = document.getElementById('screen-flash');

    // Setup Chart.js Gauge
    function initChart() {
        const ctx = document.getElementById('risk-gauge-canvas').getContext('2d');
        
        Chart.defaults.color = '#fff';
        Chart.defaults.font.family = "'Share Tech Mono', monospace";

        riskChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                datasets: [{
                    data: [0, 100],
                    backgroundColor: ['#00f0ff', 'rgba(255, 255, 255, 0.05)'],
                    borderWidth: 0,
                    circumference: 240,
                    rotation: 240,
                    borderRadius: 5,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '85%',
                plugins: {
                    tooltip: { enabled: false },
                    legend: { display: false }
                },
                animation: {
                    animateRotate: true,
                    animateScale: true,
                    duration: 1500,
                    easing: 'easeOutQuart'
                }
            }
        });
    }

    // Fetch Initial Data
    async function init() {
        initChart();
        try {
            const configRes = await fetch('/api/dashboard/config');
            if (configRes.ok) {
                const config = await configRes.json();
                populateZoneSelector(config.zones || []);
                if (config.zones && config.zones.length > 0) {
                    currentZone = config.zones[0].id || config.zones[0];
                    zoneSelect.value = currentZone;
                    updateZoneData();
                }
            }
        } catch (error) {
            console.error('Error loading config:', error);
        }
    }

    function populateZoneSelector(zones) {
        zoneSelect.innerHTML = '<option value="">SELECT SECURE ZONE...</option>';
        zones.forEach(zone => {
            const zId = typeof zone === 'string' ? zone : zone.id;
            const zName = typeof zone === 'string' ? zone : zone.name;
            const option = document.createElement('option');
            option.value = zId;
            option.textContent = `ZONE: ${zName || zId}`;
            zoneSelect.appendChild(option);
        });
    }

    zoneSelect.addEventListener('change', (e) => {
        currentZone = e.target.value;
        updateZoneData();
    });

    async function updateZoneData() {
        if (!currentZone) return;
        
        // Reset checker
        permitResult.innerHTML = '';
        permitResult.classList.add('hidden');

        try {
            // Fetch Zone Risk
            const zonesRes = await fetch('/api/dashboard/zones');
            if (zonesRes.ok) {
                const zones = await zonesRes.json();
                const zoneData = zones.find(z => z.zone_id === currentZone);
                if (zoneData) {
                    updateGauge(zoneData.final_score, zoneData.alert_level);
                }
            }

            // Fetch Active Permits
            const permitsRes = await fetch(`/api/permits/active/${currentZone}`);
            if (permitsRes.ok) {
                const permits = await permitsRes.json();
                renderActivePermits(permits);
            } else {
                renderActivePermits([]);
            }

            // Fetch Compliance Status
            const compRes = await fetch(`/api/permits/compliance/${currentZone}`);
            if (compRes.ok) {
                const compliance = await compRes.json();
                renderCompliance(compliance);
            } else {
                renderCompliance([]);
            }
        } catch (error) {
            console.error('Error fetching zone data:', error);
        }
    }

    function updateGauge(score, alertLevel) {
        let color = '#00f0ff'; // Cyan
        let shadowColor = 'rgba(0, 240, 255, 0.5)';
        let statusText = 'SECURE';

        if (score > 40) {
            color = '#ffcc00'; // Yellow
            shadowColor = 'rgba(255, 204, 0, 0.5)';
            statusText = 'ELEVATED';
        }
        if (score > 70) {
            color = '#ff0033'; // Red
            shadowColor = 'rgba(255, 0, 51, 0.5)';
            statusText = 'CRITICAL';
        }
        
        // Update Chart
        riskChart.data.datasets[0].data = [score, 100 - score];
        riskChart.data.datasets[0].backgroundColor = [color, 'rgba(255, 255, 255, 0.05)'];
        riskChart.update();
        
        // Animate Score Counter
        if (window.gsap) {
            gsap.to(gaugeScore, {
                innerHTML: Math.round(score),
                duration: 1.5,
                snap: { innerHTML: 1 },
                onUpdate: function() {
                    gaugeScore.style.color = color;
                    gaugeScore.style.textShadow = `0 0 20px ${shadowColor}`;
                }
            });
            
            // Pulse ring color
            const ring = document.querySelector('.pulse-ring circle');
            if(ring) {
                gsap.to(ring, {stroke: color, duration: 1});
            }
        } else {
            gaugeScore.textContent = Math.round(score);
            gaugeScore.style.color = color;
            gaugeScore.style.textShadow = `0 0 20px ${shadowColor}`;
        }

        gaugeStatus.textContent = statusText;
        gaugeStatus.style.color = color;
        gaugeStatus.style.borderColor = color;
    }

    function renderActivePermits(permits) {
        permitsList.innerHTML = '';
        if (!permits || permits.length === 0) {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td colspan="4" style="text-align:center; color:#666; padding: 20px;">NO ACTIVE CLEARANCES DETECTED</td>`;
            permitsList.appendChild(tr);
            return;
        }

        permits.forEach((p, i) => {
            const tr = document.createElement('tr');
            
            let statusClass = 'active';
            if (p.status === 'EXPIRED') statusClass = 'expired';
            else if (p.status === 'REVOKED') statusClass = 'revoked';
            
            const dateStr = new Date(p.created_at).toLocaleString();

            tr.innerHTML = `
                <td style="font-weight:bold; color:var(--c-cyan)">${p.type}</td>
                <td>
                    <div>ID: ${p.permit_id || p.id}</div>
                    <div style="font-size:0.8rem; color:#888;">USR: ${p.worker_id}</div>
                </td>
                <td style="font-size:0.85rem; color:#ccc;">${dateStr}</td>
                <td><span class="badge ${statusClass}">${p.status}</span></td>
            `;
            permitsList.appendChild(tr);
            
            if (window.gsap) {
                gsap.from(tr, {x: 50, opacity: 0, duration: 0.4, delay: i * 0.05, ease: "power2.out"});
            }
        });
    }

    function renderCompliance(complianceItems) {
        compliancePanel.innerHTML = '';
        
        const items = Array.isArray(complianceItems) ? complianceItems : 
                     (complianceItems.checks || Object.values(complianceItems || {}));
                     
        if (!items || items.length === 0) {
            compliancePanel.innerHTML = '<div style="color:#666; padding:10px;">NO COMPLIANCE DATA FOUND</div>';
            return;
        }

        items.forEach((item, i) => {
            const div = document.createElement('div');
            div.className = 'compliance-item';
            
            const isPass = item.passed || item.status === 'OK' || item.status === true;
            const color = isPass ? '#00ff00' : '#ff0033';
            const icon = isPass ? '✓' : '✗';
            const statusText = isPass ? 'VERIFIED' : 'FAILED';
            const label = item.name || item.check || 'System Check';
            
            div.innerHTML = `
                <div class="comp-icon" style="background: ${color}22; color: ${color}; border: 1px solid ${color};">
                    ${icon}
                </div>
                <div class="comp-text" style="color: #eee;">${label}</div>
                <div class="comp-status" style="color: ${color}; background: ${color}11;">${statusText}</div>
            `;
            compliancePanel.appendChild(div);
            
            if (window.gsap) {
                gsap.from(div, {y: 20, opacity: 0, duration: 0.4, delay: i * 0.1, ease: "back.out(1.5)"});
            }
        });
    }

    function flashScreen(type) {
        if (!window.gsap) return;
        const color = type === 'approved' ? 'rgba(0, 255, 0, 0.3)' : 'rgba(255, 0, 51, 0.4)';
        screenFlash.style.backgroundColor = color;
        gsap.fromTo(screenFlash, 
            {opacity: 1}, 
            {opacity: 0, duration: 0.8, ease: "power2.out"}
        );
    }

    // Permit Checker Form Submit
    permitForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const type = permitTypeInput.value.trim().toUpperCase();
        if (!type || !currentZone) {
            alert('SYSTEM ERROR: SELECT ZONE AND INPUT AUTHORIZATION CODE.');
            return;
        }
        
        const btn = document.getElementById('btn-check-permit');
        const btnText = btn.querySelector('.button-text');
        btnText.textContent = 'VERIFYING...';
        btn.disabled = true;
        
        permitResult.classList.remove('hidden');
        permitResult.innerHTML = '<div style="color:var(--c-cyan); font-family:var(--f-mono);">[ ESTABLISHING SECURE CONNECTION ]<br/>> AWAITING CLEARANCE SERVER...</div>';

        try {
            // Simulated delay for dramatic effect
            await new Promise(r => setTimeout(r, 600));

            const res = await fetch('/api/permits/check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ permit_type: type, zone_id: currentZone })
            });
            
            const result = await res.json();
            
            const statusClass = result.approved ? 'approved' : 'rejected';
            const statusText = result.approved ? 'ACCESS GRANTED' : 'ACCESS DENIED';
            
            permitResult.innerHTML = `
                <div class="stamp ${statusClass}">
                    ${statusText}
                </div>
                <div class="stamp-details">
                    ${result.reason ? `REASON: ${result.reason} | ` : ''}
                    RISK LVL: ${result.risk_level || 'N/A'}
                </div>
            `;
            
            flashScreen(statusClass);

            // Stamp Animation
            if (window.gsap) {
                const stamp = permitResult.querySelector('.stamp');
                const details = permitResult.querySelector('.stamp-details');
                
                gsap.fromTo(stamp, 
                    {scale: 5, opacity: 0, rotation: -20}, 
                    {scale: 1, opacity: 1, rotation: -10, duration: 0.4, ease: "bounce.out"}
                );
                gsap.fromTo(details, {opacity: 0, y: 10}, {opacity: 1, y: 0, duration: 0.5, delay: 0.4});
            }

        } catch (error) {
            console.error('Error checking permit:', error);
            permitResult.innerHTML = `
                <div class="stamp rejected" style="font-size: 1.5rem;">
                    SYS_ERR: CONNECTION LOST
                </div>
            `;
            flashScreen('rejected');
            if (window.gsap) {
                gsap.fromTo(permitResult.querySelector('.stamp'), 
                    {scale: 3, opacity: 0}, {scale: 1, opacity: 1, duration: 0.4, ease: "bounce.out"});
            }
        } finally {
            btnText.textContent = 'REQUEST CLEARANCE';
            btn.disabled = false;
        }
    });

    init();
});