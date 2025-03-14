const firebaseConfig = {
    apiKey: "AIzaSyBg9E8w5C5azvMKAJ3VY_YQmwu5DgaAU80",
    authDomain: "kalendar-831f8.firebaseapp.com",
    projectId: "kalendar-831f8"
};

// Inicializace Firebase aplikace jen jednou
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// Přihlášení přes Google OAuth
function loginWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    firebase.auth().signInWithPopup(provider)
        .then((result) => {
            const user = result.user;
            console.log("✅ Přihlášen uživatel:", user.email);
            fetchAppSheetData(user.email);  // Zavoláš svůj kalendář s emailem uživatele
        })
        .catch((error) => {
            console.error("❌ Chyba přihlášení:", error);
        });
}

// Kontrola přihlášeného uživatele (běží automaticky)
firebase.auth().onAuthStateChanged((user) => {
    if (user) {
        console.log("🔒 Již přihlášený uživatel:", user.email);
        fetchAppSheetData(user.email);
    } else {
        loginWithGoogle();  // pokud není uživatel přihlášen, otevře se okno Google přihlášení
    }
});
