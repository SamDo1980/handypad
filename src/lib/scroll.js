// Shared eased scroll for every "go to section" action.
// Native `behavior: 'smooth'` becomes an instant jump when the OS has animations
// turned off (Windows "Animation effects" → prefers-reduced-motion), so we animate
// ourselves: a normal glide by default, a shorter one for reduced-motion users.
let activeFrame = 0;

function stop() {
  if (activeFrame) cancelAnimationFrame(activeFrame);
  activeFrame = 0;
  removeEventListener('wheel', stop);
  removeEventListener('touchstart', stop);
  removeEventListener('keydown', stop);
}

export function scrollToElement(target, { onDone } = {}) {
  if (!target) return;
  stop();
  const headerBottom = document.querySelector('.site-header')?.getBoundingClientRect().bottom ?? 0;
  const startY = scrollY;
  const maxY = document.documentElement.scrollHeight - innerHeight;
  const targetY = Math.min(maxY, Math.max(0, startY + target.getBoundingClientRect().top - Math.max(0, headerBottom) - 16));
  const distance = targetY - startY;
  if (Math.abs(distance) < 2) { onDone?.(); return; }
  // Background tabs pause animation frames; nothing to watch, so go straight there.
  if (document.hidden) { scrollTo(0, targetY); onDone?.(); return; }
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const duration = reduced ? 320 : Math.min(800, Math.max(480, Math.abs(distance) * 0.35));
  const ease = p => (p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
  const startedAt = performance.now();
  // Let the user take over at any time.
  addEventListener('wheel', stop, { passive: true });
  addEventListener('touchstart', stop, { passive: true });
  addEventListener('keydown', stop);
  const frame = now => {
    const progress = Math.min(1, (now - startedAt) / duration);
    scrollTo(0, startY + distance * ease(progress));
    if (progress < 1) activeFrame = requestAnimationFrame(frame);
    else { stop(); onDone?.(); }
  };
  activeFrame = requestAnimationFrame(frame);
}
