// ═══════════════════════════════════════════════════════════════════════════
// anubis3100 — gallery viewer (one-at-a-time, with smooth transitions)
// ═══════════════════════════════════════════════════════════════════════════

const digitalWorks = [
  "bambi quick! the thicket!.gif",
  "butterfly of the lazy simmering apple tree.gif",
  "dream sweet in sea major.gif",
  "fruits-for-the-prince.gif",
  "here we sit.gif",
  "i am big brother and his shadow.gif",
  "it came to me in a dream.gif",
  "just a couple of shareholders grabbing hold of their destinies on the open seas.gif",
  "kerby.gif",
  "king-1.gif",
  "praying-one_weeping-mother.gif",
  "river of peace.gif",
  "sells interlinked within sells.gif",
  "skin the unexplored duck.gif",
  "sleeping-whales-4.gif",
  "sos.gif",
  "teds-cabin-pixalated.gif",
  "the music in the mountains will never stop.gif",
  "the-garden.gif",
  "what-now.gif"
];

const physicalWorks = [
  { file: 'physical-1.jpg'  },
  { file: 'physical-2.jpg'  },
  { file: 'physical-3.jpg'  },
  { file: 'physical-4.jpg'  },
  { file: 'physical-5.jpg'  },
  { file: 'physical-6.avif' },
  { file: 'physical-7.jpg'  },
  { file: 'physical-8.avif' },
  { file: 'physical-9.avif' },
  { file: 'physical-10.jpg' },
];

const studiesWorks = [
  { file: 'studies-1.jpg' },
  { file: 'studies-2.jpg' },
  { file: 'studies-3.jpg' },
  { file: 'studies-4.png' },
  { file: 'studies-5.png' },
  { file: 'studies-6.png' },
  { file: 'studies-7.png' }
];

// ── helpers ────────────────────────────────────────────────────────────────

function formatTitle(filename) {
  return filename
    .replace(/\.(gif|jpg|png|avif)$/i, '')
    .replace(/-/g, ' ')
    .replace(/_/g, ', ');
}

function normalize(works, prefix, defaultMeta) {
  return works.map((w, i) => {
    const file = typeof w === 'string' ? w : w.file;
    const title = typeof w === 'string'
      ? formatTitle(file)
      : (w.title || `Untitled ${String(i + 1).padStart(2, '0')}`);
    const meta = typeof w === 'string' ? defaultMeta : (w.meta || defaultMeta);
    return { file, title, meta, src: prefix + file + '?v=4' };
  });
}

function cvEntry(year, text) {
  return `<div class="cv-entry">
    <span class="cv-year">${year}</span>
    <span class="cv-text">${text}</span>
  </div>`;
}

// ── viewer (one artwork at a time) ─────────────────────────────────────────

function buildViewer(works, sectionLabel) {
  const page = document.createElement('section');
  page.className = 'viewer-page';

  page.innerHTML = `
    <div class="viewer" tabindex="0">
      <div class="viewer-section-label"><span class="dot"></span>${sectionLabel}</div>

      <button class="viewer-arrow prev" aria-label="Previous">
        <span class="arrow-line"></span>
        <span class="arrow-label">Prev</span>
      </button>

      <div class="viewer-stage"></div>

      <button class="viewer-arrow next" aria-label="Next">
        <span class="arrow-line"></span>
        <span class="arrow-label">Scroll to next</span>
      </button>

      <div class="viewer-hud">
        <div class="viewer-counter">
          <span class="current">01</span>
          <span class="sep">/</span>
          <span class="total">${String(works.length).padStart(2,'0')}</span>
        </div>
        <div class="viewer-progress"><div class="viewer-progress-fill"></div></div>
      </div>

      <div class="viewer-thumbs"></div>
    </div>
  `;

  const viewer   = page.querySelector('.viewer');
  const stage    = page.querySelector('.viewer-stage');
  const prevBtn  = page.querySelector('.viewer-arrow.prev');
  const nextBtn  = page.querySelector('.viewer-arrow.next');
  const curEl    = page.querySelector('.viewer-counter .current');
  const fill     = page.querySelector('.viewer-progress-fill');
  const thumbs   = page.querySelector('.viewer-thumbs');

  // build thumbs
  works.forEach((_, i) => {
    const t = document.createElement('div');
    t.className = 'thumb';
    t.dataset.index = i;
    t.addEventListener('click', () => goToIndex(i));
    thumbs.appendChild(t);
  });

  let index = 0;
  let animating = false;

  function renderSlide(i, dir) {
    const work = works[i];
    const slide = document.createElement('div');
    slide.className = 'viewer-slide entering';
    slide.style.setProperty('--dir', (dir >= 0 ? '40px' : '-40px'));
    slide.innerHTML = `
      <div class="viewer-artwork">
        <div class="artwork-frame">
          <img src="${work.src}" alt="${work.title}" data-file="${work.file}" />
        </div>
        <div class="viewer-caption">
          <div class="cap-index">Nº ${String(i + 1).padStart(2, '0')} · ${String(works.length).padStart(2, '0')}</div>
          <div class="cap-title">${work.title}</div>
          <div class="cap-meta">${work.meta}</div>
        </div>
      </div>
    `;
    // click image opens lightbox
    const imgEl = slide.querySelector('img');
    imgEl.addEventListener('click', () => {
      openLightbox(work.src, work.title);
    });
    // 3D tilt — bind to frame (stable bounds) instead of img (which transforms)
    const frameEl = slide.querySelector('.artwork-frame');
    const hoverTarget = frameEl || imgEl;
    hoverTarget.addEventListener('mouseenter', () => {
      imgEl.classList.add('is-tilting');
    });
    hoverTarget.addEventListener('mousemove', (e) => {
      // use the frame's rect — it doesn't move, so no feedback loop
      const r = hoverTarget.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width  - 0.5;
      const py = (e.clientY - r.top)  / r.height - 0.5;
      imgEl.style.setProperty('--tilt-x', (py * -9) + 'deg');
      imgEl.style.setProperty('--tilt-y', (px *  9) + 'deg');
      imgEl.style.setProperty('--float-x', (px *  6) + 'px');
      imgEl.style.setProperty('--float-y', (-10 + py * 5) + 'px');
      // directional halo — opposite side of the cursor, like light from cursor casts a glow
      imgEl.style.setProperty('--glow-x', (-px * 40) + 'px');
      imgEl.style.setProperty('--glow-y', (-py * 40 + 20) + 'px');
    });
    hoverTarget.addEventListener('mouseleave', () => {
      imgEl.classList.remove('is-tilting');
      imgEl.style.setProperty('--tilt-x', '0deg');
      imgEl.style.setProperty('--tilt-y', '0deg');
      imgEl.style.setProperty('--float-x', '0px');
      imgEl.style.setProperty('--float-y', '0px');
      imgEl.style.setProperty('--glow-x', '0px');
      imgEl.style.setProperty('--glow-y', '24px');
    });

    // caption tilt on hover
    const capEl = slide.querySelector('.viewer-caption');
    if (capEl) {
      capEl.addEventListener('mousemove', (e) => {
        const r = capEl.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width  - 0.5;
        const py = (e.clientY - r.top)  / r.height - 0.5;
        capEl.style.setProperty('--cap-tilt-x', (py * -8) + 'deg');
        capEl.style.setProperty('--cap-tilt-y', (px *  8) + 'deg');
      });
      capEl.addEventListener('mouseleave', () => {
        capEl.style.setProperty('--cap-tilt-x', '0deg');
        capEl.style.setProperty('--cap-tilt-y', '0deg');
      });
    }
    return slide;
  }

  function goToIndex(i, dir) {
    if (animating) return;
    const next = ((i % works.length) + works.length) % works.length;
    if (next === index && stage.children.length > 0) return;
    const d = dir == null ? (next > index ? 1 : -1) : dir;
    animating = true;

    const old = stage.querySelector('.viewer-slide');
    const slide = renderSlide(next, d);
    slide.style.setProperty('--dir', (d >= 0 ? '40px' : '-40px'));
    stage.appendChild(slide);

    if (old) {
      old.classList.remove('entering');
      old.classList.add('leaving');
      old.style.setProperty('--dir', (d >= 0 ? '40px' : '-40px'));
      setTimeout(() => old.remove(), 520);
    }

    index = next;
    curEl.textContent = String(index + 1).padStart(2, '0');
    fill.style.width = ((index + 1) / works.length * 100) + '%';
    thumbs.querySelectorAll('.thumb').forEach((t, ti) => {
      t.classList.toggle('active', ti === index);
    });

    setTimeout(() => { animating = false; }, 520);
  }

  // initial — honor intro target if route matches
  let initialIndex = 0;
  const tgt = window.__introTarget;
  if (tgt && tgt.route === getRoute() && typeof tgt.index === 'number') {
    initialIndex = Math.max(0, Math.min(works.length - 1, tgt.index));
    window.__introTarget = null;
  }
  requestAnimationFrame(() => goToIndex(initialIndex, 1));

  // controls
  prevBtn.addEventListener('click', () => goToIndex(index - 1, -1));
  nextBtn.addEventListener('click', () => goToIndex(index + 1, 1));

  // keyboard
  function onKey(e) {
    if (document.getElementById('lightbox').classList.contains('open')) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); goToIndex(index + 1, 1); }
    if (e.key === 'ArrowLeft')  { e.preventDefault(); goToIndex(index - 1, -1); }
  }
  document.addEventListener('keydown', onKey);
  page._cleanup = () => document.removeEventListener('keydown', onKey);

  // wheel — debounced
  let wheelLock = false;
  viewer.addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaY) < 8 && Math.abs(e.deltaX) < 8) return;
    e.preventDefault();
    if (wheelLock || animating) return;
    wheelLock = true;
    const dir = (e.deltaY + e.deltaX) > 0 ? 1 : -1;
    goToIndex(index + dir, dir);
    setTimeout(() => { wheelLock = false; }, 650);
  }, { passive: false });

  // swipe
  let touchX = 0, touchY = 0;
  viewer.addEventListener('touchstart', e => {
    touchX = e.touches[0].clientX;
    touchY = e.touches[0].clientY;
  }, { passive: true });
  viewer.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - touchX;
    const dy = e.changedTouches[0].clientY - touchY;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
      goToIndex(index + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
    }
  }, { passive: true });

  return page;
}

// ── pages ──────────────────────────────────────────────────────────────────

function pageDigital() {
  return buildViewer(
    normalize(digitalWorks, 'assets/digital work/', 'Digital animation'),
    'Digital'
  );
}
function pagePhysical() {
  return buildViewer(
    normalize(physicalWorks, 'assets/physical paintings/', 'Oil on canvas'),
    'Painting — Physical'
  );
}
function pageStudies() {
  return buildViewer(
    normalize(studiesWorks, 'assets/studies/', 'Study'),
    'Painting — Studies'
  );
}

function pageVideo() {
  const section = document.createElement('section');
  section.className = 'video-section';
  section.innerHTML = `
    <div class="video-grid">
      <div class="video-item">
        <div class="video-embed-wrap">
          <iframe
            src="https://www.youtube.com/embed/D4xZp1IBla0"
            title="Video work by anubis3100"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowfullscreen>
          </iframe>
        </div>
        <div class="video-info">
          <p class="video-title">Video work</p>
          <p class="video-meta">Digital video · 2024</p>
        </div>
      </div>
    </div>
  `;
  return section;
}

function pageCV() {
  const wrap = document.createElement('div');
  wrap.className = 'cv-wrap';
  wrap.innerHTML = `
    <div class="bio">
      <p class="bio-name">anubis3100</p>
      <p class="bio-detail">Born 1998, Giza, Egypt<br>BFA, University of Ottawa, 2016–2021</p>
    </div>

    <div class="cv-section">
      <p class="cv-section-label">Group Exhibitions</p>
      ${cvEntry('2024', 'Subjective Art Festival, Burrito DAO x Subjective NYC x Lume Studios <em>— New York</em>')}
      ${cvEntry('2024', 'Artist Showcase, Singapore Crypto Carnival, ArtOnInternet x Forbes Web3 x Magic Eden x Takeover <em>— Singapore</em>')}
      ${cvEntry('2024', 'RGB MTL, hosted by Strano <em>— Montreal, Canada</em>')}
      ${cvEntry('2024', 'Art for Humanity 2, Superlative Gallery <em>— Legian, Bali</em>')}
      ${cvEntry('2023', 'Intertwined, Art Blocks x MOCA x Artdao <em>— Lisbon, Portugal</em>')}
      ${cvEntry('2023', 'NFT Brasil 2023, nft brasil <em>— Ciccillo Matarazzo Pavilion, São Paulo, Brazil</em>')}
      ${cvEntry('2023', 'Making It Exhibition, MakingIt 24/7 <em>— New York</em>')}
      ${cvEntry('2023', 'Making It x Kula x PureWeb3, Burrito DAO art exhibition <em>— New York</em>')}
      ${cvEntry('2023', 'Making It x MOCA pop-up exhibition, Bathhouse Studios <em>— New York</em>')}
      ${cvEntry('2023', '"Making It Home" virtual exhibition and auction, MakingIt 24/7 <em>— oncyber</em>')}
      ${cvEntry('2023', 'NFT.NYC 2023 Diversity of Art Showcase <em>— New York</em>')}
      ${cvEntry('2023', '"Children of the Internet" virtual exhibition, MakingIt x MOCA <em>— hyperfy</em>')}
      ${cvEntry('2023', 'Children of the Internet, show and drop, MakingIt 24/7 collective <em>— oncyber</em>')}
      ${cvEntry('2022', 'Who Mi?, show and drop, MakingIt 24/7 collective <em>— oncyber</em>')}
      ${cvEntry('2022', 'Omente Orange, show and drop, MakingIt 24/7 collective <em>— oncyber</em>')}
      ${cvEntry('2022', 'Proof of People group show, verticalcryptoart <em>— London, United Kingdom</em>')}
      ${cvEntry('2022', '1st Making It group show, Making It collective <em>— New York</em>')}
      ${cvEntry('2022', 'ETH Barcelona x MOCA x DoinGud <em>— Barcelona, Spain</em>')}
      ${cvEntry('2022', 'NFT.NYC 2022 Diversity of Art Showcase <em>— New York</em>')}
      ${cvEntry('2022', '3rd cohort residency auction and virtual exhibition, verticalcryptoart <em>— hyperfy</em>')}
      ${cvEntry('2020', 'End Sars with Art, fundraising auction for Nigeria, AGAH <em>— oncyber</em>')}
      ${cvEntry('2020', 'Eunoia, University of Ottawa <em>— Ottawa</em>')}
    </div>

    <div class="cv-section">
      <p class="cv-section-label">Art Administration</p>
      ${cvEntry('2024–present', 'Art for Humanity, founder & team member <em>(art auction fundraising organization)</em>')}
      ${cvEntry('2023', 'Children of the Internet MOCA group show, curator')}
      ${cvEntry('2022–present', 'MOCA, community outreach')}
      ${cvEntry('2022', 'Art discord created and managed for artist Terrell Jones')}
      ${cvEntry('2022', 'Art focused, created the Rozwell company')}
      ${cvEntry('2022–present', 'MOCA, ambassador')}
      ${cvEntry('2022', 'Art advisor, airwire.io')}
      ${cvEntry('2021', 'Art content creator, the Metakey project')}
      ${cvEntry('2021', 'Art judge, Creator Competition by Creator Collective')}
      ${cvEntry('2015', 'TEDx AISE Egypt, sound and lighting <em>— Cairo, Egypt</em>')}
      ${cvEntry('2014', 'Art assistant, The Egyptian Sibyl, Gavin Worth <em>— Cairo, Egypt</em>')}
    </div>

    <div class="cv-section">
      <p class="cv-section-label">Collections</p>
      ${cvEntry('2023–present', 'Private collections')}
      ${cvEntry('2022', 'Tezos Foundation permanent art collection')}
      ${cvEntry('2022', 'MOCA permanent collection')}
      ${cvEntry('2022', 'NFT.NYC 2022 "Diversity of NFTs" Art Collection')}
      ${cvEntry('2022', 'Private collections')}
      ${cvEntry('2021', 'The Metakey Project vault')}
      ${cvEntry('2021', 'Flume x Jonathan Zawda collection')}
      ${cvEntry('2021', 'Private collections')}
      ${cvEntry('2016–2020', 'Private collections')}
      ${cvEntry('2011–2016', 'Private collections')}
    </div>
  `;
  return wrap;
}

// ── router ─────────────────────────────────────────────────────────────────

const routes = {
  digital:  pageDigital,
  physical: pagePhysical,
  studies:  pageStudies,
  video:    pageVideo,
  cv:       pageCV,
};

const app = document.getElementById('app');
let navigating = false;

function getRoute() {
  const hash = window.location.hash.slice(1);
  return routes[hash] ? hash : 'digital';
}

function updateNavActive(route) {
  document.querySelectorAll('.nav-links > li > a[data-route]').forEach(a => {
    a.classList.toggle('active', a.dataset.route === route);
  });
  const paintingToggleEl = document.getElementById('painting-toggle');
  if (paintingToggleEl) {
    paintingToggleEl.classList.toggle('active', route === 'physical' || route === 'studies');
  }
  document.querySelectorAll('.dropdown-menu a[data-route]').forEach(a => {
    a.classList.toggle('active', a.dataset.route === route);
  });
  const titles = {
    digital: 'anubis3100',
    physical: 'anubis3100 — Painting',
    studies: 'anubis3100 — Studies',
    video: 'anubis3100 — Video',
    cv: 'anubis3100 — CV'
  };
  document.title = titles[route] || 'anubis3100';
}

function renderRoute(route) {
  updateNavActive(route);
  const lb = document.getElementById('lightbox');
  if (lb.classList.contains('open')) closeLightbox();

  // cleanup old listeners
  const oldPage = app.querySelector('.page-content');
  if (oldPage && oldPage._childCleanup) oldPage._childCleanup();

  app.innerHTML = '';
  const wrapper = document.createElement('div');
  wrapper.className = 'page-content';
  const view = routes[route]();
  if (view._cleanup) wrapper._childCleanup = view._cleanup;
  wrapper.appendChild(view);
  app.appendChild(wrapper);
  window.scrollTo(0, 0);

  // focus viewer for keyboard nav
  const v = wrapper.querySelector('.viewer');
  if (v) setTimeout(() => v.focus({ preventScroll: true }), 100);
}

function goTo(route) {
  if (navigating || route === getRoute()) return;
  navigating = true;
  const currentContent = app.querySelector('.page-content');
  if (currentContent) {
    if (currentContent._childCleanup) currentContent._childCleanup();
    currentContent.classList.add('leaving');
    setTimeout(() => {
      history.pushState(null, '', '#' + route);
      renderRoute(route);
      navigating = false;
    }, 280);
  } else {
    history.pushState(null, '', '#' + route);
    renderRoute(route);
    navigating = false;
  }
}

document.querySelectorAll('a[data-route]').forEach(link => {
  link.addEventListener('click', e => { e.preventDefault(); goTo(link.dataset.route); });
});

const navLogo = document.querySelector('.nav-logo');
if (navLogo) navLogo.addEventListener('click', e => { e.preventDefault(); goTo('digital'); });

window.addEventListener('popstate', () => { if (!navigating) renderRoute(getRoute()); });

// ── lightbox ───────────────────────────────────────────────────────────────

const lightbox  = document.getElementById('lightbox');
const lbImg     = document.getElementById('lightbox-img');
const lbCaption = document.getElementById('lightbox-caption');
const lbClose   = document.getElementById('lightbox-close');

function openLightbox(src, caption) {
  lbImg.src = src;
  lbImg.alt = caption;
  lbCaption.textContent = caption;
  lbImg.classList.remove('lb-entering', 'lb-leaving');
  lbCaption.classList.remove('lb-entering');
  void lbImg.offsetWidth;
  lbImg.classList.add('lb-entering');
  lbCaption.classList.add('lb-entering');
  lightbox.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  lbImg.classList.remove('lb-entering');
  lbImg.classList.add('lb-leaving');
  lbCaption.classList.remove('lb-entering');
  lbCaption.classList.add('lb-leaving');
  lightbox.classList.remove('open');
  setTimeout(() => {
    lbImg.classList.remove('lb-leaving');
    lbCaption.classList.remove('lb-leaving');
    // do NOT clear lbImg.src — an empty src shows a broken-image icon + alt text.
    // the lightbox is hidden via visibility; the src can safely stay until next open.
    document.body.style.overflow = '';
  }, 320);
}

lbClose.addEventListener('click', closeLightbox);
lightbox.addEventListener('click', e => { if (e.target === lightbox) closeLightbox(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLightbox(); });

// ── painting dropdown ──────────────────────────────────────────────────────

const paintingToggle = document.getElementById('painting-toggle');
const paintingMenu   = document.getElementById('painting-menu');

paintingToggle.addEventListener('click', e => {
  e.stopPropagation();
  if (window.innerWidth >= 768) paintingMenu.classList.toggle('open');
});

// ── mobile nav ─────────────────────────────────────────────────────────────

const navBurger    = document.getElementById('nav-burger');
const navLinksList = document.querySelector('.nav-links');
const navOverlay   = document.getElementById('nav-overlay');

function closeAllMenus() {
  paintingMenu.classList.remove('open');
  navBurger.classList.remove('open');
  navLinksList.classList.remove('mobile-open');
  if (navOverlay) navOverlay.classList.remove('active');
}

navBurger.addEventListener('click', e => {
  e.stopPropagation();
  const isOpen = navBurger.classList.toggle('open');
  navLinksList.classList.toggle('mobile-open', isOpen);
  if (navOverlay) navOverlay.classList.toggle('active', isOpen);
});

if (navOverlay) {
  navOverlay.addEventListener('click', closeAllMenus);
  navOverlay.addEventListener('touchstart', closeAllMenus, { passive: true });
}
document.addEventListener('click', closeAllMenus);

// ── dark mode ──────────────────────────────────────────────────────────────

const themeToggle = document.getElementById('theme-toggle');
if (localStorage.getItem('theme') !== 'light') document.body.classList.add('dark');
document.documentElement.classList.remove('dark-preload');

themeToggle.addEventListener('click', () => {
  document.body.classList.toggle('dark');
  localStorage.setItem('theme', document.body.classList.contains('dark') ? 'dark' : 'light');
});

// ── initial render ─────────────────────────────────────────────────────────
renderRoute(getRoute());

