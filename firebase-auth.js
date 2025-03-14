// firebase konfigurace tvého projektu
const firebaseConfig = {
    apiKey: "API_KEY",
    authDomain: "kalendar-831f8.firebaseapp.com",
    projectId: "kalendar-831f8"
};

// Inicializace Firebase
firebase.initializeApp(firebaseConfig);

// Funkce pro přihlášení
function loginWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    firebase.auth().signInWithPopup(provider)
        .then((result) => {
            const user = result.user;
            console.log("✅ Přihlášen uživatel:", user.email);
            fetchAppSheetData(user.email);  // Tady načteš eventy pro uživatele
        })
        .catch((error) => {
            console.error("❌ Chyba přihlášení:", error);
        });
}

// Kontrola, jestli je uživatel už přihlášen
firebase.auth().onAuthStateChanged((user) => {
    if (user) {
        console.log("🔒 Přihlášený uživatel:", user.email);
        fetchAppSheetData(user.email); // Zavolej načtení dat
    } else {
        loginWithGoogle(); // Přihlášení
    }
});
