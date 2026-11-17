/**
 * طوابير — Clinics Module (Real-time Firestore)
 * Zero mock data. Live directory with GPS sorting.
 */
import { db } from './firebase-config.js';
import {
  collection, query, where, orderBy, onSnapshot,
  doc, updateDoc, getDoc, getDocs, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

/**
 * الاستماع المباشر لكل العيادات المسجلة (Real-time)
 * إذا لم توجد عيادات → القائمة فارغة (يظهر "لا توجد عيادات مسجلة حالياً")
 */
export function listenToClinics(callback) {
  const q = query(collection(db, 'clinics'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const clinics = [];
    snapshot.forEach(docSnap => {
      clinics.push({ id: docSnap.id, ...docSnap.data() });
    });
    callback(clinics);
  }, (error) => {
    console.error('Clinics listener error:', error);
    callback([]);
  });
}

/**
 * جلب عيادة واحدة بواسطة clinicId
 */
export async function getClinicById(clinicId) {
  const snap = await getDoc(doc(db, 'clinics', clinicId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

/**
 * جلب عيادة بواسطة slug
 */
export async function getClinicBySlug(slug) {
  const q = query(collection(db, 'clinics'), where('slug', '==', slug));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}

/**
 * تحديث حالة العيادة (مفتوح / مغلق) — من لوحة الطبيب فقط
 */
export async function setClinicOpenStatus(clinicId, isOpen) {
  await updateDoc(doc(db, 'clinics', clinicId), {
    isOpen: !!isOpen,
    updatedAt: serverTimestamp()
  });
}

/**
 * تفعيل / إيقاف الطابور اللحظي
 */
export async function setWalkinEnabled(clinicId, enabled) {
  await updateDoc(doc(db, 'clinics', clinicId), {
    walkinEnabled: !!enabled,
    updatedAt: serverTimestamp()
  });
}

/**
 * حساب المسافة بين نقطتين (Haversine) بالكيلومتر
 */
export function haversineKm(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * ترتيب العيادات حسب الأقرب أو التقييم
 */
export function sortClinics(clinics, mode = 'rating', userLat = null, userLng = null) {
  const list = [...clinics];
  if (mode === 'nearest' && userLat != null && userLng != null) {
    list.sort((a, b) => {
      const da = haversineKm(userLat, userLng, a.coords?.lat, a.coords?.lng) ?? 9999;
      const db = haversineKm(userLat, userLng, b.coords?.lat, b.coords?.lng) ?? 9999;
      return da - db;
    });
  } else {
    list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  }
  return list;
}

/**
 * فلترة العيادات
 */
export function filterClinics(clinics, { search = '', city = '', specialty = '', onlyOpen = false, onlyWalkin = false } = {}) {
  const q = search.trim().toLowerCase();
  return clinics.filter(c => {
    if (q && !(c.clinicName || '').toLowerCase().includes(q) &&
             !(c.doctorName || '').toLowerCase().includes(q) &&
             !(c.specialty || '').toLowerCase().includes(q)) return false;
    if (city && c.city !== city) return false;
    if (specialty && c.specialty !== specialty) return false;
    if (onlyOpen && !c.isOpen) return false;
    if (onlyWalkin && !c.walkinEnabled) return false;
    return true;
  });
}
