const getServerBaseUrl = require('./serverBaseUrl');

const SKILL_LEVELS = ['Novice', 'Learner', 'Intermediate', 'Advanced', 'Master', 'Teacher'];

function normalizeInstruments(instruments) {
  if (!instruments || !Array.isArray(instruments)) return [];
  return instruments.map((item) => {
    if (typeof item === 'string') {
      return { name: item.trim(), level: 'Novice' };
    }
    if (item && typeof item === 'object' && item.name) {
      const level = SKILL_LEVELS.includes(item.level) ? item.level : 'Novice';
      return { name: String(item.name).trim(), level };
    }
    return null;
  }).filter((item) => item && item.name && item.name.trim());
}

function transformPhotoUrls(photos) {
  if (!photos || !Array.isArray(photos)) {
    return photos;
  }
  const baseUrl = getServerBaseUrl();
  return photos.map((photo) => {
    if (photo && (photo.startsWith('http://') || photo.startsWith('https://'))) {
      return photo;
    }
    if (photo && photo.startsWith('/')) {
      return `${baseUrl}${photo}`;
    }
    return photo;
  });
}

function normalizeLocationForClient(location) {
  if (!location || !location.coordinates || !Array.isArray(location.coordinates) || location.coordinates.length < 2) {
    return location;
  }
  const [lng, lat] = location.coordinates.map(Number);
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return location;
  }
  return {
    type: location.type || 'Point',
    coordinates: location.coordinates,
    latitude: lat,
    longitude: lng
  };
}

/**
 * Utilisateur minimal pour affichage (pas d'email — évite fuite et énumération).
 */
function publicUserSummary(userDoc) {
  if (!userDoc) return null;
  const u = userDoc._doc || userDoc;
  const id = u._id || u.id;
  if (!id) return null;
  return {
    _id: id,
    id,
    username: u.username
  };
}

/**
 * Profil "carte / swipe / autre utilisateur" — champs strictement nécessaires au client.
 */
function serializePublicProfile(profileInput, options = {}) {
  const raw = profileInput && typeof profileInput.toObject === 'function'
    ? profileInput.toObject({ virtuals: true })
    : { ...profileInput };
  const distanceCalculated = options.distanceCalculated !== undefined
    ? options.distanceCalculated
    : raw.distanceCalculated;

  let userIdOut = null;
  if (raw.userId) {
    if (typeof raw.userId === 'object' && raw.userId !== null) {
      userIdOut = publicUserSummary(raw.userId);
    } else {
      userIdOut = raw.userId;
    }
  }

  const base = {
    _id: raw._id,
    id: raw._id,
    userId: userIdOut,
    pseudo: raw.pseudo,
    age: raw.age,
    sexe: raw.sexe,
    photos: transformPhotoUrls(raw.photos),
    description: raw.description,
    instruments: normalizeInstruments(raw.instruments),
    styles: raw.styles || [],
    maxDistance: raw.maxDistance,
    media: raw.media || [],
    location: normalizeLocationForClient(raw.location),
    locationName: raw.locationName ?? null
  };

  if (distanceCalculated !== undefined && distanceCalculated !== null) {
    base.distanceCalculated = distanceCalculated;
  }

  return base;
}

/**
 * Profil du compte connecté — pas de listes internes (likes, blocages, quotas, miroirs match).
 */
function serializeOwnProfile(profileInput, { isPremium }) {
  const raw = profileInput && typeof profileInput.toObject === 'function'
    ? profileInput.toObject({ virtuals: true })
    : { ...profileInput };

  let userIdOut;
  if (raw.userId && typeof raw.userId === 'object' && raw.userId !== null) {
    const uid = raw.userId._id || raw.userId.id;
    userIdOut = {
      _id: uid,
      id: uid,
      username: raw.userId.username,
      isPremium: !!isPremium
    };
  } else if (raw.userId) {
    userIdOut = {
      _id: raw.userId,
      id: raw.userId,
      isPremium: !!isPremium
    };
  } else {
    userIdOut = null;
  }

  return {
    _id: raw._id,
    id: raw._id,
    userId: userIdOut,
    pseudo: raw.pseudo,
    age: raw.age,
    sexe: raw.sexe,
    photos: transformPhotoUrls(raw.photos),
    description: raw.description,
    instruments: normalizeInstruments(raw.instruments),
    styles: raw.styles || [],
    maxDistance: raw.maxDistance,
    media: raw.media || [],
    location: normalizeLocationForClient(raw.location),
    locationName: raw.locationName ?? null
  };
}

function serializeMessageDoc(msg) {
  const m = msg && typeof msg.toObject === 'function' ? msg.toObject() : { ...msg };
  const sender = m.senderId && typeof m.senderId === 'object'
    ? { _id: m.senderId._id, username: m.senderId.username }
    : m.senderId;
  const receiver = m.receiverId && typeof m.receiverId === 'object'
    ? { _id: m.receiverId._id, username: m.receiverId.username }
    : m.receiverId;

  return {
    _id: m._id,
    id: m._id,
    conversationId: m.conversationId,
    senderId: sender && sender._id ? sender._id : sender,
    receiverId: receiver && receiver._id ? receiver._id : receiver,
    content: m.content,
    read: m.read,
    readAt: m.readAt || null,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt
  };
}

function serializeConversationOtherUser(userDoc) {
  const u = userDoc && (userDoc._doc || userDoc);
  if (!u || !u._id) return null;
  return {
    id: u._id.toString(),
    username: u.username
  };
}

function serializeConversationProfileSummary(profile) {
  if (!profile) return null;
  const p = profile.toObject ? profile.toObject({ virtuals: true }) : profile;
  return {
    id: p._id.toString(),
    pseudo: p.pseudo,
    photos: transformPhotoUrls(p.photos || []),
    description: p.description
  };
}

module.exports = {
  normalizeInstruments,
  transformPhotoUrls,
  normalizeLocationForClient,
  publicUserSummary,
  serializePublicProfile,
  serializeOwnProfile,
  serializeMessageDoc,
  serializeConversationOtherUser,
  serializeConversationProfileSummary
};
