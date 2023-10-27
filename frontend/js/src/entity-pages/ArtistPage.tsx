import * as React from "react";
import { createRoot } from "react-dom/client";

import * as Sentry from "@sentry/react";
import { Integrations } from "@sentry/tracing";
import NiceModal from "@ebay/nice-modal-react";
import { toast, ToastContainer } from "react-toastify";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faHeadphones,
  faPlayCircle,
  faUserAstronaut,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { chain } from "lodash";
import tinycolor from "tinycolor2";
import { sanitize } from "dompurify";
import withAlertNotifications from "../notifications/AlertNotificationsHOC";
import GlobalAppContext from "../utils/GlobalAppContext";
import Loader from "../components/Loader";
import ErrorBoundary from "../utils/ErrorBoundary";
import {
  getAverageRGBOfImage,
  getPageProps,
  getReviewEventContent,
} from "../utils/utils";
import BrainzPlayer from "../brainzplayer/BrainzPlayer";
import TagsComponent from "../tags/TagsComponent";
import ListenCard from "../listens/ListenCard";
import OpenInMusicBrainzButton from "../components/OpenInMusicBrainz";
import {
  JSPFTrackToListen,
  MUSICBRAINZ_JSPF_TRACK_EXTENSION,
} from "../playlists/utils";
import { getRelIconLink } from "./utils";

export type ArtistPageProps = {
  popular_recordings?: Array<{
    artist_mbid: string;
    count: number;
    recording_mbid: string;
  }>;
  artist_tags?: ArtistTag[];
  artist: MusicBrainzArtist;
};

export default function ArtistPage(props: ArtistPageProps): JSX.Element {
  const { currentUser, APIService } = React.useContext(GlobalAppContext);
  const { artist: initialArtist, popular_recordings, artist_tags } = props;

  const [artist, setArtist] = React.useState(initialArtist);
  const [topListeners, setTopListeners] = React.useState([]);
  const [listenCount, setListenCount] = React.useState(0);
  const [reviews, setReviews] = React.useState<CritiqueBrainzReviewAPI[]>([]);
  const [wikipediaExtract, setWikipediaExtract] = React.useState<
    WikipediaExtract
  >();
  // Data we get from the back end, doesn't contain metadata
  const [popularRecordings, setPopularRecordings] = React.useState(
    popular_recordings
  );
  // JSPF Tracks fetched using the recording mbids above
  const [popularTracks, setPopularTracks] = React.useState<JSPFTrack[]>([]);
  const [loading, setLoading] = React.useState(false);

  /** Album art and album color related */
  const coverArtSrc = "/static/img/cover-art-placeholder.jpg";
  const albumArtRef = React.useRef<HTMLImageElement>(null);
  const [albumArtColor, setAlbumArtColor] = React.useState({
    r: 0,
    g: 0,
    b: 0,
  });
  React.useEffect(() => {
    const setAverageColor = () => {
      const averageColor = getAverageRGBOfImage(albumArtRef?.current);
      setAlbumArtColor(averageColor);
    };
    const currentAlbumArtRef = albumArtRef.current;
    if (currentAlbumArtRef) {
      currentAlbumArtRef.addEventListener("load", setAverageColor);
    }
    return () => {
      if (currentAlbumArtRef) {
        currentAlbumArtRef.removeEventListener("load", setAverageColor);
      }
    };
  }, [setAlbumArtColor]);

  const adjustedAlbumColor = tinycolor.fromRatio(albumArtColor);
  adjustedAlbumColor.saturate(20);
  adjustedAlbumColor.setAlpha(0.6);

  /** Navigation from one artist to a similar artist */
  //   const onClickSimilarArtist: React.MouseEventHandler<HTMLElement> = (
  //     event
  //   ) => {
  //     setLoading(true);
  //   	try{
  //     // Hit the API to get all the required info for the artist we clicked on
  //    const response = await fetch(…)
  //   if(!response.ok){
  // 	throw new Error(response.status);
  //   }
  //	setArtist(response.artist)
  //  setArtistTags(…)
  //  setPopularTracks(…)
  // }
  // catch(err){
  // toast.error(<ToastMsg title={"Could no load similar artist"} message={err.toString()})
  // }
  //     setLoading(false);
  //   };
  React.useEffect(() => {
    async function getRecordingMetadata() {
      const recordingMBIDs = popularRecordings
        ?.slice(0, 10)
        ?.map((rec) => rec.recording_mbid);
      if (!recordingMBIDs?.length) {
        return;
      }
      const recordingMetadataMap = await APIService.getRecordingMetadata(
        recordingMBIDs,
        true
      );
      if (recordingMetadataMap) {
        const tracks = Object.entries(recordingMetadataMap).map(
          ([mbid, metadata]) => {
            const trackObject: JSPFTrack = {
              identifier: `https://musicbrainz.org/recording/${mbid}`,
              title: metadata.recording?.name ?? mbid,
              creator: metadata.artist?.name ?? artist.name,
              duration: metadata.recording?.length,
              extension: {
                [MUSICBRAINZ_JSPF_TRACK_EXTENSION]: {
                  additional_metadata: {
                    caa_id: metadata.release?.caa_id,
                    caa_release_mbid: metadata.release?.caa_release_mbid,
                  },
                  added_at: "",
                  added_by: "ListenBrainz",
                },
              },
            };
            return trackObject;
          }
        );
        setPopularTracks(tracks);
      }
    }
    getRecordingMetadata();
  }, [popularRecordings]);

  React.useEffect(() => {
    async function fetchListenerStats() {
      try {
        const response = await fetch(
          `${APIService.APIBaseURI}/stats/artist/${artist.artist_mbid}/listeners`
        );
        const body = await response.json();
        if (!response.ok) {
          throw body?.message ?? response.statusText;
        }
        setTopListeners(body.payload.listeners);
        setListenCount(body.payload.total_listen_count);
      } catch (error) {
        toast.error(error);
      }
    }
    async function fetchReviews() {
      try {
        const response = await fetch(
          `https://critiquebrainz.org/ws/1/review/?limit=5&entity_id=${artist.artist_mbid}&entity_type=artist`
        );
        const body = await response.json();
        if (!response.ok) {
          throw body?.message ?? response.statusText;
        }
        setReviews(body.reviews);
      } catch (error) {
        toast.error(error);
      }
    }
    async function fetchWikipediaExtract() {
      try {
        const response = await fetch(
          `https://musicbrainz.org/artist/${artist.artist_mbid}/wikipedia-extract`
        );
        const body = await response.json();
        if (!response.ok) {
          throw body?.message ?? response.statusText;
        }
        setWikipediaExtract(body.wikipediaExtract);
      } catch (error) {
        toast.error(error);
      }
    }
    fetchListenerStats();
    fetchReviews();
    fetchWikipediaExtract();
  }, [artist]);

  const listensFromJSPFTracks = popularTracks.map(JSPFTrackToListen) ?? [];
  const filteredTags = chain(artist.tag?.artist)
    .filter("genre_mbid")
    .sortBy("count")
    .value()
    .reverse();

  return (
    <div
      id="artist-page"
      style={{ ["--bg-color" as string]: adjustedAlbumColor }}
    >
      <Loader isLoading={loading} />
      <div className="artist-page-header flex">
        <div className="cover-art">
          <img
            src={coverArtSrc}
            ref={albumArtRef}
            crossOrigin="anonymous"
            alt="Album art"
          />
          <OpenInMusicBrainzButton
            entityType="artist"
            entityMBID={artist.artist_mbid}
          />
        </div>
        <div className="artist-info">
          <h2>{artist.name}</h2>
          <div className="details">
            {artist.begin_year} — {artist.area}
          </div>
          {wikipediaExtract && (
            <div className="wikipedia-extract">
              <div
                className="content"
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{
                  __html: sanitize(wikipediaExtract.content),
                }}
              />
              <a
                className="btn btn-link pull-right"
                href={wikipediaExtract.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Read on Wikipedia…
              </a>
            </div>
          )}
        </div>
        <div className="right-side">
          <div className="artist-rels">
            {Object.entries(artist.rels).map(([relName, relValue]) =>
              getRelIconLink(relName, relValue)
            )}
          </div>
          <div className="btn-group btn-group-lg lb-radio-button">
            <a
              type="button"
              className="btn btn-info"
              href={`/explore/lb-radio/?prompt=artist:(${encodeURIComponent(
                artist.name
              )})&mode=easy`}
            >
              <FontAwesomeIcon icon={faPlayCircle} /> Radio
            </a>
            <button
              type="button"
              className="btn btn-info dropdown-toggle"
              data-toggle="dropdown"
              aria-haspopup="true"
              aria-expanded="false"
            >
              <span className="caret" />
              <span className="sr-only">Toggle Dropdown</span>
            </button>
            <ul className="dropdown-menu">
              <li>
                <a
                  target="_blank"
                  rel="noopener noreferrer"
                  href={`/explore/lb-radio/?prompt=artist:(${encodeURIComponent(
                    artist.name
                  )})::nosim&mode=easy`}
                >
                  This artist
                </a>
              </li>
              <li>
                <a
                  target="_blank"
                  rel="noopener noreferrer"
                  href={`/explore/lb-radio/?prompt=artist:(${encodeURIComponent(
                    artist.name
                  )})&mode=easy`}
                >
                  Similar artists
                </a>
              </li>
              {Boolean(filteredTags?.length) && (
                <li>
                  <a
                    target="_blank"
                    rel="noopener noreferrer"
                    href={`/explore/lb-radio/?prompt=tag:(${encodeURIComponent(
                      filteredTags.join(",")
                    )})::or&mode=easy`}
                  >
                    Tags (
                    <span className="tags-list">{filteredTags.join(",")}</span>)
                  </a>
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>
      <div className="tags">
        <TagsComponent
          key={artist.name}
          tags={filteredTags}
          entityType="artist"
          entityMBID={artist.name}
        />
      </div>
      <div className="artist-page-content">
        {Boolean(listensFromJSPFTracks?.length) && (
          <div className="tracks">
            <div className="header">
              <h3>Popular tracks</h3>
              <button
                type="button"
                className="btn btn-icon btn-info btn-rounded"
                title="Play popular tracks"
                onClick={() => {
                  window.postMessage(
                    {
                      brainzplayer_event: "play-listen",
                      payload: listensFromJSPFTracks,
                    },
                    window.location.origin
                  );
                }}
              >
                <FontAwesomeIcon icon={faPlayCircle} fixedWidth />
              </button>
            </div>
            {listensFromJSPFTracks?.map((listen) => {
              const recording = popularRecordings?.find(
                (rec) =>
                  rec.recording_mbid === listen.track_metadata.recording_mbid
              );
              let listenCountComponent;
              if (recording && Number.isFinite(recording.count)) {
                listenCountComponent = (
                  <>
                    {recording.count} x <FontAwesomeIcon icon={faHeadphones} />
                  </>
                );
              }
              return (
                <ListenCard
                  key={listen.track_metadata.track_name}
                  listen={listen}
                  showTimestamp={false}
                  showUsername={false}
                  additionalActions={listenCountComponent}
                />
              );
            })}
            <div className="read-more">
              <button type="button" className="btn btn-outline">
                See more…
              </button>
            </div>
          </div>
        )}
        <div className="stats">
          <div className="listening-stats card flex-center">
            <div className="text-center">
              <div className="number">
                {Intl.NumberFormat().format(listenCount)}
              </div>
              <div className="text-muted small">
                {/* <FontAwesomeIcon icon={faXmark} fixedWidth size="xs" /> */}
                <FontAwesomeIcon icon={faHeadphones} /> plays
              </div>
            </div>
            <div className="text-center">
              <div className="number">
                {Intl.NumberFormat().format(topListeners.length)}
              </div>
              <div className="text-muted small">
                {/* <FontAwesomeIcon icon={faXmark} fixedWidth size="xs" /> */}
                <FontAwesomeIcon icon={faUserAstronaut} /> listeners
              </div>
            </div>
          </div>
          {Boolean(topListeners?.length) && (
            <div className="top-listeners">
              <h3>Top listeners</h3>
              {topListeners
                .slice(0, 10)
                .map(
                  (listener: { listen_count: number; user_name: string }) => {
                    return (
                      <div key={listener.user_name} className="listener">
                        <a
                          href={`/user/${listener.user_name}/`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {listener.user_name}
                        </a>
                        <span className="pill">
                          {Intl.NumberFormat().format(listener.listen_count)}
                          <FontAwesomeIcon
                            icon={faXmark}
                            fixedWidth
                            size="xs"
                          />
                          <FontAwesomeIcon icon={faHeadphones} />
                        </span>
                      </div>
                    );
                  }
                )}
            </div>
          )}
        </div>
        <div className="albums full-width scroll-start">
          <h3>Albums</h3>
          <div className="cover-art-container dragscroll">
            {Array.from(Array(10).keys()).map((number) => {
              return (
                // <ReleaseCard
                //   releaseDate=""
                //   releaseMBID=""
                //   releaseName=""
                //   caaID={null}
                //   caaReleaseMBID={null}
                //   artistMBIDs={[artist.name]}
                //   artistCreditName={artist.name}
                // />
                <div
                  key={number}
                  className="cover-art"
                  style={{ background: tinycolor.random().toHexString() }}
                >
                  Album cover here
                </div>
              );
            })}
          </div>
        </div>
        {Boolean(reviews?.length) && (
          <div className="reviews">
            <h3>Reviews</h3>
            {reviews.slice(0, 3).map(getReviewEventContent)}
            <a
              href={`https://critiquebrainz.org/artist/${artist.artist_mbid}`}
              className="btn btn-link"
            >
              More on CritiqueBrainz…
            </a>
          </div>
        )}
        <div className="similarity">
          <h3>Similar artists</h3>
          Artist similarity here
        </div>
      </div>
      <BrainzPlayer
        listens={listensFromJSPFTracks}
        listenBrainzAPIBaseURI={APIService.APIBaseURI}
        refreshSpotifyToken={APIService.refreshSpotifyToken}
        refreshYoutubeToken={APIService.refreshYoutubeToken}
        refreshSoundcloudToken={APIService.refreshSoundcloudToken}
      />
    </div>
  );
}

document.addEventListener("DOMContentLoaded", () => {
  const {
    domContainer,
    reactProps,
    globalAppContext,
    sentryProps,
  } = getPageProps();
  const { sentry_dsn, sentry_traces_sample_rate } = sentryProps;

  if (sentry_dsn) {
    Sentry.init({
      dsn: sentry_dsn,
      integrations: [new Integrations.BrowserTracing()],
      tracesSampleRate: sentry_traces_sample_rate,
    });
  }
  const { artist_data, popular_recordings } = reactProps;
  const { tag, ...artist_metadata } = artist_data;

  const ArtistPageWithAlertNotifications = withAlertNotifications(ArtistPage);

  const renderRoot = createRoot(domContainer!);
  renderRoot.render(
    <ErrorBoundary>
      <ToastContainer
        position="bottom-right"
        autoClose={8000}
        hideProgressBar
      />
      <GlobalAppContext.Provider value={globalAppContext}>
        <NiceModal.Provider>
          <ArtistPageWithAlertNotifications
            artist={artist_metadata}
            artist_tags={tag?.artist}
            popular_recordings={popular_recordings}
          />
        </NiceModal.Provider>
      </GlobalAppContext.Provider>
    </ErrorBoundary>
  );
});
