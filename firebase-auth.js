// firebase-auth.js (finální funkční řešení)
const firebaseConfig = {
    apiKey: "AIzaSyBg9E8w5C5azvMKAJ3VY_YQmwu5DgaAU80",
    authDomain: "kalendar-831f8.firebaseapp.com",
    projectId: "kalendar-831f8"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const provider = new firebase.auth.GoogleAuthProvider();

firebase.auth().getRedirectResult()
  .then((result) => {
    if (result.user) {
      console.log("✅ Přihlášen přes redirect:", result.user.email);
      window.currentUser = result.user;
      sessionStorage.setItem('loggedIn', 'true');
      initApp(result.user);
    }
  })
  .catch((error) => {
    console.error("❌ Chyba redirect:", error);
  });

firebase.auth().onAuthStateChanged((user) => {
  if (user) {
    console.log("🔒 Už přihlášený:", user.email);
    window.currentUser = user;
    initApp(user);
  } else {
    const isLoggingIn = sessionStorage.getItem("redirecting");
    if (!isRedirecting()) {
      sessionStorage.setItem("redirecting", "true");
      firebase.auth().signInWithRedirect(provider);
    }
  }
});

function isRedirecting() {
  return sessionStorage.getItem("redirecting") === "true";
}

function initRedirect() {
  sessionStorage.setItem("redirecting", "true");
  firebase.auth().signInWithRedirect(provider);
}

function isReturningFromRedirect() {
  return sessionStorage.getItem("redirecting") === "true";
}

function initAuthFlow() {
  firebase.auth().getRedirectResult().then((result) => {
    if (result.user) {
      sessionStorage.removeItem("redirecting");
      initApp(result.user);
    } else {
      if (!firebase.auth().currentUser && !isRedirecting()) {
        initRedirect();
      }
    }
  }).catch((error) => {
    console.error("❌ Chyba:", error);
    sessionStorage.removeItem("redirecting");
  });
}

function initApp(user) {
  window.currentUser = user;
  sessionStorage.removeItem("redirecting");
  console.log("🚀 App inicializována pro:", user.email);
  // zde později zavoláš načtení dat
}

// Inicializuj aplikaci ihned po načtení
window.addEventListener("load", () => {
  initAppAuth();
});

function initApp(user) {
  // Místo pro načtení dat, zatím prázdné
  console.log("✅ aplikace připravena pro:", user.email);
}

// Ověř na začátku
initApp(firebase.auth().currentUser);

