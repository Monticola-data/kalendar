import { db } from './firebase.js';

// 🚀 COMPAT verze Firebase (není potřeba importovat moduly)
let calendarEl, modal, partySelect, savePartyButton, partyFilter;
let allEvents = [], partyMap = {}, selectedEvent = null, calendar;

async function fetchFirestoreParties() {
    const snapshot = await db.collection("parties").get();
    partyMap = snapshot.docs.reduce((map, doc) => {
        map[doc.id] = doc.data();
        return map;
    }, {});
    populateFilter();
}

export async function fetchFirestoreEvents(userEmail) {

    await fetchFirestoreParties();
    
    const eventsSnapshot = await db.collection('events').get();
    
    const allFirestoreEvents = eventsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            title: data.title,
            start: new Date(data.start).toISOString().split('T')[0], // ✅ Vloženo sem
            color: data.color,
            party: data.party,
            extendedProps: data.extendedProps || {}
        };
    });

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


async function updateFirestoreEvent(eventId, updates = {}) {
    await firebase.firestore().collection("events").doc(eventId).set(updates, { merge: true });
    console.log("✅ Data uložena do Firestore:", updates);
}

function renderCalendar(view = null) {
    const savedView = view || localStorage.getItem('selectedCalendarView') || 'dayGridMonth';

    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: savedView,
        editable: true,
        locale: 'cs',
        height: 'auto',
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
        eventDrop: async function(info) {
            try {
                await fetch("https://us-central1-kalendar-831f8.cloudfunctions.net/updateAppSheetFromFirestore", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        eventId: info.event.id,
                        start: info.event.startStr,
                        party: info.event.extendedProps.party
                    })
                });
                console.log("✅ Změna poslána do AppSheet!");
            } catch (err) {
                console.error("❌ Chyba při odeslání do AppSheet:", err);
                info.revert();
            }
        },
        eventClick: async function (info) {
            if (info.event.extendedProps?.SECURITY_filter) {
                selectedEvent = info.event;

                const partiesSnapshot = await firebase.firestore().collection("parties").get();
                const parties = partiesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                partySelect.innerHTML = "";
                parties.forEach(party => {
                    const option = document.createElement("option");
                    option.value = party.id;
                    option.textContent = party.name;
                    option.selected = party.id === info.event.extendedProps.party;
                    partySelect.appendChild(option);
                });

                partySelect.onchange = async (e) => {
                    const selectedParty = parties.find(p => p.id === e.target.value);
                    if (selectedParty) {
                        try {
                            await firebase.firestore().collection("events").doc(info.event.id).update({
                                party: selectedParty.id,
                                color: selectedParty.color
                            });
                            await fetch("https://us-central1-kalendar-831f8.cloudfunctions.net/updateAppSheetFromFirestore", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                    eventId: info.event.id,
                                    party: selectedParty.id
                                })
                            });
                            calendar.refetchEvents();
                            console.log("✅ Party změněna a aktualizována.");
                        } catch (error) {
                            console.error("❌ Chyba při změně party:", error);
                        }
                    }
                };

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
        const option = document.createElement("option");
        option.value = id;
        option.textContent = party.name;
        partyFilter.appendChild(option);
    });

    partyFilter.onchange = () => {
        const selectedParty = partyFilter.value;
        calendar.removeAllEvents();
        calendar.addEventSource(selectedParty === "all" ? allEvents : allEvents.filter(event => event.party === selectedParty));
    };
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
            await updateFirestoreEvent(selectedEvent.id, { party: partySelect.value });
            modal.style.display = "none";
        }
    };
});

export function listenForUpdates(userEmail) {
    firebase.firestore().collection('events').onSnapshot((snapshot) => {
        const normalizedUserEmail = userEmail.trim().toLowerCase();

        allEvents = snapshot.docs.map(doc => ({
            id: doc.id, ...doc.data()
        })).filter(event => event.extendedProps?.SECURITY_filter?.map(e => e.toLowerCase()).includes(normalizedUserEmail));

        populateFilter();
        calendar.removeAllEvents();
        calendar.addEventSource(allEvents);
    });
}

