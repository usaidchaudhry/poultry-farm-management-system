// Labels and form fields for the four levels of the hierarchy.
export const ENTITY_LABELS = { site: 'Site', farm: 'Farm', house: 'House', flock: 'Flock' };

// ASSUMPTION: the PRD does not list bird types. Edit this list to match the project.
export const BIRD_TYPE_OPTIONS = [
  { value: 'Layer', label: 'Layer' },
  { value: 'Broiler', label: 'Broiler' },
  { value: 'Other', label: 'Other' },
];

/*
  Field types: text | number | date | select | parent (a select for the parent record, create mode only)
  The parent of a record cannot change after creation, so edit mode hides the parent field.
*/
const FIELDS = {
  site: [
    { name: 'name', label: 'Site name', type: 'text', required: true },
    { name: 'location', label: 'Location', type: 'text', hint: 'City or area (optional)' },
  ],
  farm: [
    { name: 'siteId', label: 'Site', type: 'parent', required: true, placeholder: 'Select a site' },
    { name: 'name', label: 'Farm name', type: 'text', required: true },
  ],
  house: [
    { name: 'farmId', label: 'Farm', type: 'parent', required: true, placeholder: 'Select a farm' },
    { name: 'name', label: 'House or shed name', type: 'text', required: true },
    { name: 'capacity', label: 'Capacity (birds)', type: 'number', hint: 'Optional. Maximum number of birds.' },
  ],
  flock: [
    { name: 'houseId', label: 'House', type: 'parent', required: true, placeholder: 'Select a house' },
    { name: 'name', label: 'Flock name', type: 'text', required: true },
    { name: 'birdType', label: 'Bird type', type: 'select', options: BIRD_TYPE_OPTIONS, placeholder: 'Not specified' },
    { name: 'placementDate', label: 'Placement date', type: 'date', required: true },
    { name: 'initialCount', label: 'Birds placed', type: 'number', required: true, hint: 'Number of birds when the flock was placed.' },
  ],
};

export function getFormFields(kind, mode) {
  return FIELDS[kind].filter((field) => mode === 'create' || field.type !== 'parent');
}
