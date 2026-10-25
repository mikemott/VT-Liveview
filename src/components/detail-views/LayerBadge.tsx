/**
 * The layer a detail panel belongs to: its icon and name in the layer color,
 * so the panel matches the chip and the marker that opened it (VTL-64).
 */
import { LAYER_STYLES, layerColorVars, type LayerStyleKey } from '../../config/layers';

interface LayerBadgeProps {
  layer: LayerStyleKey;
  /** Overrides the layer's chip label (e.g. "Accident" instead of "Accidents") */
  label?: string;
}

export default function LayerBadge({ layer, label }: LayerBadgeProps) {
  const { icon: Icon, label: chipLabel } = LAYER_STYLES[layer];
  return (
    <div className="layer-badge" style={layerColorVars(layer)} data-layer={layer}>
      <Icon size={14} strokeWidth={2.5} aria-hidden="true" />
      <span>{label ?? chipLabel}</span>
    </div>
  );
}
