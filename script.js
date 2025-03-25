import { db } from './firebase.js';
import { state } from './state.js';

// Smazáno: let calendarEl, modal, partySelect, partyFilter, strediskoFilter;
// Smazáno: let allEvents = [], partyMap = {}, selectedEvent = null, calendar;

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
}

async function updateFirestoreEvent(eventId, updates = {}) {
    await db.collection("events").doc(eventId).set(updates, { merge: true });
    console.log("✅ Data uložena do Firestore:", updates);
}

async function updateEventField(eventId, firestoreUpdate, appsheetPayload) {
    try {
        await db.collection("events").doc(eventId).update(firestoreUpdate);
        await fetch("https://us-central1-kalendar-831f8.cloudfunctions.net/updateAppSheetFromFirestore", {
            method: "POST",
            body: JSON.stringify({ eventId, ...appsheetPayload }),
            headers: { 'Content-Type': 'application/json' }
        });
        console.log("✅ Úspěšně aktualizováno:", appsheetPayload);
    } catch (error) {
        console.error("❌ Chyba při aktualizaci:", error);
    }
}



import { renderCalendar } from './calendar.js';



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



function filterAndRenderEvents() {
    if (!state.calendar) return;

    const selectedParty = state.partyFilter.value;
    const selectedStredisko = state.strediskoFilter.value;

    const statusChecks = document.querySelectorAll('#statusFilter input[type=checkbox]');
    const selectedStatuses = Array.from(statusChecks)
                                  .filter(chk => chk.checked)
                                  .map(chk => chk.value);

    const filteredEvents = state.allEvents.filter(event => {
        const partyMatch = selectedParty === "all" || event.party === selectedParty;
        const strediskoMatch = selectedStredisko === "vše" || event.stredisko === selectedStredisko;

        const { hotove = false, predane = false, odeslane = false } = event.extendedProps;

        let statusMatch = false;

        if (selectedStatuses.includes("kOdeslani") && !hotove && !predane && !odeslane) {
            statusMatch = true;
        } else if (selectedStatuses.includes("odeslane") && odeslane && !hotove && !predane) {
            statusMatch = true;
        } else if (selectedStatuses.includes("hotove") && hotove && !predane) {
            statusMatch = true;
        } else if (selectedStatuses.includes("predane") && predane) {
            statusMatch = true;
        }

        return partyMatch && strediskoMatch && statusMatch;
    });

    const omluvenkyFiltered = state.omluvenkyEvents.filter(event => {
        const partyMatch = selectedParty === "all" || event.parta === selectedParty;
        const strediskoMatch = selectedStredisko === "vše" || event.stredisko === selectedStredisko;
        return partyMatch && strediskoMatch;
    });

    state.calendar.batchRendering(() => {
        state.calendar.removeAllEvents();

        filteredEvents.forEach(evt => state.calendar.addEvent(evt));
        omluvenkyFiltered.forEach(evt => state.calendar.addEvent(evt));

        state.calendar.getEventSources()
                .filter(src => src.id === 'holidays')
                .forEach(src => src.remove());

        state.calendar.addEventSource({
            id: 'holidays',
            googleCalendarApiKey: 'AIzaSyBA8iIXOCsGuTXeBvpkvfIOZ6nT1Nw4Ugk',
            googleCalendarId: 'cs.czech#holiday@group.v.calendar.google.com',
            display: 'background',
            color: '#854646',
            textColor: '#000',
            className: 'holiday-event',
            extendedProps: { isHoliday: true }
        });
    });
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
        state.allEvents = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                title: data.title,
                start: new Date(data.start).toISOString().split('T')[0],
                color: data.color,
                party: data.party,
                stredisko: data.stredisko || (state.partyMap[data.party]?.stredisko) || "",
                extendedProps: data.extendedProps || {}
            };
        }).filter(event => {
            const security = event.extendedProps?.SECURITY_filter || [];
            return security.map(e => e.toLowerCase()).includes(normalizedUserEmail);
        });

        filterAndRenderEvents();
    });

    db.collection('omluvenky').onSnapshot((snapshot) => {
        state.omluvenkyEvents = snapshot.docs.map(doc => {
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

        filterAndRenderEvents();
    });
}

