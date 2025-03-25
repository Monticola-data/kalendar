// calendar.js
import { state } from './state.js';
import { db } from './firebase.js';
import { filterAndRenderEvents } from './events.js';
import { updateEventField } from './events.js';

export function getPartyName(partyId) {
    return state.partyMap[partyId]?.name || '';
}

export function renderCalendar(view = null) {
    const savedView = view || localStorage.getItem('selectedCalendarView') || 'dayGridMonth';

    state.calendar = new FullCalendar.Calendar(state.calendarEl, {
        initialView: savedView,
        editable: true,
        locale: 'cs',
        buttonText: {
            today: 'dnes',
            month: 'měsíc'
        },
        views: {
            listFourWeeks: {
                type: 'list',
                duration: { weeks: 4 },
                buttonText: 'seznam',
                visibleRange: function(currentDate) {
                    let start = new Date(currentDate);
                    start.setDate(start.getDate() - (start.getDay() + 6) % 7);

                    let end = new Date(start);
                    end.setDate(end.getDate() + 28);

                    return { start, end };
                }
            },
            aktualni: {
                type: 'dayGrid',
                duration: { weeks: 4 },
                buttonText: 'aktuální',
                visibleRange: function(currentDate) {
                    let start = new Date(currentDate);
                    start.setDate(start.getDate() - (start.getDay() + 6) % 7);

                    let end = new Date(start);
                    end.setDate(end.getDate() + 28);

                    return { start, end };
                }
            }   
        },
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,aktualni,listFourWeeks'
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
                events: state.allEvents
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
                events: state.omluvenkyEvents
            }
        ],
        eventAllow: function(dropInfo, draggedEvent) {
            const { hotove, predane } = draggedEvent.extendedProps;
            return !(hotove || predane);
        },
        eventDrop: function(info) {
            const eventId = info.event.id;
            const newDate = info.event.startStr;
            const originalCas = info.oldEvent.extendedProps.cas;
            const cas = originalCas !== undefined ? Number(originalCas) : 0;

            info.event.setProp('editable', false);
            info.event.setProp('opacity', 0.6);

            (async () => {
                try {
                    await db.collection("events").doc(eventId).update({
                        start: newDate,
                        "extendedProps.cas": cas
                    });

                    await fetch("https://us-central1-kalendar-831f8.cloudfunctions.net/updateAppSheetFromFirestore", {
                        method: "POST",
                        body: JSON.stringify({ eventId, start: newDate, cas }),
                        headers: { 'Content-Type': 'application/json' }
                    });

                    console.log(`✅ Datum (${newDate}) a čas (${cas}) aktualizovány.`);
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
                state.selectedEvent = info.event;

                const { hotove, predane, odeslane, zakaznik, cinnost, detail, cas } = state.selectedEvent.extendedProps;
                const currentStredisko = state.strediskoFilter.value;
                const modalEventInfo = document.getElementById('modalEventInfo');
                const detailButton = document.getElementById('detailButton');
                const casSelect = document.getElementById('casSelect');
                const partySelect = document.getElementById('partySelect');
                
                modalEventInfo.innerHTML = `
                    <div style="padding-bottom:5px; margin-bottom:5px; border-bottom:1px solid #ddd;">
                        🚧 ${zakaznik || ''} - ${cinnost || ''} - ${getPartyName(state.selectedEvent.extendedProps.party)}
                    </div>`;

                detailButton.style.display = detail ? "inline-block" : "none";
                if (detail) detailButton.onclick = () => window.open(detail, '_blank');

                partySelect.innerHTML = "";
                Object.entries(state.partyMap).forEach(([id, party]) => {
                    if (currentStredisko === "vše" || party.stredisko === currentStredisko) {
                        const option = document.createElement("option");
                        option.value = id;
                        option.textContent = party.name;
                        option.selected = id === state.selectedEvent.extendedProps.party;
                        partySelect.appendChild(option);
                    }
                });

                casSelect.value = cas || 0;

                partySelect.disabled = hotove || predane || odeslane;
                casSelect.disabled = hotove || predane;

                partySelect.onchange = async () => {
                    const newParty = partySelect.value;
                    const selectedParty = state.partyMap[newParty];
                    await updateEventField(state.selectedEvent.id, {
                        party: newParty,
                        color: selectedParty.color
                    }, { party: newParty });
                };

                casSelect.onchange = async () => {
                    const newCas = (casSelect.value !== "" && !isNaN(casSelect.value))
                        ? Number(casSelect.value)
                        : cas;

                    await updateEventField(state.selectedEvent.id, {
                        'extendedProps.cas': newCas
                    }, { cas: newCas });
                };

                state.modal.style.display = state.modalOverlay.style.display = "block";
            }
        },
        eventContent: function(arg) {
            //... zde pokračuje tvůj původní kód bez změn ...
        }
    });

    state.calendar.render();

    state.modalOverlay.onclick = () => {
        state.modal.style.display = "none";
        state.modalOverlay.style.display = "none";
    };
}
