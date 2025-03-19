import { db } from './firebase.js';

let eventQueue = {};
let isProcessing = false;

//fronta, proti prehlceni
function debounce(func, wait = 1000) {
    let timeout;

    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}


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
    let currentViewDate;

calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        editable: true,
        locale: 'cs',
        height: 'auto',
        firstDay: 1,
        selectable: false, // Zajistí, že se nebude automaticky označovat datum
        unselectAuto: true,
        navLinks: false,   // ✅ Zakáže klikatelné dny a přechody na jiný pohled
        eventOrder: "cas,title",
    
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

        eventDragStart: function() {
            currentViewDate = calendar.getDate();
        },


    // Vytvoř objekt pro ukládání debouncovaných funkcí (globálně)
const debouncedUpdates = {};

eventDrop: function(info) {
    const eventId = info.event.id;
    const cas = Number(info.event.extendedProps.cas) || 0;
    const newStart = info.event.startStr;
    const newParty = info.event.extendedProps.party;

    if (!debouncedUpdates[eventId]) {
        debouncedUpdates[eventId] = debounce(async (updates) => {
            try {
                // ✅ Aktualizace Firestore
                await db.collection("events").doc(eventId).update(updates);

                // ✅ Aktualizace AppSheet
                await fetch("https://us-central1-kalendar-831f8.cloudfunctions.net/updateAppSheetFromFirestore", {
                    method: "POST",
                    body: JSON.stringify({
                        eventId,
                        ...updates
                    }),
                    headers: { 'Content-Type': 'application/json' }
                });

                console.log("✅ Data úspěšně aktualizována (Firestore i AppSheet)");

                // ✅ Opětovně aplikuj filtr po aktualizaci
                filterAndRenderEvents();

            } catch (error) {
                console.error("❌ Chyba při aktualizaci:", error);
                info.revert(); // Pokud chyba, vrátí zpět vizuální změnu
            }
        }, 1500); // 1,5 vteřiny debounce
    }

    // Volání debounced funkce s aktuálními daty
    debouncedUpdates[eventId]({
        start: newStart,
        party: newParty,
        "extendedProps.cas": cas
    });
},


eventClick: async function (info) {
    if (info.event.extendedProps?.SECURITY_filter) {
        selectedEvent = info.event;

        const selectedStredisko = strediskoFilter.value;

        // ✅ Naplnění výběru party
        partySelect.innerHTML = "";
        Object.entries(partyMap).forEach(([id, party]) => {
            if (selectedStredisko === "vše" || party.stredisko === selectedStredisko) {
                const option = document.createElement("option");
                option.value = id;
                option.textContent = party.name;
                option.selected = id === selectedEvent.extendedProps.party;
                partySelect.appendChild(option);
            }
        });

        // ✅ Inicializace výběru času
        const casSelect = document.getElementById('casSelect');
        casSelect.value = selectedEvent.extendedProps.cas || 0;

        // ✅ Zobraz informace v modalu
        const modalEventInfo = document.getElementById('modalEventInfo');
        modalEventInfo.innerHTML = `
            ${info.event.title} - ${info.event.startStr} (${getPartyName(selectedEvent.extendedProps.party)})
        `;

        // ✅ Zobrazení tlačítka detail, pokud existuje detail URL
        const detailButton = document.getElementById('detailButton');
        if (selectedEvent.extendedProps.detail && selectedEvent.extendedProps.detail.trim() !== "") {
            detailButton.style.display = "inline-block";
            detailButton.onclick = () => {
                window.open(selectedEvent.extendedProps.detail, '_blank');
            };
        } else {
            detailButton.style.display = "none";
        }

        // ✅ Uložit změnu ČASU
        document.getElementById('saveCas').onclick = async () => {
            const newCas = Number(casSelect.value) || 0;

            eventQueue[selectedEvent.id + '_cas'] = async () => {
                try {
                    await db.collection("events").doc(selectedEvent.id).update({
                        'extendedProps.cas': newCas
                    });

                    await fetch("https://us-central1-kalendar-831f8.cloudfunctions.net/updateAppSheetFromFirestore", {
                        method: "POST",
                        body: JSON.stringify({
                            eventId: selectedEvent.id,
                            cas: newCas
                        }),
                        headers: { 'Content-Type': 'application/json' }
                    });

                    console.log("✅ Čas úspěšně uložen.");
                } catch (error) {
                    console.error("❌ Chyba při ukládání času:", error);
                }
            };

            selectedEvent.setExtendedProp('cas', newCas);
            calendar.render();

            processQueue();

            modal.style.display = "none";
            modalOverlay.style.display = "none";
        };

        // ✅ Uložit změnu PARTY
        document.getElementById('saveParty').onclick = async () => {
            const newParty = partySelect.value;
            const selectedParty = partyMap[newParty];

            eventQueue[selectedEvent.id + '_party'] = async () => {
                try {
                    await db.collection("events").doc(selectedEvent.id).update({
                        party: newParty,
                        color: selectedParty.color
                    });

                    await fetch("https://us-central1-kalendar-831f8.cloudfunctions.net/updateAppSheetFromFirestore", {
                        method: "POST",
                        body: JSON.stringify({
                            eventId: selectedEvent.id,
                            party: newParty
                        }),
                        headers: { 'Content-Type': 'application/json' }
                    });

                    console.log("✅ Parta úspěšně uložena.");
                } catch (error) {
                    console.error("❌ Chyba při ukládání party:", error);
                }
            };

            selectedEvent.setExtendedProp('party', newParty);
            selectedEvent.setProp('backgroundColor', selectedParty.color);
            calendar.render();

            processQueue();

            modal.style.display = "none";
            modalOverlay.style.display = "none";
        };

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
          
            <div style="font-weight:bold;">${icon} ${cas ? cas + ':00 ' : ''}${title}</div>
            <div style="font-size:9px; color:#ffffff;">${partyName}</div>
            
        </div>`
        };
    }
});

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

    // ✅ Zde zachovej aktuální datum
    const currentViewDate = calendar.getDate();

    const firestoreSource = calendar.getEventSourceById('firestore');
    if (firestoreSource) firestoreSource.remove();

    calendar.addEventSource({
        id: 'firestore',
        events: filteredEvents
    });

    // ✅ Zde se vrať zpět na aktuální datum
    calendar.gotoDate(currentViewDate);
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

    // ✅ Přidáno - tlačítka pro změnu pohledu
  const monthViewBtn = document.getElementById('monthView');
  const weekViewBtn = document.getElementById('weekView');
  const listViewBtn = document.getElementById('listView');

    strediskoFilter.onchange = () => {
        localStorage.setItem('selectedStredisko', strediskoFilter.value);
        populateFilter();
        filterAndRenderEvents();
    };

    partyFilter.onchange = filterAndRenderEvents;

    renderCalendar();

    monthViewBtn.onclick = () => calendar.changeView('dayGridMonth');
    weekViewBtn.onclick = () => calendar.changeView('dayGridWeek');
    listViewBtn.onclick = () => calendar.changeView('listWeek');

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
                extendedProps: data.extendedProps || {}
            };
        }).filter(event => {
            const security = event.extendedProps?.SECURITY_filter || [];
            return security.map(e => e.toLowerCase()).includes(normalizedUserEmail);
        });

        // ✅ DŮLEŽITÁ ZMĚNA: Přidej tento řádek:
        filterAndRenderEvents();
    });
}
