import { db } from './firebase.js';

let calendarEl, modal, partySelect, partyFilter, strediskoFilter;
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
}

async function updateFirestoreEvent(eventId, updates = {}) {
    await firebase.firestore().collection("events").doc(eventId).set(updates, { merge: true });
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
        datesSet: function(info) {
            localStorage.setItem('selectedCalendarView', info.view.type);
            document.getElementById('calendarTitle').textContent = info.view.title;
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
          buttonText: '4 týdny',
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
    tyden: {  // ✅ týdenní pohled bez časů
        type: 'dayGridWeek',
        buttonText: 'týden',
        }
    },
    headerToolbar: {
        left: 'prev,next today',
        center: '',
        right: 'tyden,aktualni,dayGridMonth,listFourWeeks' // ✅ Aktualizované pořadí
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

eventDrop: function(info) {
    const eventId = info.event.id;
    const newDate = info.event.startStr;
    const originalCas = info.oldEvent.extendedProps.cas;
    const cas = (typeof originalCas !== 'undefined') ? Number(originalCas) : 0;

    const currentParty = info.event.extendedProps.party; // ✅ získáš aktuální partu

    (async () => {
        try {
            await db.collection("events").doc(eventId).update({
                start: newDate,
                "extendedProps.cas": cas
            });

            await fetch("https://us-central1-kalendar-831f8.cloudfunctions.net/updateAppSheetFromFirestore", {
                method: "POST",
                body: JSON.stringify({ eventId, start: newDate, cas, party: currentParty }), // ✅ parta přidána!
                headers: { 'Content-Type': 'application/json' }
            });

            console.log(`✅ Datum (${newDate}), čas (${cas}) a parta (${currentParty}) aktualizovány.`);
        } catch (err) {
            console.error("❌ Chyba při aktualizaci:", err);
            info.revert();
        } finally {
            filterAndRenderEvents(); 
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
   
        if (!partySelect || !casSelect) {
            console.warn("❌ Chybí DOM elementy pro partySelect nebo casSelect.");
            return;
        }
        
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

// naplnění výběru party bez barevných teček a stylování
partySelect.innerHTML = "";

// Přidej prázdnou default možnost
const emptyOption = document.createElement("option");
emptyOption.value = "";
emptyOption.textContent = "-- nevybráno --";
emptyOption.selected = !selectedEvent.extendedProps.party;
partySelect.appendChild(emptyOption);

// Generuj seznam part
Object.entries(partyMap).forEach(([id, party]) => {
    if (currentStredisko === "vše" || party.stredisko === currentStredisko) {
        const option = document.createElement("option");
        option.value = id;
        option.textContent = party.name;
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

    partySelect.onchange = async () => {
        const newParty = partySelect.value;
        const selectedParty = partyMap[newParty];

        await updateEventField(selectedEvent.id, {
            party: newParty,
            color: selectedParty.color
        }, { party: newParty });
    };

casSelect.onchange = async () => {
    const newCas = (casSelect.value !== "" && !isNaN(casSelect.value))
        ? Number(casSelect.value)
        : selectedEvent.extendedProps.cas;

    const currentEvent = calendar.getEventById(selectedEvent.id);

    const currentParty = currentEvent?.extendedProps?.party || selectedEvent.extendedProps.party;
    const currentStart = currentEvent?.startStr || selectedEvent.startStr;

    console.log("✅ Aktualizace času s datem a partou:", {
        eventId: selectedEvent.id,
        cas: newCas,
        party: currentParty,
        start: currentStart
    });

    await updateEventField(selectedEvent.id, {
        'extendedProps.cas': newCas
    }, { 
        cas: newCas, 
        party: currentParty,
        start: currentStart  // 🚩 Zde posíláš i datum!
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

  const formattedDate = event.start.toLocaleDateString('cs-CZ', { weekday: 'short', day: 'numeric', month: 'short' });

  const cas = (event.extendedProps.cas && event.extendedProps.cas !== 0)
    ? (event.extendedProps.cas.toString().includes(':') ? event.extendedProps.cas : `${event.extendedProps.cas}:00`)
    : "";

  const partyName = getPartyName(event.extendedProps.party);
  const partyColor = event.backgroundColor || "#666";

  const isOmluvenka = event.extendedProps?.isOmluvenka === true;
  const isLoading = event.extendedProps.loading === true;
  const loadingIcon = isLoading ? '⏳ ' : '';

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

    const displayTitle = isOmluvenka
      ? event.title
      : `${event.title} (${partyName})`;

    return {
      html: `
        <div class="event-list-item" style="--party-color:${partyColor};">
          <div class="event-list-icon" style="--status-color:${statusColor};">${iconHtml}</div>
          <div class="event-list-info">
            <div class="event-list-date">${loadingIcon}${formattedDate}, ${cas}</div>
            <div class="event-list-title">${displayTitle}</div>
          </div>
        </div>`
    };
  } else {
    if (isOmluvenka) {
      const [titleText, typText] = event.title.split('(');
      const typ = typText ? typText.replace(')', '').trim() : '';

      return {
        html: `
          <div class="event-calendar-item event-calendar-omluvenka">
            <span class="event-calendar-title">
              <i class="fa-solid fa-user-slash"></i> ${titleText.trim()}
            </span>
            <span class="event-calendar-type">(${typ})</span>
          </div>`
      };
    } else {
      return { 
        html: `
          <div class="event-calendar-item">
            <div class="event-calendar-title">
              ${loadingIcon}${iconHtml} ${cas} ${event.title}
            </div>
            <div class="event-calendar-type">${partyName}</div>
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
//const hammer = new Hammer(calendarEl);

// Swipe doprava (předchozí měsíc/týden)
//hammer.on('swiperight', function() {
//  calendar.prev();
//});

// Swipe doleva (další měsíc/týden)
//hammer.on('swipeleft', function() {
//  calendar.next();
//});

}

function populateFilter() {
    const savedStredisko = localStorage.getItem('selectedStredisko') || 'vše';
    strediskoFilter.value = savedStredisko;

    partyFilter.innerHTML = '<option value="all">Všechny party</option>' + 
        Object.entries(partyMap)
            .filter(([_, party]) => savedStredisko === "vše" || party.stredisko === savedStredisko)
            .map(([id, party]) => `<option value="${id}">${party.name}</option>`)
            .join('');

    filterAndRenderEvents();
}

function filterAndRenderEvents() {
    if (!calendar) return;

    const selectedParty = partyFilter.value;
    const selectedStredisko = strediskoFilter.value;

    const statusChecks = document.querySelectorAll('#statusFilter input[type=checkbox]');
    const selectedStatuses = Array.from(statusChecks)
        .filter(chk => chk.checked)
        .map(chk => chk.value);

    const filteredEvents = allEvents.filter(event => {
        const partyMatch = selectedParty === "all" || event.party === selectedParty;
        const strediskoMatch = selectedStredisko === "vše" || event.stredisko === selectedStredisko;

        const { hotove = false, predane = false, odeslane = false } = event.extendedProps;

        let statusMatch = false;

        if (selectedStatuses.includes("kOdeslani")) {
            if (!hotove && !predane && !odeslane) statusMatch = true;
        }
        if (selectedStatuses.includes("odeslane")) {
            if (odeslane === true && hotove === false && predane === false) statusMatch = true;
        }
        if (selectedStatuses.includes("hotove")) {
            if (hotove === true && predane === false) statusMatch = true;
        }
        if (selectedStatuses.includes("predane")) {
            if (predane === true) statusMatch = true;
        }

        return partyMatch && strediskoMatch && statusMatch;
    });

    const omluvenkyFiltered = omluvenkyEvents.filter(event => {
        const partyMatch = selectedParty === "all" || event.parta === selectedParty;
        const strediskoMatch = selectedStredisko === "vše" || event.stredisko === selectedStredisko;
        return partyMatch && strediskoMatch;
    });

    // ✅ Načtení uloženého pohledu přímo z localStorage
    const currentView = localStorage.getItem('selectedCalendarView') || calendar.view.type;
    const currentDate = calendar.getDate();

    calendar.batchRendering(() => {
        calendar.getEvents().forEach(evt => {
            if (evt.source?.id !== 'holidays') evt.remove();
        });

        filteredEvents.forEach(evt => calendar.addEvent(evt));
        omluvenkyFiltered.forEach(evt => calendar.addEvent(evt));

        if (!calendar.getEventSources().some(src => src.id === 'holidays')) {
            calendar.addEventSource({
                id: 'holidays',
                googleCalendarApiKey: 'AIzaSyBA8iIXOCsGuTXeBvpkvfIOZ6nT1Nw4Ugk',
                googleCalendarId: 'cs.czech#holiday@group.v.calendar.google.com',
                display: 'background',
                color: '#854646',
                textColor: '#000',
                className: 'holiday-event',
                extendedProps: { isHoliday: true }
            });
        }

    });
}






document.addEventListener('DOMContentLoaded', () => {
    calendarEl = document.getElementById('calendar');
    modal = document.getElementById('eventModal');
    partySelect = document.getElementById('partySelect');
    partyFilter = document.getElementById('partyFilter');
    strediskoFilter = document.getElementById('strediskoFilter');
    const modalOverlay = document.getElementById('modalOverlay');

    
    const statusChecks = document.querySelectorAll('#statusFilter input[type=checkbox]');
    statusChecks.forEach(chk => chk.addEventListener('change', filterAndRenderEvents));

    if (!calendarEl || !modal || !partySelect || !partyFilter || !strediskoFilter || !modalOverlay) {
        console.error("❌ Některé DOM elementy nejsou dostupné:", { calendarEl, modal, partySelect, partyFilter, strediskoFilter, modalOverlay });
        return;
    }

    const savedStredisko = localStorage.getItem('selectedStredisko') || 'vše';
    strediskoFilter.value = savedStredisko;

    if (strediskoFilter) {
        strediskoFilter.onchange = () => {
            localStorage.setItem('selectedStredisko', strediskoFilter.value);
            populateFilter();
        };
    }

    if (partyFilter) {
        partyFilter.onchange = filterAndRenderEvents;
    }

    renderCalendar();

    // Zavření modalu kliknutím mimo modal přes overlay
    if (modalOverlay) {
        modalOverlay.onclick = () => {
            if (modal) modal.style.display = "none";
            modalOverlay.style.display = "none";
        };
    }
});



export function listenForUpdates(userEmail) {
    const normalizedUserEmail = userEmail.trim().toLowerCase();

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
            return security.map(e => e.toLowerCase()).includes(normalizedUserEmail);
        });

        filterAndRenderEvents();  // ✅ Překresli kompletně!
    });

    db.collection('omluvenky').onSnapshot((snapshot) => {
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
                extendedProps: { isOmluvenka: true }
            };
        });

        filterAndRenderEvents();  // ✅ Překresli kompletně!
    });
}
