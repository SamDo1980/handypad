/* V66 — continuous Product Range marquee.
   Keeps the current DOM/layout and pauses only while the user hovers or focuses the gallery. */
(() => {
  const marquee = document.querySelector('#product-range .product-range-marquee');
  if (!marquee) return;

  const track = marquee.querySelector('.product-range-track');
  const groups = Array.from(marquee.querySelectorAll('.product-range-group'));
  if (!track || groups.length < 2) return;

  const SPEED_PX_PER_SECOND = 22;
  let paused = false;
  let offset = 0;
  let loopWidth = 0;
  let lastTime = performance.now();
  let frameId = 0;

  const measure = () => {
    loopWidth = groups[0].getBoundingClientRect().width;
    if (loopWidth > 0) offset %= loopWidth;
  };

  const render = () => {
    track.style.transform = `translate3d(${-offset}px, 0, 0)`;
  };

  const tick = now => {
    const elapsed = Math.min((now - lastTime) / 1000, 0.08);
    lastTime = now;

    if (!paused && !document.hidden && loopWidth > 0) {
      offset += SPEED_PX_PER_SECOND * elapsed;
      if (offset >= loopWidth) offset %= loopWidth;
      render();
    }

    frameId = requestAnimationFrame(tick);
  };

  const pause = () => { paused = true; };
  const resume = () => {
    paused = false;
    lastTime = performance.now();
  };

  marquee.addEventListener('mouseenter', pause);
  marquee.addEventListener('mouseleave', resume);
  marquee.addEventListener('focusin', pause);
  marquee.addEventListener('focusout', event => {
    if (!marquee.contains(event.relatedTarget)) resume();
  });

  window.addEventListener('resize', measure, { passive: true });
  window.addEventListener('load', measure, { once: true });
  document.addEventListener('visibilitychange', () => {
    lastTime = performance.now();
  });

  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(measure);
    observer.observe(groups[0]);
  }

  measure();
  render();
  frameId = requestAnimationFrame(tick);

  window.addEventListener('pagehide', () => cancelAnimationFrame(frameId), { once: true });
})();
