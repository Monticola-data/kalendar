document.getElementById("viewSelect").addEventListener("change", function() {
    calendar.changeView(this.value);
});

document.addEventListener('DOMContentLoaded', function () {
    var calendarEl = document.getElementById('calendar');
    var modal = document.getElementById('eventModal');
    var partySelect = document.getElementById('partySelect');
    var savePartyButton = document.getElementById('saveParty');
    var partyFilter = document.getElementById('partyFilter');
    var allEvents = [];
    var partyMap = {}; 
    var selectedEvent = null;
    var calendar; // Definujeme proměnnou pro kalendář

const isLocal = window.location.hostname === "localhost";

const API_BASE_URL = isLocal
    ? "http://127.0.0.1:5001/kalendar-831f8/us-central1"
    : "https://us-central1-kalendar-831f8.cloudfunctions.net";

    // 🟢 1️⃣ Načtení dat z backendu

async function fetchAppSheetData() {
    console.log("🔍 Odesílám požadavek na Firebase function...");

    try {
        const response = await fetch("https://us-central1-kalendar-831f8.cloudfunctions.net/fetchAppSheetData", {
            method: "GET",
            headers: {
                "Content-Type": "application/json"
            }
        });

        console.log("📡 Odpověď z Firebase function:", response);

        if (!response.ok) {
            throw new Error(`❌ Chyba: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        console.log("✅ Načtená data:", data);
        allEvents = data.events;
        partyMap = data.partyMap;

        renderCalendar();
        populateFilter();
        renderLegend();

    } catch (error) {
        console.error("❌ Chyba při načítání dat z backendu:", error);
    }
}


// 🟢 2️⃣ Funkce pro zobrazení kalendáře
function renderCalendar() {
    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        editable: true,
        locale: 'cs',
        height: 'auto',
        contentHeight: 'auto',
        aspectRatio: 1.8,
        events: allEvents,

        // 🟢 Přesunutí události v kalendáři (drag & drop)
        eventDrop: async function (info) {
            const updatedEvent = {
                id: info.event.id,
                start: info.event.startStr,
                party: info.event.extendedProps.party || null // ✅ Uchováme partu
            };

            console.log("🔄 Událost přesunuta:", updatedEvent);

            // ✅ Odeslat aktualizaci do AppSheet
            await updateAppSheetEvent(updatedEvent.id, updatedEvent.start, updatedEvent.party);
        },


            // 🟢 Kliknutí na událost → změna party
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

    // 🟢 3️⃣ Aktualizace události v AppSheet přes API
async function updateAppSheetEvent(eventId, newDate, newParty = null) {
    console.log(`📡 Odesílám do Firebase: ID: ${eventId}, Datum: ${newDate}, Parta: ${newParty}`);

    try {
        const response = await fetch("https://us-central1-kalendar-831f8.cloudfunctions.net/updateAppSheetEvent", {
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
    } catch (error) {
        console.error("❌ Chyba při aktualizaci události:", error);
    }
}



    // 🟢 4️⃣ Uložení nové party
    savePartyButton.addEventListener("click", async function () {
        if (selectedEvent) {
            let selectedPartyId = partySelect.value;
            let selectedPartyName = partyMap[selectedPartyId]?.name || "Neznámá parta";
            let selectedPartyColor = partyMap[selectedPartyId]?.color || "#145C7E";

            console.log("🟢 Nové ID party:", selectedPartyId);
            console.log("🟢 Název party:", selectedPartyName);
            console.log("🟢 Barva party:", selectedPartyColor);

            const updatedEvent = allEvents.find(event => event.id === selectedEvent.id);
            if (updatedEvent) {
                updatedEvent.party = selectedPartyId;
                updatedEvent.color = selectedPartyColor;
                selectedEvent.setExtendedProp("party", selectedPartyId);
                selectedEvent.setProp("title", selectedEvent.title.split(" (")[0]);
                selectedEvent.setProp("backgroundColor", selectedPartyColor);

                await updateAppSheetEvent(updatedEvent.id, selectedEvent.startStr, selectedPartyId);
                modal.style.display = "none";
            } else {
                console.log("❌ Událost nebyla nalezena!");
            }
        } else {
            console.log("❌ `selectedEvent` je null!");
        }
    });

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

    // 🟢 6️⃣ Automatické sledování změn
async function listenForUpdates() {
    console.log("🔄 Zahajuji kontrolu změn...");

    async function checkForChanges() {
        try {
            const response = await fetch(`${API_BASE_URL}/checkRefreshStatus`);
            const data = await response.json();

            if (data.type === "update") {
                console.log("✅ Změna detekována, aktualizuji kalendář...");
                fetchAppSheetData();
            } else {
                console.log("⏳ Žádná změna, kontroluji znovu za 5 sekund...");
            }

            setTimeout(checkForChanges, 5000);
        } catch (error) {
            console.error("❌ Chyba při kontrole změn:", error);
            setTimeout(checkForChanges, 5000);
        }
    }

    checkForChanges();
}


    // 🟢 7️⃣ Spustíme vše po načtení stránky
    fetchAppSheetData();
    listenForUpdates();
});

async function listenForUpdates() {
    console.log("🔄 Naslouchám změnám z webhooku...");
    
    // Webhook zavolá tuto URL při změně
    const webhookURL = "https://us-central1-kalendar-831f8.cloudfunctions.net/webhook";

    try {
        const eventSource = new EventSource(webhookURL);
        
        eventSource.onmessage = function (event) {
            console.log("📡 Webhook přijal změnu:", event.data);
            fetchAppSheetData(); // 🔄 Aktualizace kalendáře
        };

        eventSource.onerror = function (error) {
            console.error("❌ Chyba Webhook EventSource:", error);
            eventSource.close();
        };
        
    } catch (error) {
        console.error("❌ Chyba při navázání spojení s webhookem:", error);
    }
}

// 🟢 Spustíme naslouchání na změny
listenForUpdates();

