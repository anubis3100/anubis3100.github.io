// ═══════════════════════════════════════════════════════════════════════════
// blog mind-map — sphere force layout on canvas2d, no deps
//
// features:
//   • posts + artworks as nodes; edges link posts → mentioned artworks
//   • drag empty space to rotate the sphere
//   • drag a node to move it; connected nodes spring toward it (force sim)
//   • mouse wheel / pinch to zoom
//   • click → preview card; dbl-click → navigate
//   • auto-rotates again after 10s of idle
//   • subtle per-node oscillation for life
//
// exposes: window.buildBlogMindmap(posts, artworks) → DOM element
// ═══════════════════════════════════════════════════════════════════════════

(function () {
  const IDLE_AUTOSPIN_MS = 10000;

  function normalizeForMatch(s) {
    return (s || '')
      .toLowerCase()
      .replace(/[._-]+/g, ' ')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function buildEdges(posts, artworks) {
    const out = [];
    const bodies = posts.map(p => normalizeForMatch(p.body));
    artworks.forEach((a, ai) => {
      const cands = [normalizeForMatch(a.title), normalizeForMatch(a.slug)]
        .filter(s => s && s.length >= 3);
      bodies.forEach((b, pi) => {
        if (!b) return;
        for (const c of cands) {
          if (b.includes(c)) { out.push({ p: pi, a: ai }); break; }
        }
      });
    });
    return out;
  }

  function fibonacciSphere(n, R) {
    const pts = [];
    const phi = Math.PI * (Math.sqrt(5) - 1);
    for (let i = 0; i < n; i++) {
      const y = 1 - (i / Math.max(1, n - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const t = phi * i;
      pts.push([Math.cos(t) * r * R, y * R, Math.sin(t) * r * R]);
    }
    return pts;
  }

  function rotateXY(p, ax, ay) {
    let [x, y, z] = p;
    const cy = Math.cos(ay), sy = Math.sin(ay);
    const x1 = x * cy + z * sy;
    const z1 = -x * sy + z * cy;
    const cx = Math.cos(ax), sx = Math.sin(ax);
    const y1 = y * cx - z1 * sx;
    const z2 = y * sx + z1 * cx;
    return [x1, y1, z2];
  }

  function applyAlpha(hex, a) {
    if (!hex || !hex.startsWith('#')) return hex;
    let r, g, b;
    if (hex.length === 4) {
      r = parseInt(hex[1] + hex[1], 16);
      g = parseInt(hex[2] + hex[2], 16);
      b = parseInt(hex[3] + hex[3], 16);
    } else {
      r = parseInt(hex.slice(1, 3), 16);
      g = parseInt(hex.slice(3, 5), 16);
      b = parseInt(hex.slice(5, 7), 16);
    }
    return `rgba(${r},${g},${b},${a})`;
  }

  function buildBlogMindmap(posts, artworks) {
    const root = document.createElement('div');
    root.className = 'mindmap-wrap';
    root.innerHTML = `
      <div class="mindmap-canvas-wrap">
        <canvas class="mindmap-canvas"></canvas>
        <div class="mindmap-empty" hidden>No posts yet — write something to populate the map.</div>
        <div class="mindmap-legend">
          <span><i class="lg post"></i>Post</span>
          <span><i class="lg digital"></i>Digital</span>
          <span><i class="lg physical"></i>Physical</span>
          <span><i class="lg studies"></i>Study</span>
        </div>
        <div class="mindmap-hint">drag bg · rotate · drag node · scroll to zoom · dbl-click to open</div>
        <div class="mindmap-tip" hidden></div>
        <div class="mindmap-preview" hidden>
          <button class="mp-close" type="button" aria-label="Close preview">×</button>
          <div class="mp-corner mp-c-tl"></div>
          <div class="mp-corner mp-c-tr"></div>
          <div class="mp-corner mp-c-bl"></div>
          <div class="mp-corner mp-c-br"></div>
          <div class="mp-body"></div>
          <div class="mp-foot">
            <span class="mp-foot-key">› DBL-CLICK TO OPEN</span>
            <span class="mp-foot-pulse"></span>
          </div>
        </div>
      </div>
    `;

    const canvas = root.querySelector('.mindmap-canvas');
    const tip    = root.querySelector('.mindmap-tip');
    const empty  = root.querySelector('.mindmap-empty');
    const ctx    = canvas.getContext('2d');

    if (posts.length === 0) {
      empty.hidden = false;
      return root;
    }

    // ── nodes
    const nodes = [
      ...posts.map((p, i) => ({
        kind: 'post', idx: i, slug: p.slug, title: p.title, meta: 'Journal entry',
      })),
      ...artworks.map((a, i) => ({
        kind: 'art', idx: i, section: a.section, slug: a.slug,
        src: a.src, title: a.title, meta: a.meta,
        sectionIndex: a.sectionIndex,
      })),
    ];
    const N = nodes.length;
    const postOff = 0;
    const artOff  = posts.length;

    const rawEdges = buildEdges(posts, artworks);
    const edges = rawEdges.map(e => ({ from: postOff + e.p, to: artOff + e.a }));

    const adj = new Map();
    for (let i = 0; i < N; i++) adj.set(i, new Set());
    edges.forEach(e => { adj.get(e.from).add(e.to); adj.get(e.to).add(e.from); });

    // initial positions on sphere
    const positions = fibonacciSphere(N, 1).map(([x, y, z]) => [x, y, z]);
    // small per-node oscillation seeds for "life"
    const seeds = nodes.map(() => [Math.random() * Math.PI * 2, Math.random() * Math.PI * 2, Math.random() * Math.PI * 2]);
    // velocities for force sim
    const vel = nodes.map(() => [0, 0, 0]);

    // ── state
    let rotX = -0.25, rotY = 0;
    let zoom = 1;                       // 1 = default
    const ZOOM_MIN = 0.5, ZOOM_MAX = 3;
    let autoSpin = true;
    let lastInteraction = performance.now();

    let mode = 'idle';                  // 'idle' | 'rotate' | 'dragNode'
    let dragNodeIdx = -1;
    let downX = 0, downY = 0;
    let lastPx = 0, lastPy = 0;
    let hoverIdx = -1;
    let lastClickTime = 0, lastClickIdx = -1;

    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let W = 0, H = 0, R = 0;
    let timePrev = performance.now();

    function resize() {
      const wrap = root.querySelector('.mindmap-canvas-wrap');
      const rect = wrap.getBoundingClientRect();
      W = rect.width; H = rect.height;
      R = Math.min(W, H) * 0.40;
      canvas.width  = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      canvas.style.width  = W + 'px';
      canvas.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function project(p3) {
      const [x, y, z] = rotateXY(p3, rotX, rotY);
      const sx = W / 2 + x * R * zoom;
      const sy = H / 2 + y * R * zoom;
      const t = (z + 1) / 2;
      return { x: sx, y: sy, z, t };
    }

    // unproject screen point onto current rotation plane (z=0 in rotated space)
    function unproject(sx, sy) {
      const x = (sx - W / 2) / (R * zoom);
      const y = (sy - H / 2) / (R * zoom);
      // inverse rotate (rotX then rotY reversed)
      // forward was: rotateY(ay) then rotateX(ax). inverse: rotateX(-ax) then rotateY(-ay)
      const cx = Math.cos(-rotX), sx_ = Math.sin(-rotX);
      const y0 = y * cx;
      const z0 = y * sx_;   // correct sign: undo X-rotation of (x,y,0)
      const cy = Math.cos(-rotY), sy_ = Math.sin(-rotY);
      const x1 = x * cy + z0 * sy_;
      const z1 = -x * sy_ + z0 * cy;
      return [x1, y0, z1];
    }

    function colorFor(node, alpha = 1) {
      const cs = getComputedStyle(canvas);
      const palette = {
        post:     cs.getPropertyValue('--mm-post').trim()     || '#d94a3a',
        digital:  cs.getPropertyValue('--mm-digital').trim()  || '#1d8a7a',
        physical: cs.getPropertyValue('--mm-physical').trim() || '#c98b6b',
        studies:  cs.getPropertyValue('--mm-studies').trim()  || '#7b8aa8',
      };
      const key = node.kind === 'post' ? 'post' : node.section;
      const hex = palette[key] || '#888';
      return alpha === 1 ? hex : applyAlpha(hex, alpha);
    }

    function getBg() {
      const cs = getComputedStyle(canvas);
      return cs.getPropertyValue('--mm-bg').trim() || '#0c0907';
    }
    function getInk() {
      const cs = getComputedStyle(canvas);
      return cs.getPropertyValue('--mm-ink').trim() || '#efece4';
    }
    function getEdge() {
      const cs = getComputedStyle(canvas);
      return cs.getPropertyValue('--mm-edge').trim() || '#d94a3a';
    }

    // ── force simulation ───────────────────────────────────────────────────
    // pulls connected nodes closer; gentle repulsion between all nodes; soft
    // pull back to sphere surface so the layout stays roughly globular.
    function step(dt) {
      const now = performance.now();
      const t = now / 1000;

      const targetR = 1;
      const force = nodes.map(() => [0, 0, 0]);

      // attraction along edges — short rest length pulls connected nodes close
      const SPRING_LEN = 0.18;
      const SPRING_K   = 0.7;
      for (const e of edges) {
        const a = positions[e.from], b = positions[e.to];
        const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
        const d = Math.hypot(dx, dy, dz) || 0.0001;
        const f = (d - SPRING_LEN) * SPRING_K;
        const ux = dx / d, uy = dy / d, uz = dz / d;
        force[e.from][0] += ux * f; force[e.from][1] += uy * f; force[e.from][2] += uz * f;
        force[e.to  ][0] -= ux * f; force[e.to  ][1] -= uy * f; force[e.to  ][2] -= uz * f;
      }

      // mild repulsion (O(N^2) — fine for N up to a few hundred)
      const REP = 0.012;
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          const a = positions[i], b = positions[j];
          const dx = a[0] - b[0], dy = a[1] - b[1], dz = a[2] - b[2];
          const d2 = dx * dx + dy * dy + dz * dz + 0.001;
          const d  = Math.sqrt(d2);
          const f = REP / d2;
          const ux = dx / d, uy = dy / d, uz = dz / d;
          force[i][0] += ux * f; force[i][1] += uy * f; force[i][2] += uz * f;
          force[j][0] -= ux * f; force[j][1] -= uy * f; force[j][2] -= uz * f;
        }
      }

      // gentle pull back to sphere of radius targetR
      const SPHERE_K = 0.45;
      for (let i = 0; i < N; i++) {
        const p = positions[i];
        const r = Math.hypot(p[0], p[1], p[2]) || 0.0001;
        const f = (r - targetR) * -SPHERE_K;
        const ux = p[0] / r, uy = p[1] / r, uz = p[2] / r;
        force[i][0] += ux * f; force[i][1] += uy * f; force[i][2] += uz * f;
      }

      // integrate — high damping = slow, smooth settling
      const DAMP = 0.92;
      for (let i = 0; i < N; i++) {
        if (i === dragNodeIdx) {
          vel[i][0] = vel[i][1] = vel[i][2] = 0;
          continue;
        }
        vel[i][0] = (vel[i][0] + force[i][0] * dt) * DAMP;
        vel[i][1] = (vel[i][1] + force[i][1] * dt) * DAMP;
        vel[i][2] = (vel[i][2] + force[i][2] * dt) * DAMP;
        // subtle per-node oscillation — slow breath, not jitter
        const s = seeds[i];
        const osc = 0.0009;
        positions[i][0] += vel[i][0] * dt + Math.sin(t * 0.35 + s[0]) * osc;
        positions[i][1] += vel[i][1] * dt + Math.cos(t * 0.28 + s[1]) * osc;
        positions[i][2] += vel[i][2] * dt + Math.sin(t * 0.42 + s[2]) * osc;
      }
    }

    function draw() {
      const now = performance.now();
      const dt = Math.min(0.05, (now - timePrev) / 1000);
      timePrev = now;

      // resume auto-rotate after idle
      const idleMs = now - lastInteraction;
      if (mode === 'idle' && idleMs > IDLE_AUTOSPIN_MS) autoSpin = true;
      if (autoSpin && mode === 'idle') rotY += 0.0025;

      // physics
      step(dt);

      ctx.clearRect(0, 0, W, H);

      const proj = nodes.map(n => null);
      for (let i = 0; i < N; i++) proj[i] = project(positions[i]);

      let highlighted = null;
      if (hoverIdx >= 0) {
        highlighted = new Set([hoverIdx]);
        adj.get(hoverIdx).forEach(n => highlighted.add(n));
      }

      // edges
      const edgeColor = getEdge();
      const ink = getInk();
      ctx.lineCap = 'round';
      for (const e of edges) {
        const a = proj[e.from], b = proj[e.to];
        const depth = (a.t + b.t) / 2;
        const dim = highlighted && !(highlighted.has(e.from) && highlighted.has(e.to));
        const baseA = 0.16 + depth * 0.34;
        const alpha = dim ? baseA * 0.18 : (highlighted ? Math.min(1, baseA + 0.5) : baseA);
        ctx.strokeStyle = applyAlpha(highlighted && !dim ? edgeColor : ink, alpha);
        ctx.lineWidth = (highlighted && !dim ? 1.3 : 0.7) * (0.5 + depth);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }

      // nodes back-to-front
      const order = nodes.map((_, i) => i).sort((i, j) => proj[i].t - proj[j].t);
      for (const i of order) {
        const n = nodes[i];
        const p = proj[i];
        const isHover = i === hoverIdx;
        const isDrag  = i === dragNodeIdx;
        const dim = highlighted && !highlighted.has(i);
        const depth = p.t;
        const baseR = n.kind === 'post' ? 6 : 3.4;
        const radius = baseR * (0.65 + depth * 0.6) * ((isHover || isDrag) ? 1.7 : 1) * (zoom > 1 ? Math.min(1.4, zoom) : 1);
        const alpha = dim ? 0.18 : (0.55 + depth * 0.45);
        const fill = colorFor(n, alpha);

        if (isHover || isDrag) {
          const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius * 4);
          grad.addColorStop(0, applyAlpha(colorFor(n, 1), 0.4));
          grad.addColorStop(1, applyAlpha(colorFor(n, 1), 0));
          ctx.fillStyle = grad;
          ctx.beginPath(); ctx.arc(p.x, p.y, radius * 4, 0, Math.PI * 2); ctx.fill();
        }

        ctx.fillStyle = fill;
        ctx.beginPath(); ctx.arc(p.x, p.y, radius, 0, Math.PI * 2); ctx.fill();

        if (n.kind === 'post') {
          ctx.lineWidth = 1.3;
          ctx.strokeStyle = applyAlpha(getBg(), dim ? 0.05 : 0.55);
          ctx.stroke();
        }

        if (n.kind === 'post' || isHover || isDrag) {
          const labelAlpha = dim ? 0.15 : (n.kind === 'post' ? 0.55 + depth * 0.45 : 1);
          ctx.font = `${n.kind === 'post' ? 11 : 10}px 'JetBrains Mono', ui-monospace, monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          const label = truncate(n.title, n.kind === 'post' ? 26 : 30);
          const w = ctx.measureText(label).width;
          ctx.fillStyle = applyAlpha(getBg(), Math.min(0.7, labelAlpha * 1.2));
          ctx.fillRect(p.x - w / 2 - 3, p.y + radius + 4, w + 6, 14);
          ctx.fillStyle = applyAlpha(ink, labelAlpha);
          ctx.fillText(label, p.x, p.y + radius + 5);
        }
      }
    }

    function truncate(s, n) {
      if (!s) return '';
      return s.length <= n ? s : s.slice(0, n - 1) + '…';
    }

    function pickNode(px, py) {
      let best = -1, bestT = -Infinity;
      for (let i = 0; i < N; i++) {
        const p = project(positions[i]);
        const r = (nodes[i].kind === 'post' ? 6 : 3.4) * (0.65 + p.t * 0.6) + 5;
        const dx = p.x - px, dy = p.y - py;
        if (dx * dx + dy * dy <= r * r && p.t > bestT) { best = i; bestT = p.t; }
      }
      return best;
    }

    function noteInteraction() { lastInteraction = performance.now(); autoSpin = false; }

    // ── pointer
    canvas.addEventListener('pointerdown', (e) => {
      const rect = canvas.getBoundingClientRect();
      const lx = e.clientX - rect.left, ly = e.clientY - rect.top;
      downX = e.clientX; downY = e.clientY;
      lastPx = e.clientX; lastPy = e.clientY;
      const idx = pickNode(lx, ly);
      if (idx >= 0) {
        mode = 'dragNode';
        dragNodeIdx = idx;
      } else {
        mode = 'rotate';
      }
      noteInteraction();
      canvas.setPointerCapture(e.pointerId);
      canvas.style.cursor = idx >= 0 ? 'grabbing' : 'grabbing';
    });

    canvas.addEventListener('pointermove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const lx = e.clientX - rect.left, ly = e.clientY - rect.top;

      if (mode === 'rotate') {
        const dx = e.clientX - lastPx;
        const dy = e.clientY - lastPy;
        rotY += dx * 0.0085;
        rotX += dy * 0.0085;
        rotX = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, rotX));
        lastPx = e.clientX; lastPy = e.clientY;
        noteInteraction();
        return;
      }

      if (mode === 'dragNode' && dragNodeIdx >= 0) {
        const [tx, ty, tz] = unproject(lx, ly);
        // place node at unprojected point; keep it at the same radius from origin
        const cur = positions[dragNodeIdx];
        const r = Math.hypot(cur[0], cur[1], cur[2]) || 1;
        const nr = Math.hypot(tx, ty, tz) || 0.0001;
        // softly steer toward target rather than snap
        const steerK = 0.6;
        positions[dragNodeIdx][0] += (tx - cur[0]) * steerK;
        positions[dragNodeIdx][1] += (ty - cur[1]) * steerK;
        positions[dragNodeIdx][2] += (tz - cur[2]) * steerK;
        // re-normalize to roughly the previous radius so it doesn't fly off
        const p = positions[dragNodeIdx];
        const pr = Math.hypot(p[0], p[1], p[2]) || 0.0001;
        const want = Math.max(0.85, Math.min(1.15, pr));
        positions[dragNodeIdx][0] = p[0] / pr * want;
        positions[dragNodeIdx][1] = p[1] / pr * want;
        positions[dragNodeIdx][2] = p[2] / pr * want;
        noteInteraction();
        return;
      }

      // hover when not dragging
      const idx = pickNode(lx, ly);
      if (idx !== hoverIdx) {
        hoverIdx = idx;
        canvas.style.cursor = idx >= 0 ? 'pointer' : 'grab';
        if (idx >= 0) {
          const n = nodes[idx];
          tip.hidden = false;
          tip.innerHTML = `
            <div class="mm-tip-eyebrow">${n.kind === 'post' ? 'Journal entry' : 'Artwork · ' + (n.section || '')}</div>
            <div class="mm-tip-title">${escapeHtml(n.title)}</div>
            ${n.kind === 'art' && countPostNeighbors(idx) > 0 ? `<div class="mm-tip-meta">In ${countPostNeighbors(idx)} post${countPostNeighbors(idx) === 1 ? '' : 's'}</div>` : ''}
            ${n.kind === 'post' && countArtNeighbors(idx) > 0 ? `<div class="mm-tip-meta">${countArtNeighbors(idx)} artwork${countArtNeighbors(idx) === 1 ? '' : 's'}</div>` : ''}
          `;
          tip.style.left = Math.min(W - 220, Math.max(8, lx + 18)) + 'px';
          tip.style.top  = Math.min(H - 70,  Math.max(8, ly + 18)) + 'px';
        } else {
          tip.hidden = true;
        }
      }
    });

    function countPostNeighbors(i) { let c = 0; adj.get(i).forEach(n => { if (nodes[n].kind === 'post') c++; }); return c; }
    function countArtNeighbors(i)  { let c = 0; adj.get(i).forEach(n => { if (nodes[n].kind === 'art')  c++; }); return c; }

    canvas.addEventListener('pointerup', (e) => {
      const moved = Math.hypot(e.clientX - downX, e.clientY - downY);
      const wasDragNode = mode === 'dragNode';
      const idx = dragNodeIdx;
      mode = 'idle';
      dragNodeIdx = -1;
      canvas.style.cursor = hoverIdx >= 0 ? 'pointer' : 'grab';
      noteInteraction();

      // click vs drag
      if (moved < 5 && wasDragNode && idx >= 0) {
        const now = Date.now();
        if (idx === lastClickIdx && now - lastClickTime < 380) {
          handleNodeClick(nodes[idx]);
          lastClickIdx = -1; lastClickTime = 0;
          return;
        }
        lastClickIdx = idx; lastClickTime = now;
        const rect = canvas.getBoundingClientRect();
        showPreview(nodes[idx], e.clientX - rect.left, e.clientY - rect.top);
      } else if (moved < 5 && !wasDragNode) {
        hidePreview();
      }
    });

    canvas.addEventListener('pointerleave', () => {
      hoverIdx = -1; tip.hidden = true;
      if (mode !== 'dragNode') canvas.style.cursor = 'grab';
    });

    // wheel → zoom
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const k = Math.exp(-e.deltaY * 0.0015);
      zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom * k));
      noteInteraction();
    }, { passive: false });

    // pinch (two-pointer) zoom
    const activePointers = new Map();
    let pinchStartDist = 0, pinchStartZoom = 1;
    canvas.addEventListener('pointerdown', (e) => {
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (activePointers.size === 2) {
        const [a, b] = [...activePointers.values()];
        pinchStartDist = Math.hypot(a.x - b.x, a.y - b.y);
        pinchStartZoom = zoom;
        mode = 'idle'; // suspend rotate/drag while pinching
      }
    });
    canvas.addEventListener('pointermove', (e) => {
      if (activePointers.has(e.pointerId)) activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (activePointers.size === 2) {
        const [a, b] = [...activePointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinchStartDist > 0) {
          zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, pinchStartZoom * (d / pinchStartDist)));
          noteInteraction();
        }
      }
    });
    function endPointer(e) { activePointers.delete(e.pointerId); }
    canvas.addEventListener('pointerup', endPointer);
    canvas.addEventListener('pointercancel', endPointer);

    function handleNodeClick(n) {
      if (n.kind === 'post') {
        // remember user came from the map, so back button returns to map
        window.__blogReturnToMap = true;
        if (typeof window.goTo === 'function') window.goTo('blog/' + n.slug);
        else window.location.hash = 'blog/' + n.slug;
      } else {
        // navigate to the gallery section that displays this artwork
        const section = n.section; // 'digital' | 'physical' | 'studies'
        window.__introTarget = { route: section, index: n.sectionIndex || 0 };
        if (typeof window.goTo === 'function') window.goTo(section);
        else window.location.hash = section;
      }
    }

    // ── preview card
    const preview = root.querySelector('.mindmap-preview');
    const previewBody = preview.querySelector('.mp-body');
    preview.querySelector('.mp-close').addEventListener('click', (e) => { e.stopPropagation(); hidePreview(); });

    function showPreview(n, px, py) {
      const post = n.kind === 'post' ? posts[n.idx] : null;
      const art  = n.kind === 'art'  ? artworks[n.idx] : null;
      const eyebrow = n.kind === 'post' ? '› JOURNAL ENTRY' : `› ARTWORK · ${(n.section || '').toUpperCase()}`;
      let inner = '';
      if (post) {
        const text = (post.body || '')
          .replace(/^\s*#.*$/gm, '')
          .replace(/[*`_>#\[\]()]/g, '')
          .split(/\r?\n\r?\n/).map(s => s.trim()).filter(Boolean)[0] || '';
        inner = `
          <div class="mp-eyebrow">${eyebrow}</div>
          <div class="mp-title">${escapeHtml(n.title)}</div>
          <div class="mp-text">${escapeHtml(text.slice(0, 220))}${text.length > 220 ? '…' : ''}</div>
        `;
      } else if (art) {
        inner = `
          <div class="mp-eyebrow">${eyebrow}</div>
          <div class="mp-thumb"><img src="${art.src}" alt="${escapeHtml(n.title)}" loading="lazy" /></div>
          <div class="mp-title">${escapeHtml(n.title)}</div>
          <div class="mp-text mp-meta-line">${escapeHtml(art.meta || '')}</div>
        `;
      }
      previewBody.innerHTML = inner;
      preview.dataset.kind = n.kind;
      preview.dataset.nodeIdx = String(nodes.indexOf(n));

      const wrap = root.querySelector('.mindmap-canvas-wrap');
      const cw = wrap.clientWidth, ch = wrap.clientHeight;
      const PW = 290;
      const PH = n.kind === 'art' ? 370 : 230; // generous estimate keeps card fully inside
      const pad = 12;
      let x = px + 22, y = py + 22;
      // prefer right of cursor; flip left if it would overflow
      if (x + PW > cw - pad) x = px - PW - 22;
      // hard-clamp so card always stays inside canvas horizontally
      x = Math.max(pad, Math.min(cw - PW - pad, x));
      // prefer below cursor; flip above if it would overflow bottom
      if (y + PH > ch - pad) y = py - PH - 22;
      // hard-clamp vertically
      y = Math.max(pad, Math.min(ch - PH - pad, y));
      preview.style.left = x + 'px';
      preview.style.top  = y + 'px';

      preview.hidden = false;
      preview.classList.remove('is-in');
      void preview.offsetWidth;
      preview.classList.add('is-in');
    }
    function hidePreview() {
      if (preview.hidden) return;
      preview.classList.remove('is-in');
      preview.classList.add('is-out');
      setTimeout(() => { preview.classList.remove('is-out'); preview.hidden = true; }, 240);
    }
    // Preview interaction:
    //   • click the artwork thumbnail → open lightbox immediately (single click)
    //   • double-click anywhere else on the card → open / navigate
    //
    // We use a manual click-timer instead of the native 'dblclick' event because
    // the native event never fires when the first click landed on the canvas and
    // the second on the preview card (two different elements).
    let previewClickAt = 0;
    preview.addEventListener('click', (e) => {
      if (e.target.closest('.mp-close')) return; // let the × handle itself
      const idx = parseInt(preview.dataset.nodeIdx, 10);
      if (isNaN(idx) || !nodes[idx]) return;
      const n = nodes[idx];

      // single-click on the thumbnail image → open art immediately
      if (n.kind === 'art' && e.target.closest('.mp-thumb')) {
        hidePreview();
        handleNodeClick(n);
        previewClickAt = 0;
        return;
      }

      // double-click anywhere on the card → open / navigate
      const now = Date.now();
      if (now - previewClickAt < 400) {
        hidePreview();
        handleNodeClick(n);
        previewClickAt = 0;
      } else {
        previewClickAt = now;
      }
    });

    function escapeHtml(s) {
      return (s || '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
      }[c]));
    }

    // ── main loop
    let raf = 0;
    let alive = true;
    function loop() { if (!alive) return; draw(); raf = requestAnimationFrame(loop); }

    const ro = new ResizeObserver(() => { resize(); });
    ro.observe(root.querySelector('.mindmap-canvas-wrap'));
    resize();
    canvas.style.cursor = 'grab';
    loop();

    root._cleanup = () => { alive = false; cancelAnimationFrame(raf); ro.disconnect(); };
    return root;
  }

  window.buildBlogMindmap = buildBlogMindmap;
})();
