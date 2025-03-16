import { fetchFirestoreEvents } from './script.js';
import { listenForUpdates } from './script.js';
import { fetchFirestoreEvents, listenForUpdates } from './script.js';


const provider = new firebase.auth.GoogleAuthProvider();

document.addEventListener("DOMContentLoaded", () => {
    const loginButton = document.getElementById('loginButton');

    loginButton.addEventListener('click', () => {
        firebase.auth().signInWithPopup(provider)
            .then(result => {
                console.log("✅ Přihlášený uživatel (popup):", result.user.email);
                initApp(result.user);
            })
            .catch(error => {
                console.error("❌ Chyba přihlášení:", error);
            });
    });

    firebase.auth().onAuthStateChanged(user => {
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

});

// ✅ Definitivní podoba funkce initApp
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
