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



function renderCalendar() {
    
calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    editable: true,
    locale: 'cs',
    height: 'auto',
    contentHeight: 'auto',
    aspectRatio: 1.8,
    events: allEvents,

views: {
workWeek: { // ✅ Nový vlastní pohled „pracovní týden“
    type: 'timeGridWeek',
    weekends: false // ✅ Bez víkendů
},
monthWorkDays: { // ✅ Měsíc jen s pracovními dny
    type: 'dayGridMonth',
    hiddenDays: [0, 6] // skryje sobotu (6) a neděli (0)
}
},

eventDrop: async function (info) {
    const updatedEvent = {
        id: info.event.id,
        start: info.event.startStr,
        party: info.event.extendedProps.party || null // ✅ Uchováme partu
    };
    console.log("🔄 Událost přesunuta:", updatedEvent);
    await updateAppSheetEvent(updatedEvent.id, updatedEvent.start, updatedEvent.party);
},

eventClick: function (info) {
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
},

eventContent: function(arg) {
    let icon = "";
    let title = arg.event.title;

    if (arg.event.extendedProps.predane) {
        icon = "✍️"; // Předané
        title = title.toUpperCase();
    } else if (arg.event.extendedProps.hotove) {
        icon = "✅"; // Hotové
        title = title.toUpperCase();
    } else if (arg.event.extendedProps.odeslane) {
        icon = "📩"; // Odeslané
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

            setTimeout(checkForChanges, 5000);
        } catch (error) {
            console.error("❌ Chyba při kontrole změn:", error);
            setTimeout(checkForChanges, 5000);
        }
    }

    checkForChanges();
}

// ✅ Ostatní DOM věci musí být uvnitř DOMContentLoaded
document.addEventListener('DOMContentLoaded', function () {
    calendarEl = document.getElementById('calendar');
    modal = document.getElementById('eventModal');
    partySelect = document.getElementById('partySelect');
    savePartyButton = document.getElementById('saveParty');
    partyFilter = document.getElementById('partyFilter');

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
        calendar.changeView(this.value);
    });

    listenForUpdates();
});

