async function fetchAppSheetData(userEmail) {
    try {
        if (!userEmail) {
            console.error("❌ Chyba: uživatel není přihlášený nebo chybí email.");
            return;
        }

        const response = await fetch("https://us-central1-kalendar-831f8.cloudfunctions.net/fetchAppSheetData");
        if (!response.ok) throw new Error(`Chyba ${response.status}`);

        const data = await response.json();
        partyMap = data.partyMap;

        const normalizedUserEmail = userEmail.trim().toLowerCase();

        allEvents = data.events.filter(event => {
            const security = event.extendedProps.SECURITY_filter;
            const allowedEmails = Array.isArray(security)
                ? security.map(e => e.trim().toLowerCase())
                : [];

            return allowedEmails.includes(normalizedUserEmail);
        });

        console.log("✅ Eventy po filtrování:", allEvents);

        populateFilter();

        if (calendar) {
            calendar.removeAllEvents();
            calendar.addEventSource(allEvents);
            calendar.render();
        } else {
            renderCalendar();
            populateFilter();
            renderLegend();
        }
    } catch (error) {
        console.error("❌ Chyba načtení dat:", error);
    }
}

function normalizeEmail(email) {
    return email.trim().toLowerCase();
}

let calendarEl, modal, partySelect, savePartyButton, partyFilter, allEvents = [], partyMap = {}, selectedEvent = null, calendar;

const isLocal = window.location.hostname === "localhost";

const API_BASE_URL = isLocal
    ? "http://127.0.0.1:5001/kalendar-831f8/us-central1"
    : "https://us-central1-kalendar-831f8.cloudfunctions.net";


async function updateAppSheetEvent(eventId, newDate, newParty = null) {
    console.log(`📡 Odesílám do Firebase: ID: ${eventId}, Datum: ${newDate}, Parta: ${newParty}`);

    try {
        const response = await fetch(`${API_BASE_URL}/updateAppSheetEvent`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                rowId: eventId,
                Datum: newDate,
                Parta: newParty
            })
        });

        const responseData = await response.json();
        console.log("✅ Odpověď z Firebase API:", responseData);

        // 🟢 Zavolání webhooku pro refreshStatus
        await fetch(`${API_BASE_URL}/webhook`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rowId: eventId })
        });

    } catch (error) {
        console.error("❌ Chyba při aktualizaci události:", error);
    }
}



function renderCalendar(view = null) {
const savedView = view || localStorage.getItem('selectedCalendarView') || 'dayGridMonth';

calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: savedView,
    editable: true,
    locale: 'cs',
    height: 'auto',
    contentHeight: 'auto',
    aspectRatio: 1.8,
    
    eventSources: [
      allEvents,
      {
        googleCalendarApiKey: 'AIzaSyBA8iIXOCsGuTXeBvpkvfIOZ6nT1Nw4Ugk',
        googleCalendarId: 'cs.czech#holiday@group.v.calendar.google.com',
        display: 'background',
        color: '#854646',
        textColor: '#000',
        className: 'holiday-event',
        extendedProps: { isHoliday: true }
      }
    ],


views: {
    workWeek: {
        type: 'timeGridWeek',
        weekends: false,
        buttonText: 'Týden (pracovní)'
    },
    monthWorkDays: {
        type: 'dayGridMonth',
        hiddenDays: [0, 6],
        buttonText: 'Měsíc (pracovní)'
    },
    listMonth: {
        type: 'listMonth',
        buttonText: 'Seznam (měsíc)'
    },
    timeGridDay: {
        type: 'timeGridDay',
        buttonText: 'Denní agenda'
    }
},

        eventDrop: async function (info) {
            const updatedEvent = {
                id: info.event.id,
                start: info.event.startStr,
                party: info.event.extendedProps.party || null
            };
            console.log("🔄 Událost přesunuta:", updatedEvent);
            await updateAppSheetEvent(updatedEvent.id, updatedEvent.start, updatedEvent.party);
        },

eventClick: function (info) {
    // ✅ Nová a spolehlivá kontrola
    if (info.event.extendedProps && info.event.extendedProps.SECURITY_filter) {
        selectedEvent = info.event;
        partySelect.innerHTML = "";

        Object.entries(partyMap).forEach(([id, party]) => {
            let option = document.createElement("option");
            option.value = id;
            option.textContent = party.name;

            if (id === info.event.extendedProps.party) {
                option.selected = true;
            }
            partySelect.appendChild(option);
        });

        let detailButton = document.getElementById("detailButton");
        if (info.event.extendedProps.detail) {
            detailButton.style.display = "block";
            detailButton.onclick = function () {
                window.open(info.event.extendedProps.detail, "_blank");
            };
        } else {
            detailButton.style.display = "none";
        }

        modal.style.display = "block";
    } else {
        // ✅ Události BEZ SECURITY_filter ignoruj (např. svátky)
        console.log("⛔ Ignoruji kliknutí na událost bez SECURITY_filter");
        return;
    }
},


        eventContent: function (arg) {
            let icon = "";
            let title = arg.event.title;

            if (arg.event.extendedProps.predane) {
                icon = "✍️";
                title = title.toUpperCase();
            } else if (arg.event.extendedProps.hotove) {
                icon = "✅";
                title = title.toUpperCase();
            } else if (arg.event.extendedProps.odeslane) {
                icon = "📩";
                title = title.toUpperCase();
            }
            return { html: `<b>${icon}</b> ${title}` };
        }

    });

    calendar.render();
}





    // 🟢 5️⃣ Funkce pro naplnění filtru podle party
    function populateFilter() {
        partyFilter.innerHTML = '<option value="all">Všechny party</option>';

        Object.entries(partyMap).forEach(([id, party]) => {
            let option = document.createElement("option");
            option.value = id; 
            option.textContent = party.name; 
            partyFilter.appendChild(option);
        });

        partyFilter.addEventListener("change", function () {
            const selectedParty = partyFilter.value;
            calendar.removeAllEvents();

            if (selectedParty === "all") {
                calendar.addEventSource(allEvents);
            } else {
                const filteredEvents = allEvents.filter(event => event.party === selectedParty);
                calendar.addEventSource(filteredEvents);
            }
        });
    }

    function renderLegend() {
        var legendContainer = document.getElementById("legend");

        Object.entries(partyMap).forEach(([id, party]) => {
            let legendItem = document.createElement("div");
            legendItem.classList.add("legend-item");
            legendItem.style.backgroundColor = party.color;
            legendItem.textContent = party.name;
            legendContainer.appendChild(legendItem);
        });
    }

    window.addEventListener("click", function (event) {
        let modal = document.getElementById("eventModal");

        if (modal.style.display === "block") {
            if (!modal.contains(event.target) && !event.target.closest(".fc-event")) {
                modal.style.display = "none";
            }
        }
    });

async function listenForUpdates() {
    let refreshInterval;

    async function checkForChanges() {
        try {
            const response = await fetch(`${API_BASE_URL}/checkRefreshStatus`);
            const data = await response.json();

            if (data.type === "update") {
                const userEmail = window.currentUser?.email || sessionStorage.getItem('userEmail');

                if (userEmail) {
                    await fetchAppSheetData(userEmail);
                } else {
                    console.warn("⚠️ Nelze načíst data: email uživatele není dostupný.");
                }
            }
        } catch (error) {
            console.error("❌ Chyba při kontrole změn:", error);
        }
    }

    // ✅ Zde používej setInterval místo setTimeout pro robustnější běh
    function startInterval() {
        clearInterval(refreshInterval); // vyčištění předchozího intervalu
        refreshInterval = setInterval(checkForChanges, 5000); 
    }

    // ✅ Spuštění při prvním načtení
    startInterval();

    // ✅ Obnovení kontroly po probuzení stránky z uspání (mobil/PC)
    document.addEventListener("visibilitychange", () => {
        if (!document.hidden) {
            console.log("✅ Stránka znovu aktivována, obnovuji kontrolu změn.");
            startInterval();
            checkForChanges(); // okamžitě zkontroluj při obnovení stránky
        }
    });
}


// ✅ Ostatní DOM věci musí být uvnitř DOMContentLoaded
document.addEventListener('DOMContentLoaded', function () {
    calendarEl = document.getElementById('calendar');
    modal = document.getElementById('eventModal');
    partySelect = document.getElementById('partySelect');
    savePartyButton = document.getElementById('saveParty');
    partyFilter = document.getElementById('partyFilter');

    // ✅ Tohle je klíčová oprava (načtení posledního pohledu)!
    const savedView = localStorage.getItem('selectedCalendarView') || 'dayGridMonth';
    document.getElementById("viewSelect").value = savedView;

    renderCalendar(savedView); // ✅ předání pohledu do funkce

    savePartyButton.addEventListener("click", async function () {
        if (selectedEvent) {
            const selectedPartyId = partySelect.value;
            const selectedPartyColor = partyMap[selectedPartyId]?.color || "#145C7E";
            const updatedEvent = allEvents.find(event => event.id === selectedEvent.id);

            if (updatedEvent) {
                updatedEvent.party = selectedPartyId;
                updatedEvent.color = selectedPartyColor;
                selectedEvent.setExtendedProp("party", selectedPartyId);
                selectedEvent.setProp("backgroundColor", selectedPartyColor);

                await updateAppSheetEvent(updatedEvent.id, selectedEvent.startStr, selectedPartyId);
                modal.style.display = "none";
            }
        }
    });

    document.getElementById("viewSelect").addEventListener("change", function () {
        const selectedView = this.value;
        calendar.changeView(selectedView);
        localStorage.setItem('selectedCalendarView', selectedView);
    });

    listenForUpdates();
});
