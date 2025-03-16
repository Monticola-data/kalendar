import { fetchFirestoreEvents, listenForUpdates } from './script.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js';
import { 
    getAuth, 
    GoogleAuthProvider, 
    signInWithPopup, 
    onAuthStateChanged, 
    setPersistence, 
    browserLocalPersistence 
} from 'https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js';

// Inicializace Firebase App
const firebaseConfig = {
    apiKey: "AIzaSyBg9E8w5C5azvMKAJ3VY_YQmwu5DgaAU80",
    authDomain: "kalendar-831f8.firebaseapp.com",
    databaseURL: "https://kalendar-831f8-default-rtdb.firebaseio.com",
    projectId: "kalendar-831f8",
    storageBucket: "kalendar-831f8.firebasestorage.app",
    messagingSenderId: "745578521928",
    appId: "1:745578521928:web:c5c733cb9061b1668aff7d",
    measurementId: "G-X1SC7SDL4G"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

setPersistence(auth, browserLocalPersistence).then(() => {
    console.log("✅ Persistentní přihlášení nastaveno.");
}).catch((error) => {
    console.error("❌ Chyba při nastavení persistence:", error);
});

const loginButton = document.getElementById('loginButton');

loginButton.addEventListener('click', () => {
    signInWithPopup(auth, provider)
        .then(result => {
            console.log("✅ Přihlášený uživatel:", result.user.email);
            initApp(result.user);
        })
        .catch(error => {
            console.error("❌ Chyba přihlášení:", error);
        });
});

onAuthStateChanged(auth, user => {
    if (user) {
        console.log("🔒 Už přihlášený:", user.email);
        loginButton.style.display = "none";
        window.currentUser = user;
        sessionStorage.setItem('userEmail', user.email);

        user.getIdToken(true);

        initApp(user);
    } else {
        console.warn("🔓 Uživatel byl odhlášen");
        loginButton.style.display = "inline-block";
        sessionStorage.removeItem('userEmail');
        window.currentUser = null;
    }
});

function initApp(user) {
    window.currentUser = user;
    sessionStorage.setItem('userEmail', user.email);
    console.log("🚀 Přihlášený:", user.email);

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => {
            fetchFirestoreEvents(user.email);
            listenForUpdates(user.email);
        });
    } else {
        fetchFirestoreEvents(user.email);
        listenForUpdates(user.email);
    }
}

// ✅ Obnovení dat při návratu do aplikace (mobilní zařízení)
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && window.currentUser) {
        console.log("🔄 Obnovení dat po návratu do aplikace");
        fetchFirestoreEvents(window.currentUser.email);
        listenForUpdates(window.currentUser.email);
    }
});
