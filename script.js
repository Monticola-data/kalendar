import { db } from './firebase.js';
import { collection, doc, getDocs, setDoc, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js';

let calendarEl, modal, partySelect, savePartyButton, partyFilter, allEvents = [], partyMap = {}, selectedEvent = null, calendar;

export async function fetchFirestoreEvents(userEmail) {
    const eventsCol = collection(db, 'events');
    const eventsSnapshot = await getDocs(eventsCol);
    const allFirestoreEvents = eventsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const normalizedUserEmail = userEmail.trim().toLowerCase();

    allEvents = allFirestoreEvents.filter(event => {
        const security = event.extendedProps?.SECURITY_filter || [];
        return security.map(e => e.toLowerCase()).includes(normalizedUserEmail);
    });

    populateFilter();

    if (calendar) {
        calendar.removeAllEvents();
        calendar.addEventSource(allEvents);
        calendar.render();
    } else {
        renderCalendar();
        renderLegend();
    }

    console.log("✅ Data načtena z Firestore:", allEvents);
}

async function updateFirestoreEvent(eventId, { Datum = null, Parta = null } = {}) {
    const updates = {};
    if (Datum) updates.start = Datum;
    if (Parta) updates.party = Parta;

    await setDoc(doc(db, "events", eventId), updates, { merge: true });
    console.log("✅ Data uložena do Firestore:", updates);
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
        eventDrop: async function (info) {
            const newDate = info.event.startStr.split('T')[0];
            await updateFirestoreEvent(info.event.id, { Datum: newDate });
        },
        eventClick: function (info) {
            if (info.event.extendedProps?.SECURITY_filter) {
                selectedEvent = info.event;
                partySelect.innerHTML = "";

                Object.entries(partyMap).forEach(([id, party]) => {
                    const option = document.createElement("option");
                    option.value = id;
                    option.textContent = party.name;
                    option.selected = id === info.event.extendedProps.party;
                    partySelect.appendChild(option);
                });

                const detailButton = document.getElementById("detailButton");
                detailButton.style.display = info.event.extendedProps.detail ? "block" : "none";
                detailButton.onclick = () => window.open(info.event.extendedProps.detail, "_blank");

                modal.style.display = "block";
            } else {
                console.log("⛔ Ignoruji kliknutí na událost bez SECURITY_filter");
            }
        },
        eventContent: function (arg) {
            let icon = "";
            if (arg.event.extendedProps.predane) icon = "✍️";
            else if (arg.event.extendedProps.hotove) icon = "✅";
            else if (arg.event.extendedProps.odeslane) icon = "📩";

            const title = arg.event.extendedProps.predane || arg.event.extendedProps.hotove || arg.event.extendedProps.odeslane ? arg.event.title.toUpperCase() : arg.event.title;

            return { html: `<b>${icon}</b> ${title}` };
        }
    });

    calendar.render();
}

function populateFilter() {
    partyFilter.innerHTML = '<option value="all">Všechny party</option>';

    Object.entries(partyMap).forEach(([id, party]) => {
        let option = document.createElement("option");
        option.value = id;
        option.textContent = party.name;
        partyFilter.appendChild(option);
    });

    partyFilter.addEventListener("change", () => {
        const selectedParty = partyFilter.value;
        calendar.removeAllEvents();
        calendar.addEventSource(selectedParty === "all" ? allEvents : allEvents.filter(event => event.party === selectedParty));
    });
}

document.addEventListener('DOMContentLoaded', () => {
    calendarEl = document.getElementById('calendar');
    modal = document.getElementById('eventModal');
    partySelect = document.getElementById('partySelect');
    savePartyButton = document.getElementById('saveParty');
    partyFilter = document.getElementById('partyFilter');

    renderCalendar();

    savePartyButton.onclick = async () => {
        if (selectedEvent) {
            const partyId = partySelect.value;
            await updateFirestoreEvent(selectedEvent.id, { Parta: partyId });
            modal.style.display = "none";
        }
    };
});

export function listenForUpdates(userEmail) {
    const eventsCol = collection(db, 'events');

    onSnapshot(eventsCol, (snapshot) => {
        const allFirestoreEvents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const normalizedUserEmail = userEmail.trim().toLowerCase();

        allEvents = allFirestoreEvents.filter(event => {
            const security = event.extendedProps?.SECURITY_filter || [];
            return security.map(e => e.toLowerCase()).includes(normalizedUserEmail);
        });

        populateFilter();

        if (calendar) {
            calendar.removeAllEvents();
            calendar.addEventSource(allEvents);
            calendar.render();
        } else {
            renderCalendar();
            renderLegend();
        }

        console.log("✅ Realtime data z Firestore načtena:", allEvents);
    });
}

export { updateFirestoreEvent };
