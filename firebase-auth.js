document.addEventListener("DOMContentLoaded", () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    const loginButton = document.getElementById('loginButton');

    loginButton.addEventListener('click', () => {
        firebase.auth().signInWithPopup(provider)
            .catch(error => {
                console.error("❌ Chyba přihlášení:", error);
            });
    });

    firebase.auth().onAuthStateChanged(user => {
        if (user) {
            loginButton.style.display = "none";
            window.currentUser = user;
            sessionStorage.setItem('userEmail', user.email);
            user.getIdToken(true);

            waitForFunctionsAndInit(user);
        } else {
            loginButton.style.display = "inline-block";
            window.currentUser = null;
            sessionStorage.removeItem('userEmail');
        }
    });

    function waitForFunctionsAndInit(user) {
        const interval = setInterval(() => {
            if (typeof fetchAppSheetData === "function" && typeof listenForUpdates === "function") {
                clearInterval(interval);
                initApp(user);
            } else {
                console.log("⏳ Čekám na načtení funkcí...");
            }
        }
    }, 200);
});

function initApp(user) {
    fetchAppSheetData(user.email);
    listenForUpdates();
}
