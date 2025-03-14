const firebaseConfig = {
    apiKey: "AIzaSyBg9E8w5C5azvMKAJ3VY_YQmwu5DgaAU80",
    authDomain: "kalendar-831f8.firebaseapp.com",
    projectId: "kalendar-831f8"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const provider = new firebase.auth.GoogleAuthProvider();

firebase.auth().getRedirectResult().then((result) => {
    if (result.user) {
        console.log("✅ Přihlášen přes redirect:", result.user.email);
        fetchAppSheetData(result.user.email);
        sessionStorage.removeItem("redirecting");
    } else {
        checkAuthState();
    }
}).catch((error) => {
    console.error("❌ Chyba po redirectu:", error);
    sessionStorage.removeItem("redirecting");
    checkAuthState();
});

function checkAuthState() {
    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            console.log("🔒 Přihlášený uživatel:", user.email);
            fetchAppSheetData(user.email);
            sessionStorage.removeItem("redirecting");
        } else {
            if (!sessionStorage.getItem("redirecting")) {
                sessionStorage.setItem("redirecting", "true");
                firebase.auth().signInWithRedirect(provider);
            }
        }
    });
}
