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
    <div class="lightbox-inner hi-res-ready">
      <button class="lightbox-close" type="button" aria-label="Close image viewer">×</button>
      <img src="" alt="" />
    </div>
  `;
  document.body.appendChild(lightbox);

  const lightboxImg = lightbox.querySelector('img');
  const closeBtn = lightbox.querySelector('.lightbox-close');

  function fitImageToViewport() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const nw = lightboxImg.naturalWidth || 0;
    const nh = lightboxImg.naturalHeight || 0;
    if (!nw || !nh) return;

    const padding = window.innerWidth <= 760 ? 24 : 48;
    const maxW = vw - padding;
    const maxH = vh - padding;
    const scale = Math.min(maxW / nw, maxH / nh, 1); // never upscale beyond native resolution
    const finalW = Math.floor(nw * scale);
    const finalH = Math.floor(nh * scale);

    lightboxImg.style.width = finalW + 'px';
    lightboxImg.style.height = finalH + 'px';
  }

  function closeLightbox() {
    lightbox.classList.remove('open');
    lightbox.classList.remove('loading');
    lightboxImg.removeAttribute('src');
    lightboxImg.style.width = '';
    lightboxImg.style.height = '';
  }

  triggerImages.forEach(img => {
    img.classList.add('clickable-image');
    img.addEventListener('click', () => {
      const hiRes = img.dataset.full || img.getAttribute('data-full') || img.currentSrc || img.src;
      lightbox.classList.add('open');
      lightbox.classList.add('loading');
      lightboxImg.alt = img.alt || 'Artwork image';

      const preload = new Image();
      preload.onload = () => {
        lightboxImg.src = hiRes;
        fitImageToViewport();
        lightbox.classList.remove('loading');
      };
      preload.onerror = () => {
        lightboxImg.src = img.currentSrc || img.src;
        fitImageToViewport();
        lightbox.classList.remove('loading');
      };
      preload.src = hiRes;
    });
  });

  closeBtn.addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightbox();
  });

  window.addEventListener('resize', () => {
    if (lightbox.classList.contains('open') && lightboxImg.src) fitImageToViewport();
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
    const generalTopics = ['Shipping Enquiry','Commission Enquiry','Privacy Policy Enquiry','Terms and Conditions Enquiry','Testimonial Enquiry'];
    const isGeneral = generalTopics.includes(decoded);
    messageBox.value = isGeneral
      ? `Hello, I would like to enquire about: ${decoded}.`
      : `Hello, I would like to enquire about this artwork:\n\n${decoded}`;
    if (subjectSelect) {
      if (decoded === 'Commission Enquiry') subjectSelect.value = 'Commission enquiry';
      else if (decoded === 'Shipping Enquiry') subjectSelect.value = 'General enquiry';
      else if (!isGeneral) subjectSelect.value = 'Interested in original artwork';
      else subjectSelect.value = 'General enquiry';
    }
  }
}


function initFormspreeForms() {
  const forms = document.querySelectorAll('.formspree-form');
  if (!forms.length) return;

  forms.forEach(form => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const submitBtn = form.querySelector('button[type="submit"]');
      const successBox = form.querySelector('.form-success-message');
      let errorBox = form.querySelector('.form-error-message');

      if (successBox) successBox.hidden = true;
      if (!errorBox) {
        errorBox = document.createElement('div');
        errorBox.className = 'form-error-message';
        errorBox.hidden = true;
        form.appendChild(errorBox);
      }
      errorBox.hidden = true;
      errorBox.textContent = '';

      const formData = new FormData(form);
      const formType = form.dataset.formType || '';

      if (formType === 'newsletter') {
        const name = (formData.get('name') || '').toString().trim();
        const email = (formData.get('email') || '').toString().trim();
        formData.set('_subject', `Newsletter signup: ${name || 'New subscriber'} | Diane White Art`);
        formData.set('message', `A new newsletter subscription was submitted from the Diane White Art website.\n\nName: ${name}\nEmail: ${email}\nSource: Homepage Newsletter`);
      }

      if (formType === 'contact') {
        const name = (formData.get('name') || '').toString().trim();
        const email = (formData.get('email') || '').toString().trim();
        const phone = (formData.get('phone') || '').toString().trim();
        const subject = (formData.get('subject') || 'General enquiry').toString().trim();
        const message = (formData.get('message') || '').toString().trim();

        formData.set('_subject', `${subject} | Diane White Art | ${name || 'Website enquiry'}`);
        formData.set('message', `A new website enquiry was submitted through the Diane White Art contact form.\n\nName: ${name}\nEmail: ${email}\nPhone: ${phone || 'Not provided'}\nSubject: ${subject}\n\nMessage:\n${message}`);
      }

      Array.from(form.elements).forEach(el => el.disabled = true);
      if (submitBtn) {
        submitBtn.dataset.originalText = submitBtn.textContent;
        submitBtn.textContent = 'Sending...';
      }

      try {
        const response = await fetch(form.action, {
          method: 'POST',
          body: formData,
          headers: {
            'Accept': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error('Form submission failed');
        }

        form.reset();
        if (successBox) successBox.hidden = false;
        form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } catch (error) {
        errorBox.textContent = 'Sorry, something went wrong while sending your form. Please try again.';
        errorBox.hidden = false;
      } finally {
        Array.from(form.elements).forEach(el => el.disabled = false);
        if (submitBtn) {
          submitBtn.textContent = submitBtn.dataset.originalText || 'Submit';
        }
      }
    });
  });
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
  initFormspreeForms();
});
