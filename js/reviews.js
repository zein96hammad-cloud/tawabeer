/**
 * طوابير — Public Reviews (Real Firestore)
 */
import { db } from './firebase-config.js';
import {
  collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

export function listenToReviews(callback, max = 8) {
  const q = query(collection(db, 'reviews'), orderBy('createdAt', 'desc'), limit(max));
  return onSnapshot(q, (snap) => {
    const list = [];
    snap.forEach(d => list.push({ id: d.id, ...d.data() }));
    callback(list);
  }, () => callback([]));
}

export async function submitReview(authorName, stars, comment) {
  if (!stars || stars < 1 || stars > 5) throw new Error('التقييم يجب أن يكون بين 1 و 5');
  await addDoc(collection(db, 'reviews'), {
    authorName: (authorName || 'زائر').trim(),
    stars: Number(stars),
    comment: (comment || '').trim(),
    createdAt: serverTimestamp()
  });
}
