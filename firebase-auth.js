import { fetchFirestoreEvents, listenForUpdates } from './script.js';

const provider = new firebase.auth.GoogleAuthProvider();

document.addEventListener("DOMContentLoaded", () => {
    const loginButton = document.getElementById('loginButton');
    const logoutButton = document.getElementById('logoutButton');

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

    logoutButton.addEventListener('click', () => {
        firebase.auth().signOut()
            .then(() => {
                console.log("🔓 Uživatel byl odhlášen");
                window.currentUser = null;
                sessionStorage.removeItem('userEmail');
                loginButton.style.display = "inline-block";
                logoutButton.style.display = "none";
                location.reload();  // Reload stránky po odhlášení
            })
            .catch(error => {
                console.error("❌ Chyba při odhlašování:", error);
            });
    });

    firebase.auth().onAuthStateChanged(user => {
        if (user) {
            console.log("🔒 Už přihlášený:", user.email);
            document.getElementById('loginButton').style.display = "none";
            logoutButton.style.display = "inline-block";
            window.currentUser = user;
            sessionStorage.setItem('userEmail', user.email);

            initApp(user);
        } else {
            console.warn("🔓 Uživatel byl odhlášen");
            loginButton.style.display = "inline-block";
            logoutButton.style.display = "none";
            sessionStorage.removeItem('userEmail');
            window.currentUser = null;
        }
    });

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
