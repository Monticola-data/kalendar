document.addEventListener("DOMContentLoaded", () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    const loginButton = document.getElementById('loginButton');

    loginButton.addEventListener('click', () => {
        firebase.auth().signInWithPopup(provider)
            .then(result => {
                console.log("✅ Přihlášený uživatel (popup):", result.user.email);
                // zde nevolej initApp, o to se postará onAuthStateChanged
            })
            .catch(error => {
                console.error("❌ Chyba přihlášení:", error);
            });
    });

    firebase.auth().onAuthStateChanged(user => {
        if (user) {
            console.log("🔒 Už přihlášený:", user.email);
            loginButton.style.display = "none";
            window.currentUser = user;
            sessionStorage.setItem('userEmail', user.email);

            user.getIdToken(true);

            if (typeof fetchAppSheetData === 'function' && typeof listenForUpdates === 'function') {
                initApp(user);
            } else {
                document.addEventListener("readystatechange", () => {
                    if (document.readyState === "complete") {
                        initApp(user);
                    }
                });
            }

        } else {
            console.warn("🔓 Uživatel není přihlášen");
            loginButton.style.display = "inline-block";
            sessionStorage.removeItem('userEmail');
            window.currentUser = null;
        }
    });

});

function initApp(user) {
    if (!user || !user.email) {
        console.error("❌ Chybí uživatel nebo email!");
        return;
    }

    window.currentUser = user;
    sessionStorage.setItem('userEmail', user.email);
    console.log("🚀 Přihlášený:", user.email);

    fetchAppSheetData(user.email);
    listenForUpdates();
}
