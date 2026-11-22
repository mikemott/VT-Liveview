/**
 * Temp - a temperature reading in °F with a smaller, muted °C beside it (VTL-98).
 *
 * Used for measured readings in detail panels and the expanded weather card.
 * Map labels, forecast strips, normals and differences stay °F only, so the
 * second unit never crowds the map.
 */
import { bothUnits } from '../utils/temperature';
import './Temp.css';

interface TempProps {
  /** The reading as the source reports it */
  value: number;
  /** Unit of `value`: 'F' (default) or 'C'; NOAA observations can come in either */
  unit?: string;
  className?: string;
}

export default function Temp({ value, unit = 'F', className }: TempProps) {
  const { f, c } = bothUnits(value, unit);
  return (
    <span className={className ? `temp ${className}` : 'temp'}>
      {f}°F<span className="temp-alt"> {c}°C</span>
    </span>
  );
}
