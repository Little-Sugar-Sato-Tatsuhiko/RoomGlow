interface CalendarEvent {
  title: string;
  time: string;
}

interface Props {
  events?: CalendarEvent[];
}

export default function CalendarWidget({ events }: Props) {
  if (!events || events.length === 0) return null;

  return (
    <ul className="calendar-widget">
      {events.map((event, index) => (
        <li key={index} className="calendar-widget__event">
          <span className="calendar-widget__time">{event.time}</span> {event.title}
        </li>
      ))}
    </ul>
  );
}
