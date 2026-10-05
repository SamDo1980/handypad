import { element } from '../lib/dom.js';
import { t } from '../lib/locale.js';

// Type-to-filter combobox shared by Country and City / Province.
// `getOptions()` returns [{ code, name }]; an empty list makes it a plain text input.
export function createListSelect({ id, label, emptyText, getOptions, onInput, onSelect, onBlur, autocomplete = 'off' }) {
  const root = element('div', 'country-select');
  const input = element('input'); input.type = 'text'; input.autocomplete = autocomplete;
  const listId = `${id}-options`;
  input.setAttribute('role', 'combobox'); input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-expanded', 'false'); input.setAttribute('aria-controls', listId);
  const list = element('div', 'country-options'); list.id = listId; list.setAttribute('role', 'listbox'); list.setAttribute('aria-label', t(label)); list.hidden = true;
  let options = [], active = -1;
  const normalize = text => text.normalize('NFD').replace(/\p{M}/gu, '').replace(/[đĐ]/g, 'd').toLowerCase();
  function close() { list.hidden = true; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); active = -1; }
  function select(option) { input.value = option.name; close(); onSelect(option.code, option.name); }
  function highlight(index) {
    active = index;
    [...list.children].forEach((option, i) => option.setAttribute('aria-selected', String(i === active)));
    if (list.children[active]) { input.setAttribute('aria-activedescendant', list.children[active].id); list.children[active].scrollIntoView({ block: 'nearest' }); }
  }
  function open(all = false) {
    const source = getOptions();
    if (!source.length) { close(); return; }
    const query = normalize(input.value.trim());
    options = source.filter(option => all || normalize(option.name).includes(query) || option.code.toLowerCase().includes(query));
    list.replaceChildren(); active = -1; input.removeAttribute('aria-activedescendant');
    options.forEach((option, index) => {
      const row = element('div', 'country-option', option.name); row.id = `${id}-option-${index}`; row.setAttribute('role', 'option'); row.setAttribute('aria-selected', 'false');
      row.addEventListener('mousedown', event => { event.preventDefault(); select(option); }); list.append(row);
    });
    if (!options.length) list.append(element('div', 'country-empty', t(emptyText)));
    list.hidden = false; input.setAttribute('aria-expanded', 'true');
  }
  const isExact = () => getOptions().some(option => option.name === input.value);
  input.addEventListener('focus', () => open(isExact()));
  input.addEventListener('click', () => { if (list.hidden) open(true); });
  input.addEventListener('input', () => { onInput(input.value); open(); });
  input.addEventListener('blur', () => { close(); onBlur(); });
  input.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); close(); }
    if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
      event.preventDefault(); if (list.hidden) open(true);
      if (options.length) highlight(active < 0 ? (event.key === 'ArrowDown' ? 0 : options.length - 1) : (active + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length);
    }
    if (event.key === 'Enter' && !list.hidden) { event.preventDefault(); if (options[active]) select(options[active]); }
  });
  root.append(input, list);
  return { root, input };
}
