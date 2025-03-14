const provider = new firebase.auth.GoogleAuthProvider();
const loginButton = document.getElementById('loginButton');

// kliknutí na tlačítko přihlásí uživatele
loginButton.addEventListener('click', () => {
    firebase.auth().signInWithPopup(provider)
        .then(result => {
            console.log("✅ Přihlášený uživatel (popup):", result.user.email);
            initApp(result.user);
        })
        .catch(error => {
            console.error("❌ Chyba přihlášení:", error);
            alert("Přihlášení selhalo: " + error.message);
        });
});

// sledování přihlášení a řízení viditelnosti tlačítka
firebase.auth().onAuthStateChanged(user => {
    if (user) {
        console.log("🔒 Už přihlášený uživatel:", user.email);
        document.getElementById('loginButton').style.display = "none"; // ✅ skryje tlačítko
        initApp(user);
    } else {
        console.log("🔓 Nikdo není přihlášený");
        document.getElementById('loginButton').style.display = "inline-block"; // ✅ zobrazí tlačítko
    }
});

function initApp(user) {
    window.currentUser = user;
    console.log("🚀 Aplikace připravena pro uživatele:", user.email);
    // fetchAppSheetData(user.email); později
}
