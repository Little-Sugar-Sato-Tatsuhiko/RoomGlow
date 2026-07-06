interface Props {
  sunrise?: string | null;
  sunset?: string | null;
}

export default function SunTimes({ sunrise, sunset }: Props) {
  if (!sunrise || !sunset) return null;

  return (
    <div className="sun-times">
      <span className="sun-times__item">🌅 {sunrise}</span>
      <span className="sun-times__item">🌇 {sunset}</span>
    </div>
  );
}
