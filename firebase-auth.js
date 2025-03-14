const firebaseConfig = {
    apiKey: "AIzaSyBg9E8w5C5azvMKAJ3VY_YQmwu5DgaAU80",
    authDomain: "kalendar-831f8.firebaseapp.com",
    projectId: "kalendar-831f8"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const provider = new firebase.auth.GoogleAuthProvider();

firebase.auth().onAuthStateChanged((user) => {
    if (user) {
        console.log("🔒 Přihlášený uživatel:", user.email);
        window.currentUser = user;
    } else if (!sessionStorage.getItem("redirecting")) {
        sessionStorage.setItem("redirecting", "true");
        firebase.auth().signInWithRedirect(provider);
    }
});

// Přesměrování zpět vyřešíme jednou a správně
firebase.auth().getRedirectResult().then((result) => {
    if (result.user) {
        console.log("✅ Přihlášen přes redirect:", result.user.email);
        window.currentUser = result.user;
        sessionStorage.removeItem("redirecting");
    } else {
        sessionStorage.removeItem("redirecting");
    }
}).catch((error) => {
    console.error("❌ Chyba redirect:", error);
    sessionStorage.removeItem("redirecting");
});
