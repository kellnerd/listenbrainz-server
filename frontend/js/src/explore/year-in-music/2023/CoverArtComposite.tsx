import React, { useCallback, useEffect, useRef, useState } from "react";
import panzoom, { PanZoom } from "panzoom";
import { createRoot } from "react-dom/client";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faHandPointRight, faSyncAlt } from "@fortawesome/free-solid-svg-icons";
import jsonMap from "./mosaic-2023.json";
import { getPageProps } from "../../../utils/utils";
import ErrorBoundary from "../../../utils/ErrorBoundary";

type CoverDef = {
  x1: number;
  x2: number;
  y1: number;
  y2: number;
  name: string;
  release_mbid: string;
};

export default function CoverArtComposite() {
  const targetRef = useRef<HTMLImageElement>(null);
  const [preventClick, setPreventClick] = useState(false);
  const [bigImageActive, setBigImageActive] = useState(false);
  const [panZoomInstance, setPanZoomInstance] = useState<PanZoom>();

  const setInitialZoom = useCallback(() => {
    if (!panZoomInstance) {
      return;
    }
    panZoomInstance.moveTo(0, 0);
    panZoomInstance.smoothZoom(
      0, // initial x position
      0, // initial y position
      panZoomInstance.getMinZoom() // initial zoom
    );
  }, [panZoomInstance]);

  useEffect(() => {
    if (!targetRef.current || !bigImageActive) return;

    const container = targetRef.current.parentElement as HTMLDivElement;
    const containerWidth = container.clientWidth;
    const imageWidth = 10750;
    const lowestZoom = containerWidth / imageWidth;
    const createdPanZoomInstance = panzoom(targetRef.current, {
      maxZoom: 1,
      minZoom: lowestZoom,
      bounds: true,
      onTouch: () => false, // how to allow touch events to work on mobile. See https://github.com/anvaka/panzoom/issues/235#issuecomment-1207341563
    });
    createdPanZoomInstance.smoothZoomAbs(0, 0, lowestZoom);
    setPanZoomInstance(createdPanZoomInstance);
    /* Prevent clicks while panning */
    createdPanZoomInstance.on("panstart", (e) => {
      setPreventClick(true);
    });
    createdPanZoomInstance.on("panend", (e) => {
      setTimeout(() => {
        setPreventClick(false);
      }, 100);
    });
  }, [bigImageActive]);

  return (
    <div
      id="year-in-music"
      className="yim-2023"
      style={{
        textAlign: "center",
        WebkitOverflowScrolling: "auto", // See https://github.com/anvaka/panzoom/issues/235#issuecomment-1207341563
      }}
    >
      <div className="header" style={{ marginBottom: "0.5em", height: "15vh" }}>
        Album covers of 2023
        <div className="subheader">
          Zoom, drag and click your way to some of 2023&apos;s most colourful
          albums.
        </div>
      </div>
      {bigImageActive && (
        <button type="button" className="btn btn-info" onClick={setInitialZoom}>
          <FontAwesomeIcon icon={faSyncAlt} /> Reset
        </button>
      )}
      <div
        style={{
          width: "100%",
          height: "70vh",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {!bigImageActive ? (
          <>
            <div
              className="flex flex-center"
              style={{ width: "100%", top: "10em", position: "absolute" }}
            >
              <div
                className="alert alert-warning"
                style={{ maxWidth: "700px", zIndex: 1 }}
              >
                - Confirm to load large image (be kind to your data plan) -
                <br />
                <button
                  type="button"
                  className="btn btn-success"
                  onClick={() => {
                    setBigImageActive(true);
                  }}
                  style={{ marginTop: "0.5em" }}
                >
                  <FontAwesomeIcon icon={faHandPointRight} /> Continue
                </button>
              </div>
            </div>
            <img
              src="https://staticbrainz.org/LB/year-in-music/2023/mosaic-2023-small.jpg"
              srcSet="https://staticbrainz.org/LB/year-in-music/2023/mosaic-2023-small.jpg 500w,
			https://staticbrainz.org/LB/year-in-music/2023/mosaic-2023-medium.jpg 1000w"
              alt="2023 albums"
            />
          </>
        ) : (
          <>
            <img
              ref={targetRef}
              src="https://staticbrainz.org/LB/year-in-music/2023/mosaic-2023.jpg"
              useMap="#cover-image-map"
              alt="Albums"
              onLoad={setInitialZoom}
            />
            <map name="cover-image-map">
              {jsonMap.map((coverDef: CoverDef) => {
                const { x1, x2, y1, y2, name, release_mbid } = coverDef;
                const coordinates = [x1, y1, x2, y2].join();
                return (
                  <area
                    key={`${name}-${coordinates}`}
                    shape="rect"
                    coords={coordinates}
                    alt={name}
                    href={
                      preventClick
                        ? undefined
                        : `/player/release/${release_mbid}/`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                  />
                );
              })}
            </map>
          </>
        )}
      </div>
    </div>
  );
}

document.addEventListener("DOMContentLoaded", () => {
  const { domContainer } = getPageProps();

  const renderRoot = createRoot(domContainer!);
  renderRoot.render(
    <ErrorBoundary>
      <CoverArtComposite />
    </ErrorBoundary>
  );
});