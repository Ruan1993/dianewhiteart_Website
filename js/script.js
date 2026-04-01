const soldKey = 'dianeWhiteArtSoldState';

function setActiveNav() {
  const page = document.body.dataset.page;
  document.querySelectorAll('[data-nav]').forEach(link => {
    if (link.dataset.nav === page) link.classList.add('active');
  });
}

function initMenu() {
  const toggle = document.querySelector('[data-menu-toggle]');
  const links = document.querySelector('.nav-links');
  if (!toggle || !links) return;

  toggle.addEventListener('click', () => {
    document.body.classList.toggle('menu-open');
  });

  links.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => document.body.classList.remove('menu-open'));
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') document.body.classList.remove('menu-open');
  });
}

function initHeroSlider() {
  const slides = Array.from(document.querySelectorAll('.hero-slide'));
  const dots = Array.from(document.querySelectorAll('.hero-dots button'));
  if (!slides.length) return;
  let index = 0;

  const activate = (i) => {
    slides.forEach((slide, idx) => slide.classList.toggle('active', idx === i));
    dots.forEach((dot, idx) => dot.classList.toggle('active', idx === i));
    index = i;
  };

  dots.forEach((dot, i) => dot.addEventListener('click', () => activate(i)));
  activate(0);
  setInterval(() => activate((index + 1) % slides.length), 7000);
}

function getSoldState() {
  try { return JSON.parse(localStorage.getItem(soldKey) || '{}'); }
  catch { return {}; }
}

function saveSoldState(state) {
  localStorage.setItem(soldKey, JSON.stringify(state));
}

function applySoldState() {
  const state = getSoldState();
  document.querySelectorAll('[data-art-id]').forEach(card => {
    const id = card.dataset.artId;
    const sold = !!state[id];
    const badge = card.querySelector('.badge');
    const statusText = card.querySelector('[data-status-text]');
    const toggle = card.querySelector('[data-toggle-sold]');
    if (badge) {
      badge.textContent = sold ? 'Sold' : 'Available';
      badge.classList.toggle('sold', sold);
    }
    if (statusText) statusText.textContent = sold ? 'Status: Sold' : 'Status: Available';
    if (toggle) toggle.textContent = sold ? 'Mark Available' : 'Mark Sold';
  });
}

function initSoldToggles() {
  const state = getSoldState();
  document.querySelectorAll('[data-toggle-sold]').forEach(button => {
    button.addEventListener('click', () => {
      const card = button.closest('[data-art-id]');
      if (!card) return;
      const id = card.dataset.artId;
      state[id] = !state[id];
      saveSoldState(state);
      applySoldState();
    });
  });
  applySoldState();
}

function initFilters() {
  const filterButtons = Array.from(document.querySelectorAll('[data-filter]'));
  const cards = Array.from(document.querySelectorAll('[data-category]'));
  if (!filterButtons.length || !cards.length) return;

  filterButtons.forEach(button => {
    button.addEventListener('click', () => {
      const filter = button.dataset.filter;
      filterButtons.forEach(btn => btn.classList.toggle('active', btn === button));
      cards.forEach(card => {
        const show = filter === 'all' || card.dataset.category.includes(filter);
        card.style.display = show ? '' : 'none';
      });
    });
  });
}

function initLightbox() {
  const triggerImages = document.querySelectorAll('.art-image img');
  if (!triggerImages.length) return;

  const existing = document.querySelector('.lightbox');
  if (existing) existing.remove();

  const lightbox = document.createElement('div');
  lightbox.className = 'lightbox';
  lightbox.innerHTML = `
    <div class="lightbox-inner">
      <button class="lightbox-close" type="button" aria-label="Close image viewer">×</button>
      <img src="" alt="" />
    </div>
  `;
  document.body.appendChild(lightbox);

  const lightboxImg = lightbox.querySelector('img');
  const closeBtn = lightbox.querySelector('.lightbox-close');

  function closeLightbox() {
    lightbox.classList.remove('open');
    lightboxImg.src = '';
  }

  triggerImages.forEach(img => {
    img.classList.add('clickable-image');
    img.addEventListener('click', () => {
      lightboxImg.src = img.src;
      lightboxImg.alt = img.alt || 'Artwork image';
      lightbox.classList.add('open');
    });
  });

  closeBtn.addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightbox();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && lightbox.classList.contains('open')) closeLightbox();
  });
}

function initBackToTop() {
  const existing = document.querySelector('.back-to-top');
  if (existing) existing.remove();

  const button = document.createElement('button');
  button.className = 'back-to-top';
  button.type = 'button';
  button.setAttribute('aria-label', 'Back to top');
  button.innerHTML = '↑';
  document.body.appendChild(button);

  const toggleVisibility = () => {
    if (window.innerWidth <= 760) {
      button.classList.add('show');
      return;
    }
    button.classList.toggle('show', window.scrollY > 280);
  };

  window.addEventListener('scroll', toggleVisibility, { passive: true });
  window.addEventListener('resize', toggleVisibility);
  toggleVisibility();

  button.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

function initDynamicYear() {
  document.querySelectorAll('[data-current-year]').forEach(el => {
    el.textContent = new Date().getFullYear();
  });
}

function initContactPrefill() {
  const form = document.querySelector('.pretty-form');
  if (!form) return;
  const params = new URLSearchParams(window.location.search);
  const artwork = params.get('artwork');
  const messageBox = form.querySelector('textarea');
  const subjectSelect = form.querySelector('select');
  if (artwork && messageBox) {
    const decoded = decodeURIComponent(artwork);
    messageBox.value = `Hello, I would like to enquire about this artwork:\n\n${decoded}`;
    if (subjectSelect) subjectSelect.value = 'Interested in original artwork';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  setActiveNav();
  initMenu();
  initHeroSlider();
  initSoldToggles();
  initFilters();
  initLightbox();
  initBackToTop();
  initDynamicYear();
  initContactPrefill();
});
