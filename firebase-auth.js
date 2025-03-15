document.addEventListener("DOMContentLoaded", () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    const loginButton = document.getElementById('loginButton');

    loginButton.addEventListener('click', () => {
        firebase.auth().signInWithPopup(provider)
            .then(result => {
                console.log("✅ Přihlášený uživatel (popup):", result.user.email);
                // již nevolat initApp, automaticky to zvládne onAuthStateChanged
            })
            .catch(error => {
                console.error("❌ Chyba přihlášení:", error);
            });
    });

    firebase.auth().onAuthStateChanged(user => {
        if (user) {
            console.log("🔒 Už přihlášený:", user.email);
            loginButton.style.display = "none"; // skryj tlačítko
            window.currentUser = user;
            sessionStorage.setItem('userEmail', user.email);

            user.getIdToken(true); // ✅ pravidelná obnova tokenu
            initApp(user);
        } else {
            console.warn("🔓 Uživatel není přihlášen");
            loginButton.style.display = "inline-block"; // zobraz tlačítko
            sessionStorage.removeItem('userEmail');
            window.currentUser = null;
        }
    });

});

// ✅ Jediná správná definice initApp
function initApp(user) {
    if (!user || !user.email) {
        console.error("❌ Chybí uživatel nebo email!");
        return;
    }

    window.currentUser = user;
    sessionStorage.setItem('userEmail', user.email);
    console.log("🚀 Přihlášený:", user.email);

    // ✅ Tato část musí být volána jen zde:
    fetchAppSheetData(user.email);
    listenForUpdates(); // ✅ toto stačí volat zde JEDNOU!
}

