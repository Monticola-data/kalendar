import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js';
import { getFirestore, doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyBg9E8w5C5azvMKAJ3VY_YQmwu5DgaAU80",
  authDomain: "kalendar-831f8.firebaseapp.com",
  projectId: "kalendar-831f8",
  storageBucket: "kalendar-831f8.appspot.com",
  messagingSenderId: "745578521928",
  appId: "1:745578521928:web:c5c733cb9061b1668aff7d"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Test čtení dat
async function testReadEvent() {
  const docRef = doc(db, "events", "GIuSGcMjPK1yR7CNvpnTem");
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    console.log("✅ Data z Firestore načtena úspěšně:", docSnap.data());
  } else {
    console.log("❌ Dokument nenalezen");
  }
}

// Test zápisu dat
async function testWriteEvent() {
  const docRef = doc(db, "events", "GIuSGcMjPK1yR7CNvpnTem");
  await setDoc(docRef, {
    party: "parta_test",
    color: "#123456"
  }, { merge: true });

  console.log("✅ Data do Firestore zapsána úspěšně");
}

// Spuštění testů
testReadEvent();
testWriteEvent();

