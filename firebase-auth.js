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
            initApp(user);
        } else {
            console.log("🔓 Uživatel není přihlášen");
            loginButton.style.display = "inline-block"; // zobraz tlačítko
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
        document.addEventListener("DOMContentLoaded", () => fetchAppSheetData(user.email));
    } else {
        fetchAppSheetData(user.email);
        listenForUpdates();
    }
}
