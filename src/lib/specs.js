import { language } from './locale.js';

// Specification sheet in the page language (both PDFs ship with the site).
export const specsFile = Object.freeze(language === 'vi'
  ? { href: './assets/HandyPad-by-Handyman-specs-vi.pdf', download: 'HandyPad-by-Handyman-specs-vi.pdf' }
  : { href: './assets/HandyPad-by-Handyman-specs-en.pdf', download: 'HandyPad-by-Handyman-specs-en.pdf' });

export function linkToSpecs(anchor) {
  anchor.href = specsFile.href;
  anchor.download = specsFile.download;
  return anchor;
}
