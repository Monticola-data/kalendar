const firebaseConfig = {
    apiKey: "AIzaSyBg9E8w5C5azvMKAJ3VY_YQmwu5DgaAU80",
    authDomain: "kalendar-831f8.firebaseapp.com",
    projectId: "kalendar-831f8"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const provider = new firebase.auth.GoogleAuthProvider();

// Zpracuj návrat z redirectu ihned po načtení stránky
firebase.auth().getRedirectResult().then((result) => {
    if (result.user) {
        console.log("✅ Přihlášen přes redirect:", result.user.email);
        window.currentUser = result.user; // globálně dostupné
    }
}).catch((error) => {
    console.error("❌ Chyba redirect:", error);
}).finally(() => {
    // Hlavní kontrola stavu autentizace
    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            console.log("🔒 Přihlášený uživatel:", user.email);
            window.currentUser = user; // globálně dostupné
            // fetchAppSheetData(user.email); // zatím zakomentováno
        } else {
            if (!sessionStorage.getItem("redirecting")) {
                sessionStorage.setItem("redirecting", "true");
                firebase.auth().signInWithRedirect(provider);
            }
        }
        sessionStorage.removeItem("redirecting"); // vždy smaž příznak po ověření stavu
    });
});
