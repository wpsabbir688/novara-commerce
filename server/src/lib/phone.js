// Bangladeshi phone normalization + validation.
// Accepts 01XXXXXXXXX, +8801XXXXXXXXX, 8801XXXXXXXXX. Normalizes to +8801XXXXXXXXX.
const BD_MOBILE = /^01[3-9]\d{8}$/;

export function normalizeBdPhone(raw) {
  if (typeof raw !== 'string') return null;
  const digits = raw.replace(/[\s-]/g, '');
  let local = digits;
  if (local.startsWith('+880')) local = `0${local.slice(4)}`;
  else if (local.startsWith('880')) local = `0${local.slice(3)}`;
  if (!BD_MOBILE.test(local)) return null;
  return `+880${local.slice(1)}`;
}

export function isValidBdPhone(raw) {
  return normalizeBdPhone(raw) !== null;
}
