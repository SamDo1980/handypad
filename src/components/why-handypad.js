import { element } from '../lib/dom.js';
import { t } from '../lib/locale.js';
import { linkToSpecs } from '../lib/specs.js';

// Shopify-style story: each sentence owns three photos in a draggable strip.
// Hovering a photo reveals its slogan picture (English lettering, shown on both EN and VI pages).
// Tiles start at their photo's own shape; a set narrower than the strip scales its tiles up a little
// (trimming top/bottom) to fill it. `position` frames that trim, `zoom` + `origin` move closer on a subject,
// and `cutout` shows a transparent product shot whole on a soft backdrop.
const STORY = [
  { sentence: 'Fireproof canvas for hot works.', tiles: [
    { photo: 'scaffold-pads.webp', width: 1254, height: 1254, alt: 'HANDYPAD pads fitted to scaffold tubes and couplers', position: '50% 80%',
      slogan: 'slogan-protection.webp', sloganAlt: 'HANDYPAD impact protection for safer worksites.' },
    { photo: 'fire-grinding.webp', width: 1536, height: 1024, alt: 'HANDYPAD pad beside grinding sparks on a scaffold',
      zoom: 1.3, origin: '75% 50%', // closer on the pad and sparks (right side); trims the bare pipe on the left
      slogan: 'slogan-safer.webp', sloganAlt: 'Helping you build safer worksites with HANDYPAD.' },
    { photo: 'worker-pad.jpg', width: 403, height: 403, alt: 'Worker on scaffold next to a HANDYPAD pad', position: '50% 40%',
      slogan: 'slogan-risks.webp', sloganAlt: 'Reducing impact risks on site to people & equipment.' },
  ] },
  { sentence: '3M-grade reflective tape for night shifts.', tiles: [
    { photo: 'reflective-night.webp', width: 1536, height: 1024, alt: 'Reflective HANDYPAD pads on scaffold at night',
      slogan: 'slogan-solas.webp', sloganAlt: 'SOLAS grade marine reflective tape.' },
    { photo: 'reflective-tape.webp', width: 1254, height: 1254, alt: 'Rolls of reflective tape',
      slogan: 'slogan-tested.webp', sloganAlt: 'Tested for the temperature range & UV exposure marine equipment requires.' },
    { photo: 'reflective-offshore.webp', width: 1536, height: 1024, alt: 'Reflective HANDYPAD pads on an offshore platform at night',
      slogan: 'slogan-standards.webp', sloganAlt: 'Built to the visibility & durability standards required by marine & coast guard programs.' },
  ] },
  { sentence: 'Stitching that outlasts every strip-down.', tiles: [
    { photo: 'coupler.webp', width: 1431, height: 1080, alt: 'Worker tightening a scaffold coupler',
      slogan: 'slogan-stitching.webp', sloganAlt: 'Durable stitching.' },
    // Transparent cut-out: sits on a soft backdrop instead of a photo background.
    { photo: 'pads-cutout.webp', width: 1033, height: 829, alt: 'HANDYPAD Double and Single pads', cutout: true,
      slogan: 'slogan-sewn.webp', sloganAlt: 'Sewn, not glued.' },
    { photo: 'scaffold-pads.webp', width: 1254, height: 1254, alt: 'HANDYPAD pads fitted to scaffold tubes and couplers', position: '50% 80%',
      slogan: 'slogan-holds.webp', sloganAlt: 'Holds up through repeated strip-downs & re-erects.' },
  ] },
];
const DRAG_THRESHOLD = 6;
const AUTOPLAY_MS = 5000; // time each set stays before the next one slides in
const GLIDE_MS = 1400;
const GLIDE_DELAY_MS = 250; // pause between the sentence lighting up and the set starting to slide
const easeInOut = p => (1 - Math.cos(Math.PI * p)) / 2; // ease-in-out sine: soft start and stop, no rush in the middle

function tileImage(className, file, alt, width, height) {
  const image = element('img', className);
  image.src = `./src/assets/products/handypad/why/${file}`;
  image.alt = alt;
  image.width = width;
  image.height = height;
  image.loading = 'lazy';
  image.decoding = 'async';
  return image;
}

function createTile(tile) {
  // All tiles share one height and start at their photo's shape (CSS may widen them to fill the set).
  const root = element('div', `feature-tile story-tile${tile.cutout ? ' story-tile--cutout' : ''}`);
  root.style.aspectRatio = `${tile.width} / ${tile.height}`;
  const photo = tileImage('feature-photo', tile.photo, t(tile.alt), tile.width, tile.height);
  if (tile.position) photo.style.objectPosition = tile.position;
  if (tile.zoom) { photo.style.scale = tile.zoom; photo.style.transformOrigin = tile.origin ?? 'center'; }
  // Both images carry alt text, so screen readers get the photo and the slogan without hovering.
  root.append(photo, tileImage('feature-tile-slogan', tile.slogan, tile.sloganAlt, 1440, 1080));
  return root;
}

export function createWhyHandypad() {
  const section = element('section', 'feature-section');
  section.id = 'why-handypad';
  section.setAttribute('aria-labelledby', 'why-handypad-title');
  const inner = element('div', 'container');

  // The red label is the section heading, as in Product Range.
  const title = element('h2', 'section-eyebrow', t('WHY HANDYPAD'));
  title.id = 'why-handypad-title';
  title.tabIndex = -1;

  const strip = element('div', 'story-strip');
  strip.id = 'why-handypad-photos';
  strip.tabIndex = 0;
  strip.setAttribute('role', 'group');
  strip.setAttribute('aria-label', t('WHY HANDYPAD'));
  const track = element('div', 'story-track');
  const sets = STORY.map(chapter => {
    const set = element('div', 'story-set');
    set.append(...chapter.tiles.map(createTile));
    return set;
  });
  track.append(...sets);
  strip.append(track);
  // One tile height for every set: the height at which the widest set (largest sum of photo
  // width/height ratios) exactly fills the strip. In narrower sets CSS grows each tile by the same amount.
  const widest = Math.max(...STORY.map(chapter => chapter.tiles.reduce((sum, tile) => sum + tile.width / tile.height, 0)));
  strip.style.setProperty('--max-ratio', widest.toFixed(4));
  const tiles = [...track.querySelectorAll('.feature-tile')];

  // Sentences are inline spans (not <button>s) so they flow as one wrapping paragraph.
  const text = element('p', 'story-text');
  const phrases = STORY.map((chapter, index) => {
    const phrase = element('span', 'story-phrase', t(chapter.sentence));
    phrase.setAttribute('role', 'button');
    phrase.tabIndex = 0;
    phrase.setAttribute('aria-controls', strip.id);
    // Only a click (or Enter / Space) changes the set; hovering just tints the sentence.
    phrase.addEventListener('click', () => go(index));
    phrase.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      go(index);
    });
    text.append(phrase, document.createTextNode(' '));
    // The last sentence starts its own line (sentences 1–2 on the first line).
    if (index === STORY.length - 2) text.append(element('br', 'story-break'));
    return phrase;
  });

  const link = linkToSpecs(element('a', 'feature-section-link'));
  link.append(element('span', '', t('View specs')), element('span', 'feature-section-link-arrow', '→'));

  // Scroll positions: each set starts at its first tile; the last set may stop at the strip's end.
  const maxScroll = () => strip.scrollWidth - strip.clientWidth;
  const setStart = index => Math.min(sets[index].offsetLeft - track.offsetLeft, maxScroll());
  let active = -1;
  function setActive(index) {
    if (index === active) return;
    active = index;
    phrases.forEach((phrase, i) => {
      phrase.classList.toggle('is-active', i === index);
      phrase.setAttribute('aria-pressed', String(i === index));
    });
  }
  // Glide: an eased scroll of the strip (smoother than the browser's 'smooth'), snapping off while
  // it runs. The sentence lights up first; after a short pause (and once the next set's pictures
  // are decoded, so nothing stutters mid-slide) the set slides in. It always slides — also with
  // reduced motion, at the business's request — and the target sentence stays lit throughout.
  let gliding = false, glideFrame = 0, glideDelay = 0, glideId = 0;
  function endGlide() {
    cancelAnimationFrame(glideFrame);
    clearTimeout(glideDelay);
    glideId++;
    gliding = false;
    strip.classList.remove('is-gliding');
  }
  const ready = set => Promise.all([...set.querySelectorAll('img')].map(img => {
    img.loading = 'eager';
    return img.decode().catch(() => {});
  }));
  async function glideTo(index) {
    endGlide();
    const id = glideId;
    gliding = true;
    strip.classList.add('is-gliding');
    const wait = new Promise(resolve => { glideDelay = setTimeout(resolve, GLIDE_DELAY_MS); });
    await Promise.all([wait, Promise.race([ready(sets[index]), new Promise(resolve => setTimeout(resolve, 800))])]);
    if (id !== glideId) return; // a newer glide or a drag took over
    const from = strip.scrollLeft, left = setStart(index);
    if (Math.abs(left - from) < 2) { endGlide(); return; }
    const start = performance.now();
    const step = now => {
      const p = Math.min(1, (now - start) / GLIDE_MS);
      strip.scrollLeft = from + (left - from) * easeInOut(p);
      if (p < 1) glideFrame = requestAnimationFrame(step);
      else endGlide();
    };
    glideFrame = requestAnimationFrame(step);
  }
  function go(index) {
    setActive(index); // the sentence lights up first; its set slides in just after
    glideTo(index);
    schedule();
  }

  // Autoplay: every 5 s the next set slides in and the next sentence lights up, looping forever.
  // It waits while the pointer is on the photos (so slogans can be read), while the section is
  // off screen or the tab hidden; any manual move restarts the 5 s.
  let autoTimer = 0, onPhotos = false, inView = false;
  const playing = () => inView && !onPhotos && !drag?.moved && !document.hidden;
  function schedule() {
    clearTimeout(autoTimer);
    if (playing()) autoTimer = setTimeout(() => go((active + 1) % sets.length), AUTOPLAY_MS);
  }
  strip.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse') { onPhotos = true; schedule(); } });
  strip.addEventListener('pointerleave', event => { if (event.pointerType === 'mouse') { onPhotos = false; schedule(); } });
  document.addEventListener('visibilitychange', schedule);
  new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; schedule(); }, { threshold: .3 }).observe(strip);

  // Scrolling or dragging lights up the sentence whose photos lead the strip.
  let frame = 0;
  strip.addEventListener('scroll', () => {
    if (gliding) return;
    schedule(); // a manual scroll or swipe restarts the autoplay wait
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const left = strip.scrollLeft;
      let nearest = 0;
      sets.forEach((_, index) => { if (Math.abs(setStart(index) - left) < Math.abs(setStart(nearest) - left)) nearest = index; });
      setActive(nearest);
    });
  }, { passive: true });

  // Mouse: click-and-drag scrolls the strip (touch scrolls natively). The pointer is captured
  // only once it really moves, so a hover or plain click is left alone.
  let drag = null;
  strip.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    drag = { id: event.pointerId, x: event.clientX, left: strip.scrollLeft, moved: false };
  });
  strip.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.id) return;
    const delta = event.clientX - drag.x;
    if (!drag.moved && Math.abs(delta) >= DRAG_THRESHOLD) {
      drag.moved = true;
      endGlide();
      strip.classList.add('is-dragging');
      strip.setPointerCapture(drag.id);
    }
    if (drag.moved) strip.scrollLeft = drag.left - delta;
  });
  const endDrag = event => {
    if (!drag || event.pointerId !== drag.id) return;
    drag = null;
    strip.classList.remove('is-dragging');
    schedule();
  };
  strip.addEventListener('pointerup', endDrag);
  strip.addEventListener('pointercancel', endDrag);
  strip.addEventListener('dragstart', event => event.preventDefault());

  // Touch has no hover: a tap toggles that photo's slogan (a swipe scrolls instead).
  strip.addEventListener('pointerup', event => {
    const tile = event.target.closest('.feature-tile');
    if (!tile || event.pointerType === 'mouse') return;
    const show = !tile.classList.contains('is-revealed');
    tiles.forEach(other => other.classList.toggle('is-revealed', show && other === tile));
  });
  // A tap elsewhere puts a revealed tile back to its photo.
  document.addEventListener('pointerdown', event => {
    if (!strip.contains(event.target)) tiles.forEach(tile => tile.classList.remove('is-revealed'));
  });

  setActive(0);
  inner.append(title, text, strip, link);
  section.append(inner);
  return section;
}
