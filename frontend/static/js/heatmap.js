/* ============================================================
   SENTINEL — ISOMETRIC 3D HEATMAP ENGINE
   Matches reference: isometric factory, glowing heat zones,
   machinery silhouettes, cyan workers, neon borders.
   ALL data from API — zero hardcoded risk values.
   ============================================================ */

(function () {
  'use strict';

  // ── STATE ─────────────────────────────────────────────────
  let scene, camera, renderer, clock;
  let raycaster, mouse;
  let isDragging = false, prevMouse = { x: 0, y: 0 };
  let cameraAngleH = 0, cameraAngleV = 0.6;
  let cameraRadius = 80;
  let zoneObjects  = {};   // zone_id → { mesh, heatMesh, label, workers: [], lights: [] }
  let zonesData    = [];
  let configData   = [];
  let zoneNames    = {};   // zone_id → name
  let trendCharts  = {};
  let selectedZone = null;
  let animFrame;
  let particles    = [];

  // Factory floor layout — positions assigned from config index, sizes from area_sqm
  // These are 3D positions on the floor, NOT lat/lng — never hardcoded data values
  const FLOOR_LAYOUT = [
    { col: 0, row: 0 }, // index 0
    { col: 1, row: 0 }, // index 1
    { col: 0, row: 1 }, // index 2
    { col: 2, row: 0 }, // index 3
    { col: 1, row: 1 }, // index 4
    { col: 2, row: 1 }, // index 5
  ];
  const CELL_SIZE = 28;   // world units per grid cell
  const FLOOR_W   = 3;    // cols
  const FLOOR_H   = 2;    // rows

  // ── COLOR: purely from score, never hardcoded data ────────
  function scoreColor(score) {
    if (score <= 40) return { hex: 0x00ff88, css: '#00ff88', r: 0,   g: 255, b: 136 };
    if (score <= 60) return { hex: 0xffd700, css: '#ffd700', r: 255, g: 215, b: 0   };
    if (score <= 75) return { hex: 0xff8c00, css: '#ff8c00', r: 255, g: 140, b: 0   };
    if (score <= 85) return { hex: 0xff4444, css: '#ff4444', r: 255, g: 68,  b: 68  };
    return               { hex: 0xff0000, css: '#ff0000', r: 255, g: 0,   b: 0   };
  }

  // ── FETCH ─────────────────────────────────────────────────
  async function safeFetch(url) {
    try { const r = await fetch(url); return r.ok ? r.json() : null; } catch { return null; }
  }

  async function loadData() {
    const [cfg, zones] = await Promise.all([
      safeFetch('/api/dashboard/config'),
      safeFetch('/api/dashboard/zones'),
    ]);
    if (cfg)   { configData = cfg; cfg.forEach(z => { zoneNames[z.zone_id] = z.name; }); }
    if (zones) { zonesData = zones; }
    populateZoneSelector();
  }

  function populateZoneSelector() {
    const sel = document.getElementById('zone-selector');
    if (!sel) return;
    sel.innerHTML = '<option value="">All Zones</option>';
    configData.forEach(z => {
      const opt = document.createElement('option');
      opt.value   = z.zone_id;
      opt.textContent = z.name || z.zone_id;
      sel.appendChild(opt);
    });
    sel.addEventListener('change', e => focusZone(e.target.value));
  }

  // ── THREE.JS INIT ─────────────────────────────────────────
  function initThree() {
    const canvas  = document.getElementById('factory-canvas');
    const wrapper = document.querySelector('.canvas-wrapper');
    if (!canvas || !wrapper) return;

    clock = new THREE.Clock();

    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020210);
    scene.fog = new THREE.Fog(0x020210, 200, 400);

    // Isometric-style orthographic camera
    const aspect = wrapper.clientWidth / wrapper.clientHeight;
    const d = 45;
    camera = new THREE.OrthographicCamera(-d * aspect, d * aspect, d, -d, 0.1, 1000);
    updateCamera();

    // Renderer
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setSize(wrapper.clientWidth, wrapper.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Lighting
    const ambient = new THREE.AmbientLight(0x111133, 1.5);
    scene.add(ambient);

    const sun = new THREE.DirectionalLight(0x6688aa, 0.8);
    sun.position.set(80, 100, 60);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 0.1;
    sun.shadow.camera.far  = 500;
    sun.shadow.camera.left = -100;
    sun.shadow.camera.right = 100;
    sun.shadow.camera.top  = 100;
    sun.shadow.camera.bottom = -100;
    scene.add(sun);

    const fill = new THREE.DirectionalLight(0x003355, 0.4);
    fill.position.set(-80, 50, -60);
    scene.add(fill);

    // Raycaster
    raycaster = new THREE.Raycaster();
    mouse     = new THREE.Vector2();

    // Build the factory scene
    buildFactoryFloor();
    buildZones();
    buildSparks();

    // Events
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup',   () => isDragging = false);
    canvas.addEventListener('wheel',     onWheel, { passive: true });
    canvas.addEventListener('click',     onCanvasClick);
    window.addEventListener('resize',    onResize);

    animate();
  }

  // ── CAMERA ────────────────────────────────────────────────
  function updateCamera() {
    // True isometric position: 45° horizontal, ~35° vertical
    const x = cameraRadius * Math.sin(cameraAngleH) * Math.cos(cameraAngleV);
    const y = cameraRadius * Math.sin(cameraAngleV);
    const z = cameraRadius * Math.cos(cameraAngleH) * Math.cos(cameraAngleV);
    camera.position.set(x + 35, y, z + 20);
    camera.lookAt(35, 0, 20);
    camera.updateProjectionMatrix();
  }

  function onMouseDown(e) {
    isDragging = true;
    prevMouse  = { x: e.clientX, y: e.clientY };
  }
  function onMouseMove(e) {
    if (!isDragging) return;
    const dx = (e.clientX - prevMouse.x) * 0.005;
    const dy = (e.clientY - prevMouse.y) * 0.005;
    cameraAngleH -= dx;
    cameraAngleV  = Math.max(0.2, Math.min(1.2, cameraAngleV + dy));
    prevMouse = { x: e.clientX, y: e.clientY };
    updateCamera();
  }
  function onWheel(e) {
    cameraRadius = Math.max(50, Math.min(250, cameraRadius + e.deltaY * 0.3));
    const wrapper = document.querySelector('.canvas-wrapper');
    if (wrapper) {
      const aspect = wrapper.clientWidth / wrapper.clientHeight;
      const d = cameraRadius * 0.55;
      camera.left   = -d * aspect; camera.right = d * aspect;
      camera.top    =  d;          camera.bottom = -d;
    }
    camera.updateProjectionMatrix();
  }
  function onResize() {
    const wrapper = document.querySelector('.canvas-wrapper');
    if (!wrapper || !renderer) return;
    const w = wrapper.clientWidth, h = wrapper.clientHeight;
    renderer.setSize(w, h);
    const aspect = w / h, d = cameraRadius * 0.55;
    camera.left = -d * aspect; camera.right = d * aspect;
    camera.top  = d;           camera.bottom = -d;
    camera.updateProjectionMatrix();
  }

  // ── FACTORY FLOOR ─────────────────────────────────────────
  function buildFactoryFloor() {
    const fw = FLOOR_W * CELL_SIZE;
    const fh = FLOOR_H * CELL_SIZE;

    // Floor plane
    const floorGeo  = new THREE.PlaneGeometry(fw, fh);
    const floorMat  = new THREE.MeshLambertMaterial({ color: 0x1a1a2e, side: THREE.FrontSide });
    const floor     = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(fw / 2 - CELL_SIZE / 2, -0.01, fh / 2 - CELL_SIZE / 2);
    floor.receiveShadow = true;
    scene.add(floor);

    // Neon floor grid
    const gridMat = new THREE.LineBasicMaterial({ color: 0x2a2a4a, linewidth: 1 });
    for (let i = 0; i <= FLOOR_W; i++) {
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(i * CELL_SIZE - CELL_SIZE / 2, 0.01, -CELL_SIZE / 2),
        new THREE.Vector3(i * CELL_SIZE - CELL_SIZE / 2, 0.01, FLOOR_H * CELL_SIZE - CELL_SIZE / 2),
      ]);
      scene.add(new THREE.Line(geo, gridMat));
    }
    for (let j = 0; j <= FLOOR_H; j++) {
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-CELL_SIZE / 2, 0.01, j * CELL_SIZE - CELL_SIZE / 2),
        new THREE.Vector3(FLOOR_W * CELL_SIZE - CELL_SIZE / 2, 0.01, j * CELL_SIZE - CELL_SIZE / 2),
      ]);
      scene.add(new THREE.Line(geo, gridMat));
    }

    // Factory outer boundary — neon cyan wireframe
    const borderPts = [
      new THREE.Vector3(-CELL_SIZE / 2, 0.05, -CELL_SIZE / 2),
      new THREE.Vector3(FLOOR_W * CELL_SIZE - CELL_SIZE / 2, 0.05, -CELL_SIZE / 2),
      new THREE.Vector3(FLOOR_W * CELL_SIZE - CELL_SIZE / 2, 0.05, FLOOR_H * CELL_SIZE - CELL_SIZE / 2),
      new THREE.Vector3(-CELL_SIZE / 2, 0.05, FLOOR_H * CELL_SIZE - CELL_SIZE / 2),
      new THREE.Vector3(-CELL_SIZE / 2, 0.05, -CELL_SIZE / 2),
    ];
    const borderGeo = new THREE.BufferGeometry().setFromPoints(borderPts);
    const borderMat = new THREE.LineBasicMaterial({ color: 0x00d4ff, linewidth: 2 });
    const border    = new THREE.Line(borderGeo, borderMat);
    scene.add(border);

    // Wall height wireframe
    const wallH = 8;
    [[-CELL_SIZE/2,-CELL_SIZE/2],[FLOOR_W*CELL_SIZE-CELL_SIZE/2,-CELL_SIZE/2],[FLOOR_W*CELL_SIZE-CELL_SIZE/2,FLOOR_H*CELL_SIZE-CELL_SIZE/2],[-CELL_SIZE/2,FLOOR_H*CELL_SIZE-CELL_SIZE/2]].forEach(([x,z]) => {
      const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x,0.05,z), new THREE.Vector3(x,wallH,z)]);
      scene.add(new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0x003355 })));
    });

    // Cross-beams
    const beamMat = new THREE.LineBasicMaterial({ color: 0x001122 });
    for (let i = 0; i <= FLOOR_W; i++) {
      const g = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(i*CELL_SIZE-CELL_SIZE/2, wallH, -CELL_SIZE/2),
        new THREE.Vector3(i*CELL_SIZE-CELL_SIZE/2, wallH, FLOOR_H*CELL_SIZE-CELL_SIZE/2),
      ]);
      scene.add(new THREE.Line(g, beamMat));
    }
  }

  // ── ZONE BUILDINGS ────────────────────────────────────────
  function buildZones() {
    configData.forEach((cfg, idx) => {
      const layout  = FLOOR_LAYOUT[idx] || { col: idx % 3, row: Math.floor(idx / 3) };
      const cx      = layout.col * CELL_SIZE;
      const cz      = layout.row * CELL_SIZE;
      const zoneScore = getZoneScore(cfg.zone_id);
      const color     = scoreColor(zoneScore);

      // Zone group
      const group = new THREE.Group();
      group.position.set(cx, 0, cz);
      group.userData = { zone_id: cfg.zone_id, name: cfg.name || cfg.zone_id };
      scene.add(group);

      // Floor marker — colored plane on the ground
      const markerSize = Math.max(CELL_SIZE * 0.6, Math.min(CELL_SIZE * 0.85, Math.sqrt(cfg.area_sqm || 10000) / 4));
      const markerGeo  = new THREE.PlaneGeometry(markerSize, markerSize);
      const markerMat  = new THREE.MeshBasicMaterial({
        color: color.hex, transparent: true, opacity: 0.07, side: THREE.FrontSide
      });
      const marker = new THREE.Mesh(markerGeo, markerMat);
      marker.rotation.x = -Math.PI / 2;
      marker.position.y = 0.02;
      group.add(marker);

      // Zone boundary outline
      const hs = markerSize / 2;
      const outPts = [
        new THREE.Vector3(-hs,0.03,-hs), new THREE.Vector3(hs,0.03,-hs),
        new THREE.Vector3(hs,0.03,hs),   new THREE.Vector3(-hs,0.03,hs),
        new THREE.Vector3(-hs,0.03,-hs),
      ];
      const outGeo = new THREE.BufferGeometry().setFromPoints(outPts);
      const outMat = new THREE.LineBasicMaterial({ color: color.hex, linewidth: 2 });
      group.add(new THREE.Line(outGeo, outMat));

      // MACHINERY — varies by hazard type from config
      buildMachinery(group, cfg.hazard_type || 'GAS', color, markerSize);

      // HEAT GLOW — point light + radial plane, driven by score
      const heatLight = new THREE.PointLight(color.hex, 0, 35);
      heatLight.position.set(0, 3, 0);
      group.add(heatLight);

      // Radial heat plane (glowing halo on floor)
      const heatGeo = new THREE.CircleGeometry(markerSize * 0.5, 32);
      const heatMat = new THREE.MeshBasicMaterial({
        color: color.hex, transparent: true, opacity: 0, side: THREE.FrontSide
      });
      const heatPlane = new THREE.Mesh(heatGeo, heatMat);
      heatPlane.rotation.x = -Math.PI / 2;
      heatPlane.position.y = 0.04;
      group.add(heatPlane);

      // WORKERS — cyan capsules, count from snapshot
      const workerCount = getWorkerCount(cfg.zone_id);
      const workerMeshes = buildWorkers(group, markerSize, workerCount);

      // HTML LABEL
      const labelDiv = buildLabel(cfg.zone_id, cfg.name || cfg.zone_id, zoneScore, color.css);

      zoneObjects[cfg.zone_id] = {
        group, marker, heatPlane, heatLight, markerMat, outMat,
        workers: workerMeshes, label: labelDiv,
        score: zoneScore, color,
      };

      // Apply initial glow
      applyZoneGlow(cfg.zone_id, zoneScore);
      updateLabelPosition(cfg.zone_id);
    });
  }

  function buildMachinery(group, hazardType, color, zoneSize) {
    const darkMat  = new THREE.MeshPhongMaterial({ color: 0x0a0a1a, shininess: 60, specular: 0x003366 });
    const accentMat = new THREE.MeshPhongMaterial({ color: color.hex, shininess: 80, specular: 0x222222, emissive: color.hex, emissiveIntensity: 0.05 });
    const pipeMat  = new THREE.MeshPhongMaterial({ color: 0x111133, shininess: 30 });

    const h = zoneSize / 2 * 0.7;

    if (hazardType === 'GAS' || hazardType === 'CHEMICAL') {
      // Cylindrical tanks
      const tankGeo = new THREE.CylinderGeometry(1.8, 2.0, 5.5, 12);
      const tank1 = new THREE.Mesh(tankGeo, darkMat);
      tank1.position.set(-h * 0.4, 2.75, -h * 0.3);
      tank1.castShadow = true;
      group.add(tank1);

      const tank2 = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.4, 4, 10), darkMat);
      tank2.position.set(-h * 0.4 + 5, 2, -h * 0.3 + 2);
      tank2.castShadow = true;
      group.add(tank2);

      // Connecting pipe
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 5.5, 8), pipeMat);
      pipe.rotation.z = Math.PI / 2;
      pipe.position.set(-h * 0.4 + 2.5, 4.5, -h * 0.3 + 1);
      group.add(pipe);

      // Accent top dome
      const dome = new THREE.Mesh(new THREE.SphereGeometry(1.8, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.5), accentMat);
      dome.position.set(-h * 0.4, 5.5, -h * 0.3);
      group.add(dome);

      // Control box
      const box = new THREE.Mesh(new THREE.BoxGeometry(3, 2.5, 2), darkMat);
      box.position.set(h * 0.3, 1.25, h * 0.2);
      box.castShadow = true;
      group.add(box);

    } else if (hazardType === 'HEAT') {
      // Blast furnace — tall cylinders + boxes
      const furnaceGeo = new THREE.CylinderGeometry(2.5, 3.0, 8, 10);
      const furnace = new THREE.Mesh(furnaceGeo, darkMat);
      furnace.position.set(0, 4, 0);
      furnace.castShadow = true;
      group.add(furnace);

      // Furnace top glow ring
      const ring = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.25, 8, 20), accentMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(0, 8, 0);
      group.add(ring);

      // Support structures
      [-4, 4].forEach(ox => {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.6, 4, 0.6), pipeMat);
        leg.position.set(ox, 2, 0);
        group.add(leg);
      });

      // Crane arm
      const arm = new THREE.Mesh(new THREE.BoxGeometry(9, 0.5, 0.5), pipeMat);
      arm.position.set(0, 9, 0);
      group.add(arm);
      const armV = new THREE.Mesh(new THREE.BoxGeometry(0.4, 5, 0.4), pipeMat);
      armV.position.set(4, 6.5, 0);
      group.add(armV);

    } else if (hazardType === 'ELECTRICAL') {
      // Control boxes + transformers
      const ctrl = new THREE.Mesh(new THREE.BoxGeometry(5, 3.5, 3), darkMat);
      ctrl.position.set(0, 1.75, 0);
      ctrl.castShadow = true;
      group.add(ctrl);

      // Screen/panel face
      const screen = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.8, 0.1), accentMat);
      screen.position.set(0, 1.75, 1.55);
      group.add(screen);

      // Transformer
      const xfm = new THREE.Mesh(new THREE.BoxGeometry(2.5, 3, 2), darkMat);
      xfm.position.set(h * 0.35, 1.5, -h * 0.3);
      xfm.castShadow = true;
      group.add(xfm);

      // Insulators
      [0.5, 1.5, 2.5].forEach(ox => {
        const ins = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 2, 6), pipeMat);
        ins.position.set(h * 0.35 - 1 + ox * 0.5, 4.5, -h * 0.3);
        group.add(ins);
      });

    } else {
      // Generic storage — stacked boxes
      for (let si = 0; si < 3; si++) {
        const bx = new THREE.Mesh(new THREE.BoxGeometry(3.5, 2, 4), darkMat);
        bx.position.set(-h * 0.2 + si * 0.3, si * 2.1 + 1, 0);
        bx.castShadow = true;
        group.add(bx);
      }
      const conveyor = new THREE.Mesh(new THREE.BoxGeometry(9, 0.4, 1.5), pipeMat);
      conveyor.position.set(h * 0.1, 0.2, h * 0.3);
      group.add(conveyor);
    }
  }

  function buildWorkers(group, zoneSize, count) {
    const workers = [];
    const cap = Math.min(count, 8);
    const cyanMat = new THREE.MeshPhongMaterial({ color: 0x00d4ff, emissive: 0x003366, emissiveIntensity: 0.5 });
    for (let i = 0; i < cap; i++) {
      const workerGroup = new THREE.Group();
      // Body
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.8, 6), cyanMat);
      body.position.y = 0.65;
      workerGroup.add(body);
      // Head
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), cyanMat);
      head.position.y = 1.15;
      workerGroup.add(head);
      // Helmet
      const helm = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.22, 0.15, 8), new THREE.MeshBasicMaterial({ color: 0xffcc00 }));
      helm.position.y = 1.27;
      workerGroup.add(helm);

      // Scatter within zone
      const angle = (i / cap) * Math.PI * 2 + Math.random() * 0.5;
      const r     = zoneSize * 0.28 + Math.random() * zoneSize * 0.05;
      workerGroup.position.set(Math.cos(angle) * r, 0, Math.sin(angle) * r);
      group.add(workerGroup);
      workers.push(workerGroup);
    }
    return workers;
  }

  function buildLabel(zone_id, name, score, colorCss) {
    const container = document.querySelector('.canvas-wrapper');
    if (!container) return null;
    const div = document.createElement('div');
    div.className = 'zone-label-3d';
    div.id        = `label-${zone_id}`;
    div.innerHTML = `
      <div class="zl-name">${name}</div>
      <div class="zl-score" style="color:${colorCss}">${Math.round(score)}</div>
    `;
    container.appendChild(div);
    return div;
  }

  // ── FLOATING SPARKS ───────────────────────────────────────
  function buildSparks() {
    // Ambient floating particle field across factory
    const geo = new THREE.BufferGeometry();
    const N   = 400;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      pos[i*3]   = Math.random() * FLOOR_W * CELL_SIZE - CELL_SIZE / 2;
      pos[i*3+1] = Math.random() * 12;
      pos[i*3+2] = Math.random() * FLOOR_H * CELL_SIZE - CELL_SIZE / 2;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: 0x00d4ff, size: 0.18, transparent: true, opacity: 0.4 });
    const pts = new THREE.Points(geo, mat);
    scene.add(pts);
    particles.push({ mesh: pts, velocities: Array.from({ length: N }, () => (Math.random() - 0.5) * 0.02) });
  }

  // ── GLOW UPDATER ─────────────────────────────────────────
  function applyZoneGlow(zone_id, score) {
    const obj   = zoneObjects[zone_id];
    if (!obj) return;
    const color = scoreColor(score);
    obj.score   = score;
    obj.color   = color;

    // Heat light intensity 0 (safe) → 3 (critical)
    const intensity = Math.max(0, (score - 40) / 60) * 3.5;
    obj.heatLight.color.set(color.hex);
    obj.heatLight.intensity = intensity;

    // Heat glow opacity on floor
    obj.heatPlane.material.color.set(color.hex);
    obj.heatPlane.material.opacity = Math.max(0, (score - 40) / 60) * 0.55;

    // Zone boundary color
    obj.outMat.color.set(color.hex);

    // Floor marker opacity
    obj.markerMat.color.set(color.hex);
    obj.markerMat.opacity = 0.04 + Math.max(0, (score - 40) / 60) * 0.2;

    // Label
    if (obj.label) {
      const scoreEl = obj.label.querySelector('.zl-score');
      if (scoreEl) { scoreEl.style.color = color.css; scoreEl.textContent = Math.round(score); }
    }

    // Critical pulse class
    if (score > 85) {
      obj.group.userData.critical = true;
    } else {
      obj.group.userData.critical = false;
    }
  }

  // ── LABEL POSITION ────────────────────────────────────────
  function updateLabelPosition(zone_id) {
    const obj = zoneObjects[zone_id];
    if (!obj || !obj.label || !renderer || !camera) return;
    const pos3d = new THREE.Vector3();
    obj.group.getWorldPosition(pos3d);
    pos3d.y += 12;

    const proj  = pos3d.clone().project(camera);
    const wrapper = document.querySelector('.canvas-wrapper');
    if (!wrapper) return;
    const rect  = wrapper.getBoundingClientRect();
    const x = (proj.x * 0.5 + 0.5) * rect.width;
    const y = (-(proj.y * 0.5) + 0.5) * rect.height;

    if (proj.z > 1) {
      obj.label.style.display = 'none'; return;
    }
    obj.label.style.display = 'block';
    obj.label.style.left    = x + 'px';
    obj.label.style.top     = y + 'px';
  }

  // ── HELPERS ───────────────────────────────────────────────
  function getZoneScore(zone_id) {
    const z = zonesData.find(z => z.zone_id === zone_id);
    return z ? (z.final_score || 0) : 0;
  }
  function getWorkerCount(zone_id) {
    const z = zonesData.find(z => z.zone_id === zone_id);
    return z?.snapshot?.worker_count ?? 0;
  }

  // ── RAYCASTING — CLICK ZONE ───────────────────────────────
  function onCanvasClick(e) {
    const wrapper = document.querySelector('.canvas-wrapper');
    if (!wrapper) return;
    const rect  = wrapper.getBoundingClientRect();
    mouse.x     =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
    mouse.y     = -((e.clientY - rect.top)  / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const meshes = Object.values(zoneObjects).map(o => o.marker);
    const hits   = raycaster.intersectObjects(meshes, false);

    if (hits.length > 0) {
      const hitMesh = hits[0].object;
      const zone_id = Object.entries(zoneObjects).find(([, o]) => o.marker === hitMesh)?.[0];
      if (zone_id) selectZone(zone_id);
    }
  }

  function selectZone(zone_id) {
    selectedZone = zone_id;
    const name = zoneNames[zone_id] || zone_id;
    showInfoOverlay(zone_id, name);

    // Highlight selected, dim others
    Object.entries(zoneObjects).forEach(([zid, obj]) => {
      const isSelected = zid === zone_id;
      obj.heatLight.intensity *= isSelected ? 1.5 : 0.5;
    });

    // Side panel selection
    document.querySelectorAll('.zone-item').forEach(el => el.classList.remove('selected'));
    const li = document.getElementById(`zitem-${zone_id}`);
    if (li) li.classList.add('selected');

    fetchTrend(zone_id);
  }

  function focusZone(zone_id) {
    if (zone_id) selectZone(zone_id);
  }

  // ── INFO OVERLAY ──────────────────────────────────────────
  async function showInfoOverlay(zone_id, name) {
    const overlay = document.getElementById('zone-info-overlay');
    if (!overlay) return;
    overlay.classList.remove('hidden');

    const scoreVal = getZoneScore(zone_id);
    const color    = scoreColor(scoreVal);

    document.getElementById('overlay-zone-id').textContent   = zone_id.toUpperCase();
    document.getElementById('overlay-zone-name').textContent  = name;
    const scoreEl = document.getElementById('overlay-score');
    if (scoreEl) { scoreEl.textContent = Math.round(scoreVal); scoreEl.style.color = color.css; }

    const trend = await safeFetch(`/api/risk/trend/${zone_id}`);
    if (trend) {
      const el = document.getElementById('overlay-gas');
      const te = document.getElementById('overlay-trend');
      const ce = document.getElementById('overlay-critical');
      if (el) el.textContent = `${Number(trend.current_gas_ppm).toFixed(1)} PPM`;
      if (te) { te.textContent = trend.trend || '--'; te.style.color = trend.trend === 'RISING' ? '#ff4444' : (trend.trend === 'FALLING' ? '#00d4ff' : '#00ff88'); }
      if (ce) ce.textContent = (trend.alert && trend.minutes_to_critical) ? `${trend.minutes_to_critical} min` : '—';
    }
  }

  // ── SIDE PANEL ───────────────────────────────────────────
  function renderSidePanel() {
    const list = document.getElementById('zone-list');
    if (!list) return;
    const sorted = [...zonesData].sort((a, b) => b.final_score - a.final_score);
    list.innerHTML = '';
    sorted.forEach(z => {
      const name  = zoneNames[z.zone_id] || z.zone_id;
      const color = scoreColor(z.final_score);
      const workers = z.snapshot?.worker_count ?? 0;
      const li = document.createElement('div');
      li.className = 'zone-item';
      li.id        = `zitem-${z.zone_id}`;
      li.style.borderLeftColor = color.css;
      li.innerHTML = `
        <div class="zi-row1">
          <span class="zi-name">${name}</span>
          <span class="zi-score" style="color:${color.css}">${Math.round(z.final_score)}</span>
        </div>
        <div class="zi-row2">
          <span class="zi-tag" style="color:${color.css}; border-color:${color.css}44;">${levelLabel(z.final_score)}</span>
          <span class="zi-workers">👷 ${workers}</span>
        </div>
        <div class="zi-bar-track"><div class="zi-bar-fill" style="width:${z.final_score}%; background:${color.css};"></div></div>
      `;
      li.addEventListener('click', () => selectZone(z.zone_id));
      list.appendChild(li);
    });
  }

  function levelLabel(score) {
    if (score <= 40) return 'NORMAL';
    if (score <= 60) return 'CAUTION';
    if (score <= 75) return 'WARNING';
    if (score <= 85) return 'HIGH RISK';
    return 'CRITICAL';
  }

  // ── TREND SPARKLINE ───────────────────────────────────────
  async function buildTrendStrip() {
    const strip = document.getElementById('trend-strip');
    if (!strip || !window.Chart) return;
    strip.innerHTML = '';

    for (const cfg of configData) {
      const trend = await safeFetch(`/api/risk/trend/${cfg.zone_id}`);
      if (!trend) continue;
      const score = getZoneScore(cfg.zone_id);
      const color = scoreColor(score);
      const slope = trend.slope || 0;
      const cur   = trend.current_gas_ppm || 0;
      const pts   = [0,1,2,3,4].map(i => Math.max(0, cur - slope * (4-i)));

      const item = document.createElement('div');
      item.className = 'trend-item';
      item.innerHTML = `
        <div class="trend-header">
          <span style="color:${color.css}; font-size:10px;">${cfg.name || cfg.zone_id}</span>
          <span style="color:${color.css}; font-size:11px; font-family:var(--f-mono);">${Math.round(cur)} PPM</span>
        </div>
        <div class="trend-chart-container"><canvas id="trend-${cfg.zone_id}"></canvas></div>
      `;
      strip.appendChild(item);

      const canvas = item.querySelector('canvas');
      const ctx    = canvas.getContext('2d');
      const grad   = ctx.createLinearGradient(0, 0, 0, 50);
      grad.addColorStop(0, color.css + '66');
      grad.addColorStop(1, color.css + '00');

      trendCharts[cfg.zone_id] = new Chart(ctx, {
        type: 'line',
        data: {
          labels: ['-2m','-1.5m','-1m','-30s','Now'],
          datasets: [{ data: pts, borderColor: color.css, backgroundColor: grad, borderWidth: 1.5, tension: 0.4, fill: true, pointRadius: 0 }]
        },
        options: {
          responsive: true, maintainAspectRatio: false, animation: false,
          scales: { x: { display: false }, y: { display: false } },
          plugins: { legend: { display: false } }
        }
      });
    }
  }

  async function fetchTrend(zone_id) {
    // Refresh that zone's sparkline
    const trend = await safeFetch(`/api/risk/trend/${zone_id}`);
    if (!trend || !trendCharts[zone_id]) return;
    const slope = trend.slope || 0;
    const cur   = trend.current_gas_ppm || 0;
    const pts   = [0,1,2,3,4].map(i => Math.max(0, cur - slope * (4-i)));
    trendCharts[zone_id].data.datasets[0].data = pts;
    trendCharts[zone_id].update();
  }

  // ── ANIMATION LOOP ────────────────────────────────────────
  let pulseT = 0;
  function animate() {
    animFrame = requestAnimationFrame(animate);
    const dt  = clock.getDelta();
    pulseT   += dt;

    // Pulse critical zones
    Object.values(zoneObjects).forEach(obj => {
      if (obj.group.userData.critical) {
        const pulse = 0.5 + Math.sin(pulseT * 6) * 0.5;
        obj.heatLight.intensity = 2.5 + pulse * 2.5;
        obj.heatPlane.material.opacity = 0.35 + pulse * 0.3;
      }
    });

    // Animate worker bobbing
    Object.values(zoneObjects).forEach(obj => {
      obj.workers.forEach((w, i) => {
        w.position.y = Math.sin(pulseT * 1.5 + i * 0.8) * 0.08;
      });
    });

    // Particle drift
    particles.forEach(p => {
      const pos = p.mesh.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        pos.array[i*3+1] += p.velocities[i];
        if (pos.array[i*3+1] > 14) pos.array[i*3+1] = 0;
        if (pos.array[i*3+1] < 0)  pos.array[i*3+1] = 14;
      }
      pos.needsUpdate = true;
    });

    // Update label positions
    Object.keys(zoneObjects).forEach(updateLabelPosition);

    renderer.render(scene, camera);
  }

  // ── DATA REFRESH ──────────────────────────────────────────
  async function refresh() {
    const zones = await safeFetch('/api/dashboard/zones');
    if (!zones) return;
    zonesData = zones;

    // Update glows and side panel
    zonesData.forEach(z => applyZoneGlow(z.zone_id, z.final_score));
    renderSidePanel();
    updateKPIs();
  }

  function updateKPIs() {
    const totalZones  = zonesData.length;
    const criticalCt  = zonesData.filter(z => z.final_score > 75).length;
    const totalWork   = zonesData.reduce((s, z) => s + (z.snapshot?.worker_count ?? 0), 0);
    const maxScore    = Math.max(0, ...zonesData.map(z => z.final_score));

    const setEl = (id, val, colorCss) => {
      const el = document.getElementById(id);
      if (el) { el.textContent = val; if (colorCss) el.style.color = colorCss; }
    };
    setEl('kpi-total',    totalZones,  '#00d4ff');
    setEl('kpi-critical', criticalCt,  criticalCt > 0 ? '#ff4444' : '#00ff88');
    setEl('kpi-workers',  totalWork,   totalWork > 0 ? '#ff8c00' : '#00ff88');
    setEl('kpi-maxrisk',  Math.round(maxScore), scoreColor(maxScore).css);
  }

  // ── INIT ──────────────────────────────────────────────────
  async function init() {
    await loadData();
    initThree();
    renderSidePanel();
    buildTrendStrip();
    updateKPIs();
    setInterval(refresh, 30000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();