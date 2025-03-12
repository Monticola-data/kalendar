document.getElementById("viewSelect").addEventListener("change", function() {
    calendar.changeView(this.value);
});

let calendar;
let selectedEvent = null;
let allEvents = [];
let partyMap = {};

const isLocal = window.location.hostname === "localhost";
const API_BASE_URL = isLocal
    ? "http://127.0.0.1:5001/backend-kalendar/us-central1"
    : "https://us-central1-backend-kalendar.cloudfunctions.net";

// 🟢 Načtení dat z backendu
async function fetchAppSheetData() {
    try {
        const response = await fetch(`${API_BASE_URL}/fetchAppSheetData`);
        if (!response.ok) throw new Error(response.statusText);
        const data = await response.json();
        allEvents = data.events;
        partyMap = data.partyMap;
        renderCalendar();
        populateFilter();
        renderLegend();
    } catch (error) {
        console.error("❌ Chyba při načítání dat:", error);
    }
}

function renderCalendar() {
    calendar = new FullCalendar.Calendar(document.getElementById('calendar'), {
        initialView: 'dayGridMonth',
        editable: true,
        locale: 'cs',
        events: allEvents,
        eventDrop: async (info) => {
            await updateAppSheetEvent(info.event.id, info.event.startStr, info.event.extendedProps.party);
        },
        eventClick: function(info) {
            selectedEvent = info.event;
            const modal = document.getElementById('eventModal');
            const partySelect = document.getElementById('partySelect');
            partySelect.innerHTML = '';
            Object.entries(partyMap).forEach(([id, party]) => {
                let option = new Option(party.name, id, id === selectedEvent.extendedProps.party);
                partySelect.appendChild(option);
            });
            modal.style.display = 'block';
        },
        eventContent: function(arg) {
            let icon = arg.event.extendedProps.predane ? "✍️" :
                arg.event.extendedProps.hotove ? "✅" :
                arg.event.extendedProps.odeslane ? "📩" : "";
            let title = icon ? arg.event.title.toUpperCase() : arg.event.title;
            return { html: `<b>${icon}</b> ${title}` };
        }
    });
    calendar.render();
}

async function updateAppSheetEvent(eventId, newDate, newParty = null) {
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

        if (!response.ok) throw new Error(response.statusText);
        console.log("✅ Event aktualizován!");
    } catch (error) {
        console.error("❌ Chyba při aktualizaci události:", error);
    }
}

// Uložení party
document.getElementById('saveParty').addEventListener("click", async () => {
    if (selectedEvent) {
        const partySelect = document.getElementById('partySelect');
        await updateAppSheetEvent(selectedEvent.id, selectedEvent.startStr, partySelect.value);
        document.getElementById('eventModal').style.display = 'none';
        fetchAppSheetData();
    }
});

function populateFilter() {
    const filter = document.getElementById('partyFilter');
    filter.innerHTML = '<option value="">Všechny</option>';
    Object.entries(partyMap).forEach(([id, party]) => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = party.name;
        filter.appendChild(option);
    });
    filter.onchange = () => {
        calendar.removeAllEvents();
        const filtered = filter.value ? allEvents.filter(e => e.party === filter.value) : allEvents;
        calendar.addEventSource(filtered);
    };
}

function renderLegend() {
    const legend = document.getElementById('legend');
    legend.innerHTML = '';
    Object.entries(partyMap).forEach(([id, party]) => {
        let item = document.createElement('div');
        item.className = 'legend-item';
        item.style.backgroundColor = party.color;
        item.textContent = party.name;
        legend.appendChild(item);
    });
}

document.addEventListener('click', (event) => {
    const modal = document.getElementById('eventModal');
    if (modal.style.display === 'block' && !modal.contains(event.target) && !event.target.closest(".fc-event")) {
        modal.style.display = 'none';
    }
});

document.getElementById("viewSelect").onchange = function() {
    calendar.changeView(this.value);
};

window.addEventListener('DOMContentLoaded', () => {
    fetchAppSheetData();
    listenForUpdates();
});

