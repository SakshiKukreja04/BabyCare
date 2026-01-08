import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp
} from "firebase/firestore";
import { db } from "./firebase";
import { careLogsApi, alertsApi } from './api';

// USERS
export async function createUserIfNotExists(user) {
  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) {
    await setDoc(userRef, {
      name: user.displayName || "Anonymous",
      email: user.email,
      language: "en",
      createdAt: serverTimestamp(),
    });
  }
}

// BABIES
export async function addBaby(data) {
  // data: { parentId, name, dob, gestationalAge, currentWeight }
  if (!data.parentId) throw new Error("parentId required");

  const babiesCol = collection(db, "babies");

  // If a baby already exists for this parent, treat this as an update/edit
  const existingQuery = query(babiesCol, where("parentId", "==", data.parentId), limit(1));
  const existingSnap = await getDocs(existingQuery);

  if (!existingSnap.empty) {
    const existingDoc = existingSnap.docs[0];
    const babyRef = doc(db, "babies", existingDoc.id);
    await setDoc(
      babyRef,
      {
        ...data,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    return babyRef;
  }

  // Otherwise create a new baby profile with timestamps
  return await addDoc(babiesCol, {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function getBabiesByParent(uid) {
  // Simple query without orderBy to avoid requiring composite index
  const q = query(
    collection(db, "babies"),
    where("parentId", "==", uid)
  );
  const snap = await getDocs(q);
  const babies = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  
  // Sort in memory by createdAt if available (newest first)
  babies.sort((a, b) => {
    const aTime = a.createdAt?.toMillis?.() || a.createdAt?.seconds * 1000 || 0;
    const bTime = b.createdAt?.toMillis?.() || b.createdAt?.seconds * 1000 || 0;
    return bTime - aTime; // Descending order
  });
  
  return babies;
}

// CARE LOGS
// Note: Care logs are now handled by the backend API
// These functions are kept for backward compatibility but redirect to API
export async function addCareLog(logData) {
  // logData: { parentId, babyId, type, ...fields }
  if (!logData.parentId) throw new Error("parentId required");
  if (!logData.babyId || !logData.type) throw new Error("babyId and type required");

  // Use backend API instead of direct Firestore
  const result = await careLogsApi.create({
    babyId: logData.babyId,
    type: logData.type,
    quantity: logData.quantity,
    duration: logData.duration,
    medicationGiven: logData.medicationGiven,
    notes: logData.notes,
  });

  return result.careLog;
}

export async function getCareLogsByBaby(babyId, parentId, max = 20) {
  // Use backend API instead of direct Firestore
  const result = await careLogsApi.getByBaby(babyId, max);
  return result.careLogs;
}

// RULES (READ-ONLY)
export async function getRules() {
  const snap = await getDocs(collection(db, "rules"));
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// ALERTS (READ-ONLY)
// Note: Alerts are now handled by the backend API
export async function getAlertsByBaby(babyId) {
  // Use backend API instead of direct Firestore
  const result = await alertsApi.getByBaby(babyId, false); // Get unresolved alerts
  return result.alerts;
}
