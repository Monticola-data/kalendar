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

// hlavní sledování autentizace
firebase.auth().onAuthStateChanged(user => {
    if (user) {
        console.log("🔒 Už přihlášen:", user.email);
        sessionStorage.removeItem("redirecting");
        initApp(user);
    } else {
        if (!sessionStorage.getItem("redirecting")) {
            sessionStorage.setItem("redirecting", "true");
            firebase.auth().signInWithRedirect(provider);
        }
    }
});

// Jediná správná definice funkce initApp
function initApp(user) {
    window.currentUser = user;
    console.log("🚀 Aplikace připravena pro uživatele:", user.email);
    // zde později načítáš data:
    // fetchAppSheetData(user.email);
}
