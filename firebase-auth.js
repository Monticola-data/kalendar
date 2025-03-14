const firebaseConfig = {
    apiKey: "AIzaSyBg9E8w5C5azvMKAJ3VY_YQmwu5DgaAU80",
    authDomain: "kalendar-831f8.firebaseapp.com",
    projectId: "kalendar-831f8"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const provider = new firebase.auth.GoogleAuthProvider();

// Kontrola přihlášeného uživatele
firebase.auth().onAuthStateChanged((user) => {
    if (user) {
        console.log("🔒 Přihlášen uživatel:", user.email);
        fetchAppSheetData(user.email);
    } else {
        // Pokud uživatel není přihlášen, přesměruje na přihlášení
        firebase.auth().signInWithRedirect(provider);
    }
});

// Po návratu z přesměrování (nutné)
firebase.auth().getRedirectResult()
    .then((result) => {
        if (result.user) {
            console.log("✅ Uživatel přihlášen po redirectu:", result.user.email);
            fetchAppSheetData(result.user.email);
        }
    })
    .catch((error) => {
        console.error("❌ Chyba přihlášení:", error);
    });
