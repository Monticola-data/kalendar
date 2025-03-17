import { db } from './firebase.js';
import { holidays } from './holidays.js';

let eventQueue = {};
let isProcessing = false;

async function processQueue() {
    if (isProcessing) return;

    const eventIds = Object.keys(eventQueue);
    if (eventIds.length === 0) return;

    isProcessing = true;

    const eventId = eventIds[0]; // Vezmi první event z fronty
    const task = eventQueue[eventId];
    delete eventQueue[eventIds[0]]; // odstraní z fronty před zpracováním

    try {
        await task();
    } catch (error) {
        console.error("❌ Chyba při zpracování úkolu:", error);
    }

    isProcessing = false;

    // zpracuj další úkol
    processQueue();
}


// 🚀 COMPAT verze Firebase (není potřeba importovat moduly)
let calendarEl, modal, partySelect, savePartyButton, partyFilter, strediskoFilter;
let allEvents = [], partyMap = {}, selectedEvent = null, calendar;

function getPartyName(partyId) {
    return partyMap[partyId]?.name || '';
}

async function fetchFirestoreParties() {
    const snapshot = await db.collection("parties").get();
    partyMap = snapshot.docs.reduce((map, doc) => {
        map[doc.id] = doc.data();
        return map;
    }, {});
    populateFilter();
}


export async function fetchFirestoreEvents(userEmail) {
    await fetchFirestoreParties();
    const eventsSnapshot = await db.collection('events').get();
    
    const allFirestoreEvents = eventsSnapshot.docs.map(doc => {
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
    });

    const normalizedUserEmail = userEmail.trim().toLowerCase();

    allEvents = allFirestoreEvents.filter(event => {
        const security = event.extendedProps?.SECURITY_filter || [];
        return security.map(e => e.toLowerCase()).includes(normalizedUserEmail);
    });

    // ✅ Načtení uloženého filtru a správné zobrazení
    const savedStredisko = localStorage.getItem('selectedStrediskoFilter') || 'vše';
    strediskoFilter.value = savedStredisko;

    populateFilter(); // Aktualizuje možnosti filtru podle střediska
    filterAndRenderEvents(); // Ihned filtruje a vykreslí kalendář
}



async function updateFirestoreEvent(eventId, updates = {}) {
    await firebase.firestore().collection("events").doc(eventId).set(updates, { merge: true });
    console.log("✅ Data uložena do Firestore:", updates);
}

function renderCalendar(view = null) {
    const savedView = view || localStorage.getItem('selectedCalendarView') || 'dayGridMonth';

    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: savedView,
        editable: true,
        locale: 'cs',
        height: 'auto',
        eventSources: [
            {
                id: 'firestore', // ✅ zde přidáno správné id
                events: allEvents
            },
            {
                id: 'holidays',
                googleCalendarApiKey: 'AIzaSyBA8iIXOCsGuTXeBvpkvfIOZ6nT1Nw4Ugk',
                googleCalendarId: 'cs.czech#holiday@group.v.calendar.google.com',
                display: 'background',
                color: '#854646',
                textColor: '#000',
                className: 'holiday-event',
                extendedProps: { isHoliday: true }
            }
        ],
eventDrop: function(info) {
    const eventId = info.event.id;

    eventQueue[eventId] = async () => {
        try {
            await fetch("https://us-central1-kalendar-831f8.cloudfunctions.net/updateAppSheetFromFirestore", {
                method: "POST",
                body: JSON.stringify({
                    id: eventId,
                    start: info.event.startStr,
                    party: info.event.extendedProps.party
                }),
                headers: { 'Content-Type': 'application/json' }
            });
            console.log("✅ Změna poslána do AppSheet!");
        } catch (err) {
            console.error("❌ Chyba při odeslání do AppSheet:", err);
            info.revert();
        }
    };

    processQueue();
},

eventClick: async function (info) {
    if (info.event.extendedProps?.SECURITY_filter) {
        selectedEvent = info.event;

        const selectedStredisko = strediskoFilter.value;

        partySelect.innerHTML = "";
        Object.entries(partyMap).forEach(([id, party]) => {
            // ✅ Přidána kontrola střediska
            if (selectedEvent && (strediskoFilter.value === "vše" || party.stredisko === strediskoFilter.value)) {
                const option = document.createElement("option");
                option.value = id;
                option.textContent = party.name;
                option.selected = id === info.event.extendedProps.party;
                partySelect.appendChild(option);
            }
        });

partySelect.onchange = (e) => {
    const selectedParty = partyMap[e.target.value];
    if (selectedParty && selectedEvent) {
        eventQueue.push(async () => {
            try {
                await db.collection("events").doc(selectedEvent.id).update({
                    party: e.target.value,
                    color: selectedParty.color
                });

                await fetch("https://us-central1-kalendar-831f8.cloudfunctions.net/updateAppSheetFromFirestore", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        eventId: selectedEvent.id,
                        party: e.target.value
                    })
                });

                console.log("✅ Party změněna a aktualizována.");
            } catch (error) {
                console.error("❌ Chyba při změně party:", error);
            }
        });

        processQueue(); // spusť frontu
    }
};
                modal.style.display = "block";
        }
        },
eventContent: function (arg) {
    let icon = "";
    if (arg.event.extendedProps.predane) icon = "✍️";
    else if (arg.event.extendedProps.hotove) icon = "✅";
    else if (arg.event.extendedProps.odeslane) icon = "📩";

    const title = (arg.event.extendedProps.predane || arg.event.extendedProps.hotove || arg.event.extendedProps.odeslane)
        ? arg.event.title.toUpperCase()
        : arg.event.title;

    const partyName = getPartyName(arg.event.extendedProps.party);

    return { html: `
        <div style="text-align:left; font-size:11px; color:#ffffff; line-height:1;">
            <div style="font-weight:bold;">${icon} ${title}</div>
            <div style="font-size:9px; color:#ffffff;">${partyName}</div>
        </div>`
    };
}


    });

    calendar.render();    
}

function populateFilter() {
    const savedStredisko = localStorage.getItem('selectedStredisko') || 'vše';
    strediskoFilter.value = savedStredisko;

    partyFilter.innerHTML = '<option value="all">Všechny party</option>';
    Object.entries(partyMap).forEach(([id, party]) => {
        if (savedStredisko === "vše" || party.stredisko === savedStredisko) {
            const option = document.createElement("option");
            option.value = id;
            option.textContent = party.name;
            partyFilter.appendChild(option);
        }
    });

    filterAndRenderEvents();
}

function filterAndRenderEvents() {
    const selectedParty = partyFilter.value;
    const selectedStredisko = strediskoFilter.value;

    const filteredEvents = allEvents.filter(event => {
        const partyMatch = selectedParty === "all" || event.party === selectedParty;
        const strediskoMatch = selectedStredisko === "vše" || event.stredisko === selectedStredisko;
        return partyMatch && strediskoMatch;
    });

    const firestoreSource = calendar.getEventSourceById('firestore');
    if (firestoreSource) firestoreSource.remove();

    calendar.addEventSource({
        id: 'firestore',
        events: filteredEvents
    });
}



document.addEventListener('DOMContentLoaded', () => {
    calendarEl = document.getElementById('calendar');
    modal = document.getElementById('eventModal');
    partySelect = document.getElementById('partySelect');
    savePartyButton = document.getElementById('saveParty');
    partyFilter = document.getElementById('partyFilter');
    strediskoFilter = document.getElementById('strediskoFilter');

    const savedStredisko = localStorage.getItem('selectedStredisko') || 'vše';
    strediskoFilter.value = savedStredisko;

    strediskoFilter.onchange = () => {
        localStorage.setItem('selectedStredisko', strediskoFilter.value);
        populateFilter();
        filterAndRenderEvents();
    };

    partyFilter.onchange = filterAndRenderEvents;

    renderCalendar();

    savePartyButton.onclick = async () => {
        if (selectedEvent) {
            await updateFirestoreEvent(selectedEvent.id, { party: partySelect.value });
            modal.style.display = "none";
        }
    };
});




export function listenForUpdates(userEmail) {
    db.collection('events').onSnapshot((snapshot) => {
        const normalizedUserEmail = userEmail.trim().toLowerCase();

        allEvents = snapshot.docs.map(doc => ({
            id: doc.id, ...doc.data()
        })).filter(event => {
            const security = event.extendedProps?.SECURITY_filter || [];
            return security.map(e => e.toLowerCase()).includes(normalizedUserEmail);
        });

        populateFilter();

        if (calendar) {
            const firestoreSource = calendar.getEventSourceById('firestore');
            if (firestoreSource) firestoreSource.remove();

            calendar.addEventSource({
                id: 'firestore',
                events: allEvents
            });

            calendar.render();
        }
    });
}
