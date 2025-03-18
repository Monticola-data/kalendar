import { db } from './firebase.js';

let eventQueue = {};
let isProcessing = false;

async function processQueue() {
    if (isProcessing) return;

    const eventIds = Object.keys(eventQueue);
    if (eventIds.length === 0) return;

    isProcessing = true;

    const eventId = eventIds[0];
    const task = eventQueue[eventId];
    delete eventQueue[eventId];

    try {
        await task();
    } catch (error) {
        console.error("❌ Chyba při zpracování úkolu:", error);
    }

    isProcessing = false;
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
        allDay: true,
        cas: data.cas !== undefined ? Number(data.cas) : 0,  // cas přímo v hlavních datech
        extendedProps: {
            ...data.extendedProps
        }
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
    function displayTime(cas) {
        return cas && cas !== 0 ? cas + ':00 ' : '';
    }
    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: savedView,
        editable: true,
        locale: 'cs',
        height: 'auto',
        firstDay: 1,
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'customMonth,customWeek,list14Days'
        },
        views: {
            customMonth: {
                type: 'dayGridMonth',
                buttonText: 'Měsíc',
            },
            customWeek: {
                type: 'dayGridWeek',
                buttonText: 'Týden',
                allDaySlot: true,
                slotDuration: { days: 1 },
                displayEventTime: false,
            },
            list14Days: {
                type: 'list',
                duration: { days: 14 },
                buttonText: '14 dní',
            }
        },
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
    eventOrder: "cas,title",

eventDrop: function(info) {
    const eventId = info.event.id;

    eventQueue[eventId] = async () => {
        try {
            await db.collection("events").doc(eventId).update({
                start: info.event.startStr,
                party: info.event.extendedProps.party,
                cas: info.event.extendedProps.cas || 0,  // přidej tento řádek!
            });

            await fetch("https://us-central1-kalendar-831f8.cloudfunctions.net/updateAppSheetFromFirestore", {
                method: "POST",
                body: JSON.stringify({
                    eventId: eventId,
                    start: info.event.startStr,
                    party: info.event.extendedProps.party,
                    cas: info.event.extendedProps.cas || 0  // přidej i zde!
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
        const eventId = selectedEvent.id;

        eventQueue[eventId] = async () => {
            try {
                await db.collection("events").doc(selectedEvent.id).update({
                    party: e.target.value,
                    color: selectedParty.color
                });

                await fetch("https://us-central1-kalendar-831f8.cloudfunctions.net/updateAppSheetFromFirestore", {
                    method: "POST",
                    body: JSON.stringify({
                        eventId: selectedEvent.id,
                        party: e.target.value
                    }),
                    headers: { 'Content-Type': 'application/json' }
                });

                console.log("✅ Party změněna a aktualizována.");
            } catch (error) {
                console.error("❌ Chyba při změně party:", error);
            }
        };

    // ✅ Aktualizuj barvu ihned ve frontendu!
    selectedEvent.setProp('backgroundColor', selectedParty.color);
    selectedEvent.setExtendedProp('party', e.target.value);

    processQueue(); // spusť frontu
        }
};

        // ✅ Zobraz informace v modalu
        const modalEventInfo = document.getElementById('modalEventInfo');
        modalEventInfo.innerHTML = `
        ${info.event.title} - ${info.event.startStr} (${getPartyName(info.event.extendedProps.party)})
        `;

        // ✅ Zobrazení tlačítka detail, pokud existuje detail URL
        const detailButton = document.getElementById('detailButton');
        if (info.event.extendedProps.detail && info.event.extendedProps.detail.trim() !== "") {
            detailButton.style.display = "inline-block";
            detailButton.onclick = () => {
                window.open(info.event.extendedProps.detail, '_blank');
            };
        } else {
            detailButton.style.display = "none"; // schovej, pokud není detail
        }
        
        modal.style.display = "block";
        modalOverlay.style.display = "block";
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
    const cas = arg.event.extendedProps.cas;

    return {
        html: `
        <div style="
          width:100%; 
          font-size:11px; 
          color:#ffffff; 
          line-height:1.1; 
          overflow:hidden; 
          text-overflow:ellipsis;
          white-space:nowrap;">
            <div style="font-weight:bold; white-space:nowrap;">
                ${icon} ${displayTime(cas)}${title}
            </div>
            <div style="font-size:9px; opacity:0.85; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                ${partyName}
            </div>
        </div>`,
    };
}



});
// ✅ CSS kód pro odlišení tlačítek barevně
const style = document.createElement('style');
style.innerHTML = `
.fc-button {
  background-color: #f0f0f0 !important;
  color: #555 !important;
  border: none !important;
  border-radius: 8px !important;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1) !important;
  transition: all 0.3s ease !important;
}

.fc-button:hover {
  background-color: #e0e0e0 !important;
  color: #000 !important;
}

.fc-button.fc-button-active {
  background-color: #d0d0d0 !important;
  color: #000 !important;
}

.fc-customMonth-button {
  background-color: #a3c9a8 !important;
  color: #fff !important;
}

.fc-customWeek-button {
  background-color: #9cb9d9 !important;
  color: #fff !important;
}

.fc-list14Days-button {
  background-color: #f0b49e !important;
  color: #fff !important;
}

.fc-customMonth-button:hover {
  background-color: #92b894 !important;
}

.fc-customWeek-button:hover {
  background-color: #89aacd !important;
}

.fc-list14Days-button:hover {
  background-color: #dfa08a !important;
}
`;
document.head.appendChild(style);

    
calendar.render();

// Swipe navigace pro mobilní telefony pomocí Hammer.js
const hammer = new Hammer(calendarEl);

// Swipe doprava (předchozí měsíc/týden)
hammer.on('swiperight', function() {
  calendar.prev();
});

// Swipe doleva (další měsíc/týden)
hammer.on('swipeleft', function() {
  calendar.next();
});

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

    if (firestoreSource) {
        firestoreSource.refetch(); // Toto aktualizuje zdroj
        firestoreSource.remove();  // Pokud refetch nezabere, ponech remove a add
    }

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
            modalOverlay.style.display = "none"; // ✅ schovej overlay
        }
    };

    // ✅ Zavření modalu kliknutím mimo modal přes overlay
    modalOverlay.onclick = function() {
        modal.style.display = "none";
        modalOverlay.style.display = "none";
    };
});



export function listenForUpdates(userEmail) {
    db.collection('events').onSnapshot((snapshot) => {
        const normalizedUserEmail = userEmail.trim().toLowerCase();

        allEvents = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                title: data.title,
                start: new Date(data.start).toISOString().split('T')[0],
                color: data.color,
                party: data.party,
                stredisko: data.stredisko || (partyMap[data.party]?.stredisko) || "",
                allDay: true,
                cas: data.cas !== undefined ? Number(data.cas) : 0,
                extendedProps: {
                    ...data.extendedProps
                }
            };
        }).filter(event => {
            const security = event.extendedProps?.SECURITY_filter || [];
            return security.map(e => e.toLowerCase()).includes(normalizedUserEmail);
        });

        filterAndRenderEvents(); // aktualizuje kalendář bezprostředně po změně
    });
}
