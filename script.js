import { db } from './firebase.js';

let currentUserEmail = "";
let calendars = [];
let allEvents = [], partyMap = {}, selectedEvent = null;
let modal, modalOverlay, partySelect, partyFilter, strediskoFilter, currentUserEmail;

const debouncedUpdates = {};


// Helper debounce funkce
function debounce(func, wait = 1000) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// Načtení dat z Firestore
async function fetchFirestoreParties() {
  const snapshot = await db.collection("parties").get();
  partyMap = snapshot.docs.reduce((map, doc) => ({ ...map, [doc.id]: doc.data() }), {});
  populateFilter();
}

export async function fetchFirestoreEvents(userEmail) {
  currentUserEmail = userEmail;
  await fetchFirestoreParties();
  const snapshot = await db.collection('events').get();

  allEvents = snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .filter(event => {
      const security = event.extendedProps?.SECURITY_filter || [];
      return security.map(e => e.toLowerCase()).includes(userEmail.trim().toLowerCase());
    });

  populateFilter();
  filterAndRenderEvents();
}

// Vykreslení kalendářů pod sebou
function renderCalendar() {
  const calendarDivs = document.querySelectorAll('.month-calendar');
  calendars = [];

  calendarDivs.forEach(div => {
    const monthOffset = Number(div.dataset.month);
    const initialDate = new Date(new Date().getFullYear(), new Date().getMonth() + monthOffset, 1);

    const calendar = new FullCalendar.Calendar(div, {
      initialView: 'dayGridMonth',
      initialDate,
      editable: true,
      locale: 'cs',
      height: 'auto',
      firstDay: 1,
      dragScroll: false,
      longPressDelay: 0,
      eventOrder: "cas,title",
      eventSources: [{ id: 'firestore', events: allEvents }],
      eventDrop: handleEventDrop,
      eventClick: calendarEventClick,
      eventContent: renderEventContent,
    });

    calendars.push(calendar);
    calendar.render();
  });
}

function renderAllCalendars() {
  calendars.forEach(cal => cal.render());
}

// Drag & Drop handler
async function handleEventDrop(info) {
  const eventId = info.event.id;
  const updates = {
    start: info.event.startStr,
    party: info.event.extendedProps.party,
    'extendedProps.cas': info.event.extendedProps.cas || 0
  };

  info.event.setExtendedProp('isSaving', true);
  renderAllCalendars();

  if (!debouncedUpdates[eventId]) {
    debouncedUpdates[eventId] = debounce(async (updates, event) => {
      try {
        await db.collection("events").doc(eventId).update(updates);
        await fetch("https://us-central1-kalendar-831f8.cloudfunctions.net/updateAppSheetFromFirestore", {
          method: "POST",
          body: JSON.stringify({ eventId, ...updates }),
          headers: { 'Content-Type': 'application/json' }
        });

        event.setExtendedProp('isSaving', false);
        await fetchFirestoreEvents(currentUserEmail);
      } catch (error) {
        console.error("❌", error);
        event.setExtendedProp('isSaving', false);
        info.revert();
      }
    }, 1500);
  }

  debouncedUpdates[eventId](updates, info.event);
}

// Event click handler
async function calendarEventClick(info) {
  selectedEvent = info.event;
  const modalEventInfo = document.getElementById('modalEventInfo');
  modalEventInfo.textContent = `${info.event.title} - ${info.event.startStr}`;

  modal.style.display = modalOverlay.style.display = "block";
}

// Event content renderer
function renderEventContent(arg) {
  const isSaving = arg.event.extendedProps.isSaving;
  const icon = isSaving ? "⏳" : arg.event.extendedProps.hotove ? "✅" : "";
  return { html: `<div>${icon} ${arg.event.title}</div>` };
}

function populateFilter() {
  partyFilter.innerHTML = '<option value="all">Všechny party</option>';
  Object.entries(partyMap).forEach(([id, party]) => {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = party.name;
    partyFilter.appendChild(option);
  });
}

function filterAndRenderEvents() {
  const selectedParty = partyFilter.value;
  const filteredEvents = allEvents.filter(event => selectedParty === "all" || event.party === selectedParty);

  calendars.forEach(calendar => {
    const source = calendar.getEventSourceById('firestore');
    if (source) source.remove();
    calendar.addEventSource({ id: 'firestore', events: filteredEvents });
    calendar.render();
  });
}

// DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  
  modal = document.getElementById('eventModal');
  modalOverlay = document.getElementById('modalOverlay');
  partySelect = document.getElementById('partySelect');
  partyFilter = document.getElementById('partyFilter');
  strediskoFilter = document.getElementById('strediskoFilter');

  // Iniciální nastavení emailu přihlášeného uživatele
  firebase.auth().onAuthStateChanged((user) => {
    if (user) {
      currentUserEmail = user.email;
      fetchFirestoreEvents(currentUserEmail);
      listenForUpdates(currentUserEmail);
    } else {
      console.warn("⚠️ Uživatel není přihlášen.");
    }
  });

  // zachovej stávající inicializaci kalendáře
  fetchFirestoreEvents(currentUserEmail).then(() => {
    renderCalendar();
  });

  // zajištění správného chování filtrů
  strediskoFilter.onchange = () => {
    localStorage.setItem('selectedStredisko', strediskoFilter.value);
    populateFilter();
    filterAndRenderEvents();
  };

  partyFilter.onchange = filterAndRenderEvents;

});


export function listenForUpdates(userEmail) {
  currentUserEmail = userEmail;

  db.collection('events').onSnapshot((snapshot) => {
    allEvents = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title,
        start: new Date(data.start).toISOString().split('T')[0],
        color: data.color,
        party: data.party,
        stredisko: data.stredisko || (partyMap[data.party]?.stredisko) || "",
        extendedProps: data.extendedProps || {}
      };
    }).filter(event => {
      const security = event.extendedProps?.SECURITY_filter || [];
      return security.map(e => e.toLowerCase()).includes(currentUserEmail.trim().toLowerCase());
    });

  filterAndRenderEvents();
}

