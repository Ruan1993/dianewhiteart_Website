const firebaseState = {
  initAttempted: false,
  enabled: false,
  app: null,
  auth: null,
  db: null,
  user: null,
  isAdmin: false,
  showSold: true,
  statuses: {},
  unsubscribeStatuses: null,
  authObserverAttached: false,
  panelBound: false,
  renderGallery: null,
};

function setActiveNav() {
  const page = document.body.dataset.page;
  document.querySelectorAll('[data-nav]').forEach((link) => {
    if (link.dataset.nav === page) link.classList.add('active');
  });
}

function setButtonState(buttons, activeValue) {
  buttons.forEach((button) => {
    button.classList.toggle('active', button.dataset.filterMain === activeValue || button.dataset.filterSub === activeValue);
  });
}

function initMenu() {
  const toggle = document.querySelector('[data-menu-toggle]');
  const links = document.querySelector('.nav-links');
  if (!toggle || !links) return;

  toggle.addEventListener('click', () => {
    document.body.classList.toggle('menu-open');
  });

  links.querySelectorAll('a').forEach((link) => {
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

function normalizeStatus(value) {
  return String(value || 'available').trim().toLowerCase() === 'sold' ? 'sold' : 'available';
}

function normalizeInventoryLabel(label) {
  return String(label || '').trim().replace(/\s+/g, '').toUpperCase();
}

function formatStatusLabel(value) {
  return normalizeStatus(value) === 'sold' ? 'Sold' : 'Available';
}

function getLiveStatusForWork(work) {
  const key = normalizeInventoryLabel(work?.inventoryLabel || work?.number || work?.id);
  const liveData = firebaseState.statuses[key];
  if (key && liveData) {
    return {
      status: formatStatusLabel(liveData.status),
      updatedBy: liveData.updatedBy,
      updatedAt: liveData.updatedAt
    };
  }
  return {
    status: formatStatusLabel(work?.status || 'Available'),
    updatedBy: null,
    updatedAt: null
  };
}

function mergeWorkWithLiveStatus(work) {
  const live = getLiveStatusForWork(work);
  return {
    ...work,
    status: live.status,
    updatedBy: live.updatedBy,
    updatedAt: live.updatedAt
  };
}

function initFirebaseServices() {
  if (firebaseState.initAttempted) return firebaseState.enabled;
  firebaseState.initAttempted = true;

  if (!window.firebase || !window.DWA_FIREBASE_CONFIG) {
    return false;
  }

  try {
    firebaseState.app = window.firebase.apps && window.firebase.apps.length
      ? window.firebase.app()
      : window.firebase.initializeApp(window.DWA_FIREBASE_CONFIG);
    firebaseState.auth = window.firebase.auth();
    firebaseState.db = window.firebase.firestore();
    firebaseState.enabled = true;
  } catch (error) {
    console.error('Firebase initialisation failed.', error);
    firebaseState.enabled = false;
  }

  return firebaseState.enabled;
}

function updateAdminPanelUI(message = '') {
  const panel = document.querySelector('[data-admin-panel]');
  if (!panel) return;

  const status = panel.querySelector('[data-admin-status]');
  const signedOut = panel.querySelector('[data-admin-signed-out]');
  const signedIn = panel.querySelector('[data-admin-signed-in]');
  const emailLabel = panel.querySelector('[data-admin-user-email]');
  const formButton = panel.querySelector('[data-admin-submit]');
  const activeBadge = panel.querySelector('[data-admin-active-badge]');

  if (!firebaseState.enabled) {
    panel.hidden = false;
    if (status) status.textContent = 'Firebase is not configured on this page yet.';
    if (signedOut) signedOut.hidden = true;
    if (signedIn) signedIn.hidden = true;
    if (activeBadge) activeBadge.hidden = true;
    return;
  }

  panel.hidden = false;
  if (!firebaseState.user) {
    if (status) status.textContent = message || 'Sign in here to manage Sold / Available status on this page.';
    if (signedOut) signedOut.hidden = false;
    if (signedIn) signedIn.hidden = true;
    if (formButton) formButton.disabled = false;
    if (activeBadge) activeBadge.hidden = true;
    return;
  }

  if (signedOut) signedOut.hidden = true;
  if (signedIn) signedIn.hidden = false;
  if (activeBadge) activeBadge.hidden = !firebaseState.isAdmin;
  if (emailLabel) emailLabel.textContent = firebaseState.user.email || 'Admin';
  if (status) {
    status.textContent = message || (
      firebaseState.isAdmin
        ? 'Admin mode is active. Use the gallery buttons to mark works Sold or Available.'
        : 'You are signed in, but this account does not have admin access.'
    );
  }
}

function subscribeToArtworkStatuses() {
  if (!firebaseState.enabled || firebaseState.unsubscribeStatuses) return;

  firebaseState.unsubscribeStatuses = firebaseState.db.collection('artworkStatus').onSnapshot((snapshot) => {
    const nextStatuses = {};
    snapshot.forEach((doc) => {
      const data = doc.data() || {};
      const key = normalizeInventoryLabel(data.inventoryLabel || doc.id);
      if (!key) return;
      nextStatuses[key] = {
        status: normalizeStatus(data.status),
        updatedBy: data.updatedBy || null,
        updatedAt: data.updatedAt || null
      };
    });
    firebaseState.statuses = nextStatuses;
    if (typeof firebaseState.renderGallery === 'function') {
      firebaseState.renderGallery();
    }
  }, (error) => {
    console.error('Artwork status sync failed.', error);
    updateAdminPanelUI('Live status could not be loaded. Check Firestore rules and try again.');
  });
}

function initAdminPanel() {
  const panel = document.querySelector('[data-admin-panel]');
  if (!panel) return;

  initFirebaseServices();
  updateAdminPanelUI();

  if (!firebaseState.enabled || firebaseState.panelBound) return;

  firebaseState.panelBound = true;
  const form = panel.querySelector('[data-admin-form]');
  const signOutButton = panel.querySelector('[data-admin-signout]');

  if (form) {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const email = form.querySelector('[data-admin-email]')?.value?.trim();
      const password = form.querySelector('[data-admin-password]')?.value || '';
      const submitButton = form.querySelector('[data-admin-submit]');

      if (!email || !password) {
        updateAdminPanelUI('Enter your email and password to sign in.');
        return;
      }

      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Signing in...';
      }

      try {
        await firebaseState.auth.signInWithEmailAndPassword(email, password);
        form.reset();
      } catch (error) {
        console.error('Admin sign-in failed.', error);
        updateAdminPanelUI('Sign-in failed. Double-check the email and password, then try again.');
      } finally {
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = 'Sign in';
        }
      }
    });
  }

  if (signOutButton) {
    signOutButton.addEventListener('click', async () => {
      try {
        await firebaseState.auth.signOut();
      } catch (error) {
        console.error('Admin sign-out failed.', error);
        updateAdminPanelUI('Could not sign out right now. Please try again.');
      }
    });
  }

  if (!firebaseState.authObserverAttached) {
    firebaseState.authObserverAttached = true;
    firebaseState.auth.onAuthStateChanged(async (user) => {
      firebaseState.user = user || null;
      firebaseState.isAdmin = false;

      if (user) {
        try {
          const tokenResult = await user.getIdTokenResult();
          firebaseState.isAdmin = Boolean(tokenResult?.claims?.admin);
        } catch (error) {
          console.error('Could not read admin claim.', error);
        }
      }

      updateAdminPanelUI();
      if (typeof firebaseState.renderGallery === 'function') {
        firebaseState.renderGallery();
      }
    });
  }

  subscribeToArtworkStatuses();
}

async function saveArtworkStatus(inventoryLabel, nextStatus) {
  if (!firebaseState.enabled || !firebaseState.isAdmin) {
    throw new Error('Admin access required.');
  }

  const normalizedLabel = normalizeInventoryLabel(inventoryLabel);
  if (!normalizedLabel) {
    throw new Error('Missing artwork label.');
  }

  const normalizedStatus = normalizeStatus(nextStatus);

  await firebaseState.db.collection('artworkStatus').doc(normalizedLabel).set({
    inventoryLabel: normalizedLabel,
    status: normalizedStatus,
    updatedBy: firebaseState.user?.email || 'admin',
    updatedAt: window.firebase.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  firebaseState.statuses = {
    ...firebaseState.statuses,
    [normalizedLabel]: {
      status: normalizedStatus,
      updatedBy: firebaseState.user?.email || 'admin',
      updatedAt: window.firebase.firestore.Timestamp.now()
    },
  };

  if (typeof firebaseState.renderGallery === 'function') {
    firebaseState.renderGallery();
  }
}

function initStatusToggles() {
  document.querySelectorAll('[data-toggle-status]').forEach((button) => {
    if (button.dataset.bound === 'true') return;
    button.dataset.bound = 'true';

    button.addEventListener('click', async () => {
      if (!firebaseState.isAdmin) return;

      const inventoryLabel = button.dataset.inventoryLabel;
      const nextStatus = button.dataset.nextStatus || 'sold';
      const originalText = button.textContent;

      button.disabled = true;
      button.textContent = 'Saving...';

      try {
        const normalizedLabel = normalizeInventoryLabel(inventoryLabel);
        await saveArtworkStatus(normalizedLabel, nextStatus);
        updateAdminPanelUI(`${inventoryLabel} updated to ${formatStatusLabel(nextStatus)}.`);
      } catch (error) {
        console.error('Artwork status update failed.', error);
        updateAdminPanelUI(`Could not update ${inventoryLabel}. Please try again.`);
        button.disabled = false;
        button.textContent = originalText;
      }
    });
  });
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function splitArtworkTitle(work) {
  const inventoryLabel = String(work.inventoryLabel || work.number || '').trim();
  const rawTitle = String(work.title || 'Untitled').trim();
  const pattern = /^([A-Za-z]\d+|No\s*\d+)\s*[·\-–:]\s*(.+)$/i;
  const match = rawTitle.match(pattern);

  if (match) {
    return {
      displayRef: match[1].trim().toUpperCase(),
      displayTitle: match[2].trim() || 'Untitled'
    };
  }

  return {
    displayRef: inventoryLabel,
    displayTitle: rawTitle || 'Untitled'
  };
}

function getArtworkAlt(work) {
  const { displayTitle } = splitArtworkTitle(work);
  return `${displayTitle} painting by Diane White`;
}

function createArtworkCard(work) {
  const mediumLine = work.mediumDetails || work.medium || 'Original artwork';
  const sizeLine = work.size || 'Available on request';
  const priceLine = work.price || 'Price on enquiry';
  const enquiryTitle = encodeURIComponent(work.title || 'Artwork enquiry');
  const currentStatus = formatStatusLabel(work.status || 'Available');
  const isSold = normalizeStatus(currentStatus) === 'sold';
  const nextStatus = isSold ? 'available' : 'sold';
  const inventoryLabel = work.inventoryLabel || work.number || work.id || 'Artwork';
  const { displayRef, displayTitle } = splitArtworkTitle(work);

  let adminLog = '';
  if (firebaseState.isAdmin && work.updatedBy) {
    const date = work.updatedAt?.toDate ? work.updatedAt.toDate() : (work.updatedAt ? new Date(work.updatedAt) : null);
    const dateStr = date ? date.toLocaleDateString() : '';
    adminLog = `<div class="admin-log">Last updated by ${work.updatedBy} ${dateStr}</div>`;
  }

  const widthAttr = Number(work.imageWidth) > 0 ? ` width="${Number(work.imageWidth)}"` : '';
  const heightAttr = Number(work.imageHeight) > 0 ? ` height="${Number(work.imageHeight)}"` : '';

  return `
    <article class="art-card ${isSold ? 'is-sold' : ''}" data-art-id="${escapeHtml(work.id)}" data-inventory-label="${escapeHtml(inventoryLabel)}" data-category="${escapeHtml(work.mainFilter)}" data-subcategory="${escapeHtml(work.subFilter || '')}">
      <div class="art-image">
        <img
          src="${escapeHtml(work.image)}"
          data-full="${escapeHtml(work.full || work.image)}"
          alt="${escapeHtml(getArtworkAlt(work))}"${widthAttr}${heightAttr}
          loading="lazy"
          decoding="async"
        />
        <span class="badge ${isSold ? 'sold' : ''}">${escapeHtml(currentStatus)}</span>
      </div>
      <div class="art-body">
        <div class="art-title-block">
          ${displayRef ? `<span class="art-ref">${escapeHtml(displayRef)}</span>` : ''}
          <h3>${escapeHtml(displayTitle)}</h3>
        </div>
        <div class="meta">
          <div><strong>Medium:</strong> ${escapeHtml(mediumLine)}</div>
          <div><strong>Category:</strong> ${escapeHtml(work.subcategory || 'Original works')}</div>
          <div><strong>Size:</strong> ${escapeHtml(sizeLine)}</div>
          <div><strong>Price:</strong> ${escapeHtml(priceLine)}</div>
          <div data-status-text><strong>Status:</strong> ${escapeHtml(currentStatus)}</div>
          ${adminLog}
        </div>
        <div class="card-actions">
          ${!isSold ? `<a class="small-btn accent" href="contact.html?artwork=${enquiryTitle}">Enquire</a>` : ''}
          ${firebaseState.isAdmin ? `<button class="small-btn" type="button" data-toggle-status data-inventory-label="${escapeHtml(inventoryLabel)}" data-next-status="${escapeHtml(nextStatus)}">${isSold ? 'Mark Available' : 'Mark Sold'}</button>` : ''}
        </div>
      </div>
    </article>
  `;
}

function updateFilterAvailability(payload, works, mainButtons, subButtons) {
  const acrylicCount = works.filter(w => w.mainFilter === 'acrylic').length;
  const watercolourCount = works.filter(w => w.mainFilter === 'watercolour').length;
  const inksCount = works.filter(w => w.mainFilter === 'inks').length;

  const counts = {
    acrylic: acrylicCount,
    watercolour: watercolourCount,
    inks: inksCount
  };

  mainButtons.forEach((button) => {
    const key = button.dataset.filterMain;
    if (!key) return;
    const hasWorks = Boolean(counts[key]);
    button.disabled = !hasWorks;
    button.classList.toggle('is-disabled', !hasWorks);
  });

  const subCounts = {
    landscapes: works.filter(w => w.mainFilter === 'acrylic' && w.subFilter === 'landscapes').length,
    florals: works.filter(w => w.mainFilter === 'acrylic' && w.subFilter === 'florals').length,
    animals: works.filter(w => w.mainFilter === 'acrylic' && w.subFilter === 'animals').length
  };

  subButtons.forEach((button) => {
    const key = button.dataset.filterSub;
    if (!key) return;
    const hasWorks = Boolean(subCounts[key]);
    button.disabled = !hasWorks;
    button.classList.toggle('is-disabled', !hasWorks);
  });
}

async function initAvailableWorksPage() {
  const grid = document.querySelector('[data-gallery-grid]');
  if (!grid) return;

  const countLabel = document.querySelector('[data-gallery-count]');
  const emptyState = document.querySelector('[data-gallery-empty]');
  const subFilterWrap = document.getElementById('acrylic-sub-filters');
  const mainButtons = Array.from(document.querySelectorAll('[data-filter-main]'));
  const subButtons = Array.from(document.querySelectorAll('[data-filter-sub]'));

  let payload = window.DIANE_AVAILABLE_WORKS;
  try {
    if (!payload) {
      const response = await fetch('data/available-works.json');
      if (!response.ok) throw new Error('Manifest unavailable');
      payload = await response.json();
    }
  } catch (error) {
    grid.innerHTML = '';
    if (emptyState) {
      emptyState.hidden = false;
      emptyState.textContent = 'The gallery could not be loaded. Please regenerate data/available-works.json and try again.';
    }
    if (countLabel) countLabel.textContent = '0 works loaded';
    return;
  }

  const works = Array.isArray(payload.works) ? payload.works : [];
  let activeMain = 'acrylic';
  let activeSub = 'landscapes';

  updateFilterAvailability(payload, works, mainButtons, subButtons);

  const soldToggle = document.querySelector('[data-toggle-sold-visibility]');
  if (soldToggle) {
    soldToggle.checked = firebaseState.showSold;
    soldToggle.addEventListener('change', (e) => {
      firebaseState.showSold = e.target.checked;
      renderGallery();
    });
  }

  const getVisibleWorks = () => {
    const liveWorks = works.map(mergeWorkWithLiveStatus);
    let filtered = liveWorks;

    if (!firebaseState.showSold) {
      filtered = filtered.filter(work => normalizeStatus(work.status) !== 'sold');
    }

    if (activeMain !== 'all') {
      filtered = filtered.filter((work) => work.mainFilter === activeMain);
    }
    
    if (activeMain === 'acrylic') {
      filtered = filtered.filter((work) => work.subFilter === activeSub);
    }
    return filtered;
  };

  const renderGallery = () => {
    const visibleWorks = getVisibleWorks();
    grid.innerHTML = visibleWorks.map(createArtworkCard).join('');

    if (emptyState) {
      emptyState.hidden = visibleWorks.length > 0;
      if (!visibleWorks.length) {
        const subLabels = { landscapes: 'landscape', florals: 'floral', animals: 'animal' };
        emptyState.textContent = activeMain === 'acrylic' && activeSub !== 'all'
          ? `No ${subLabels[activeSub] || activeSub} works have been added yet.`
          : 'No works have been added yet.';
      }
    }

    if (countLabel) {
      const suffix = visibleWorks.length === 1 ? 'work' : 'works';
      countLabel.textContent = `${visibleWorks.length} ${suffix} shown`;
    }

    if (subFilterWrap) {
      subFilterWrap.hidden = activeMain !== 'acrylic';
    }

    initStatusToggles();
    initLightbox();
  };

  firebaseState.renderGallery = renderGallery;
  initAdminPanel();

  mainButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const nextMain = button.dataset.filterMain;
      if (!nextMain || button.disabled) return;
      activeMain = nextMain;
      activeSub = 'all';
      setButtonState(mainButtons, activeMain);
      setButtonState(subButtons, activeSub);
      renderGallery();
    });
  });

  subButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const nextSub = button.dataset.filterSub;
      if (!nextSub || button.disabled || activeMain !== 'acrylic') return;
      activeSub = nextSub;
      setButtonState(subButtons, activeSub);
      renderGallery();
    });
  });

  setButtonState(mainButtons, activeMain);
  setButtonState(subButtons, activeSub);
  renderGallery();
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

    const padding = window.innerWidth <= 760 ? 24 : 72;
    const maxW = vw - padding;
    const maxH = vh - padding;
    const scale = Math.min(maxW / nw, maxH / nh, 1);
    lightboxImg.style.width = `${Math.floor(nw * scale)}px`;
    lightboxImg.style.height = `${Math.floor(nh * scale)}px`;
  }

  function closeLightbox() {
    lightbox.classList.remove('open', 'loading');
    lightboxImg.removeAttribute('src');
    lightboxImg.style.width = '';
    lightboxImg.style.height = '';
  }

  triggerImages.forEach((img) => {
    img.classList.add('clickable-image');
    img.addEventListener('click', () => {
      const hiRes = img.dataset.full || img.currentSrc || img.src;
      lightbox.classList.add('open', 'loading');
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
    if (!e.target.closest('.lightbox-inner') || e.target.classList.contains('lightbox-inner')) {
      closeLightbox();
    }
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
  document.querySelectorAll('[data-current-year]').forEach((el) => {
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
    const generalTopics = ['Shipping Enquiry', 'Commission Enquiry', 'Privacy Policy Enquiry', 'Terms and Conditions Enquiry', 'Testimonial Enquiry'];
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

  forms.forEach((form) => {
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

      Array.from(form.elements).forEach((el) => {
        el.disabled = true;
      });
      if (submitBtn) {
        submitBtn.dataset.originalText = submitBtn.textContent;
        submitBtn.textContent = 'Sending...';
      }

      try {
        const response = await fetch(form.action, {
          method: 'POST',
          body: formData,
          headers: {
            Accept: 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Form submission failed');
        }

        form.reset();

        Array.from(form.children).forEach((child) => {
          if (child !== successBox) child.style.display = 'none';
        });

        if (successBox) {
          successBox.hidden = false;
          successBox.style.display = 'grid';
        }
        form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } catch (error) {
        errorBox.textContent = 'Sorry, something went wrong while sending your form. Please try again.';
        errorBox.hidden = false;
      } finally {
        Array.from(form.elements).forEach((el) => {
          el.disabled = false;
        });
        if (submitBtn) {
          submitBtn.textContent = submitBtn.dataset.originalText || 'Submit';
        }
      }
    });
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  setActiveNav();
  initMenu();
  initHeroSlider();
  await initAvailableWorksPage();
  initLightbox();
  initBackToTop();
  initDynamicYear();
  initContactPrefill();
  initFormspreeForms();
});
