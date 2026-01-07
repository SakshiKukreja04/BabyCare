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
  return await addDoc(collection(db, "babies"), data);
}

export async function getBabiesByParent(uid) {
  const q = query(collection(db, "babies"), where("parentId", "==", uid));
  const snap = await getDocs(q);
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
