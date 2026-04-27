// ═══════════════════════════════════════════════════════════════════════════
// blog mind-map — 2D force-directed graph (Obsidian-style), no deps
//
// features:
//   • posts + artworks as nodes; edges link posts → mentioned artworks
//   • drag background to pan; drag node to reposition
//   • mouse wheel / pinch to zoom (toward cursor)
//   • click → preview card; dbl-click → navigate
//   • force sim: spring attraction on edges, repulsion between nodes,
//     gentle centering pull — settles into a calm organic layout
//
// exposes: window.buildBlogMindmap(posts, artworks) → DOM element
// ═══════════════════════════════════════════════════════════════════════════

(function () {

  // ── helpers ──────────────────────────────────────────────────────────────

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

  function escapeHtml(s) {
    return (s || '').replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function truncate(s, n) {
    if (!s) return '';
    return s.length <= n ? s : s.slice(0, n - 1) + '…';
  }

  // ── main builder ──────────────────────────────────────────────────────────

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
        <div class="mindmap-hint">drag to pan · drag node · scroll to zoom · dbl-click to open</div>
        <div class="mindmap-tip" hidden></div>
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

    // ── nodes & edges ────────────────────────────────────────────────────
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

    // initial positions: each group starts near its own quadrant so the
    // cohesion force has less work to do before the layout settles.
    const GROUP_CENTERS = {
      post:     [-50, -50],
      digital:  [ 50, -50],
      physical: [-50,  50],
      studies:  [ 50,  50],
    };
    const groupCount = { post: 0, digital: 0, physical: 0, studies: 0 };
    const positions = nodes.map((n) => {
      const key = n.kind === 'post' ? 'post' : n.section;
      const c   = GROUP_CENTERS[key] || [0, 0];
      const idx = groupCount[key] = (groupCount[key] || 0) + 1;
      // tight spiral within the group zone
      const angle = idx * 2.399963;
      const r     = 10 * Math.sqrt(idx);
      return [c[0] + Math.cos(angle) * r, c[1] + Math.sin(angle) * r];
    });
    // per-node velocities (frame-based, no dt needed)
    const vel = nodes.map(() => [0, 0]);
    // nodes locked in place after being manually dragged
    const pinnedNodes = new Set();

    // ── view state ────────────────────────────────────────────────────────
    let panX = 0, panY = 0;          // world-origin offset from canvas center (px)
    let zoom = 1;
    const ZOOM_MIN = 0.15, ZOOM_MAX = 5;

    let mode = 'idle';               // 'idle' | 'pan' | 'dragNode'
    let dragNodeIdx = -1;
    let downX = 0, downY = 0;
    let lastPx = 0, lastPy = 0;
    let hoverIdx = -1;
    let lastClickTime = 0, lastClickIdx = -1;

    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let W = 0, H = 0;

    function resize() {
      const wrap = root.querySelector('.mindmap-canvas-wrap');
      const rect = wrap.getBoundingClientRect();
      W = rect.width; H = rect.height;
      canvas.width  = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      canvas.style.width  = W + 'px';
      canvas.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // world ↔ screen conversions
    function toScreen(wx, wy) {
      return { x: W / 2 + panX + wx * zoom, y: H / 2 + panY + wy * zoom };
    }
    function toWorld(sx, sy) {
      return [(sx - W / 2 - panX) / zoom, (sy - H / 2 - panY) / zoom];
    }

    // ── CSS color helpers ─────────────────────────────────────────────────
    function cssVar(name) {
      return getComputedStyle(canvas).getPropertyValue(name).trim();
    }
    function colorFor(node, alpha) {
      const palette = {
        post:     cssVar('--mm-post')     || '#d94a3a',
        digital:  cssVar('--mm-digital')  || '#1d8a7a',
        physical: cssVar('--mm-physical') || '#c98b6b',
        studies:  cssVar('--mm-studies')  || '#7b8aa8',
      };
      const hex = palette[node.kind === 'post' ? 'post' : node.section] || '#888';
      return (alpha == null || alpha === 1) ? hex : applyAlpha(hex, alpha);
    }
    const getBg   = () => cssVar('--mm-bg')   || '#0c0907';
    const getInk  = () => cssVar('--mm-ink')  || '#efece4';
    const getEdge = () => cssVar('--mm-edge') || '#4fc3a9';

    // ── force simulation (frame-based Euler, no dt) ───────────────────────
    //   spring attraction on edges  →  pulls connected nodes together
    //   node-node repulsion         →  keeps nodes from overlapping
    //   group cohesion              →  pulls same-type nodes toward their centroid
    //   gentle centering            →  prevents the graph drifting off-screen
    const REST_LEN = 28;     // px — edge rest length
    const SPRING_K = 0.012;  // spring stiffness
    const REP      = 320;    // repulsion (keeps nodes from overlapping)
    const GROUP_K  = 0.003;  // cohesion — keeps unpinned nodes clustered
    const CENTER_K = 0.0003; // centering — keeps unpinned graph together
    const DAMP     = 0.82;

    // pre-build group membership lists (stable across frames)
    const groupMembers = { post: [], digital: [], physical: [], studies: [] };
    nodes.forEach((n, i) => {
      const key = n.kind === 'post' ? 'post' : n.section;
      if (groupMembers[key]) groupMembers[key].push(i);
    });

    function step() {
      const force    = nodes.map(() => [0, 0]); // full forces for unpinned nodes
      const repForce = nodes.map(() => [0, 0]); // repulsion only, for pinned nodes

      // spring forces along edges (unpinned only — pinned nodes don't get pulled)
      for (const e of edges) {
        const a = positions[e.from], b = positions[e.to];
        const dx = b[0] - a[0], dy = b[1] - a[1];
        const d  = Math.hypot(dx, dy) || 0.0001;
        const f  = (d - REST_LEN) * SPRING_K;
        const ux = dx / d, uy = dy / d;
        if (!pinnedNodes.has(e.from)) { force[e.from][0] += ux * f; force[e.from][1] += uy * f; }
        if (!pinnedNodes.has(e.to))   { force[e.to  ][0] -= ux * f; force[e.to  ][1] -= uy * f; }
      }

      // pairwise repulsion — applied to ALL nodes (prevents overlapping everywhere)
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          const a = positions[i], b = positions[j];
          const dx = a[0] - b[0], dy = a[1] - b[1];
          const d2 = dx * dx + dy * dy + 0.1;
          const d  = Math.sqrt(d2);
          const f  = REP / d2;
          const ux = dx / d, uy = dy / d;
          force[i][0]    += ux * f; force[i][1]    += uy * f;
          force[j][0]    -= ux * f; force[j][1]    -= uy * f;
          repForce[i][0] += ux * f; repForce[i][1] += uy * f;
          repForce[j][0] -= ux * f; repForce[j][1] -= uy * f;
        }
      }

      // group cohesion + centering — unpinned nodes only
      for (const members of Object.values(groupMembers)) {
        if (members.length < 2) continue;
        let cx = 0, cy = 0;
        for (const i of members) { cx += positions[i][0]; cy += positions[i][1]; }
        cx /= members.length; cy /= members.length;
        for (const i of members) {
          if (pinnedNodes.has(i)) continue;
          force[i][0] += (cx - positions[i][0]) * GROUP_K;
          force[i][1] += (cy - positions[i][1]) * GROUP_K;
        }
      }
      for (let i = 0; i < N; i++) {
        if (pinnedNodes.has(i)) continue;
        force[i][0] -= positions[i][0] * CENTER_K;
        force[i][1] -= positions[i][1] * CENTER_K;
      }

      // integrate
      for (let i = 0; i < N; i++) {
        if (i === dragNodeIdx) { vel[i][0] = vel[i][1] = 0; continue; }
        if (pinnedNodes.has(i)) {
          // locked: only nudge by repulsion so overlapping nodes push apart
          positions[i][0] += repForce[i][0] * 0.25;
          positions[i][1] += repForce[i][1] * 0.25;
          vel[i][0] = vel[i][1] = 0;
          continue;
        }
        vel[i][0] = (vel[i][0] + force[i][0]) * DAMP;
        vel[i][1] = (vel[i][1] + force[i][1]) * DAMP;
        positions[i][0] += vel[i][0];
        positions[i][1] += vel[i][1];
      }
    }

    // ── rendering ─────────────────────────────────────────────────────────
    function draw() {
      step();
      ctx.clearRect(0, 0, W, H);

      const proj = nodes.map((_, i) => toScreen(positions[i][0], positions[i][1]));

      let highlighted = null;
      if (hoverIdx >= 0) {
        highlighted = new Set([hoverIdx]);
        adj.get(hoverIdx).forEach(n => highlighted.add(n));
      }

      const edgeColor = getEdge();
      const ink       = getInk();

      // edges
      ctx.lineCap = 'round';
      for (const e of edges) {
        const a = proj[e.from], b = proj[e.to];
        const isLit = highlighted && highlighted.has(e.from) && highlighted.has(e.to);
        const dim   = highlighted && !isLit;
        const alpha = dim ? 0.06 : isLit ? 0.85 : 0.22;
        ctx.strokeStyle = applyAlpha(isLit ? edgeColor : ink, alpha);
        ctx.lineWidth   = isLit ? 1.6 : 0.8;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }

      // nodes (all at same depth — no z-sorting needed)
      for (let i = 0; i < N; i++) {
        const n  = nodes[i];
        const p  = proj[i];
        const isHover = i === hoverIdx;
        const isDrag  = i === dragNodeIdx;
        const dim = highlighted && !highlighted.has(i);

        const baseR  = n.kind === 'post' ? 7 : 4.5;
        const scaled = baseR * Math.max(0.6, Math.min(1.8, zoom));
        const radius = scaled * ((isHover || isDrag) ? 1.55 : 1);
        const alpha  = dim ? 0.18 : 0.88;

        // glow ring on hover / drag
        if (isHover || isDrag) {
          const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius * 5);
          glow.addColorStop(0, applyAlpha(colorFor(n), 0.30));
          glow.addColorStop(1, applyAlpha(colorFor(n), 0));
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(p.x, p.y, radius * 5, 0, Math.PI * 2);
          ctx.fill();
        }

        // node circle
        ctx.fillStyle = colorFor(n, alpha);
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fill();

        // subtle ring on post nodes
        if (n.kind === 'post') {
          ctx.lineWidth   = 1.5;
          ctx.strokeStyle = applyAlpha(getBg(), dim ? 0.04 : 0.45);
          ctx.stroke();
        }

        // label visibility rules:
        //   zoom < 0.7  → only on hover/drag (too zoomed out to read)
        //   0.7–1.8     → posts always, art only on hover/drag
        //   zoom > 1.8  → all nodes always
        const showLabel = (isHover || isDrag)
          || (zoom >= 0.7 && n.kind === 'post')
          || (zoom >= 1.8);
        if (showLabel) {
          const labelAlpha = dim ? 0.12 : (n.kind === 'post' ? 0.72 : 0.95);
          const fSize = Math.max(9, Math.min(12, 10.5 * Math.sqrt(zoom)));
          ctx.font = `${fSize}px 'JetBrains Mono', ui-monospace, monospace`;
          ctx.textAlign    = 'center';
          ctx.textBaseline = 'top';
          const label = truncate(n.title, n.kind === 'post' ? 24 : 28);
          const tw = ctx.measureText(label).width;
          ctx.fillStyle = applyAlpha(getBg(), Math.min(0.72, labelAlpha * 1.1));
          ctx.fillRect(p.x - tw / 2 - 3, p.y + radius + 4, tw + 6, fSize + 3);
          ctx.fillStyle = applyAlpha(ink, labelAlpha);
          ctx.fillText(label, p.x, p.y + radius + 5);
        }
      }
    }

    // ── hit-testing ───────────────────────────────────────────────────────
    function pickNode(sx, sy) {
      let best = -1, bestD2 = Infinity;
      for (let i = 0; i < N; i++) {
        const p    = toScreen(positions[i][0], positions[i][1]);
        const base = (nodes[i].kind === 'post' ? 7 : 4.5) * Math.max(0.6, Math.min(1.8, zoom));
        const hit  = base + 7;
        const dx   = p.x - sx, dy = p.y - sy;
        const d2   = dx * dx + dy * dy;
        if (d2 <= hit * hit && d2 < bestD2) { best = i; bestD2 = d2; }
      }
      return best;
    }

    // ── pointer events ────────────────────────────────────────────────────
    canvas.addEventListener('pointerdown', (e) => {
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
      downX = e.clientX; downY = e.clientY;
      lastPx = e.clientX; lastPy = e.clientY;
      const idx = pickNode(sx, sy);
      if (idx >= 0) {
        mode = 'dragNode';
        dragNodeIdx = idx;
      } else {
        mode = 'pan';
      }
      canvas.setPointerCapture(e.pointerId);
      canvas.style.cursor = 'grabbing';
    });

    canvas.addEventListener('pointermove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left, sy = e.clientY - rect.top;

      if (mode === 'pan') {
        panX += e.clientX - lastPx;
        panY += e.clientY - lastPy;
        lastPx = e.clientX; lastPy = e.clientY;
        return;
      }

      if (mode === 'dragNode' && dragNodeIdx >= 0) {
        // convert screen delta → world delta
        positions[dragNodeIdx][0] += (e.clientX - lastPx) / zoom;
        positions[dragNodeIdx][1] += (e.clientY - lastPy) / zoom;
        lastPx = e.clientX; lastPy = e.clientY;
        return;
      }

      // hover detection (idle only)
      const idx = pickNode(sx, sy);
      if (idx !== hoverIdx) {
        hoverIdx = idx;
        canvas.style.cursor = idx >= 0 ? 'pointer' : 'grab';
        if (idx >= 0) {
          const n = nodes[idx];
          tip.hidden = false;
          tip.innerHTML = `
            <div class="mm-tip-eyebrow">${n.kind === 'post' ? 'Journal entry' : 'Artwork · ' + (n.section || '')}</div>
            <div class="mm-tip-title">${escapeHtml(n.title)}</div>
            ${n.kind === 'art'  && countPostNeighbors(idx) > 0 ? `<div class="mm-tip-meta">In ${countPostNeighbors(idx)} post${countPostNeighbors(idx) === 1 ? '' : 's'}</div>` : ''}
            ${n.kind === 'post' && countArtNeighbors(idx)  > 0 ? `<div class="mm-tip-meta">${countArtNeighbors(idx)} artwork${countArtNeighbors(idx) === 1 ? '' : 's'}</div>` : ''}
          `;
          tip.style.left = Math.min(W - 220, Math.max(8, sx + 18)) + 'px';
          tip.style.top  = Math.min(H - 70,  Math.max(8, sy + 18)) + 'px';
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

      if (wasDragNode && idx >= 0) {
        if (moved >= 6) {
          // real drag — lock node in place; repulsion still keeps it from overlapping
          pinnedNodes.add(idx);
          vel[idx][0] = vel[idx][1] = 0;
        } else {
          // treated as a click
          const now = Date.now();
          if (idx === lastClickIdx && now - lastClickTime < 380) {
            handleNodeClick(nodes[idx]);
            lastClickIdx = -1; lastClickTime = 0;
            return;
          }
          lastClickIdx = idx; lastClickTime = now;
          const rect = canvas.getBoundingClientRect();
          togglePreview(nodes[idx], e.clientX - rect.left, e.clientY - rect.top);
        }
      }
    });

    canvas.addEventListener('pointerleave', () => {
      hoverIdx = -1; tip.hidden = true;
      if (mode !== 'dragNode') canvas.style.cursor = 'grab';
    });

    // wheel → zoom toward cursor
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const factor = Math.exp(-e.deltaY * 0.001);
      const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom * factor));
      const ratio   = newZoom / zoom;
      // keep world point under cursor fixed: adjust pan
      panX = (sx - W / 2) * (1 - ratio) + panX * ratio;
      panY = (sy - H / 2) * (1 - ratio) + panY * ratio;
      zoom = newZoom;
    }, { passive: false });

    // pinch zoom
    const activePointers = new Map();
    let pinchDist0 = 0, pinchZoom0 = 1, pinchMidScreen = [0, 0], pinchPan0 = [0, 0];
    canvas.addEventListener('pointerdown', (e) => {
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (activePointers.size === 2) {
        const [a, b] = [...activePointers.values()];
        pinchDist0 = Math.hypot(a.x - b.x, a.y - b.y);
        pinchZoom0 = zoom;
        pinchPan0  = [panX, panY];
        const rect = canvas.getBoundingClientRect();
        pinchMidScreen = [(a.x + b.x) / 2 - rect.left, (a.y + b.y) / 2 - rect.top];
        mode = 'idle';
      }
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!activePointers.has(e.pointerId)) return;
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (activePointers.size === 2 && pinchDist0 > 0) {
        const [a, b] = [...activePointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, pinchZoom0 * (d / pinchDist0)));
        const ratio   = newZoom / pinchZoom0;
        const mx = pinchMidScreen[0], my = pinchMidScreen[1];
        panX = (mx - W / 2) * (1 - ratio) + pinchPan0[0] * ratio;
        panY = (my - H / 2) * (1 - ratio) + pinchPan0[1] * ratio;
        zoom = newZoom;
      }
    });
    function endPointer(e) { activePointers.delete(e.pointerId); }
    canvas.addEventListener('pointerup',     endPointer);
    canvas.addEventListener('pointercancel', endPointer);

    // ── navigation ────────────────────────────────────────────────────────
    function handleNodeClick(n) {
      if (n.kind === 'post') {
        window.__blogReturnToMap = true;
        if (typeof window.goTo === 'function') window.goTo('blog/' + n.slug);
        else window.location.hash = 'blog/' + n.slug;
      } else {
        window.__introTarget = { route: n.section, index: n.sectionIndex || 0 };
        if (typeof window.goTo === 'function') window.goTo(n.section);
        else window.location.hash = n.section;
      }
    }

    // ── multi-preview cards ───────────────────────────────────────────────
    // Each node can have its own open card simultaneously.
    // activePreviews: nodeIdx → { el, clickAt }
    const activePreviews = new Map();
    const wrap = root.querySelector('.mindmap-canvas-wrap');

    function buildPreviewEl(n, px, py) {
      const post = n.kind === 'post' ? posts[n.idx]    : null;
      const art  = n.kind === 'art'  ? artworks[n.idx] : null;
      const eyebrow = n.kind === 'post'
        ? '› JOURNAL ENTRY'
        : `› ARTWORK · ${(n.section || '').toUpperCase()}`;

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

      const el = document.createElement('div');
      el.className = 'mindmap-preview';
      el.innerHTML = `
        <button class="mp-close" type="button" aria-label="Close preview">×</button>
        <div class="mp-corner mp-c-tl"></div>
        <div class="mp-corner mp-c-tr"></div>
        <div class="mp-corner mp-c-bl"></div>
        <div class="mp-corner mp-c-br"></div>
        <div class="mp-body">${inner}</div>
        <div class="mp-foot">
          <span class="mp-foot-key">› DBL-CLICK TO OPEN</span>
          <span class="mp-foot-pulse"></span>
        </div>
      `;

      // position
      const cw = wrap.clientWidth, ch = wrap.clientHeight;
      const PW = 290, PH = n.kind === 'art' ? 370 : 230, pad = 12;
      let x = px + 22, y = py + 22;
      if (x + PW > cw - pad) x = px - PW - 22;
      x = Math.max(pad, Math.min(cw - PW - pad, x));
      if (y + PH > ch - pad) y = py - PH - 22;
      y = Math.max(pad, Math.min(ch - PH - pad, y));
      el.style.left = x + 'px';
      el.style.top  = y + 'px';

      return el;
    }

    function closePreview(nodeIdx) {
      const entry = activePreviews.get(nodeIdx);
      if (!entry) return;
      const el = entry.el;
      el.classList.remove('is-in');
      el.classList.add('is-out');
      setTimeout(() => el.remove(), 240);
      activePreviews.delete(nodeIdx);
    }

    function togglePreview(n, px, py) {
      const nodeIdx = nodes.indexOf(n);
      // second click on same node → close its card
      if (activePreviews.has(nodeIdx)) { closePreview(nodeIdx); return; }

      const el = buildPreviewEl(n, px, py);
      const entry = { el, clickAt: 0 };
      activePreviews.set(nodeIdx, entry);
      wrap.appendChild(el);
      void el.offsetWidth;
      el.classList.add('is-in');

      // × button
      el.querySelector('.mp-close').addEventListener('click', (e) => {
        e.stopPropagation(); closePreview(nodeIdx);
      });

      // click / dbl-click on card
      el.addEventListener('click', (ev) => {
        if (ev.target.closest('.mp-close')) return;
        // single click on artwork thumbnail → navigate
        if (n.kind === 'art' && ev.target.closest('.mp-thumb')) {
          closePreview(nodeIdx); handleNodeClick(n); return;
        }
        // double click elsewhere → navigate
        const now = Date.now();
        if (now - entry.clickAt < 400) {
          closePreview(nodeIdx); handleNodeClick(n);
        } else {
          entry.clickAt = now;
        }
      });
    }

    // kept for cleanup use
    function hidePreview() {
      for (const nodeIdx of [...activePreviews.keys()]) closePreview(nodeIdx);
    }

    // ── main loop ─────────────────────────────────────────────────────────
    let raf = 0;
    let alive = true;
    function loop() { if (!alive) return; draw(); raf = requestAnimationFrame(loop); }

    const ro = new ResizeObserver(() => resize());
    ro.observe(root.querySelector('.mindmap-canvas-wrap'));
    resize();
    canvas.style.cursor = 'grab';
    loop();

    root._cleanup = () => { alive = false; cancelAnimationFrame(raf); ro.disconnect(); };
    return root;
  }

  window.buildBlogMindmap = buildBlogMindmap;
})();
