/**
 * SkiWebcam - a resort's base-area camera in the ski panel (VTL-87/88)
 *
 * The backend checks each camera; only working ones are shown. Live players
 * (YouTube, CamStreamer, Brown Rice, Roundshot) show a preview and load only
 * when tapped; stills show the latest frame. A camera that's off or broken
 * becomes a link to the resort's webcam page. Credited and linked to the
 * resort; nothing here copies the resort's images.
 */
import { useState } from 'react';
import { Play, Video } from 'lucide-react';
import { useSkiWebcams } from '../../hooks/useSkiWebcams';
import { previewUrl, type ResolvedWebcam } from '../../services/skiWebcamsApi';
import './DetailViews.css';

interface SkiWebcamProps {
  resortId: string;
  resortName: string;
}

const YT_LIVE = /hqdefault_live\.jpg$/;

function CameraTile({
  camera,
  page,
  resortName,
}: {
  camera: ResolvedWebcam;
  page: string;
  resortName: string;
}) {
  const [playing, setPlaying] = useState(false);
  const [preview, setPreview] = useState<string | null>(() => previewUrl(camera));
  const live = camera.embed !== null;

  const onImageError = (): void => {
    // A stream that isn't live has no _live thumbnail: try the plain one
    if (preview && YT_LIVE.test(preview)) setPreview(preview.replace(YT_LIVE, 'hqdefault.jpg'));
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
      <span>{camera.kind === 'panorama' ? '360° panorama' : 'Camera image unavailable'}</span>
    </span>
  );

  return (
    <figure className="ski-cam">
      <div className="ski-cam-frame">
        {playing && camera.embed ? (
          <iframe
            className="ski-cam-player"
            src={camera.embed}
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
        <a href={page} target="_blank" rel="noopener noreferrer">
          {live ? `${resortName} cams` : `Live view at ${resortName}`} ↗
        </a>
      </figcaption>
    </figure>
  );
}

export default function SkiWebcam({ resortId, resortName }: SkiWebcamProps) {
  const { data } = useSkiWebcams();
  const entry = data?.resorts[resortId];
  if (!entry) return null;
  if (!entry.camera) {
    return (
      <p className="ski-cam-link">
        {entry.status === 'offline' && <span>Base camera is off right now · </span>}
        <a href={entry.page} target="_blank" rel="noopener noreferrer">
          Webcams at {resortName} ↗
        </a>
      </p>
    );
  }
  // key: a different resort starts fresh (not playing, new preview)
  return (
    <CameraTile key={resortId} camera={entry.camera} page={entry.page} resortName={resortName} />
  );
}
