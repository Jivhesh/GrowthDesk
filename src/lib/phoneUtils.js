/**
 * Normalizes a phone number for WhatsApp wa.me links.
 * Strips spaces, dashes, brackets, leading + and zeros.
 * Prepends default_country_code if no country code exists.
 */
export function normalizePhoneNumber(rawPhone, defaultCountryCode = '+91') {
  if (!rawPhone || typeof rawPhone !== 'string') {
    return {
      valid: false,
      error: 'No phone number provided.',
      number: ''
    };
  }

  const trimmed = rawPhone.trim();
  if (!trimmed) {
    return {
      valid: false,
      error: 'Phone number is empty.',
      number: ''
    };
  }

  const hadExplicitPlus = trimmed.startsWith('+');
  const cleanCountryCode = (defaultCountryCode || '+91').replace(/\D/g, '') || '91';

  // Strip spaces, dashes, brackets, parentheses, dots, and +
  let digits = trimmed.replace(/[\s\-\(\)\.\+]/g, '');

  // Strip leading zeros
  digits = digits.replace(/^0+/, '');

  if (!digits || !/^\d+$/.test(digits)) {
    return {
      valid: false,
      error: 'Phone number must contain digits.',
      number: ''
    };
  }

  let finalNumber = digits;
  if (!hadExplicitPlus) {
    if (digits.length === 10) {
      finalNumber = cleanCountryCode + digits;
    } else if (!digits.startsWith(cleanCountryCode)) {
      finalNumber = cleanCountryCode + digits;
    }
  }

  if (finalNumber.length < 8 || finalNumber.length > 15) {
    return {
      valid: false,
      error: `Invalid phone length (${finalNumber.length} digits). Valid WhatsApp numbers are between 8 and 15 digits.`,
      number: ''
    };
  }

  return {
    valid: true,
    error: null,
    number: finalNumber
  };
}

export function generateWaLink(normalizedNumber, message) {
  return `https://wa.me/${normalizedNumber}?text=${encodeURIComponent(message || '')}`;
}

