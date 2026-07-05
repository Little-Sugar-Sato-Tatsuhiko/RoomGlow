import { useEffect, useState } from "react";

export default function ClockWidget() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const time = now.toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const date = now.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });

  return (
    <div className="clock-widget">
      <div className="clock-widget__time">{time}</div>
      <div className="clock-widget__date">{date}</div>
    </div>
  );
}
