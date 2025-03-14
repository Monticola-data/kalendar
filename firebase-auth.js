// firebase-auth.js – funkční varianta s tlačítkem

const provider = new firebase.auth.GoogleAuthProvider();

document.getElementById('loginButton').addEventListener('click', () => {
    firebase.auth().signInWithPopup(provider)
    .then(result => {
        console.log("✅ Úspěšně přihlášený uživatel:", result.user.email);
        initApp(result.user);
    })
    .catch(error => {
        console.error("❌ Chyba při přihlášení:", error);
        alert("Nepodařilo se přihlásit: " + error.message);
    });
});

// ověř přihlášení automaticky po načtení
firebase.auth().onAuthStateChanged(user => {
    if (user) {
        console.log("🔒 Uživatel je přihlášený:", user.email);
        initApp(user);
    } else {
        console.log("🔓 Uživatel není přihlášený – čekám na kliknutí na tlačítko");
        // Zde můžeš ukázat tlačítko přihlášení
    }
});

function initApp(user) {
    window.currentUser = user;
    console.log("🚀 Aplikace připravena pro:", user.email);
    // Později tady načteš data:
    // fetchAppSheetData(user.email);
}
