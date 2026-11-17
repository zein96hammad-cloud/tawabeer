/**
 * =====================================================
 * طوابير (Tawabeer) — Smart Authentication Module
 * =====================================================
 * - Google Sign-In يعمل في كل الواجهات (مريض / صاحب عيادة)
 * - البريد: يحاول الدخول أولاً، وإن لم يوجد الحساب ينشئه تلقائياً
 * - رسائل أخطاء عربية واضحة
 */

import { auth, db } from './firebase-config.js';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  updateProfile,
  fetchSignInMethodsForEmail
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  doc, setDoc, getDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// ---------- ترجمة أخطاء Firebase إلى العربية ----------
export function translateAuthError(error) {
  const code = error?.code || '';
  const map = {
    'auth/invalid-email': 'البريد الإلكتروني غير صالح',
    'auth/user-disabled': 'هذا الحساب معطّل. تواصل مع الدعم',
    'auth/user-not-found': 'لا يوجد حساب بهذا البريد',
    'auth/wrong-password': 'كلمة المرور غير صحيحة',
    'auth/invalid-credential': 'البريد أو كلمة المرور غير صحيحة',
    'auth/email-already-in-use': 'هذا البريد مستخدم مسبقاً',
    'auth/weak-password': 'كلمة المرور ضعيفة — استخدم 6 أحرف على الأقل',
    'auth/too-many-requests': 'محاولات كثيرة جداً. حاول لاحقاً',
    'auth/network-request-failed': 'مشكلة في الاتصال بالإنترنت',
    'auth/popup-closed-by-user': 'تم إغلاق نافذة Google قبل إتمام الدخول',
    'auth/cancelled-popup-request': 'تم إلغاء نافذة تسجيل الدخول',
    'auth/popup-blocked': 'المتصفح منع النافذة المنبثقة. اسمح بالنوافذ لهذا الموقع',
    'auth/account-exists-with-different-credential': 'يوجد حساب بنفس البريد بطريقة دخول مختلفة',
    'auth/operation-not-allowed': 'طريقة الدخول غير مفعّلة في إعدادات Firebase',
    'auth/missing-password': 'أدخل كلمة المرور',
    'auth/internal-error': 'خطأ داخلي. حاول مرة أخرى'
  };
  return map[code] || (error?.message ? error.message : 'حدث خطأ غير متوقع. حاول مرة أخرى');
}

/**
 * حفظ / تحديث مستند المستخدم في Firestore
 */
async function ensureUserDoc(user, role = 'patient', extra = {}) {
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      uid: user.uid,
      fullName: extra.fullName || user.displayName || 'مستخدم',
      email: (user.email || '').toLowerCase(),
      role: role,
      createdAt: serverTimestamp(),
      ...extra
    });
  } else if (extra.fullName && !snap.data().fullName) {
    await setDoc(ref, { fullName: extra.fullName }, { merge: true });
  }
  return (await getDoc(ref)).data();
}

/**
 * =====================================================
 * تسجيل ذكي بالبريد + كلمة المرور
 * 1) يحاول تسجيل الدخول
 * 2) إن لم يوجد الحساب → ينشئه تلقائياً
 * =====================================================
 */
export async function smartEmailAuth(email, password, options = {}) {
  const { fullName = '', role = 'patient', preferredAction = 'auto' } = options;
  // preferredAction: 'auto' | 'login' | 'register'
  email = (email || '').trim().toLowerCase();
  password = password || '';

  if (!email) throw new Error('أدخل البريد الإلكتروني');
  if (!password || password.length < 6) throw new Error('كلمة المرور يجب أن تكون 6 أحرف على الأقل');

  // ---- محاولة الدخول أولاً ----
  if (preferredAction === 'login' || preferredAction === 'auto') {
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      await ensureUserDoc(cred.user, role, { fullName });
      return { user: cred.user, isNew: false };
    } catch (err) {
      const code = err.code || '';
      // أخطاء تعني أن الحساب غير موجود أو بيانات خاطئة
      const shouldTryCreate =
        preferredAction === 'auto' &&
        (code === 'auth/user-not-found' ||
         code === 'auth/invalid-credential' ||
         code === 'auth/wrong-password');

      if (!shouldTryCreate) {
        // إذا كان preferredAction = login فقط، أو خطأ آخر
        if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
          // تحقق إن كان البريد موجوداً أصلاً
          try {
            const methods = await fetchSignInMethodsForEmail(auth, email);
            if (methods && methods.length > 0) {
              throw new Error('كلمة المرور غير صحيحة');
            }
          } catch (e2) {
            if (e2.message === 'كلمة المرور غير صحيحة') throw e2;
          }
        }
        throw new Error(translateAuthError(err));
      }
      // نتابع لإنشاء الحساب
    }
  }

  // ---- إنشاء حساب جديد ----
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (fullName) {
      try { await updateProfile(cred.user, { displayName: fullName }); } catch (_) {}
    }
    await ensureUserDoc(cred.user, role, { fullName: fullName || 'مستخدم جديد' });
    return { user: cred.user, isNew: true };
  } catch (err) {
    if (err.code === 'auth/email-already-in-use') {
      // الحساب موجود لكن كلمة المرور كانت خاطئة في المحاولة الأولى
      throw new Error('هذا البريد مسجّل مسبقاً. تأكد من كلمة المرور أو استخدم "نسيت كلمة المرور"');
    }
    throw new Error(translateAuthError(err));
  }
}

/**
 * تسجيل دخول مريض (ذكي)
 */
export async function loginOrRegisterPatient(email, password, fullName = '') {
  return smartEmailAuth(email, password, {
    fullName,
    role: 'patient',
    preferredAction: 'auto'
  });
}

/**
 * تسجيل دخول صاحب عيادة فقط (لا ينشئ حساباً جديداً من هنا)
 */
export async function loginClinicOwner(email, password) {
  const result = await smartEmailAuth(email, password, {
    role: 'clinic_owner',
    preferredAction: 'login'
  });
  const data = await getCurrentUserData();
  if (data && data.role !== 'clinic_owner') {
    await signOut(auth);
    throw new Error('هذا الحساب ليس حساب صاحب عيادة. سجّل عيادة جديدة أولاً');
  }
  return result;
}

/**
 * إنشاء حساب صاحب عيادة + عيادة جديدة (Provisioning مجاني)
 */
export async function registerClinicOwner({
  email, password, fullName, clinicName, doctorName, specialty, city, lat, lng
}) {
  email = (email || '').trim().toLowerCase();
  if (!clinicName?.trim()) throw new Error('أدخل اسم العيادة');
  if (!doctorName?.trim()) throw new Error('أدخل اسم الطبيب');
  if (!specialty) throw new Error('اختر التخصص');
  if (!city) throw new Error('اختر المدينة');
  if (!email) throw new Error('أدخل البريد الإلكتروني');
  if (!password || password.length < 6) throw new Error('كلمة المرور يجب أن تكون 6 أحرف على الأقل');

  // إنشاء أو دخول الحساب
  let cred;
  try {
    cred = await createUserWithEmailAndPassword(auth, email, password);
  } catch (err) {
    if (err.code === 'auth/email-already-in-use') {
      // جرب الدخول ثم التحقق من عدم وجود عيادة مسبقاً
      try {
        cred = await signInWithEmailAndPassword(auth, email, password);
      } catch (e2) {
        throw new Error('هذا البريد مسجّل مسبقاً. إن كنت صاحب العيادة أدخل من "تسجيل دخول صاحب عيادة"');
      }
      const existing = await getDoc(doc(db, 'clinics', cred.user.uid));
      if (existing.exists()) {
        throw new Error('لديك عيادة مسجّلة مسبقاً. استخدم تسجيل الدخول');
      }
    } else {
      throw new Error(translateAuthError(err));
    }
  }

  await updateProfile(cred.user, { displayName: fullName || doctorName }).catch(() => {});

  await setDoc(doc(db, 'users', cred.user.uid), {
    uid: cred.user.uid,
    fullName: (fullName || doctorName).trim(),
    email,
    role: 'clinic_owner',
    createdAt: serverTimestamp()
  }, { merge: true });

  const baseSlug = clinicName
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\u0600-\u06FFa-zA-Z0-9-]/g, '')
    .toLowerCase() || ('clinic-' + Date.now());
  const slug = baseSlug + '-' + cred.user.uid.slice(0, 6);

  await setDoc(doc(db, 'clinics', cred.user.uid), {
    clinicId: cred.user.uid,
    slug,
    ownerUid: cred.user.uid,
    clinicName: clinicName.trim(),
    doctorName: doctorName.trim(),
    specialty: specialty.trim(),
    city: city.trim(),
    address: '',
    coords: { lat: lat || null, lng: lng || null },
    isOpen: true,
    walkinEnabled: true,
    rating: 0,
    ratingCount: 0,
    createdAt: serverTimestamp()
  });

  return { user: cred.user, clinicId: cred.user.uid, slug, isNew: true };
}

/**
 * =====================================================
 * Google Sign-In — يعمل في كل الواجهات
 * يتعرف تلقائياً إن كان الحساب جديداً أو قديماً
 * =====================================================
 */
export async function loginWithGoogle(role = 'patient') {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    const userRef = doc(db, 'users', user.uid);
    const snap = await getDoc(userRef);

    let isNew = false;
    if (!snap.exists()) {
      isNew = true;
      await setDoc(userRef, {
        uid: user.uid,
        fullName: user.displayName || 'مستخدم Google',
        email: (user.email || '').toLowerCase(),
        role: role, // patient أو clinic_owner حسب الواجهة التي استُدعي منها
        createdAt: serverTimestamp()
      });
    }
    // إذا كان موجوداً نحتفظ بالـ role الأصلي ولا نغيّره
    return { user, isNew, data: (await getDoc(userRef)).data() };
  } catch (err) {
    throw new Error(translateAuthError(err));
  }
}

/**
 * تسجيل الخروج
 */
export async function logout() {
  await signOut(auth);
}

/**
 * مراقبة حالة المصادقة
 */
export function onUserChanged(callback) {
  return onAuthStateChanged(auth, callback);
}

/**
 * جلب بيانات المستخدم الحالي من Firestore
 */
export async function getCurrentUserData() {
  const user = auth.currentUser;
  if (!user) return null;
  const snap = await getDoc(doc(db, 'users', user.uid));
  return snap.exists() ? { ...snap.data(), uid: user.uid } : null;
}

export { auth };
