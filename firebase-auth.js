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

// ✅ Opravená a jednoduchá inicializace aplikace
function initApp(user) {
    window.currentUser = user;
    sessionStorage.setItem('userEmail', user.email);
    console.log("🚀 Přihlášený:", user.email);

    if (typeof fetchAppSheetData === "function") {
        fetchAppSheetData(user.email);
    } else {
        console.error("❌ Funkce fetchAppSheetData není definována!");
    }

    // ✅ Zde voláme listenForUpdates jen jednou
    if (typeof listenForUpdates === "function") {
        listenForUpdates();
    } else {
        console.error("❌ Funkce listenForUpdates není definována!");
    }
}
