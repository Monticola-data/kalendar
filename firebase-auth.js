// firebase-auth.js – definitivní verze s tlačítkem a ochranou proti popup-block

const provider = new firebase.auth.GoogleAuthProvider();

// přihlášení po kliknutí tlačítka (správně!)
document.getElementById('loginButton').addEventListener('click', () => {
    firebase.auth().signInWithPopup(provider)
    .then(result => {
      console.log("✅ Přihlášený uživatel (popup):", result.user.email);
      initApp(result.user);
    })
    .catch(error => {
      console.error("❌ Chyba popup přihlášení:", error);
      alert("Popup byl zablokován nebo nastala jiná chyba: " + error.message);
    });
});

// sledování stavu autentizace
firebase.auth().onAuthStateChanged(user => {
    if (user) {
        console.log("🔒 Už přihlášený uživatel:", user.email);
        initApp(user);
    } else {
        console.log("🔓 Uživatel není přihlášený – čeká se na kliknutí tlačítka");
    }
});

// inicializace aplikace po přihlášení
function initApp(user) {
    window.currentUser = user;
    console.log("🚀 Aplikace inicializována pro uživatele:", user.email);
    // Později sem dáš načtení kalendáře:
    // fetchAppSheetData(user.email);
}
