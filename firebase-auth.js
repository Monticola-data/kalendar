const firebaseConfig = {
    apiKey: "AIzaSyBg9E8w5C5azvMKAJ3VY_YQmwu5DgaAU80",
    authDomain: "kalendar-831f8.firebaseapp.com",
    projectId: "kalendar-831f8"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const provider = new firebase.auth.GoogleAuthProvider();

// Nejdříve vyřeš stav po redirectu
firebase.auth().getRedirectResult().then((result) => {
    if (result.user) {
        console.log("✅ Přihlášen přes redirect:", result.user.email);
        sessionStorage.removeItem("redirecting");
    }
}).catch((error) => {
    console.error("❌ Chyba redirect:", error);
    sessionStorage.removeItem("redirecting");  // smaž stav, pokud nastala chyba
}).finally(() => {
    // Teprve zde spustíme sledování autentizace
    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            console.log("🔒 Přihlášený uživatel:", user.email);
            // fetchAppSheetData(user.email); // Zatím zakomentované
            sessionStorage.removeItem("redirecting");
        } else {
            if (!sessionStorage.getItem("redirecting")) {
                sessionStorage.setItem("redirecting", "true");
                firebase.auth().signInWithRedirect(provider);
            }
        }
    });
});


