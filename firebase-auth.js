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
        console.log("✅ Přihlášen uživatel (redirect):", result.user.email);
        window.currentUser = result.user;
        sessionStorage.setItem("loggedIn", "true");
    }
}).catch((error) => {
    console.error("❌ Chyba přihlášení (redirect):", error);
}).finally(() => {
    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            console.log("🔒 Už přihlášený uživatel:", user.email);
            window.currentUser = user;
            sessionStorage.setItem("loggedIn", "true");
        } else {
            if (!sessionStorage.getItem("loggedIn")) {
                firebase.auth().signInWithRedirect(provider);
            }
        }
    });
});
