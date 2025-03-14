const provider = new firebase.auth.GoogleAuthProvider();

document.addEventListener("DOMContentLoaded", () => {
    const loginButton = document.getElementById('loginButton');

    loginButton.addEventListener('click', () => {
        firebase.auth().signInWithPopup(provider)
            .then(result => {
                console.log("✅ Přihlášený uživatel:", result.user.email);
                initApp(result.user);
            })
            .catch(error => {
                console.error("❌ Chyba přihlášení:", error);
            });
    });

    firebase.auth().onAuthStateChanged(user => {
        if (user) {
            console.log("🔒 Uživatel přihlášen:", user.email);
            loginButton.style.display = "none";  // ✅ schová tlačítko
            initApp(user);
        } else {
            console.log("🔓 Uživatel není přihlášen");
            loginButton.style.display = "inline-block";  // ✅ zobrazí tlačítko
        }
    });
});

function initApp(user) {
    window.currentUser = user;
    console.log("🚀 App připravena pro uživatele:", user.email);
    // fetchAppSheetData(user.email); – připraveno pro další krok
}
