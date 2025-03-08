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
    try {
        console.log("📡 Odesílám požadavek na backend...");

        const response = await fetch("https://us-central1-kalendar-831f8.cloudfunctions.net/fetchAppSheetData");

        if (!response.ok) {
            throw new Error(`Chyba API: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        console.log("🔥 Data přijatá z Firebase:", data);

        // ✅ Ověříme, že `data.events` existuje a je pole
        if (!data.events || !Array.isArray(data.events)) {
            throw new Error("❌ Chyba: Data z backendu nejsou ve správném formátu.");
        }

        // ✅ Přidáme kontrolu, jestli správně získáváme názvy klíčů
        console.log("🔍 První objekt z dat pro kontrolu:", data.events[0]);

        // ✅ Správné mapování dat
        allEvents = data.events.map(event => {
            let id = event["Row ID"] || event["id"] || "Neznámé ID"; // Oprava chybějícího ID
            let title = event["Obec"] || event["title"] || "Neznámá obec";
            let start = formatDate(event["Datum"] || event["start"]); // Formátujeme datum
            let partaColor = partyMap[event["Parta"]] ? partyMap[event["Parta"]].color : "#145C7E"; // Barva party

            let transformedEvent = {
                id: id,
                title: title,
                start: start,
                color: partaColor,
                extendedProps: {
                    status: event["Status"] || "Neznámý status",
                    odeslane: event["Odeslané"] === "Y",
                    hotove: event["Hotové"] === "Y",
                    predane: event["Předané"] === "Y",
                    detail: event["Detail"] || ""
                }
            };

            console.log("📌 Transformovaná událost pro kalendář:", transformedEvent);
            return transformedEvent;
        });

        // ✅ Uložíme mapu party
        partyMap = data.partyMap || {};

        console.log("📅 Formátovaná data pro kalendář:", allEvents);

        renderCalendar();
        populateFilter();
        renderLegend();
    } catch (error) {
        console.error("❌ Chyba při načítání dat z backendu:", error);
    }
}



    // ✅ Funkce pro formátování data (YYYY-MM-DD)
function formatDate(dateStr) {
    if (!dateStr || typeof dateStr !== "string") return null;

    let parts = dateStr.split("/");
    if (parts.length !== 3) return null;

    let day = parseInt(parts[0]);
    let month = parseInt(parts[1]);
    let year = parts[2];

    if (year.length === 2) {
        year = `20${year}`;
    }

    // Pokud je den větší než 12, pravděpodobně je ve formátu DD/MM/YYYY
    if (day > 12) {
        [day, month] = [month, day];
    }

    return `${year}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}



// 🟢 2️⃣ Funkce pro zobrazení kalendáře
function renderCalendar() {
    console.log("📅 Rendering kalendář s událostmi:", allEvents);

    let eventsForCalendar = allEvents.map(event => ({
        id: event.id,
        title: event.title || "Neznámá obec",
        start: event.start, // ✅ Data už jsou správně formátovaná
        color: event.color, // ✅ Barva správně přiřazena
        extendedProps: event.extendedProps
    }));

    console.log("📌 Data poslaná do FullCalendar:", eventsForCalendar);

    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        editable: true,
        locale: 'cs',
        height: 'auto',
        contentHeight: 'auto',
        aspectRatio: 1.8,
        events: eventsForCalendar,

        // 🟢 Přesunutí události v kalendáři (drag & drop)
        eventDrop: async function (info) {
            const updatedEvent = {
                id: info.event.id,
                start: info.event.startStr,
                party: info.event.extendedProps.party || null
            };

            console.log("🔄 Událost přesunuta:", updatedEvent);

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

    console.log("📌 Události poslané do kalendáře:", eventsForCalendar);
    calendar.render();
}


    // 🟢 3️⃣ Aktualizace události v AppSheet přes API
async function updateAppSheetEvent(eventId, newDate, newParty = null) {
    try {
        console.log(`📡 Odesílám do Firebase: ID: ${eventId}, Datum: ${newDate}, Parta: ${newParty}`);

        const response = await fetch(`${API_BASE_URL}/updateAppSheetEvent`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ eventId, newDate, newParty })
        });

        const responseData = await response.json();
        console.log("✅ Odpověď z Firebase API:", responseData);

        fetchAppSheetData(); // 🟢 Po úspěšné aktualizaci načteme nové údaje
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
    console.log("🔄 Zahajuji kontrolu změn...");

    async function checkForChanges() {
        try {
            const response = await fetch("https://us-central1-kalendar-831f8.cloudfunctions.net/checkRefreshStatus");
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

