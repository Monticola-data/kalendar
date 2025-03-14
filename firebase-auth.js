const firebaseConfig = {
    apiKey: "AIzaSyBg9E8w5C5azvMKAJ3VY_YQmwu5DgaAU80",
    authDomain: "kalendar-831f8.firebaseapp.com",
    projectId: "kalendar-831f8"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const provider = new firebase.auth.GoogleAuthProvider();

let authHandled = false;  // Globální příznak proti smyčce

firebase.auth().getRedirectResult()
    .then((result) => {
        if (result.user) {
            console.log("✅ Přihlášený uživatel po redirectu:", result.user.email);
            authResolved(result.user);
        } else {
            authCheck();
        }
    })
    .catch((error) => {
        console.error("❌ Chyba redirectu:", error);
        authCheck();
    });

function authResolved(user) {
    window.currentUser = user;
    sessionStorage.removeItem("redirecting");
    authFinished = true;
    console.log("🔒 Přihlášení úspěšné:", user.email);
    // fetchAppSheetData(user.email);  // až budeš připravená
}

function authCheck() {
    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            console.log("🔒 Uživatel přihlášen (onAuthStateChanged):", user.email);
            authResolved(user);
        } else if (!sessionStorage.getItem("auth_in_progress")) {
            sessionStorage.setItem("auth_in_progress", "true");
            setTimeout(() => {
                firebase.auth().signInWithRedirect(new firebase.auth.GoogleAuthProvider());
            }, 500); // Krátká prodleva pro jistotu
        }
    });
}
