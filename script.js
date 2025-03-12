document.getElementById("viewSelect").addEventListener("change", function() {
    calendar.changeView(this.value);
});

let calendar; // Definujeme proměnnou pro kalendář globálně
let selectedEvent = null;
let allEvents = [];
let partyMap = {};

const isLocal = window.location.hostname === "localhost";
const API_BASE_URL = isLocal
    ? "http://127.0.0.1:5001/kalendar-831f8/us-central1"
    : "https://us-central1-kalendar-831f8.cloudfunctions.net";

// 🟢 1️⃣ Načtení dat z backendu
async function fetchAppSheetData() {
    try {
        const response = await fetch(`${API_BASE_URL}/fetchAppSheetData`, { method: "GET" });
        if (!response.ok) throw new Error(response.statusText);

        const data = await response.json();
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
    calendar = new FullCalendar.Calendar(document.getElementById('calendar'), {
        initialView: 'dayGridMonth',
        editable: true,
        locale: 'cs',
        height: 'auto',
        events: allEvents,

        eventDrop: async function(info) {
            await updateAppSheetEvent(info.event.id, info.event.startStr, info.event.extendedProps.party || null);
        },

        eventClick: function(info) {
            selectedEvent = info.event;
            let modal = document.getElementById('eventModal');
            let partySelect = document.getElementById('partySelect');
            partySelect.innerHTML = "";

            Object.entries(partyMap).forEach(([id, party]) => {
                let option = document.createElement("option");
                option.value = id;
                option.textContent = party.name;
                option.selected = id === info.event.extendedProps.party;
                partySelect.appendChild(option);
            });

            let detailButton = document.getElementById("detailButton");
            if (info.event.extendedProps.detail) {
                detailButton.style.display = "block";
                detailButton.onclick = () => window.open(info.event.extendedProps.detail, "_blank");
            } else {
                detailButton.style.display = "none";
            }

            modal.style.display = "block";
        },

        eventContent: function(arg) {
            let icon = arg.event.extendedProps.predane ? "✍️" : arg.event.extendedProps.hotove ? "✅" : arg.event.extendedProps.odeslane ? "📩" : "";
            let title = icon ? arg.event.title.toUpperCase() : arg.event.title;
            return { html: `<b>${icon}</b> ${title}` };
        }
    });
    calendar.render();
}

// 🟢 3️⃣ Aktualizace události v AppSheet přes API
async function updateAppSheetEvent(eventId, newDate, newParty = null) {
    try {
        await fetch(`${API_BASE_URL}/updateAppSheetEvent`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({ id: eventId, start: newDate, party: newParty })
        });
    } catch (error) {
        console.error("❌ Chyba při aktualizaci události:", error);
    }
}

// 🟢 4️⃣ Uložení nové party
 document.getElementById('saveParty').addEventListener("click", async function() {
    const modal = document.getElementById('eventModal');
    const partySelect = document.getElementById('partySelect');

    if (selectedEvent) {
        const updatedEvent = allEvents.find(event => event.id === selectedEvent.id);
        if (updatedEvent) {
            await updateAppSheetEvent(updatedEvent.id, selectedEvent.startStr, partySelect.value);
            modal.style.display = "none";
            fetchAppSheetData();
        }
    } // ⬅️ správně uzavřený if-blok
});   // ⬅️ správně uzavřená funkce addEventListener

// 🟢 5️⃣ Filtrace podle party
function populateFilter() {
    const partyFilter = document.getElementById('partyFilter');
    partyFilter.innerHTML = '<option value="">Všechny</option>';
    Object.entries(partyMap).forEach(([id, party]) => {
        let option = document.createElement("option");
        option.value = id;
        option.textContent = party.name;
        partyFilter.appendChild(option);
    });

    partyFilter.addEventListener("change", function() {
        calendar.removeAllEvents();
        const filteredEvents = this.value ? allEvents.filter(e => e.party === this.value) : allEvents;
        calendar.addEventSource(filteredEvents);
    });
}

// 🟢 6️⃣ Legenda part
function renderLegend() {
    const legend = document.getElementById("legend");
    legend.innerHTML = '';

    Object.entries(partyMap).forEach(([id, party]) => {
        let item = document.createElement("div");
        item.className = "legend-item";
        item.style.backgroundColor = party.color;
        item.textContent = party.name;
        legend.appendChild(item);
    });
}

// 🟢 7️⃣ Zavření modálu po kliknutí mimo něj
 document.addEventListener("click", function(event) {
    const modal = document.getElementById("eventModal");
    if (modal.style.display === "block" &&
        !modal.contains(event.target) &&
        !event.target.closest(".fc-event") &&
        !event.target.closest(".fc-daygrid-event-harness")) {
        modal.style.display = "none";
    }
});

// 🟢 6️⃣ Automatické sledování změn z backendu
async function listenForUpdates() {
    const response = await fetch(`${API_BASE_URL}/checkRefreshStatus`);
    const data = await response.json();

    if (data.type === "update") fetchAppSheetData();
    setTimeout(listenForUpdates, 5000);
}

// 🟢 Inicializace
window.addEventListener('DOMContentLoaded', () => {
    fetchAppSheetData();
    listenForUpdates();
});

