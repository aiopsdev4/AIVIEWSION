import { useCallback } from "react";

export type TimelineUtilsProps = {
  segmentDuration: number;
  timelineDuration?: number;
  timelineRef?: React.RefObject<HTMLElement | null>;
  orientation?: "horizontal" | "vertical";
};

export function useTimelineUtils({
  segmentDuration,
  timelineDuration,
  timelineRef,
  orientation = "vertical",
}: TimelineUtilsProps) {
  const segmentHeight = 8;

  const alignEndDateToTimeline = useCallback(
    (time: number): number => {
      const remainder = time % segmentDuration;
      const adjustment = remainder !== 0 ? segmentDuration - remainder : 0;
      return time + adjustment;
    },
    [segmentDuration],
  );

  const alignStartDateToTimeline = useCallback(
    (time: number): number => {
      const remainder = time % segmentDuration;
      const adjustment = remainder === 0 ? 0 : -remainder;
      return time + adjustment;
    },
    [segmentDuration],
  );

  const getCumulativeScrollTop = useCallback((element: HTMLElement | null) => {
    let scrollTop = 0;
    while (element) {
      scrollTop += orientation === "horizontal" ? element.scrollLeft : element.scrollTop;
      element = element.parentElement;
    }
    return scrollTop;
  }, [orientation]);

  const getVisibleTimelineDuration = useCallback(() => {
    if (timelineRef?.current && timelineDuration) {
      const size = orientation === "horizontal" ? timelineRef.current.clientWidth : timelineRef.current.clientHeight;

      const visibleTime =
        (size / segmentHeight) * segmentDuration;

      return visibleTime;
    }
  }, [segmentDuration, timelineDuration, timelineRef, orientation]);

  return {
    alignEndDateToTimeline,
    alignStartDateToTimeline,
    getCumulativeScrollTop,
    getVisibleTimelineDuration,
    segmentHeight,
  };
}
