import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBA8iIXOCsGuTXeBvpkvfIOZ6nT1Nw4Ugk",
  authDomain: "...",
  projectId: "kalendar-831f8",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
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
