/**
 * طوابير — Bookings Module (Real-time + Tenant Isolation)
 */
import { db } from './firebase-config.js';
import {
  collection, query, where, orderBy, onSnapshot,
  addDoc, updateDoc, doc, getDocs, serverTimestamp,
  writeBatch, limit
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

/**
 * الاستماع المباشر لحجوزات عيادة معينة (لوحة الطبيب)
 */
export function listenToClinicBookings(clinicId, callback) {
  const q = query(
    collection(db, 'bookings'),
    where('clinicId', '==', clinicId),
    orderBy('createdAt', 'asc')
  );
  return onSnapshot(q, (snapshot) => {
    const bookings = [];
    snapshot.forEach(d => bookings.push({ id: d.id, ...d.data() }));
    callback(bookings);
  }, (err) => {
    console.error('Bookings listener error:', err);
    callback([]);
  });
}

/**
 * الاستماع لحجوزات مريض معين
 */
export function listenToPatientBookings(patientUid, callback) {
  const q = query(
    collection(db, 'bookings'),
    where('patientUid', '==', patientUid),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(q, (snapshot) => {
    const bookings = [];
    snapshot.forEach(d => bookings.push({ id: d.id, ...d.data() }));
    callback(bookings);
  });
}

/**
 * الحصول على رقم الدور التالي لعيادة معينة (تسلسلي خاص بالعيادة)
 */
async function getNextQueueNumber(clinicId) {
  const q = query(
    collection(db, 'bookings'),
    where('clinicId', '==', clinicId),
    where('type', '==', 'live'),
    where('status', 'in', ['waiting', 'in_progress']),
    orderBy('queueNumber', 'desc'),
    limit(1)
  );
  try {
    const snap = await getDocs(q);
    if (snap.empty) return 1;
    const last = snap.docs[0].data().queueNumber || 0;
    return last + 1;
  } catch (e) {
    // fallback بسيط إذا فشل الـ index
    return Date.now() % 10000;
  }
}

/**
 * إنشاء حجز لحظي (Live Queue)
 */
export async function createLiveBooking({ clinicId, patientUid, patientName, patientPhone, service = '' }) {
  const queueNumber = await getNextQueueNumber(clinicId);
  const docRef = await addDoc(collection(db, 'bookings'), {
    clinicId,
    patientUid,
    patientName: patientName.trim(),
    patientPhone: (patientPhone || '').trim(),
    service: service.trim(),
    type: 'live',
    queueNumber,
    scheduledDate: null,
    scheduledTime: null,
    status: 'waiting',
    createdAt: serverTimestamp()
  });
  return { id: docRef.id, queueNumber };
}

/**
 * إنشاء موعد مجدول
 */
export async function createScheduledBooking({
  clinicId, patientUid, patientName, patientPhone, service = '',
  scheduledDate, scheduledTime
}) {
  const docRef = await addDoc(collection(db, 'bookings'), {
    clinicId,
    patientUid,
    patientName: patientName.trim(),
    patientPhone: (patientPhone || '').trim(),
    service: service.trim(),
    type: 'scheduled',
    queueNumber: null,
    scheduledDate,
    scheduledTime,
    status: 'waiting',
    createdAt: serverTimestamp()
  });
  return { id: docRef.id };
}

/**
 * استدعاء المريض التالي (من لوحة الطبيب)
 * - ينهي المريض الحالي (in_progress → completed)
 * - ينقل أول منتظر إلى in_progress
 */
export async function callNextPatient(clinicId) {
  const q = query(
    collection(db, 'bookings'),
    where('clinicId', '==', clinicId),
    where('status', 'in', ['waiting', 'in_progress']),
    orderBy('createdAt', 'asc')
  );
  const snap = await getDocs(q);
  const waiting = [];
  let current = null;
  snap.forEach(d => {
    const data = { id: d.id, ...d.data() };
    if (data.status === 'in_progress') current = data;
    else waiting.push(data);
  });

  const batch = writeBatch(db);
  if (current) {
    batch.update(doc(db, 'bookings', current.id), {
      status: 'completed',
      completedAt: serverTimestamp()
    });
  }
  if (waiting.length > 0) {
    batch.update(doc(db, 'bookings', waiting[0].id), {
      status: 'in_progress',
      startedAt: serverTimestamp()
    });
  }
  await batch.commit();
  return waiting[0] || null;
}

/**
 * إنهاء الجلسة الحالية يدوياً
 */
export async function completeBooking(bookingId) {
  await updateDoc(doc(db, 'bookings', bookingId), {
    status: 'completed',
    completedAt: serverTimestamp()
  });
}

/**
 * إلغاء حجز
 */
export async function cancelBooking(bookingId) {
  await updateDoc(doc(db, 'bookings', bookingId), {
    status: 'cancelled',
    cancelledAt: serverTimestamp()
  });
}

/**
 * تسجيل "لم يحضر"
 */
export async function markNoShow(bookingId) {
  await updateDoc(doc(db, 'bookings', bookingId), {
    status: 'cancelled',
    noShow: true,
    cancelledAt: serverTimestamp()
  });
}
