// ── data ─────────────────────────────────────────────────────────────────────

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
  { file: 'physical-1.jpg',  title: 'Untitled', meta: '' },
  { file: 'physical-2.jpg',  title: 'Untitled', meta: '' },
  { file: 'physical-3.jpg',  title: 'Untitled', meta: '' },
  { file: 'physical-4.jpg',  title: 'Untitled', meta: '' },
  { file: 'physical-5.jpg',  title: 'Untitled', meta: '' },
  { file: 'physical-6.avif', title: 'Untitled', meta: '' },
  { file: 'physical-7.jpg',  title: 'Untitled', meta: '' },
  { file: 'physical-8.avif', title: 'Untitled', meta: '' },
  { file: 'physical-9.avif', title: 'Untitled', meta: '' },
  { file: 'physical-10.jpg', title: 'Untitled', meta: '' },
];

const studiesWorks = [
  { file: 'studies-1.jpg', title: 'Untitled', meta: '' },
  { file: 'studies-2.jpg', title: 'Untitled', meta: '' },
  { file: 'studies-3.jpg', title: 'Untitled', meta: '' }
];

// ── helpers ───────────────────────────────────────────────────────────────────

function formatTitle(filename) {
  return filename
    .replace(/\.(gif|jpg|png)$/i, '')
    .replace(/-/g, ' ')
    .replace(/_/g, ', ');
}

function cvEntry(year, text) {
  return `<div class="cv-entry">
    <span class="cv-year">${year}</span>
    <span class="cv-text">${text}</span>
  </div>`;
}

// ── gallery builder ────────────────────────────────────────────────────────────

function buildGallery(works, srcPrefix) {
  const strip = document.createElement('div');
  strip.className = 'strip';

  works.forEach(work => {
    const file  = typeof work === 'string' ? work : work.file;
    const title = typeof work === 'string' ? formatTitle(file) : work.title;
    const meta  = typeof work === 'string' ? 'Digital animation' : work.meta;
    const src   = srcPrefix + file;

    const el = document.createElement('div');
    el.className = 'artwork';
    el.innerHTML = `
      <div class="artwork-img-wrap">
        <img src="${src}" alt="${title}" loading="lazy" />
      </div>
      <div class="artwork-info">
        <p class="artwork-title">${title}</p>
        ${meta ? `<p class="artwork-meta">${meta}</p>` : ''}
      </div>
    `;
    el.addEventListener('click', () => openLightbox(src, title));
    strip.appendChild(el);
  });

  makeDraggable(strip);

  const section = document.createElement('section');
  section.className = 'section';
  section.appendChild(strip);
  return section;
}

// ── page renderers ─────────────────────────────────────────────────────────────

function pageDigital() {
  const frag = document.createDocumentFragment();
  frag.appendChild(buildGallery(digitalWorks, 'assets/digital work/'));
  return frag;
}

function pagePhysical() {
  const frag = document.createDocumentFragment();
  frag.appendChild(buildGallery(physicalWorks, 'assets/physical paintings/'));
  return frag;
}

function pageStudies() {
  const frag = document.createDocumentFragment();
  frag.appendChild(buildGallery(studiesWorks, 'assets/studies/'));
  return frag;
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
          <p class="video-meta">Digital video</p>
        </div>
      </div>
    </div>
  `;
  const frag = document.createDocumentFragment();
  frag.appendChild(section);
  return frag;
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
      ${cvEntry('2023', 'NFT Brasil 2023, nft brasil <em>— São Paulo, Brazil</em>')}
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

    <div class="cv-section" style="margin-top:48px;">
      <p class="cv-section-label">Art Administration</p>
      ${cvEntry('2024–present', 'Art for Humanity, team member <em>(art auction fundraising organization)</em>')}
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

    <div class="cv-section" style="margin-top:48px;">
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
  const frag = document.createDocumentFragment();
  frag.appendChild(wrap);
  return frag;
}

// ── routes ─────────────────────────────────────────────────────────────────────

const routes = {
  digital:  pageDigital,
  physical: pagePhysical,
  studies:  pageStudies,
  video:    pageVideo,
  cv:       pageCV,
};

// ── router ─────────────────────────────────────────────────────────────────────

const app = document.getElementById('app');
let navigating = false;

function getRoute() {
  const hash = window.location.hash.slice(1);
  return routes[hash] ? hash : 'digital';
}

function updateNavActive(route) {
  // Main nav links
  document.querySelectorAll('.nav-links > li > a[data-route]').forEach(a => {
    a.classList.toggle('active', a.dataset.route === route);
  });
  // Painting toggle — active when on physical or studies
  const paintingToggleEl = document.getElementById('painting-toggle');
  if (paintingToggleEl) {
    paintingToggleEl.classList.toggle('active', route === 'physical' || route === 'studies');
  }
  // Dropdown items
  document.querySelectorAll('.dropdown-menu a[data-route]').forEach(a => {
    a.classList.toggle('active', a.dataset.route === route);
  });
  // Update document title
  const titles = { digital: 'anubis3100', physical: 'anubis3100 — Painting', studies: 'anubis3100 — Studies', video: 'anubis3100 — Video', cv: 'anubis3100 — CV' };
  document.title = titles[route] || 'anubis3100';
}

function renderRoute(route) {
  updateNavActive(route);
  if (document.getElementById('lightbox').classList.contains('open')) closeLightbox();

  app.innerHTML = '';
  const wrapper = document.createElement('div');
  wrapper.className = 'page-content';
  wrapper.appendChild(routes[route]());
  app.appendChild(wrapper);
  window.scrollTo(0, 0);
}

function goTo(route) {
  if (navigating || route === getRoute()) return;
  navigating = true;

  const currentContent = app.querySelector('.page-content');
  if (currentContent) {
    currentContent.classList.add('leaving');
    setTimeout(() => {
      history.pushState(null, '', '#' + route);
      renderRoute(route);
      navigating = false;
    }, 250);
  } else {
    history.pushState(null, '', '#' + route);
    renderRoute(route);
    navigating = false;
  }
}

// Nav link clicks (intercepted for fade-out animation)
document.querySelectorAll('a[data-route]').forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    goTo(link.dataset.route);
  });
});

// Logo click → go to digital
const navLogo = document.querySelector('.nav-logo');
if (navLogo) {
  navLogo.addEventListener('click', e => {
    e.preventDefault();
    goTo('digital');
  });
}

// Browser back / forward
window.addEventListener('popstate', () => {
  if (!navigating) renderRoute(getRoute());
});

// ── draggable strips ───────────────────────────────────────────────────────────

function makeDraggable(el) {
  let isDown = false, startX, scrollLeft, moved = false;
  el.addEventListener('mousedown', e => {
    isDown = true; moved = false;
    startX = e.pageX - el.offsetLeft;
    scrollLeft = el.scrollLeft;
  });
  el.addEventListener('mouseleave', () => { isDown = false; });
  el.addEventListener('mouseup',    () => { isDown = false; });
  el.addEventListener('mousemove', e => {
    if (!isDown) return;
    e.preventDefault();
    moved = true;
    el.scrollLeft = scrollLeft - (e.pageX - el.offsetLeft - startX) * 1.2;
  });
  // Prevent click from firing after a drag
  el.addEventListener('click', e => { if (moved) e.stopPropagation(); }, true);
}

// ── lightbox ───────────────────────────────────────────────────────────────────

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
  void lbImg.offsetWidth; // force reflow to restart animation
  lbImg.classList.add('lb-entering');
  lbCaption.classList.add('lb-entering');
  lightbox.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  lbImg.classList.remove('lb-entering');
  lbImg.classList.add('lb-leaving');
  lbCaption.classList.remove('lb-entering');
  lightbox.classList.remove('open');
  setTimeout(() => {
    lbImg.classList.remove('lb-leaving');
    lbImg.src = '';
    document.body.style.overflow = '';
  }, 280);
}

lbClose.addEventListener('click', closeLightbox);
lightbox.addEventListener('click', e => { if (e.target === lightbox) closeLightbox(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLightbox(); });

// ── painting dropdown ──────────────────────────────────────────────────────────

const paintingToggle = document.getElementById('painting-toggle');
const paintingMenu   = document.getElementById('painting-menu');

paintingToggle.addEventListener('click', e => {
  e.stopPropagation();
  if (window.innerWidth >= 768) paintingMenu.classList.toggle('open');
});

// ── mobile nav ─────────────────────────────────────────────────────────────────

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
  // Show/hide the transparent overlay so tapping outside reliably closes the nav
  // on iOS Safari (which doesn't bubble click events from non-interactive elements)
  if (navOverlay) navOverlay.classList.toggle('active', isOpen);
});

// Close on overlay tap — handles iOS where document click doesn't always fire
if (navOverlay) {
  navOverlay.addEventListener('click',      closeAllMenus);
  navOverlay.addEventListener('touchstart', closeAllMenus, { passive: true });
}

// Keep the document click handler as a fallback for desktop dropdown close
document.addEventListener('click', closeAllMenus);

// ── custom cursor ──────────────────────────────────────────────────────────────

const cursorDot = document.createElement('div');
cursorDot.className = 'cursor-dot';
cursorDot.style.left = '-100px';
cursorDot.style.top  = '-100px';
document.body.appendChild(cursorDot);

let cursorOnPage = true;

window.addEventListener('mousemove', e => {
  cursorOnPage = true;
  cursorDot.style.left = e.clientX + 'px';
  cursorDot.style.top  = e.clientY + 'px';
});

document.addEventListener('mouseleave', () => { cursorOnPage = false; });
document.addEventListener('mouseenter', () => { cursorOnPage = true;  });

window.addEventListener('scroll', () => {
  if (!cursorOnPage) {
    cursorDot.style.left = '-100px';
    cursorDot.style.top  = '-100px';
  }
}, { passive: true });

// ── dark mode ──────────────────────────────────────────────────────────────────

const themeToggle = document.getElementById('theme-toggle');

if (localStorage.getItem('theme') === 'dark') document.body.classList.add('dark');

themeToggle.addEventListener('click', () => {
  document.body.classList.toggle('dark');
  localStorage.setItem('theme', document.body.classList.contains('dark') ? 'dark' : 'light');
});

// ── initial render ─────────────────────────────────────────────────────────────

renderRoute(getRoute());
