import { useEffect, useState } from "react";

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

export default function MonthCalendar() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60 * 1000);
    return () => window.clearInterval(id);
  }, []);

  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();

  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="month-calendar">
      <p className="month-calendar__title">
        {year}年{month + 1}月
      </p>
      <div className="month-calendar__weekdays">
        {WEEKDAY_LABELS.map((label) => (
          <span key={label} className="month-calendar__weekday">
            {label}
          </span>
        ))}
      </div>
      <div className="month-calendar__grid">
        {cells.map((day, index) => (
          <span
            key={index}
            className={
              day === today ? "month-calendar__cell month-calendar__cell--today" : "month-calendar__cell"
            }
          >
            {day ?? ""}
          </span>
        ))}
      </div>
    </div>
  );
}
