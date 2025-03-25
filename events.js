// events.js
import { db } from './firebase.js';
import { state } from './state.js';

export async function updateEventField(eventId, firestoreUpdate, appsheetPayload) {
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

export function filterAndRenderEvents() {
    if (!state.calendar) return;

    const selectedParty = state.partyFilter.value;
    const selectedStredisko = state.strediskoFilter.value;

    const statusChecks = document.querySelectorAll('#statusFilter input[type=checkbox]');
    const selectedStatuses = Array.from(statusChecks)
                                  .filter(chk => chk.checked)
                                  .map(chk => chk.value);

    const filteredEvents = state.allEvents.filter(event => {
        const partyMatch = selectedParty === "all" || event.party === selectedParty;
        const strediskoMatch = selectedStredisko === "vše" || event.stredisko === selectedStredisko;

        const { hotove = false, predane = false, odeslane = false } = event.extendedProps;

        let statusMatch = false;

        if (selectedStatuses.includes("kOdeslani") && !hotove && !predane && !odeslane) {
            statusMatch = true;
        } else if (selectedStatuses.includes("odeslane") && odeslane && !hotove && !predane) {
            statusMatch = true;
        } else if (selectedStatuses.includes("hotove") && hotove && !predane) {
            statusMatch = true;
        } else if (selectedStatuses.includes("predane") && predane) {
            statusMatch = true;
        }

        return partyMatch && strediskoMatch && statusMatch;
    });

    const omluvenkyFiltered = state.omluvenkyEvents.filter(event => {
        const partyMatch = selectedParty === "all" || event.parta === selectedParty;
        const strediskoMatch = selectedStredisko === "vše" || event.stredisko === selectedStredisko;
        return partyMatch && strediskoMatch;
    });

    state.calendar.batchRendering(() => {
        state.calendar.removeAllEvents();

        filteredEvents.forEach(evt => state.calendar.addEvent(evt));
        omluvenkyFiltered.forEach(evt => state.calendar.addEvent(evt));

        state.calendar.getEventSources()
            .filter(src => src.id === 'holidays')
            .forEach(src => src.remove());

        state.calendar.addEventSource({
            id: 'holidays',
            googleCalendarApiKey: 'AIzaSyBA8iIXOCsGuTXeBvpkvfIOZ6nT1Nw4Ugk',
            googleCalendarId: 'cs.czech#holiday@group.v.calendar.google.com',
            display: 'background',
            color: '#854646',
            textColor: '#000',
            className: 'holiday-event',
            extendedProps: { isHoliday: true }
        });
    });
}
