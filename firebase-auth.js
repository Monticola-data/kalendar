// firebase-auth.js - jistě funkční varianta (bez smyčky!)

const provider = new firebase.auth.GoogleAuthProvider();

firebase.auth().onAuthStateChanged(user => {
    if (user) {
        console.log("🔒 Uživatel přihlášený:", user.email);
        window.currentUser = user;
        initApp(user);
    } else {
        console.log("🔓 Nikdo není přihlášený, spouštím popup...");
        firebase.auth().signInWithPopup(provider).then(result => {
            console.log("✅ Přihlášen uživatel (popup):", result.user.email);
            initApp(result.user);
        }).catch(error => {
            console.error("❌ Chyba popup přihlášení:", error);
        });
    }
});

function initApp(user) {
    window.currentUser = user;
    console.log("🚀 App inicializována pro uživatele:", user.email);
    // fetchAppSheetData(user.email); později
}
