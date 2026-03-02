interface DestinationMarkerProps {
  x: number;
  y: number;
}

export default function DestinationMarker({ x, y }: DestinationMarkerProps) {
  return <div className="destination-marker" style={{ left: x, top: y }} aria-hidden="true" />;
}
