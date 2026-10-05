import { countries } from '../checkout/countries.js';
import { createListSelect } from './list-select.js';

export function createCountrySelect({ onInput, onSelect, onBlur }) {
  return createListSelect({ id: 'country', label: 'Country', emptyText: 'No countries found', autocomplete: 'country-name',
    getOptions: () => countries, onInput, onSelect: code => onSelect(code), onBlur });
}
