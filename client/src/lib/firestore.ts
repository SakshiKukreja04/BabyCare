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
export async function addCareLog(logData) {
  // logData: { parentId, babyId, type, ...fields }
  if (!logData.parentId) throw new Error("parentId required");
  if (!logData.babyId || !logData.type) throw new Error("babyId and type required");

  return await addDoc(collection(db, "careLogs"), {
    ...logData,
    timestamp: serverTimestamp(),
  });
}

export async function getCareLogsByBaby(babyId, parentId, max = 20) {
  const q = query(
    collection(db, "careLogs"),
    where("parentId", "==", parentId)
  );
  const snap = await getDocs(q);
  // Filter & sort client-side so we don't require a composite index
  return snap.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((doc: any) => doc.babyId === babyId)
    // newest first, based on Firestore timestamp field
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .sort((a: any, b: any) => {
      const ta = a.timestamp?.toMillis?.() ?? 0;
      const tb = b.timestamp?.toMillis?.() ?? 0;
      return tb - ta;
    })
    .slice(0, max);
}

// RULES (READ-ONLY)
export async function getRules() {
  const snap = await getDocs(collection(db, "rules"));
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// ALERTS (READ-ONLY)
export async function getAlertsByBaby(babyId) {
  const q = query(collection(db, "alerts"), where("babyId", "==", babyId));
  const snap = await getDocs(q);
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
