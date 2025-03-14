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
            console.log("🔒 Přihlášen uživatel:", user.email);
            loginButton.style.display = "none"; // ✅ TOTO DEFINITIVNĚ SKRYJE TLAČÍTKO!
            initApp(user);
        } else {
            loginButton.style.display = "inline-block"; // ✅ ukáže tlačítko
            console.log("🔓 Uživatel není přihlášený");
        }
    });
});

function initApp(user) {
    window.currentUser = user;
    console.log("🚀 Přihlášený:", user.email);
    fetchAppSheetData(user.email); // ✅ Zde správně předáváš email uživatele
}
