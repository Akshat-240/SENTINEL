// report.js - SENTINEL Reports Module Redesign

let scoreChartInstance = null;
let binaryInterval = null;

document.addEventListener('DOMContentLoaded', () => {
    initZoneSelector();

    document.getElementById('report-zone-select').addEventListener('change', (e) => {
        const zoneId = e.target.value;
        if (zoneId) {
            loadEvidenceLog(zoneId);
        } else {
            document.getElementById('evidence-log').innerHTML = '<div class="loading-state">AWAITING ZONE SELECTION...</div>';
        }
    });

    document.getElementById('btn-generate').addEventListener('click', generateReport);
});

async function initZoneSelector() {
    try {
        const response = await fetch('/api/dashboard/config');
        if (!response.ok) throw new Error('Failed to fetch config');
        const data = await response.json();
        
        const select = document.getElementById('report-zone-select');
        select.innerHTML = '<option value="">SELECT TARGET ZONE...</option>';
        
        // The API returns an array directly
        data.forEach(zone => {
            const option = document.createElement('option');
            option.value = zone.zone_id;
            option.textContent = `${zone.name} (${zone.zone_id})`;
            select.appendChild(option);
        });

        if (data.length > 0) {
            select.value = data[0].zone_id;
            loadEvidenceLog(data[0].zone_id);
        }
    } catch (error) {
        console.error('Error initializing zone selector:', error);
        document.getElementById('report-zone-select').innerHTML = '<option value="">ERROR LOADING ZONES</option>';
    }
}

async function loadEvidenceLog(zoneId) {
    const evidenceContainer = document.getElementById('evidence-log');
    evidenceContainer.innerHTML = '<div class="loading-state"><div class="spinner"></div> FETCHING EVIDENCE...</div>';

    try {
        const response = await fetch(`/api/report/evidence/${zoneId}`);
        if (!response.ok) throw new Error('Failed to fetch evidence');
        const evidenceData = await response.json();
        
        evidenceContainer.innerHTML = '';
        if (!evidenceData || evidenceData.length === 0) {
            evidenceContainer.innerHTML = '<div class="loading-state">NO EVIDENCE DETECTED IN SELECTED ZONE.</div>';
            return;
        }

        evidenceData.forEach(item => {
            const severity = item.severity || 'low';
            const el = document.createElement('div');
            el.className = `ev-item`;
            el.innerHTML = `
                <div class="ev-header">
                    <span class="ev-type" style="color: var(--c-${severity === 'critical' ? 'critical' : (severity === 'high' ? 'high' : 'cyan')})">${item.event_type}</span>
                    <span class="ev-time">${new Date(item.timestamp).toLocaleTimeString()}</span>
                </div>
                <div class="ev-details">
                    <span>SEVERITY: ${severity.toUpperCase()}</span>
                    <span>BONUS: ${item.compound_bonus || 0}</span>
                </div>
            `;
            evidenceContainer.appendChild(el);
        });
    } catch (error) {
        console.error('Error loading evidence:', error);
        evidenceContainer.innerHTML = '<div class="loading-state">ERROR RETRIEVING EVIDENCE DATA.</div>';
    }
}

async function generateReport() {
    const zoneId = document.getElementById('report-zone-select').value;
    if (!zoneId) {
        alert('Please select a zone first.');
        return;
    }

    const bentoGrid = document.getElementById('report-bento');
    const overlay = document.getElementById('loading-sequence');
    const progressFill = document.getElementById('loader-progress');
    const statusText = document.getElementById('loader-status');
    const binaryStream = document.getElementById('binary-stream');
    
    // Reset state
    bentoGrid.classList.add('hidden');
    overlay.classList.remove('hidden');
    gsap.set('.bento-box', { opacity: 0, y: 30, scale: 0.95 });
    
    // Start binary stream effect
    startBinaryStream(binaryStream);

    // Simulate GSAP Loading Sequence
    const tl = gsap.timeline();
    
    tl.to(progressFill, { width: '30%', duration: 0.8, ease: "power1.inOut", onStart: () => statusText.textContent = "ESTABLISHING UPLINK..." })
      .to(progressFill, { width: '60%', duration: 1.2, ease: "power2.inOut", onStart: () => statusText.textContent = "EXTRACTING SENSOR DATA..." })
      .to(progressFill, { width: '85%', duration: 1.0, ease: "power1.inOut", onStart: () => statusText.textContent = "ANALYZING THREAT VECTORS..." });

    try {
        const response = await fetch('/api/report/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ zone_id: zoneId })
        });
        
        if (!response.ok) throw new Error('Failed to generate report');
        const reportData = await response.json();
        
        // Finish loading
        tl.to(progressFill, { width: '100%', duration: 0.5, ease: "power2.out", onStart: () => statusText.textContent = "REPORT COMPILED." })
          .to(overlay, { opacity: 0, duration: 0.5, delay: 0.3, onComplete: () => {
              overlay.classList.add('hidden');
              overlay.style.opacity = 1;
              progressFill.style.width = '0%';
              stopBinaryStream();
              
              renderReport(reportData);
              bentoGrid.classList.remove('hidden');
              
              // Animate Bento Boxes in
              gsap.to('.bento-box', {
                  opacity: 1, 
                  y: 0, 
                  scale: 1, 
                  duration: 0.6, 
                  stagger: 0.1, 
                  ease: "back.out(1.2)"
              });
              
              // Animate factor bars
              setTimeout(() => {
                  document.querySelectorAll('.factor-bar-fill').forEach(bar => {
                      gsap.to(bar, { width: bar.dataset.targetWidth, duration: 1, ease: "power3.out" });
                  });
              }, 500);
          }});

    } catch (error) {
        console.error('Error generating report:', error);
        stopBinaryStream();
        overlay.classList.add('hidden');
        alert('Failed to generate report. System error.');
    }
}

function startBinaryStream(el) {
    el.innerHTML = '';
    binaryInterval = setInterval(() => {
        let text = '';
        for(let i=0; i<15; i++) {
            text += Math.random().toString(2).substr(2, 32) + '<br>';
        }
        el.innerHTML = text;
    }, 50);
}

function stopBinaryStream() {
    if(binaryInterval) {
        clearInterval(binaryInterval);
        binaryInterval = null;
    }
}

function renderReport(data) {
    // Determine overall risk class
    const alertLevel = getAlertLevel(data.score);
    const riskClass = getRiskClass(data.score);

    // Apply global glows
    const allBoxes = document.querySelectorAll('.bento-box');
    allBoxes.forEach(box => {
        box.className = `bento-box ${box.id.replace('b-', 'bento-')} risk-${riskClass}`;
    });

    // Overview
    document.getElementById('r-zone-name').textContent = `ZONE ${data.zone_id}`;
    document.getElementById('r-zone-id').textContent = data.zone_id;
    const rAlert = document.getElementById('r-alert-level');
    rAlert.textContent = alertLevel;
    rAlert.className = `alert-value risk-${riskClass}`;
    
    // Sensor Snapshot
    if (data.sensor_snapshot) {
        document.getElementById('r-gas').textContent = data.sensor_snapshot.gas_ppm || 0;
        document.getElementById('r-temp').textContent = data.sensor_snapshot.temperature || 0;
        document.getElementById('r-workers').textContent = data.sensor_snapshot.worker_count || 0;
    }

    // Score Chart
    document.getElementById('r-score').textContent = data.score;
    renderScoreChart(data.score, riskClass);

    // Risk Factors
    const factorsContainer = document.getElementById('r-risk-factors');
    factorsContainer.innerHTML = '';
    if (data.risk_factors && data.risk_factors.base_scores) {
        for (const [riskType, score] of Object.entries(data.risk_factors.base_scores)) {
            const width = Math.min((score / 100) * 100, 100);
            const color = getColorForScore(score);
            factorsContainer.innerHTML += `
                <div class="factor-item">
                    <div class="factor-header">
                        <span>${riskType.toUpperCase().replace('_', ' ')}</span>
                        <span style="color:${color}">${Math.round(score)}</span>
                    </div>
                    <div class="factor-bar-bg">
                        <div class="factor-bar-fill" data-target-width="${width}%" style="background: ${color};"></div>
                    </div>
                </div>
            `;
        }
    } else {
        factorsContainer.innerHTML = '<div class="loading-state">NO THREAT VECTORS DETECTED.</div>';
    }

    // Compound Risks
    const compoundContainer = document.getElementById('r-compound-risks');
    compoundContainer.innerHTML = '';
    if (data.compound_risks && data.compound_risks.combinations_detected && data.compound_risks.combinations_detected.length > 0) {
        data.compound_risks.combinations_detected.forEach(risk => {
            compoundContainer.innerHTML += `<li>${risk}</li>`;
        });
    } else {
        compoundContainer.innerHTML = '<div class="loading-state" style="padding: 10px;">NO COMPOUND ANOMALIES.</div>';
    }

    // Timeline
    const timelineContainer = document.getElementById('r-timeline');
    timelineContainer.innerHTML = '';
    if (data.timeline && data.timeline.length > 0) {
        data.timeline.forEach(event => {
            const sevClass = event.severity === 'critical' ? 'sev-critical' : (event.severity === 'high' ? 'sev-high' : 'sev-warning');
            timelineContainer.innerHTML += `
                <div class="timeline-node ${sevClass}">
                    <div class="tl-time">${new Date(event.timestamp).toLocaleTimeString()}</div>
                    <div class="tl-desc">${event.description || event.event_type}</div>
                </div>
            `;
        });
    } else {
        timelineContainer.innerHTML = '<div class="loading-state">TIMELINE EMPTY.</div>';
    }

    // Recommendations
    const recsContainer = document.getElementById('r-recommendations');
    recsContainer.innerHTML = '';
    if (data.recommendations && data.recommendations.length > 0) {
        data.recommendations.forEach(rec => {
            recsContainer.innerHTML += `<li>${rec}</li>`;
        });
    } else {
        recsContainer.innerHTML = '<div class="loading-state">NO SYSTEM RECOMMENDATIONS.</div>';
    }
}

function renderScoreChart(score, riskClass) {
    const ctx = document.getElementById('scoreChart').getContext('2d');
    const color = getHexFromRiskClass(riskClass);
    
    if (scoreChartInstance) {
        scoreChartInstance.destroy();
    }

    scoreChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            datasets: [{
                data: [score, Math.max(0, 100 - score)],
                backgroundColor: [color, 'rgba(255, 255, 255, 0.05)'],
                borderWidth: 0,
                cutout: '82%'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { tooltip: { enabled: false }, legend: { display: false } },
            animation: { duration: 2000, easing: 'easeOutQuart' }
        }
    });
}

function getAlertLevel(score) {
    if (score >= 80) return 'CRITICAL';
    if (score >= 50) return 'HIGH';
    if (score >= 20) return 'ELEVATED';
    return 'NOMINAL';
}

function getRiskClass(score) {
    if (score >= 80) return 'critical';
    if (score >= 50) return 'high';
    if (score >= 20) return 'warning';
    return 'nominal';
}

function getColorForScore(score) {
    if (score >= 80) return 'var(--c-critical)';
    if (score >= 50) return 'var(--c-high)';
    if (score >= 20) return 'var(--c-warning)';
    return 'var(--c-safe)';
}

function getHexFromRiskClass(rc) {
    if (rc === 'critical') return '#ff0000';
    if (rc === 'high') return '#ff4444';
    if (rc === 'warning') return '#ff8c00';
    return '#00ff88';
}