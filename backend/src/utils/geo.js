const EARTH_RADIUS_KM = 6371;

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

// great-circle distance between two lat/lng points, in kilometers
function haversineDistanceKm(lat1, lng1, lat2, lng2) {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const MAX_CHECKIN_DISTANCE_KM = 50;

const isCoord = (v, limit) => typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= limit;

// decides whether a GPS check-in counts: returns an error message, or null when it's
// within MAX_CHECKIN_DISTANCE_KM of the province centroid. Missing or non-numeric
// coordinates — the user's or the province's — are always refused
function checkinError(body, province) {
  const lat = body?.lat;
  const lng = body?.lng;
  if (!isCoord(lat, 90) || !isCoord(lng, 180)) return "กรุณาเปิดสิทธิ์ตำแหน่งเพื่อเช็คอิน";
  if (!isCoord(province.latitude, 90) || !isCoord(province.longitude, 180)) {
    return "จังหวัดนี้ยังไม่มีพิกัด เช็คอินไม่ได้ชั่วคราว";
  }
  const distanceKm = haversineDistanceKm(lat, lng, province.latitude, province.longitude);
  return distanceKm > MAX_CHECKIN_DISTANCE_KM ? "ตำแหน่งไม่ตรงกับจังหวัดนี้" : null;
}

module.exports = { haversineDistanceKm, checkinError, MAX_CHECKIN_DISTANCE_KM };
