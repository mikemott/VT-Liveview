/**
 * SkiWebcam - a resort's base-area camera in the ski panel (VTL-87)
 *
 * Live players (YouTube, Brown Rice, Roundshot) show a preview and load only
 * when tapped; HDRelay shows its latest still. Credited and linked to the
 * resort. Nothing here copies the resort's images.
 */
import { useState } from 'react';
import { Play, Video } from 'lucide-react';
import {
  SKI_WEBCAMS,
  webcamEmbed,
  webcamPreview,
  type SkiWebcam as Camera,
} from '../../data/skiWebcams';
import './DetailViews.css';

interface SkiWebcamProps {
  resortId: string;
  resortName: string;
}

const YT_FALLBACK = /hqdefault_live\.jpg$/;

function CameraTile({ camera, resortName }: { camera: Camera; resortName: string }) {
  const [playing, setPlaying] = useState(false);
  const [preview, setPreview] = useState<string | null>(() => webcamPreview(camera));
  const embed = webcamEmbed(camera);
  const live = embed !== null;

  const onImageError = (): void => {
    // A YouTube stream that isn't live has no _live thumbnail: try the plain one
    if (preview && YT_FALLBACK.test(preview))
      setPreview(preview.replace(YT_FALLBACK, 'hqdefault.jpg'));
    else setPreview(null);
  };

  const picture = preview ? (
    <img
      className="ski-cam-image"
      src={preview}
      alt={`${resortName} base camera`}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={onImageError}
    />
  ) : (
    <span className="ski-cam-placeholder">
      <Video size={22} aria-hidden="true" />
      <span>{camera.provider === 'roundshot' ? '360° panorama' : 'Camera image unavailable'}</span>
    </span>
  );

  return (
    <figure className="ski-cam">
      <div className="ski-cam-frame">
        {playing && embed ? (
          <iframe
            className="ski-cam-player"
            src={embed}
            title={`${resortName} — ${camera.name} (live)`}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : live ? (
          <button
            type="button"
            className="ski-cam-play"
            onClick={() => setPlaying(true)}
            aria-label={`Play ${resortName} live camera`}
          >
            {picture}
            <span className="ski-cam-play-icon" aria-hidden="true">
              <Play size={22} fill="currentColor" />
            </span>
          </button>
        ) : (
          picture
        )}
      </div>
      <figcaption className="ski-cam-caption">
        <span>
          {live ? 'Live' : 'Latest still'} · {camera.name}
        </span>
        <a href={camera.page} target="_blank" rel="noopener noreferrer">
          {live ? `${resortName} cams` : `Live view at ${resortName}`} ↗
        </a>
      </figcaption>
    </figure>
  );
}

export default function SkiWebcam({ resortId, resortName }: SkiWebcamProps) {
  const entry = SKI_WEBCAMS[resortId];
  if (!entry) return null;
  if (!entry.camera) {
    return (
      <p className="ski-cam-link">
        <a href={entry.page} target="_blank" rel="noopener noreferrer">
          Webcams at {resortName} ↗
        </a>
      </p>
    );
  }
  // key: a different resort starts fresh (not playing, new preview)
  return <CameraTile key={resortId} camera={entry.camera} resortName={resortName} />;
}
