import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
} from "react";
import MotionSegment from "./MotionSegment";
import { ReviewSegment, MotionData } from "@/types/review";

type VirtualizedMotionSegmentsProps = {
  timelineRef: React.RefObject<HTMLDivElement | null>;
  segments: number[];
  events: ReviewSegment[];
  motion_events: MotionData[];
  segmentDuration: number;
  timestampSpread: number;
  showMinimap: boolean;
  minimapStartTime?: number;
  minimapEndTime?: number;
  contentRef: React.RefObject<HTMLDivElement | null>;
  setHandlebarTime?: React.Dispatch<React.SetStateAction<number>>;
  dense: boolean;
  motionOnly: boolean;
  getMotionSegmentValue: (timestamp: number) => number;
  getRecordingAvailability: (timestamp: number) => boolean | undefined;
  alwaysShowMotionLine: boolean;
  orientation?: "horizontal" | "vertical";
};

export interface VirtualizedMotionSegmentsRef {
  scrollToSegment: (
    segmentTime: number,
    ifNeeded?: boolean,
    behavior?: ScrollBehavior,
  ) => void;
}

const SEGMENT_SIZE = 8;
const OVERSCAN_COUNT = 20;

export const VirtualizedMotionSegments = forwardRef<
  VirtualizedMotionSegmentsRef,
  VirtualizedMotionSegmentsProps
>(
  (
    {
      timelineRef,
      segments,
      events,
      segmentDuration,
      timestampSpread,
      showMinimap,
      minimapStartTime,
      minimapEndTime,
      setHandlebarTime,
      dense,
      motionOnly,
      getMotionSegmentValue,
      getRecordingAvailability,
      alwaysShowMotionLine,
      orientation = "vertical",
    },
    ref,
  ) => {
    const [visibleRange, setVisibleRange] = useState({ start: 0, end: 0 });
    const containerRef = useRef<HTMLDivElement>(null);

    const updateVisibleRange = useCallback(() => {
      if (timelineRef.current) {
        const scroll = orientation === "horizontal" ? timelineRef.current.scrollLeft : timelineRef.current.scrollTop;
        const client = orientation === "horizontal" ? timelineRef.current.clientWidth : timelineRef.current.clientHeight;
        const start = Math.max(
          0,
          Math.floor(scroll / SEGMENT_SIZE) - OVERSCAN_COUNT,
        );
        const end = Math.min(
          segments.length,
          Math.ceil((scroll + client) / SEGMENT_SIZE) +
            OVERSCAN_COUNT,
        );
        setVisibleRange({ start, end });
      }
    }, [segments.length, timelineRef, orientation]);

    useEffect(() => {
      const container = timelineRef.current;
      if (container) {
        const handleScroll = () => {
          window.requestAnimationFrame(updateVisibleRange);
        };

        container.addEventListener("scroll", handleScroll, { passive: true });
        window.addEventListener("resize", updateVisibleRange);

        updateVisibleRange();

        return () => {
          container.removeEventListener("scroll", handleScroll);
          window.removeEventListener("resize", updateVisibleRange);
        };
      }
    }, [updateVisibleRange, timelineRef]);

    const scrollToSegment = useCallback(
      (
        segmentTime: number,
        ifNeeded: boolean = true,
        behavior: ScrollBehavior = "smooth",
      ) => {
        const segmentIndex = segments.findIndex((time) => time === segmentTime);
        if (
          segmentIndex !== -1 &&
          containerRef.current &&
          timelineRef.current
        ) {
          const client = orientation === "horizontal" ? timelineRef.current.clientWidth : timelineRef.current.clientHeight;
          const targetScroll = segmentIndex * SEGMENT_SIZE;
          const centeredScroll =
            targetScroll - client / 2 + SEGMENT_SIZE / 2;

          const isVisible =
            segmentIndex > visibleRange.start + OVERSCAN_COUNT &&
            segmentIndex < visibleRange.end - OVERSCAN_COUNT;

          if (!ifNeeded || !isVisible) {
            if (orientation === "horizontal") {
              timelineRef.current.scrollTo({
                left: Math.max(0, centeredScroll),
                behavior: behavior,
              });
            } else {
              timelineRef.current.scrollTo({
                top: Math.max(0, centeredScroll),
                behavior: behavior,
              });
            }
          }
          updateVisibleRange();
        }
      },
      [segments, timelineRef, visibleRange, updateVisibleRange, orientation],
    );

    useImperativeHandle(ref, () => ({
      scrollToSegment,
    }));

    const renderSegment = useCallback(
      (segmentTime: number, index: number) => {
        const motionStart = segmentTime;
        const motionEnd = motionStart + segmentDuration;

        const firstHalfMotionValue = getMotionSegmentValue(motionStart);
        const secondHalfMotionValue = getMotionSegmentValue(
          motionStart + segmentDuration / 2,
        );

        const segmentMotion =
          firstHalfMotionValue > 0 || secondHalfMotionValue > 0;
        const overlappingReviewItems = events.some(
          (item) =>
            (item.start_time >= motionStart && item.start_time < motionEnd) ||
            ((item.end_time ?? segmentTime) > motionStart &&
              (item.end_time ?? segmentTime) <= motionEnd) ||
            (item.start_time <= motionStart &&
              (item.end_time ?? segmentTime) >= motionEnd),
        );

        const hasRecording = getRecordingAvailability(segmentTime);

        // Check if previous and next segments have recordings
        // This is important because in motionOnly mode, the segments array is filtered
        const prevSegmentTime = segmentTime + segmentDuration;
        const nextSegmentTime = segmentTime - segmentDuration;

        const prevHasRecording = getRecordingAvailability(prevSegmentTime);
        const nextHasRecording = getRecordingAvailability(nextSegmentTime);

        // Check if prev/next segments have no recording available
        // Note: We only check hasRecording, not motion values, because segments can have
        // recordings available but no motion (eg, start of a recording before motion begins)
        const prevIsNoRecording = prevHasRecording === false;
        const nextIsNoRecording = nextHasRecording === false;

        if ((!segmentMotion || overlappingReviewItems) && motionOnly) {
          return null; // Skip rendering this segment in motion only mode
        }

        return (
          <div
            key={`${segmentTime}_${segmentDuration}`}
            style={orientation === "horizontal" ? {
              position: "absolute",
              left: `${(visibleRange.start + index) * SEGMENT_SIZE}px`,
              width: `${SEGMENT_SIZE}px`,
              height: "100%",
            } : {
              position: "absolute",
              top: `${(visibleRange.start + index) * SEGMENT_SIZE}px`,
              height: `${SEGMENT_SIZE}px`,
              width: "100%",
            }}
          >
            <MotionSegment
              events={events}
              firstHalfMotionValue={firstHalfMotionValue}
              secondHalfMotionValue={secondHalfMotionValue}
              hasRecording={hasRecording}
              prevIsNoRecording={prevIsNoRecording}
              nextIsNoRecording={nextIsNoRecording}
              segmentDuration={segmentDuration}
              segmentTime={segmentTime}
              timestampSpread={timestampSpread}
              motionOnly={motionOnly}
              showMinimap={showMinimap}
              minimapStartTime={minimapStartTime}
              minimapEndTime={minimapEndTime}
              setHandlebarTime={setHandlebarTime}
              scrollToSegment={scrollToSegment}
              dense={dense}
              alwaysShowMotionLine={alwaysShowMotionLine}
              orientation={orientation}
            />
          </div>
        );
      },
      [
        events,
        getMotionSegmentValue,
        getRecordingAvailability,
        motionOnly,
        segmentDuration,
        showMinimap,
        minimapStartTime,
        minimapEndTime,
        setHandlebarTime,
        scrollToSegment,
        dense,
        timestampSpread,
        visibleRange.start,
        alwaysShowMotionLine,
        orientation,
      ],
    );

    const totalSize = segments.length * SEGMENT_SIZE;
    const visibleSegments = segments.slice(
      visibleRange.start,
      visibleRange.end,
    );

    return (
      <div
        ref={containerRef}
        className="h-full w-full"
        style={{ position: "relative", willChange: "transform" }}
      >
        <div style={orientation === "horizontal" ? { width: `${totalSize}px`, height: "100%", position: "relative" } : { height: `${totalSize}px`, position: "relative" }}>
          {visibleRange.start > 0 && (
            <div
              style={orientation === "horizontal" ? {
                position: "absolute",
                left: 0,
                width: `${visibleRange.start * SEGMENT_SIZE}px`,
                height: "100%",
              } : {
                position: "absolute",
                top: 0,
                height: `${visibleRange.start * SEGMENT_SIZE}px`,
                width: "100%",
              }}
              aria-hidden="true"
            />
          )}
          {visibleSegments.map((segmentTime, index) =>
            renderSegment(segmentTime, index),
          )}
          {visibleRange.end < segments.length && (
            <div
              style={orientation === "horizontal" ? {
                position: "absolute",
                left: `${visibleRange.end * SEGMENT_SIZE}px`,
                width: `${
                  (segments.length - visibleRange.end) * SEGMENT_SIZE
                }px`,
                height: "100%",
              } : {
                position: "absolute",
                top: `${visibleRange.end * SEGMENT_SIZE}px`,
                height: `${
                  (segments.length - visibleRange.end) * SEGMENT_SIZE
                }px`,
                width: "100%",
              }}
              aria-hidden="true"
            />
          )}
        </div>
      </div>
    );
  },
);

export default VirtualizedMotionSegments;
