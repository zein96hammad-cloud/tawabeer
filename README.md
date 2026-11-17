# طوابير (Tawabeer) — Production-Ready SaaS

منصة سحابية متعددة المستأجرين لإدارة طوابير ومواعيد العيادات الطبية.

**المطور:** ZEIN HAMMAD — zein96hammad@gmail.com

---

## المميزات

- **Zero Mock Data**: لا توجد عيادات وهمية. الدليل فارغ حتى يسجّل أول طبيب.
- **تفعيل مجاني فوري**: لا يوجد دفع. أي طبيب يملأ النموذج يُفعَّل حسابه وعيادته مباشرة.
- **عزل تام للمستأجرين (Tenant Isolation)**: كل عيادة ترى فقط مرضاها وحجوزاتها.
- **Real-time**: دليل العيادات + قائمة الانتظار تتحدث لحظياً عبر Firestore `onSnapshot`.
- **مصادقة حقيقية**: Email/Password + Google Sign-In عبر Firebase Auth.
- **GPS حقيقي**: ترتيب العيادات حسب الأقرب باستخدام موقع المتصفح + معادلة Haversine.

---

## هيكل المشروع

```
tawabeer-saas/
├── index.html              # الواجهة الرئيسية
├── js/
│   ├── firebase-config.js  # إعدادات Firebase (ضع مفاتيحك هنا)
│   ├── auth.js             # المصادقة + إنشاء العيادة
│   ├── clinics.js          # دليل العيادات + GPS
│   ├── bookings.js         # الحجوزات والطوابير
│   └── reviews.js          # تقييمات الزوار
├── firestore.rules         # قواعد الأمان (انشرها في Firebase Console)
└── README.md
```

---

## خطوات التشغيل (Setup)

### 1. إنشاء مشروع Firebase

1. اذهب إلى [Firebase Console](https://console.firebase.google.com)
2. أنشئ مشروعاً جديداً باسم `Tawabeer`
3. فعّل **Authentication** → Sign-in method:
   - Email/Password
   - Google
4. أنشئ **Firestore Database** في وضع Production
5. من Project Settings → General → Your apps → أضف تطبيق Web وانسخ الإعدادات

### 2. وضع المفاتيح

افتح `js/firebase-config.js` واستبدل القيم:

```js
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "...",
  appId: "..."
};
```

### 3. نشر قواعد الأمان

1. في Firebase Console → Firestore → Rules
2. الصق محتوى ملف `firestore.rules`
3. Publish

### 4. إنشاء الفهارس المطلوبة (Indexes)

عند أول استخدام، قد يطلب Firebase إنشاء Composite Indexes.
اتبع الروابط التي تظهر في Console (عادةً لـ `bookings` مع `clinicId` + `status` + `createdAt`).

### 5. التشغيل المحلي

يمكنك فتح `index.html` مباشرة، أو استخدام أي خادم ثابت:

```bash
npx serve .
# أو
python -m http.server 3000
```

### 6. النشر

- **Firebase Hosting**: `firebase init hosting` ثم `firebase deploy`
- **Vercel / Netlify**: ارفع المجلد كاملاً

---

## تدفقات العمل

### صاحب العيادة
1. يملأ نموذج "إنشاء عيادة جديدة"
2. يُنشأ حساب Auth + سجل في `users` (role: clinic_owner) + سجل في `clinics`
3. يُوجَّه فوراً إلى لوحة التحكم
4. يستطيع فتح/إغلاق العيادة واستدعاء المريض التالي

### المريض
1. يسجّل دخولاً (Email أو Google)
2. يرى دليل العيادات الحقيقي (فارغ إن لم يُسجَّل أحد)
3. يختار عيادة → يحجز لحظي أو مجدول
4. يظهر الحجز فوراً في لوحة الطبيب

---

## Schema ملخص

| Collection | أهم الحقول |
|------------|------------|
| `users`    | uid, fullName, email, role |
| `clinics`  | clinicId, slug, ownerUid, clinicName, doctorName, specialty, city, coords, isOpen |
| `bookings` | clinicId, patientUid, patientName, type, queueNumber, status |
| `reviews`  | authorName, stars, comment |

---

## ملاحظات أمنية

- قواعد `firestore.rules` تضمن أن الطبيب يعدّل فقط عيادته وحجوزاتها.
- المريض يرى فقط حجوزاته.
- دليل العيادات عام للقراءة (ضروري للاكتشاف).

---

© 2026 طوابير (Tawabeer) — تطوير: **ZEIN HAMMAD**
