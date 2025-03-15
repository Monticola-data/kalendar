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

            waitForFunctionsAndInitApp(user);
        } else {
            loginButton.style.display = "inline-block";
            sessionStorage.removeItem('userEmail');
            window.currentUser = null;
        }
    });

});

function waitForFunctionsAndInitApp(user) {
    const checkInterval = setInterval(() => {
        if (typeof fetchAppSheetData === 'function' && typeof listenForUpdates === 'function') {
            clearInterval(checkInterval);
            initApp(user);
        }
    }, 200);
}

function initApp(user) {
    window.currentUser = user;
    sessionStorage.setItem('userEmail', user.email);
    fetchAppSheetData(user.email);
    listenForUpdates();
}
