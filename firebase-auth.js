const provider = new firebase.auth.GoogleAuthProvider();

document.addEventListener("DOMContentLoaded", () => {
    const loginButton = document.getElementById('loginButton');

    loginButton.addEventListener('click', () => {
        firebase.auth().signInWithPopup(provider)
            .then(result => {
                console.log("✅ Přihlášený uživatel (popup):", result.user.email);
                initApp(result.user);
            })
            .catch(error => {
                console.error("❌ Chyba přihlášení:", error);
            });
    });

firebase.auth().onAuthStateChanged(user => {
    if (user) {
        console.log("🔒 Už přihlášený:", user.email);
        loginButton.style.display = "none"; // skryj tlačítko
        window.currentUser = user; // nastavení globální proměnné
        sessionStorage.setItem('userEmail', user.email); // bezpečné uložení emailu

        user.getIdToken(true); // ✅ vynutí pravidelnou obnovu tokenu Firebase Auth

        initApp(user);
        listenForUpdates(); // ✅ ujisti se, že běží pravidelná kontrola změn
    } else {
        console.warn("🔓 Uživatel byl odhlášen");
        loginButton.style.display = "inline-block"; // zobraz tlačítko
        sessionStorage.removeItem('userEmail');
        window.currentUser = null;
    }
});

});

// ✅ Jediná správná definice initApp
function initApp(user) {
    window.currentUser = user;
    sessionStorage.setItem('userEmail', user.email);
    console.log("🚀 Přihlášený:", user.email);

    // ✅ spolehlivá oprava:
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => fetchFirestoreEvents(user.email));
    } else {
        fetchFirestoreEvents(user.email);
        listenForUpdates();
    }
}
