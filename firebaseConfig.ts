import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";   // 👈 add this

const firebaseConfig = {
  apiKey: "AIzaSyAyx4RgUj33UZqFPUEcEqvmSknQcEkfQag",
  authDomain: "clipsquad-1b5a2.firebaseapp.com",
  projectId: "clipsquad-1b5a2",
  storageBucket: "clipsquad-1b5a2.firebasestorage.app",
  messagingSenderId: "186294550410",
  appId: "1:186294550410:web:332e34ff93827ce23c1273",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);          // 👈 add this
