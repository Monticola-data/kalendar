import { db } from './firebase.js';
import { state } from './state.js';
import { renderCalendar } from './calendar.js';
import { filterAndRenderEvents } from './events.js'; // ✅ Přidat tento řádek!


function getPartyName(partyId) {
    return state.partyMap[partyId]?.name || '';
}

async function fetchFirestoreParties() {
    const snapshot = await db.collection("parties").get();
    state.partyMap = snapshot.docs.reduce((map, doc) => {
        map[doc.id] = doc.data();
        return map;
    }, {});
    populateFilter();
}

async function fetchFirestoreOmluvenky() {
    const snapshot = await db.collection('omluvenky').get();

    return snapshot.docs.map(doc => {
        const data = doc.data();
        const hex = data.hex || "#999"; 

        return {
            id: doc.id,
            title: `${data.title} (${data.typ})`,
            start: data.start,
            end: data.end,
            color: hex,
            stredisko: data.stredisko,
            parta: data.parta,
            editable: false,
            extendedProps: { isOmluvenka: true }
        };
    });
}

export async function fetchFirestoreEvents(userEmail) {
    await fetchFirestoreParties();
    const eventsSnapshot = await db.collection('events').get();

    const normalizedUserEmail = userEmail.trim().toLowerCase();

    state.allEvents = eventsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            title: data.title,
            start: data.start ? new Date(data.start).toISOString().split('T')[0] : null,
            color: data.color,
            party: data.party,
            stredisko: data.stredisko || (state.partyMap[data.party]?.stredisko) || "",
            extendedProps: data.extendedProps || {}
        };
    }).filter(event => {
        if (!event.start) {
            console.warn(`Událost ${event.id} nemá platné datum a nebude zobrazena.`);
            return false;
        }

        const security = event.extendedProps?.SECURITY_filter || [];
        return security.map(e => e.toLowerCase()).includes(normalizedUserEmail);
    });

    const savedStredisko = localStorage.getItem('selectedStredisko') || 'vše';
    if (state.strediskoFilter) {
        state.strediskoFilter.value = savedStredisko;
    }

    populateFilter();

    filterAndRenderEvents(); // ✅ Toto zajistí zobrazení událostí
}


async function updateFirestoreEvent(eventId, updates = {}) {
    await db.collection("events").doc(eventId).set(updates, { merge: true });
    console.log("✅ Data uložena do Firestore:", updates);
}

function populateFilter() {
    const savedStredisko = localStorage.getItem('selectedStredisko') || 'vše';
    state.strediskoFilter.value = savedStredisko;

    state.partyFilter.innerHTML = '<option value="all">Všechny party</option>' + 
        Object.entries(state.partyMap)
            .filter(([_, party]) => savedStredisko === "vše" || party.stredisko === savedStredisko)
            .map(([id, party]) => `<option value="${id}">${party.name}</option>`)
            .join('');

    filterAndRenderEvents();
}



document.addEventListener('DOMContentLoaded', () => {
    state.calendarEl = document.getElementById('calendar');
    state.modal = document.getElementById('eventModal');
    state.partySelect = document.getElementById('partySelect');
    state.partyFilter = document.getElementById('partyFilter');
    state.strediskoFilter = document.getElementById('strediskoFilter');
    state.modalOverlay = document.getElementById('modalOverlay');

    const statusChecks = document.querySelectorAll('#statusFilter input[type=checkbox]');
    statusChecks.forEach(chk => chk.addEventListener('change', filterAndRenderEvents));

    if (!state.calendarEl || !state.modal || !state.partySelect || !state.partyFilter || !state.strediskoFilter || !state.modalOverlay) {
        console.error("❌ Některé DOM elementy nejsou dostupné:", { 
            calendarEl: state.calendarEl, 
            modal: state.modal, 
            partySelect: state.partySelect, 
            partyFilter: state.partyFilter, 
            strediskoFilter: state.strediskoFilter, 
            modalOverlay: state.modalOverlay 
        });
        return;
    }

    const savedStredisko = localStorage.getItem('selectedStredisko') || 'vše';
    state.strediskoFilter.value = savedStredisko;

    if (state.strediskoFilter) {
        state.strediskoFilter.onchange = () => {
            localStorage.setItem('selectedStredisko', state.strediskoFilter.value);
            populateFilter();
        };
    }

    if (state.partyFilter) {
        state.partyFilter.onchange = filterAndRenderEvents;
    }

    renderCalendar();

    if (state.modalOverlay) {
        state.modalOverlay.onclick = () => {
            if (state.modal) state.modal.style.display = "none";
            state.modalOverlay.style.display = "none";
        };
    }
});


export function listenForUpdates(userEmail) {
    const normalizedUserEmail = userEmail.trim().toLowerCase();

db.collection('events').onSnapshot((snapshot) => {
    state.allEvents = snapshot.docs.map(doc => { /* tvoje logika */ });
    filterAndRenderEvents(); // důležité!
});

db.collection('omluvenky').onSnapshot((snapshot) => {
    state.omluvenkyEvents = snapshot.docs.map(doc => { /* tvoje logika */ });
    filterAndRenderEvents(); // důležité!
});

}

