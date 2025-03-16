import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyBg9E8w5C5azvMKAJ3VY_YQmwu5DgaAU80",
  authDomain: "kalendar-831f8.firebaseapp.com",
  projectId: "kalendar-831f8",
  storageBucket: "kalendar-831f8.appspot.com",
  messagingSenderId: "745578521928",
  appId: "1:745578521928:web:c5c733cb9061b1668aff7d"
};

firebase.initializeApp(firebaseConfig);

const db = firebase.firestore();

export { db };
