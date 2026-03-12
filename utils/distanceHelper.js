// Vérifie qu'un profil possède une localisation GeoJSON valide
function hasValidLocation(profile) {
  return !!(
    profile &&
    profile.location &&
    profile.location.coordinates &&
    Array.isArray(profile.location.coordinates) &&
    profile.location.coordinates.length === 2 &&
    profile.location.coordinates[0] !== null &&
    profile.location.coordinates[1] !== null &&
    !Number.isNaN(profile.location.coordinates[0]) &&
    !Number.isNaN(profile.location.coordinates[1])
  );
}

/**
 * Calcule la distance géographique entre deux profils (en kilomètres).
 *
 * - Utilise la formule de Haversine pour la distance "à vol d'oiseau" sur une sphère.
 * - Suppose que location.coordinates est au format GeoJSON [longitude, latitude].
 * - Retourne null si l'une des localisations est invalide.
 */
function computeDistanceKm(fromProfile, toProfile) {
  if (!hasValidLocation(fromProfile) || !hasValidLocation(toProfile)) {
    return null;
  }

  const [fromLng, fromLat] = fromProfile.location.coordinates.map(Number);
  const [toLng, toLat] = toProfile.location.coordinates.map(Number);

  if (
    Number.isNaN(fromLat) || Number.isNaN(fromLng) ||
    Number.isNaN(toLat) || Number.isNaN(toLng)
  ) {
    return null;
  }

  // Formule de Haversine https://www.movable-type.co.uk/scripts/latlong.html
  const R = 6371; // Rayon moyen de la Terre en kilomètres
  const dLat = (toLat - fromLat) * Math.PI / 180;
  const dLng = (toLng - fromLng) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(fromLat * Math.PI / 180) * Math.cos(toLat * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;

  // Arrondi à 2 décimales pour l'affichage (ex: 3.27 km)
  return Math.round(d * 100) / 100;
}

module.exports = {
  hasValidLocation,
  computeDistanceKm
};

