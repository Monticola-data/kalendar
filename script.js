import { db } from './firebase.js';

let calendarEl, modal, partySelect, savePartyButton, partyFilter, strediskoFilter;
let allEvents = [], partyMap = {}, selectedEvent = null, calendar;

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


let omluvenkyEvents = [];
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
            extendedProps: { isOmluvenka: true } // ✅ přidáno explicitní označení
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
        buttonText: {
            today: 'dnes',
            month: 'měsíc'
        },
    views: {
        listFourWeeks: {
            type: 'list',
            duration: { weeks: 4 },
            buttonText: 'seznam',
            visibleRange: function(currentDate) {
                // začátek týdne (pondělí)
                let start = new Date(currentDate);
                start.setDate(start.getDate() - (start.getDay() + 6) % 7);

                // konec za 4 týdny
                let end = new Date(start);
                end.setDate(end.getDate() + 28);

                return { start, end };
            }
        },
        aktualni: {
          type: 'dayGrid',
          duration: { weeks: 4 },
          buttonText: 'aktuální',
            visibleRange: function(currentDate) {
                // začátek týdne (pondělí)
                let start = new Date(currentDate);
                start.setDate(start.getDate() - (start.getDay() + 6) % 7);

                // konec za 4 týdny
                let end = new Date(start);
                end.setDate(end.getDate() + 28);

                return { start, end };
            }
        }   
    },
    headerToolbar: {
        left: 'prev,next today',
        center: 'title',
        right: 'dayGridMonth,aktualni,listFourWeeks'
      },
        height: 'auto',
        firstDay: 1,
        selectable: false,
        unselectAuto: true,
        navLinks: true,
        eventOrder: "cas,title",
        dragScroll: false,
        longPressDelay: 500,
        eventLongPressDelay: 500,
    
        weekNumbers: true,
        weekNumberContent: function(arg) {
            return {
                html: `<span class="week-number-circle" data-week="${arg.num}">T${arg.num}</span>`
            };
        },

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

eventDrop: function(info) { // bez async, aby nezdržoval UI
    const eventId = info.event.id;
    const newDate = info.event.startStr;

    const originalCas = info.oldEvent.extendedProps.cas;
    const cas = (typeof originalCas !== 'undefined') ? Number(originalCas) : 0;

    // okamžitě zahájíme asynchronní proces, ale nečekáme na něj
    (async () => {
        try {
            // Aktualizuj Firestore (nečeká na dokončení)
            db.collection("events").doc(eventId).update({
                start: newDate,
                "extendedProps.cas": cas
            });

            // Aktualizuj AppSheet
            fetch("https://us-central1-kalendar-831f8.cloudfunctions.net/updateAppSheetFromFirestore", {
                method: "POST",
                body: JSON.stringify({ eventId, start: newDate, cas }),
                headers: { 'Content-Type': 'application/json' }
            });

            console.log(`✅ Datum (${newDate}) a čas (${cas}) úspěšně odeslány!`);

        } catch (err) {
            console.error("❌ Chyba při odesílání dat:", err);
            info.revert(); // toto případně volat jen, pokud chceš vrátit změnu
        }
    })();
},

    dateClick: function(info) {
        info.jsEvent.preventDefault();
    },

eventClick: function(info) {
    if (!info.event || !info.event.extendedProps) {
        console.warn("⚠️ Kliknutí na neplatnou nebo odstraněnou událost.");
        return;
    }
    
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

  if (!event || !event.extendedProps) {
    console.warn("⚠️ Událost neexistuje nebo nemá extendedProps.", event);
    return { html: '<div>Chybějící událost</div>' };
  }

  const options = { weekday: 'short', day: 'numeric', month: 'short' };
  const formattedDate = event.start.toLocaleDateString('cs-CZ', options);

  const cas = (event.extendedProps.cas && event.extendedProps.cas !== 0)
    ? (event.extendedProps.cas.toString().includes(':') ? event.extendedProps.cas : `${event.extendedProps.cas}:00`)
    : "";

  const partyName = getPartyName(event.extendedProps.party);
  const partyColor = event.backgroundColor || "#666";

  // ✅ Jednoduchá a bezpečná detekce omluvenky
  const isOmluvenka = event.extendedProps?.isOmluvenka === true;

  let iconHtml = "";
  let statusColor = "#bbb";

  if (isOmluvenka) {
    iconHtml = '<i class="fa-solid fa-user-slash"></i>';
    statusColor = event.backgroundColor || "#999";
  } else if (event.extendedProps.predane) {
    iconHtml = '<i class="fa-solid fa-file-signature"></i>';
    statusColor = partyColor;
  } else if (event.extendedProps.hotove) {
    iconHtml = '<i class="fa-solid fa-check"></i>';
    statusColor = partyColor;
  } else if (event.extendedProps.odeslane) {
    iconHtml = '<i class="fa-solid fa-paper-plane"></i>';
    statusColor = partyColor;
  }

  if (view.type === 'listFourWeeks') {
    if (!event.extendedProps.predane && !event.extendedProps.hotove && !event.extendedProps.odeslane && !isOmluvenka) {
      iconHtml = '<i class="fa-solid fa-person-digging"></i>';
      statusColor = partyColor;
    }

    let displayTitle = event.title;
    if (isOmluvenka) {
      const [titleText, typText] = event.title.split('(');
      const typ = typText ? typText.replace(')', '').trim() : '';
      displayTitle = `${titleText.trim()} (${typ})`;
    } else {
      displayTitle = `${event.title} (${partyName})`;
    }

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
            font-size:16px;">${iconHtml}</div>

          <div style="flex-grow:1; overflow:hidden;">
            <div style="font-size:13px; font-weight:bold;">${formattedDate}, ${cas}</div>
            <div style="font-size:12px; opacity:0.8;">${displayTitle}</div>
          </div>
        </div>`
    };
  } else {
    if (isOmluvenka) {
      const [titleText, typText] = event.title.split('(');
      const typ = typText ? typText.replace(')', '').trim() : '';

      return {
        html: `
          <div style="
            width:100%; 
            font-size:11px; 
            color:#fff;
            line-height:1.1; 
            overflow:hidden; 
            text-overflow:ellipsis;
            white-space:nowrap;
            display: flex;
            align-items: center;
            gap: 4px;">
            
            <span style="font-weight:bold;">
              <i class="fa-solid fa-user-slash"></i> ${titleText.trim()}
            </span>
            <span style="font-size:9px; opacity:0.8;">
              (${typ.trim()})
            </span>
          </div>`
      };
    } else {
      return { 
        html: `
          <div style="
            width:100%; 
            font-size:11px; 
            color:#fff;
            line-height:1.1; 
            overflow:hidden; 
            text-overflow:ellipsis;
            white-space:nowrap;">
              <div style="font-weight:bold;">
                ${iconHtml} ${cas} ${event.title}
              </div>
              <div style="font-size:9px;">${partyName}</div>
          </div>`
      };
    }
  }
}

});

calendar.render();

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

    const omluvenkyFiltered = omluvenkyEvents.filter(event => {
        const partyMatch = selectedParty === "all" || event.parta === selectedParty;
        const strediskoMatch = selectedStredisko === "vše" || event.stredisko === selectedStredisko;
        return partyMatch && strediskoMatch;
    });

    const omluvenkySource = calendar.getEventSourceById('omluvenky');

    calendar.batchRendering(() => {
        calendar.getEvents().forEach(evt => evt.remove()); // bezpečně odstraní jednotlivé eventy

        filteredEvents.forEach(evt => calendar.addEvent(evt));
        
        // ✅ správně nastaví zdroj omluvenek!
        omluvenkyFiltered.forEach(evt => calendar.addEvent({ ...evt, source: omluvenkySource }));
    });
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
            editable: false,
            extendedProps: { isOmluvenka: true }  // ✅ NUTNÉ přidat!
        };
    });

    filterAndRenderEvents();
});
    
}
