/**
 * Validation stricte du body PUT /profile : liste blanche + formats,
 * pour éviter toute modification de champs internes ou injection via le JSON.
 */

const MEDIA_TYPES = ['youtube', 'mp3', 'soundcloud', 'm4a'];

/**
 * Champs internes / relations : jamais modifiables via PUT (le client peut envoyer
 * _id / userId par copie du profil — ceux-ci sont ignorés côté serveur).
 */
const FORBIDDEN_BODY_KEYS = new Set([
  'likedUsers',
  'whoLikedMe',
  'blockedUsers',
  'dailySwipes',
  'dailyMessages',
  'matches',
  // Compte utilisateur (modèle User) — jamais via PUT /profile
  'username',
  'email',
  'password',
  'googleId',
  'isPremium',
  'stripeCustomerId',
  'stripeSubscriptionId',
  'premiumExpiresAt',
  'premiumStartedAt',
  'premiumPlanType',
  'onboardingValidated',
  'newLike',
  'messageUnread'
]);

const MAX_STRING_URL = 2048;
const MAX_STYLES = 30;
const MAX_STYLE_LENGTH = 80;

function rejectForbiddenProfileKeys(body) {
  if (!body || typeof body !== 'object') {
    return { ok: false, message: 'Body JSON requis' };
  }
  const keys = Object.keys(body);
  const forbidden = keys.filter((k) => FORBIDDEN_BODY_KEYS.has(k));
  if (forbidden.length > 0) {
    return {
      ok: false,
      message: 'Certains champs ne peuvent pas être modifiés via cette requête',
      fields: forbidden
    };
  }
  return { ok: true };
}

/**
 * @param {unknown} photos
 * @param {number} maxCount
 * @returns {{ ok: true, value: string[] } | { ok: false, message: string }}
 */
function validatePhotosArray(photos, maxCount) {
  if (photos === undefined) {
    return { ok: true, value: undefined };
  }
  if (!Array.isArray(photos)) {
    return { ok: false, message: 'photos doit être un tableau' };
  }
  if (photos.length > maxCount) {
    return { ok: false, message: `Nombre de photos limité à ${maxCount}` };
  }
  const out = [];
  for (let i = 0; i < photos.length; i++) {
    const p = photos[i];
    if (typeof p !== 'string' || !p.trim()) {
      return { ok: false, message: 'Chaque photo doit être une URL non vide' };
    }
    const s = p.trim();
    if (s.length > MAX_STRING_URL) {
      return { ok: false, message: 'URL de photo trop longue' };
    }
    out.push(s);
  }
  return { ok: true, value: out };
}

/**
 * @param {unknown} media
 * @param {number} maxItems
 */
function validateMediaArray(media, maxItems) {
  if (media === undefined) {
    return { ok: true, value: undefined };
  }
  if (!Array.isArray(media)) {
    return { ok: false, message: 'media doit être un tableau' };
  }
  if (media.length > maxItems) {
    return { ok: false, message: `Nombre de médias limité à ${maxItems}` };
  }
  const out = [];
  for (let i = 0; i < media.length; i++) {
    const m = media[i];
    if (!m || typeof m !== 'object') {
      return { ok: false, message: 'Chaque élément media doit être un objet' };
    }
    const type = m.type;
    const url = m.url;
    if (typeof type !== 'string' || !MEDIA_TYPES.includes(type)) {
      return { ok: false, message: 'Type de média invalide' };
    }
    if (typeof url !== 'string' || !url.trim()) {
      return { ok: false, message: 'URL média requise' };
    }
    const urlTrim = url.trim();
    if (urlTrim.length > MAX_STRING_URL) {
      return { ok: false, message: 'URL média trop longue' };
    }
    const item = { type, url: urlTrim };
    if (m.filename != null) {
      if (typeof m.filename !== 'string' || m.filename.length > 500) {
        return { ok: false, message: 'filename invalide' };
      }
      item.filename = m.filename;
    }
    out.push(item);
  }
  return { ok: true, value: out };
}

/**
 * Construit un GeoJSON Point sûr uniquement à partir de coordonnées validées.
 * @param {unknown} location
 * @returns {{ ok: true, value: object|undefined|null } | { ok: false, message: string }}
 */
function validateLocation(location) {
  if (location === undefined) {
    return { ok: true, value: undefined };
  }
  if (location === null) {
    return {
      ok: true,
      value: { type: 'Point', coordinates: null }
    };
  }
  if (!location || typeof location !== 'object') {
    return { ok: false, message: 'location invalide' };
  }

  if (
    location.latitude !== undefined &&
    location.longitude !== undefined
  ) {
    if (location.latitude === null && location.longitude === null) {
      return {
        ok: true,
        value: { type: 'Point', coordinates: null }
      };
    }
    const lat = Number(location.latitude);
    const lng = Number(location.longitude);
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      return { ok: false, message: 'Latitude ou longitude invalide' };
    }
    return {
      ok: true,
      value: { type: 'Point', coordinates: [lng, lat] }
    };
  }

  if (Array.isArray(location.coordinates) && location.coordinates.length >= 2) {
    const lng = Number(location.coordinates[0]);
    const lat = Number(location.coordinates[1]);
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      return { ok: false, message: 'Coordonnées invalides' };
    }
    if (location.type && location.type !== 'Point') {
      return { ok: false, message: 'Type de localisation non supporté' };
    }
    return {
      ok: true,
      value: { type: 'Point', coordinates: [lng, lat] }
    };
  }

  return { ok: false, message: 'Format de localisation non reconnu' };
}

function validateMaxDistance(maxDistance) {
  if (maxDistance === undefined) {
    return { ok: true, value: undefined };
  }
  const n = Number(maxDistance);
  if (!Number.isFinite(n)) {
    return { ok: false, message: 'maxDistance doit être un nombre' };
  }
  const clamped = Math.min(1000, Math.max(1, Math.round(n)));
  return { ok: true, value: clamped };
}

function validateStyles(styles) {
  if (styles === undefined) {
    return { ok: true, value: undefined };
  }
  if (!Array.isArray(styles)) {
    return { ok: false, message: 'styles doit être un tableau' };
  }
  if (styles.length > MAX_STYLES) {
    return { ok: false, message: 'Trop de styles' };
  }
  const out = [];
  for (const s of styles) {
    if (typeof s !== 'string') {
      return { ok: false, message: 'Chaque style doit être une chaîne' };
    }
    const t = s.trim();
    if (!t) continue;
    if (t.length > MAX_STYLE_LENGTH) {
      return { ok: false, message: 'Style trop long' };
    }
    out.push(t);
  }
  return { ok: true, value: out };
}

module.exports = {
  FORBIDDEN_BODY_KEYS,
  rejectForbiddenProfileKeys,
  validatePhotosArray,
  validateMediaArray,
  validateLocation,
  validateMaxDistance,
  validateStyles
};
