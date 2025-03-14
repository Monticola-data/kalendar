const firebaseConfig = {
    apiKey: "AIzaSyBg9E8w5C5azvMKAJ3VY_YQmwu5DgaAU80",
    authDomain: "kalendar-831f8.firebaseapp.com",
    projectId: "kalendar-831f8"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const provider = new firebase.auth.GoogleAuthProvider();

// Kontrola návratu po přesměrování
firebase.auth().getRedirectResult().then((result) => {
    if (result.user) {
        console.log("✅ Přihlášen přes redirect:", result.user.email);
        fetchAppSheetData(result.user.email);
    }
}).catch((error) => {
    console.error("❌ Chyba redirect:", error);
});

// Hlavní kontrola stavu uživatele
firebase.auth().onAuthStateChanged((user) => {
    if (user) {
        console.log("🔒 Přihlášený uživatel:", user.email);
        fetchAppSheetData(user.email);
    } else {
        // Přesměruj na přihlášení jen pokud nejsme právě po redirectu
        if (!sessionStorage.getItem('redirecting')) {
            sessionStorage.setItem('redirecting', 'true');
            firebase.auth().signInWithRedirect(provider);
        }
    }
});

// Vyčištění příznaku redirectu po návratu
window.addEventListener('load', () => {
    if (sessionStorage.getItem('redirecting')) {
        sessionStorage.removeItem('redirecting');
    }
});
