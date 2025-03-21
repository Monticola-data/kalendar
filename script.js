import { db } from './firebase.js';

let eventQueue = {};
let isProcessing = false;
let omluvenkyEvents = [];

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

async function fetchFirestoreOmluvenky() {
    const snapshot = await db.collection('omluvenky').get();

    return snapshot.docs.map(doc => {
        const data = doc.data();
        const hex = data.hex || "#999"; // ✅ přímo HEX barva bez průhlednosti

        return {
            id: doc.id,
            title: `${data.title} (${data.typ})`,
            start: data.start,
            end: data.end,
            color: hex, // ✅ použij HEX přímo
            stredisko: data.stredisko,
            parta: data.parta,
            editable: false
        };
    });
}



export async function fetchFirestoreEvents(userEmail) {
    await fetchFirestoreParties();
    const eventsSnapshot = await db.collection('events').get();

    const normalizedUserEmail = userEmail.trim().toLowerCase();

    allEvents = eventsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            title: data.title,
            start: data.start ? new Date(data.start).toISOString().split('T')[0] : null, // zabezpečeno proti chybě
            color: data.color,
            party: data.party,
            stredisko: data.stredisko || (partyMap[data.party]?.stredisko) || "",
            extendedProps: data.extendedProps || {}
        };
    }).filter(event => {
        // vyřadit události s chybným datem
        if (!event.start) {
            console.warn(`Událost ${event.id} nemá platné datum a nebude zobrazena.`);
            return false;
        }

        const security = event.extendedProps?.SECURITY_filter || [];
        return security.map(e => e.toLowerCase()).includes(normalizedUserEmail);
    });

    // ✅ Načtení uloženého filtru a správné zobrazení
    const savedStredisko = localStorage.getItem('selectedStredisko') || 'vše';
    if (strediskoFilter) {
        strediskoFilter.value = savedStredisko;
    }

    populateFilter();
    filterAndRenderEvents();
}

async function updateFirestoreEvent(eventId, updates = {}) {
    await firebase.firestore().collection("events").doc(eventId).set(updates, { merge: true });
    console.log("✅ Data uložena do Firestore:", updates);
}

function renderCalendar(view = null) {
    const savedView = view || localStorage.getItem('selectedCalendarView') || 'dayGridMonth';
    let currentViewDate;

calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: savedView,
        editable: true,
        locale: 'cs',
    views: {
        listFourWeeks: {
            type: 'list',
            duration: { weeks: 4 },
            buttonText: '4 týdny',
            visibleRange: function(currentDate) {
                // Začíná od aktuálního pondělí
                let start = FullCalendar.startOfWeek(currentDate);
                // konec za 4 týdny
                let end = new Date(start);
                end.setDate(start.getDate() + 28);
                return { start, end };
            }
        }
    },
        height: 'auto',
        firstDay: 1,
        selectable: false, // Zajistí, že se nebude automaticky označovat datum
        unselectAuto: true,
        navLinks: false,   // ✅ Zakáže klikatelné dny a přechody na jiný pohled
        eventOrder: "cas,title",
        dragScroll: false,
        longPressDelay: 0,

    
        eventSources: [
            {
                id: 'firestore',
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
            },
{
    id: 'omluvenky',
    events: []
}
 
        ],

    eventAllow: function(dropInfo, draggedEvent) {
        const { hotove, predane } = draggedEvent.extendedProps;
        if (hotove === true || predane === true) {
            return false;  // 🚫 vůbec nepovolí přesunutí eventu
        }
        return true;  // ✅ přesunutí povoleno
    },

eventDrop: async function(info) {

    const eventId = info.event.id;
    const newDate = info.event.startStr;

    // ✅ Načíst původní čas eventu
    const originalCas = info.oldEvent.extendedProps.cas;
    const cas = (typeof originalCas !== 'undefined') ? Number(originalCas) : 0;

    try {
        // aktualizuj Firestore
        await db.collection("events").doc(eventId).update({
            start: newDate,
            "extendedProps.cas": cas
        });

        // aktualizuj AppSheet
        await fetch("https://us-central1-kalendar-831f8.cloudfunctions.net/updateAppSheetFromFirestore", {
            method: "POST",
            body: JSON.stringify({ eventId, start: newDate, cas }),
            headers: { 'Content-Type': 'application/json' }
        });

        console.log(`✅ Datum (${newDate}) a čas (${cas}) úspěšně odeslány do AppSheet!`);

    } catch (err) {
        console.error("❌ Chyba při odesílání dat do AppSheet:", err);
        info.revert();
    }
},
    dateClick: function(info) {
        info.jsEvent.preventDefault();
    },

eventClick: function(info) {
    if (info.event.extendedProps?.SECURITY_filter) {
        selectedEvent = info.event;

        const { hotove, predane, odeslane } = selectedEvent.extendedProps;

        const currentStredisko = strediskoFilter.value;
        const modalEventInfo = document.getElementById('modalEventInfo');
        const detailButton = document.getElementById('detailButton');
        const casSelect = document.getElementById('casSelect');
        const partySelect = document.getElementById('partySelect');

        modalEventInfo.innerHTML = `
          <div style="padding-bottom:5px; margin-bottom:5px; border-bottom:1px solid #ddd;">
            🚧 ${selectedEvent.extendedProps.zakaznik || ''} - 
            ${selectedEvent.extendedProps.cinnost || ''} - 
            ${getPartyName(selectedEvent.extendedProps.party)}
        </div>`;

        if (selectedEvent.extendedProps.detail) {
            detailButton.style.display = "inline-block";
            detailButton.onclick = () => window.open(selectedEvent.extendedProps.detail, '_blank');
        } else {
            detailButton.style.display = "none";
        }

// naplnění výběru party
partySelect.innerHTML = "";
Object.entries(partyMap).forEach(([id, party]) => {
    if (currentStredisko === "vše" || party.stredisko === currentStredisko) {
        const option = document.createElement("option");
        option.value = id;
        option.innerHTML = `&#9679; ${party.name}`; // kulatá tečka + název
        option.style.color = party.color;           // barva dle party
        option.selected = id === selectedEvent.extendedProps.party;
        partySelect.appendChild(option);
    }
});

        casSelect.value = selectedEvent.extendedProps.cas || 0;

    // ✅ Nová logika pro zakázání změn podle stavu:
    if (hotove === true || predane === true) {
        // Nelze měnit ani partu ani čas
        partySelect.disabled = true;
        partySelect.title = "Partu nelze změnit, protože event je označen jako hotový nebo předaný.";

        casSelect.disabled = true;
        casSelect.title = "Čas nelze změnit, protože event je označen jako hotový nebo předaný.";
    } else {
        // Pokud není hotovo/předáno, nastaví se podle 'odeslane'
        if (odeslane === true) {
            partySelect.disabled = true;
            partySelect.title = "Partu nelze změnit, protože event je označen jako odeslaný.";
        } else {
            partySelect.disabled = false;
            partySelect.title = "";
        }

        casSelect.disabled = false;
        casSelect.title = "";
    }

        // Asynchronní ukládání při změně party
        partySelect.onchange = async () => {
            const newParty = partySelect.value;
            const selectedParty = partyMap[newParty];

            db.collection("events").doc(selectedEvent.id).update({
                party: newParty,
                color: selectedParty.color
            }).then(() => {
                return fetch("https://us-central1-kalendar-831f8.cloudfunctions.net/updateAppSheetFromFirestore", {
                    method: "POST",
                    body: JSON.stringify({ eventId: selectedEvent.id, party: newParty }),
                    headers: { 'Content-Type': 'application/json' }
                });
            }).then(() => {
                console.log("✅ Parta úspěšně uložena.");
            }).catch(error => {
                console.error("❌ Chyba při ukládání party:", error);
            });
        };

        casSelect.onchange = async () => {
            const newCas = (casSelect.value !== "" && !isNaN(casSelect.value))
                ? Number(casSelect.value)
                : selectedEvent.extendedProps.cas;

            db.collection("events").doc(selectedEvent.id).update({
                'extendedProps.cas': newCas
            }).then(() => {
                return fetch("https://us-central1-kalendar-831f8.cloudfunctions.net/updateAppSheetFromFirestore", {
                    method: "POST",
                    body: JSON.stringify({ eventId: selectedEvent.id, cas: newCas }),
                    headers: { 'Content-Type': 'application/json' }
                });
            }).then(() => {
                console.log("✅ Čas uložen:", newCas);
            }).catch(error => {
                console.error("❌ Chyba při ukládání času:", error);
            });
        };
    modal.style.display = modalOverlay.style.display = "block";
    }
},

eventContent: function(arg) {
  const { event, view } = arg;

  let icon = "";
  let statusColor = "#bbb";
  if (event.extendedProps.predane) {
    icon = '<i class="fa-solid fa-file-signature"></i>';
    statusColor = "";
  } else if (event.extendedProps.hotove) {
    icon = '<i class="fa-solid fa-check"></i>';
    statusColor = "";
} else if (event.extendedProps.odeslane) {
    icon = '<i class="fa-solid fa-envelope-circle-check"></i>';
    statusColor = "";
}

  // Přehledný datum
  const options = { weekday: 'short', day: 'numeric', month: 'short' };
  const formattedDate = event.start.toLocaleDateString('cs-CZ', options);

const cas = (event.extendedProps.cas && event.extendedProps.cas !== 0)
    ? (event.extendedProps.cas.toString().includes(':') ? event.extendedProps.cas : `${event.extendedProps.cas}:00`)
    : "";

  const partyName = getPartyName(event.extendedProps.party);
  const partyColor = event.backgroundColor || "#666";

  // ✅ Přidáno: explicitně černá barva pro omluvenky
  const isOmluvenka = event.source && event.source.id === 'omluvenky';
  const textColor = isOmluvenka ? "#000000" : "#ffffff";

  // ✅ Speciální zobrazení pro omluvenky
  if (isOmluvenka) {
const [titleText, typText] = event.title.split('(');
const typ = typText ? typText.replace(')', '').trim() : '';

    return {
      html: `
    <div style="
    width:100%; 
    font-size:11px; 
    color:${textColor};
    line-height:1.1; 
    overflow:hidden; 
    text-overflow:ellipsis;
    white-space:nowrap;
    display: flex;
    align-items: center;
    gap: 4px;">
    
    <span style="font-weight:bold; color:#ffffff;">
        <i class="fa-solid fa-user-slash"></i> ${titleText.trim()}
    </span>
    <span style="font-size:9px; opacity:0.8; color:#ffffff;">
        (${typ.trim()})
    </span>
    </div>`
    };
  }

  // Rozlišení pohledu seznam vs ostatní
 if (view.type === 'listWeek' || view.type === 'listMonth' || view.type === 'listFourWeeks') {
    return {
      html: `
        <div style="
          display: flex;
          align-items: center;
          gap: 10px;
          border-left: 6px solid ${partyColor};
          padding-left: 10px;
          background-color: #fff;
          color: #333;
          border-radius: 4px;
          box-shadow: 2px 2px 8px rgba(0,0,0,0.1);
          overflow: hidden;">
          
          <div style="
            width:30px;
            height:30px;
            display:flex;
            justify-content:center;
            align-items:center;
            border-radius:50%;
            background-color:${statusColor};
            color:#fff;
            font-size:16px;">${icon}</div>

          <div style="flex-grow:1; overflow:hidden;">
            <div style="font-size:13px; font-weight:bold;">${formattedDate}, ${cas}</div>
            <div style="font-size:12px; opacity:0.8;">${event.title} (${partyName})</div>
          </div>
        </div>`
    };
  } else {
    // zachováš původní obsah pro ostatní pohledy
    return { 
      html: `
        <div style="
          width:100%; 
          font-size:11px; 
          color:${textColor}; /* ✅ upraveno na dynamickou barvu */
          line-height:1.1; 
          overflow:hidden; 
          text-overflow:ellipsis;
          white-space:nowrap;">
            <div style="font-weight:bold;">${icon} ${cas} ${event.title}</div>
            <div style="font-size:9px; color:#ffffff;">${partyName}</div>
        </div>`
    };
  }
}

});

calendar.render();
document.getElementById('listView').onclick = () => calendar.changeView('listFourWeeks');


modalOverlay.onclick = () => {
    modal.style.display = "none";
    modalOverlay.style.display = "none";
};

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

async function filterAndRenderEvents() {
    if (!calendar) return;
    
    const selectedParty = partyFilter.value;
    const selectedStredisko = strediskoFilter.value;

    const filteredEvents = allEvents.filter(event => {
        const partyMatch = selectedParty === "all" || event.party === selectedParty;
        const strediskoMatch = selectedStredisko === "vše" || event.stredisko === selectedStredisko;
        return partyMatch && strediskoMatch;
    });

    
    // ✅ přidána filtrace dle party i střediska pro omluvenky
    const omluvenkyFiltered = omluvenkyEvents.filter(event => {
        const partyMatch = selectedParty === "all" || event.parta === selectedParty;
        const strediskoMatch = selectedStredisko === "vše" || event.stredisko === selectedStredisko;
        return partyMatch && strediskoMatch;
    });

    const currentViewDate = calendar.getDate();

    // odebrání původních event sources
    const firestoreSource = calendar.getEventSourceById('firestore');
    if (firestoreSource) firestoreSource.remove();

    const omluvenkySource = calendar.getEventSourceById('omluvenky');
    if (omluvenkySource) omluvenkySource.remove();

    // přidání filtrovanych events
    calendar.addEventSource({ id: 'firestore', events: filteredEvents });
    calendar.addEventSource({ id: 'omluvenky', events: omluvenkyFiltered, editable: false });

    calendar.gotoDate(currentViewDate);
}




document.addEventListener('DOMContentLoaded', () => {
    calendarEl = document.getElementById('calendar');
    modal = document.getElementById('eventModal');
    partySelect = document.getElementById('partySelect');
    savePartyButton = document.getElementById('saveParty');
    partyFilter = document.getElementById('partyFilter');
    strediskoFilter = document.getElementById('strediskoFilter');
    const modalOverlay = document.getElementById('modalOverlay');

    const savedStredisko = localStorage.getItem('selectedStredisko') || 'vše';
    strediskoFilter.value = savedStredisko;

    // ✅ Přidáno - tlačítka pro změnu pohledu
  const monthViewBtn = document.getElementById('monthView');
  const weekViewBtn = document.getElementById('weekView');
  const listViewBtn = document.getElementById('listFourWeeks');

    if (strediskoFilter) {
        strediskoFilter.onchange = () => {
            localStorage.setItem('selectedStredisko', strediskoFilter.value);
            populateFilter();
            filterAndRenderEvents();
        };
    }

    if (partyFilter) {
        partyFilter.onchange = filterAndRenderEvents;
    }

    renderCalendar();

    if (monthViewBtn) {
        monthViewBtn.onclick = () => calendar.changeView('dayGridMonth');
    }
    if (weekViewBtn) {
        weekViewBtn.onclick = () => calendar.changeView('dayGridWeek');
    }
    if (listViewBtn) {
        listViewBtn.onclick = () => calendar.changeView('listFourWeeks');
    }

    if (savePartyButton) {
        savePartyButton.onclick = async () => {
            if (selectedEvent) {
                await updateFirestoreEvent(selectedEvent.id, { party: partySelect.value });
                if (modal) modal.style.display = "none";
                if (modalOverlay) modalOverlay.style.display = "none";
            }
        };
    }

    // Zavření modalu kliknutím mimo modal přes overlay
    if (modalOverlay) {
        modalOverlay.onclick = () => {
            if (modal) modal.style.display = "none";
            modalOverlay.style.display = "none";
        };
    }
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
    
    // ✅ NOVÝ Listener pro omluvenky
    db.collection('omluvenky').onSnapshot(async (snapshot) => {
        omluvenkyEvents = snapshot.docs.map(doc => {
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
                editable: false
            };
        });

        filterAndRenderEvents();
    });
    
}
