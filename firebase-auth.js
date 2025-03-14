// firebase-auth.js - definitivní čistá verze (compat SDK)

const provider = new firebase.auth.GoogleAuthProvider();

firebase.auth().getRedirectResult().then(result => {
    if (result.user) {
        console.log("✅ Přihlášen po redirect:", result.user.email);
        sessionStorage.removeItem("redirecting");
        initApp(result.user);
    }
}).catch(error => {
    console.error("❌ Chyba po redirect:", error);
    sessionStorage.removeItem("redirecting");
});

// hlavní sledování stavu přihlášení
firebase.auth().onAuthStateChanged(user => {
    if (user) {
        console.log("🔒 Přihlášený uživatel:", user.email);
        sessionStorage.removeItem("redirecting");
        initApp(user);
    } else if (!sessionStorage.getItem("redirecting")) {
        sessionStorage.setItem("redirecting", "true");
        firebase.auth().signInWithRedirect(provider);
    }
});

// Inicializace tvé aplikace, až budeš potřebovat
function initApp(user) {
    window.currentUser = user;
    console.log("✅ Aplikace připravena pro:", user.email);
    // Tady budeš později načítat data:
    // fetchAppSheetData(user.email);
}
