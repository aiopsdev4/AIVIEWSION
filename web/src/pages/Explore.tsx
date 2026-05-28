import {
  useEmbeddingsReindexProgress,
  useModelState,
} from "@/api/ws";
import ActivityIndicator from "@/components/indicators/activity-indicator";
import AnimatedCircularProgressBar from "@/components/ui/circular-progress-bar";
import { FrigateConfig } from "@/types/frigateConfig";
import { SearchResult } from "@/types/search";
import { ModelState } from "@/types/ws";
import {
  formatSecondsToDuration,
} from "@/utils/dateUtil";
import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  LuCheck,
  LuExternalLink,
  LuX,
  LuPlay,
  LuPause,
  LuVolume2,
  LuVolumeX,
  LuMaximize,
  LuChevronLeft,
  LuChevronRight,
  LuCalendar,
} from "react-icons/lu";
import { TbExclamationCircle } from "react-icons/tb";
import { Link } from "react-router-dom";
import useSWR from "swr";
import { useAllowedCameras } from "@/hooks/use-allowed-cameras";
import { useApiHost } from "@/api";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import TimeAgo from "@/components/dynamic/TimeAgo";
import { cn } from "@/lib/utils";
import { JINA_EMBEDDING_MODELS } from "@/lib/const";

function CategoryCarousel({
  label,
  labelEvents,
  selectedEvent,
  setSelectedEvent,
  setSelectedCategory,
  apiHost,
  formatTime,
}: {
  label: string;
  labelEvents: SearchResult[];
  selectedEvent: SearchResult | null;
  setSelectedEvent: (event: SearchResult) => void;
  setSelectedCategory: (category: string) => void;
  apiHost: string;
  formatTime: (time: number) => string;
}) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = () => {
    const el = scrollContainerRef.current;
    if (el) {
      setCanScrollLeft(el.scrollLeft > 2);
      setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 5);
    }
  };

  useEffect(() => {
    checkScroll();
    // A small timeout to ensure DOM has completed layout
    const timer = setTimeout(checkScroll, 100);
    window.addEventListener("resize", checkScroll);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", checkScroll);
    };
  }, [labelEvents]);

  const handleScroll = () => {
    checkScroll();
  };

  const scroll = (direction: "left" | "right") => {
    const el = scrollContainerRef.current;
    if (el) {
      const scrollAmount = el.clientWidth * 0.75;
      el.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  const totalCount = (labelEvents[0] as SearchResult & { event_count?: number })?.event_count || labelEvents.length;

  return (
    <div className="flex flex-col gap-2 w-full min-w-0">
      {/* Row Header */}
      <div className="flex items-baseline gap-2 px-1">
        <h3 className="text-sm font-bold text-foreground capitalize">
          {label}
        </h3>
        <span className="text-[11px] text-muted-foreground">
          {totalCount} Tracked Objects
        </span>
      </div>

      {/* Carousel Container */}
      <div 
        className="relative w-full group min-w-0"
        onMouseEnter={checkScroll}
      >
        {/* Left Arrow Button */}
        {canScrollLeft && (
          <button
            onClick={() => scroll("left")}
            className="absolute left-2 top-[66px] -translate-y-1/2 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-border/60 bg-background/90 text-foreground hover:text-primary hover:border-primary shadow-lg transition-all duration-300 hover:scale-110"
            title="Scroll Left"
          >
            <LuChevronLeft className="size-4 stroke-[2.5]" />
          </button>
        )}

        {/* Right Arrow Button */}
        {canScrollRight && (
          <button
            onClick={() => scroll("right")}
            className="absolute right-2 top-[66px] -translate-y-1/2 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-border/60 bg-background/90 text-foreground hover:text-primary hover:border-primary shadow-lg transition-all duration-300 hover:scale-110"
            title="Scroll Right"
          >
            <LuChevronRight className="size-4 stroke-[2.5]" />
          </button>
        )}

        {/* Horizontally Scrollable Cards Container */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="w-full flex flex-row gap-4 overflow-x-auto pb-3 pt-1 horizontal-scrollbar select-none scroll-smooth"
        >
          {labelEvents.map((event) => (
            <div
              key={event.id}
              onClick={() => setSelectedEvent(event)}
              className={cn(
                "w-48 shrink-0 flex flex-col overflow-hidden rounded-xl border bg-background transition-all duration-300 cursor-pointer hover:shadow-md hover:-translate-y-0.5",
                selectedEvent?.id === event.id
                  ? "border-primary ring-1 ring-primary"
                  : "border-border/50"
              )}
            >
              <div className="relative aspect-video w-full overflow-hidden bg-black/10">
                <img
                  src={`${apiHost}api/events/${event.id}/thumbnail.webp`}
                  alt={event.label}
                  className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                  loading="lazy"
                />
                {event.label && (
                  <span className="absolute top-2 left-2 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded bg-black/60 text-white backdrop-blur-sm">
                    {event.label}
                  </span>
                )}
                <span className="absolute bottom-2 right-2 px-1.5 py-0.5 text-[9px] rounded bg-black/60 text-white backdrop-blur-sm">
                  <TimeAgo time={event.start_time * 1000} dense />
                </span>
              </div>
              <div className="flex flex-col p-2.5">
                <p className="text-[11px] font-semibold text-foreground truncate">
                  {event.camera.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                </p>
                <p className="text-[9px] text-muted-foreground mt-0.5">
                  {formatTime(event.start_time)}
                </p>
              </div>
            </div>
          ))}

          {/* Special "Explore More" Card at the end of the carousel */}
          <div
            onClick={() => setSelectedCategory(label)}
            className="w-48 shrink-0 flex flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed border-border hover:border-primary bg-background/30 hover:bg-background/80 transition-all duration-300 cursor-pointer self-stretch"
            title={`View all ${label} events`}
          >
            <LuChevronRight className="size-6 text-muted-foreground hover:text-primary mb-1 transition-colors duration-300" />
            <span className="text-[11px] font-semibold text-muted-foreground hover:text-primary transition-colors duration-300">
              View All {label}s
            </span>
          </div>
          {/* Spacer to guarantee padding at scroll end */}
          <div className="w-2 shrink-0 pointer-events-none" />
        </div>
      </div>
    </div>
  );
}

export default function Explore() {
  const { t } = useTranslation(["views/explore"]);

  const apiHost = useApiHost();

  const { data: config } = useSWR<FrigateConfig>("config", {
    revalidateOnFocus: false,
  });

  const allowedCameras = useAllowedCameras();

  // Active filters and selectors for the 3-column view
  const [selectedCamera, setSelectedCamera] = useState<string | undefined>(undefined);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedEvent, setSelectedEvent] = useState<SearchResult | null>(null);

  // Video playback states
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Generate camera keys list
  const cameras = useMemo(() => {
    if (!config?.cameras) return [];
    return Object.keys(config.cameras).filter((cam) =>
      allowedCameras.includes(cam)
    );
  }, [config, allowedCameras]);

  // Format camera names for listing (e.g. "front_door" -> "D1 Front Door")
  const formatCameraName = useCallback((cameraName: string, index: number) => {
    const formatted = cameraName
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    return `D${index + 1} ${formatted}`;
  }, []);

  // Fetch events based on explore endpoint to ensure all categories are returned
  const { data: events, isLoading: isLoadingEvents } = useSWR<SearchResult[]>(
    [
      "events/explore",
      {
        limit: 30, // Get enough events per category for filtering
      },
    ],
    { revalidateOnFocus: true }
  );

  // Client-side filtering of the explore events to support interactive widgets
  const filteredEvents = useMemo(() => {
    if (!events) return [];
    return events.filter((event) => {
      if (selectedCamera && event.camera !== selectedCamera) {
        return false;
      }
      if (selectedCategory !== "all" && event.label !== selectedCategory) {
        return false;
      }
      if (selectedDate) {
        const eventDate = new Date(event.start_time * 1000);
        return (
          eventDate.getFullYear() === selectedDate.getFullYear() &&
          eventDate.getMonth() === selectedDate.getMonth() &&
          eventDate.getDate() === selectedDate.getDate()
        );
      }
      return true;
    });
  }, [events, selectedCamera, selectedCategory, selectedDate]);

  // Extract labels dynamically from config and fetched events to ensure all supported categories are present
  const categories = useMemo(() => {
    const labels = new Set<string>();

    // 1. Add configured tracking labels if config is available
    if (config?.objects?.track) {
      config.objects.track.forEach((label) => labels.add(label));
    }

    // 2. Add any labels that the model is capable of detecting
    if (config?.model?.labelmap) {
      Object.keys(config.model.labelmap).forEach((label) => {
        if (isNaN(Number(label))) {
          labels.add(label);
        }
      });
    }

    // 3. Add any labels from currently loaded events
    if (events) {
      events.forEach((event) => {
        if (event.label) labels.add(event.label);
      });
    }

    return ["all", ...Array.from(labels).sort()];
  }, [config, events]);

  // Group filtered events by category/label
  const eventsByLabel = useMemo(() => {
    if (!filteredEvents) return {};
    return filteredEvents.reduce<Record<string, SearchResult[]>>((acc, event) => {
      const label = event.label || "Unknown";
      if (!acc[label]) {
        acc[label] = [];
      }
      acc[label].push(event);
      return acc;
    }, {});
  }, [filteredEvents]);

  // Limit Event Video List to exactly N=15 elements, ensuring selectedEvent is included
  const gridEvents = useMemo(() => {
    if (!filteredEvents || filteredEvents.length === 0) return [];
    const baseList = filteredEvents.slice(0, 15);
    if (selectedEvent && !baseList.some((e) => e.id === selectedEvent.id)) {
      const selectedIndex = filteredEvents.findIndex((e) => e.id === selectedEvent.id);
      if (selectedIndex !== -1) {
        return [...baseList.slice(0, 14), filteredEvents[selectedIndex]];
      }
    }
    return baseList;
  }, [filteredEvents, selectedEvent]);



  // Automatically select the first event when grid updates
  useEffect(() => {
    if (filteredEvents.length > 0) {
      // Keep selected event if it's still in the current filtered events, otherwise default to first
      const exists = filteredEvents.some((e) => e.id === selectedEvent?.id);
      if (!exists) {
        setSelectedEvent(filteredEvents[0]);
      }
    } else {
      setSelectedEvent(null);
    }
  }, [filteredEvents, selectedEvent]);

  // Sync video play/pause states
  useEffect(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.pause();
      }
    }
  }, [isPlaying, selectedEvent]);

  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch(() => {});
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleNextEvent = () => {
    if (!selectedEvent) return;
    const index = gridEvents.findIndex((e) => e.id === selectedEvent.id);
    if (index !== -1 && index < gridEvents.length - 1) {
      setSelectedEvent(gridEvents[index + 1]);
    }
  };

  const handlePrevEvent = () => {
    if (!selectedEvent) return;
    const index = gridEvents.findIndex((e) => e.id === selectedEvent.id);
    if (index > 0) {
      setSelectedEvent(gridEvents[index - 1]);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleVolumeToggle = () => {
    setIsMuted(!isMuted);
  };

  const handleFullscreen = () => {
    if (videoRef.current) {
      if (videoRef.current.requestFullscreen) {
        videoRef.current.requestFullscreen();
      }
    }
  };

  // Format time helper
  const formatTime = useCallback((epoch: number) => {
    const d = new Date(epoch * 1000);
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  }, []);

  // Embeddings reindex progress
  const { payload: reindexState } = useEmbeddingsReindexProgress();

  const embeddingsReindexing = useMemo(() => {
    if (reindexState) {
      switch (reindexState.status) {
        case "indexing":
          return true;
        case "completed":
          return false;
        default:
          return undefined;
      }
    }
  }, [reindexState]);

  // Model download states
  const modelVersion = config?.semantic_search.model || "jinav1";
  const modelSize = config?.semantic_search.model_size || "small";

  const isGenaiEmbeddings =
    typeof modelVersion === "string" &&
    !(JINA_EMBEDDING_MODELS as readonly string[]).includes(modelVersion);

  const { payload: textModelState } = useModelState(
    modelVersion === "jinav1"
      ? "jinaai/jina-clip-v1-text_model_fp16.onnx"
      : modelSize === "large"
        ? "jinaai/jina-clip-v2-model_fp16.onnx"
        : "jinaai/jina-clip-v2-model_quantized.onnx"
  );

  const { payload: textTokenizerState } = useModelState(
    modelVersion === "jinav1"
      ? "jinaai/jina-clip-v1-tokenizer"
      : "jinaai/jina-clip-v2-tokenizer"
  );

  const visionModelFile =
    modelVersion === "jinav1"
      ? modelSize === "large"
        ? "jinaai/jina-clip-v1-vision_model_fp16.onnx"
        : "jinaai/jina-clip-v1-vision_model_quantized.onnx"
      : modelSize === "large"
        ? "jinaai/jina-clip-v2-model_fp16.onnx"
        : "jinaai/jina-clip-v2-model_quantized.onnx";
  const { payload: visionModelState } = useModelState(visionModelFile);

  const { payload: visionFeatureExtractorState } = useModelState(
    modelVersion === "jinav1"
      ? "jinaai/jina-clip-v1-preprocessor_config.json"
      : "jinaai/jina-clip-v2-preprocessor_config.json"
  );

  const allModelsLoaded = useMemo(() => {
    if (isGenaiEmbeddings) return true;
    return (
      textModelState === "downloaded" &&
      textTokenizerState === "downloaded" &&
      visionModelState === "downloaded" &&
      visionFeatureExtractorState === "downloaded"
    );
  }, [
    isGenaiEmbeddings,
    textModelState,
    textTokenizerState,
    visionModelState,
    visionFeatureExtractorState,
  ]);

  const renderModelStateIcon = (modelState: ModelState) => {
    if (modelState === "downloading") {
      return <ActivityIndicator className="size-5" />;
    }
    if (modelState === "downloaded") {
      return <LuCheck className="size-5 text-success" />;
    }
    if (modelState === "not_downloaded" || modelState === "error") {
      return <LuX className="size-5 text-danger" />;
    }
    return null;
  };

  const getLocaleDocUrlFallback = (key: string) => {
    return `https://docs.frigate.video/${key}`;
  };

  if (
    config?.semantic_search.enabled &&
    (!reindexState ||
      (!isGenaiEmbeddings &&
        (!textModelState ||
          !textTokenizerState ||
          !visionModelState ||
          !visionFeatureExtractorState)))
  ) {
    return (
      <ActivityIndicator className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" />
    );
  }

  return (
    <>
      {config?.semantic_search.enabled &&
      (!allModelsLoaded || embeddingsReindexing) ? (
        <div className="absolute inset-0 left-1/2 top-1/2 flex h-96 w-96 -translate-x-1/2 -translate-y-1/2">
          <div className="flex max-w-96 flex-col items-center justify-center space-y-3 rounded-lg bg-background/50 p-5">
            <div className="my-5 flex flex-col items-center gap-2 text-xl">
              <TbExclamationCircle className="mb-3 size-10" />
              <div>{t("exploreIsUnavailable.title")}</div>
            </div>
            {embeddingsReindexing && allModelsLoaded && (
              <>
                <div className="text-center text-primary-variant">
                  {t("exploreIsUnavailable.embeddingsReindexing.context")}
                </div>
                <div className="pt-5 text-center">
                  <AnimatedCircularProgressBar
                    min={0}
                    max={reindexState.total_objects}
                    value={reindexState.processed_objects}
                    gaugePrimaryColor="hsl(var(--selected))"
                    gaugeSecondaryColor="hsl(var(--secondary))"
                  />
                </div>
                <div className="flex w-96 flex-col gap-2 py-5">
                  {reindexState.time_remaining !== null && (
                    <div className="mb-3 flex flex-col items-center justify-center gap-1">
                      <div className="text-primary-variant">
                        {reindexState.time_remaining === -1
                          ? t("exploreIsUnavailable.embeddingsReindexing.startingUp")
                          : t("exploreIsUnavailable.embeddingsReindexing.estimatedTime")}
                      </div>
                      {reindexState.time_remaining >= 0 &&
                        (formatSecondsToDuration(reindexState.time_remaining) ||
                          t("exploreIsUnavailable.embeddingsReindexing.finishingShortly"))}
                    </div>
                  )}
                  <div className="flex flex-row items-center justify-center gap-3">
                    <span className="text-primary-variant">
                      {t("exploreIsUnavailable.embeddingsReindexing.step.thumbnailsEmbedded")}
                    </span>
                    {reindexState.thumbnails}
                  </div>
                  <div className="flex flex-row items-center justify-center gap-3">
                    <span className="text-primary-variant">
                      {t("exploreIsUnavailable.embeddingsReindexing.step.descriptionsEmbedded")}
                    </span>
                    {reindexState.descriptions}
                  </div>
                  <div className="flex flex-row items-center justify-center gap-3">
                    <span className="text-primary-variant">
                      {t("exploreIsUnavailable.embeddingsReindexing.step.trackedObjectsProcessed")}
                    </span>
                    {reindexState.processed_objects} / {reindexState.total_objects}
                  </div>
                </div>
              </>
            )}
            {!allModelsLoaded && (
              <>
                <div className="text-center text-primary-variant">
                  {t("exploreIsUnavailable.downloadingModels.context")}
                </div>
                <div className="flex w-96 flex-col gap-2 py-5">
                  <div className="flex flex-row items-center justify-center gap-2">
                    {renderModelStateIcon(visionModelState)}
                    {t("exploreIsUnavailable.downloadingModels.setup.visionModel")}
                  </div>
                  <div className="flex flex-row items-center justify-center gap-2">
                    {renderModelStateIcon(visionFeatureExtractorState)}
                    {t("exploreIsUnavailable.downloadingModels.setup.visionModelFeatureExtractor")}
                  </div>
                  <div className="flex flex-row items-center justify-center gap-2">
                    {renderModelStateIcon(textModelState)}
                    {t("exploreIsUnavailable.downloadingModels.setup.textModel")}
                  </div>
                  <div className="flex flex-row items-center justify-center gap-2">
                    {renderModelStateIcon(textTokenizerState)}
                    {t("exploreIsUnavailable.downloadingModels.setup.textTokenizer")}
                  </div>
                </div>
                {(textModelState === "error" ||
                  textTokenizerState === "error" ||
                  visionModelState === "error" ||
                  visionFeatureExtractorState === "error") && (
                  <div className="my-3 max-w-96 text-center text-danger">
                    {t("exploreIsUnavailable.downloadingModels.error")}
                  </div>
                )}
                <div className="text-center text-primary-variant">
                  {t("exploreIsUnavailable.downloadingModels.tips.context")}
                </div>
                <div className="flex items-center text-primary-variant">
                  <Link
                    to={getLocaleDocUrlFallback("configuration/semantic_search")}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline"
                  >
                    {t("readTheDocumentation", { ns: "common" })}
                    <LuExternalLink className="ml-2 inline-flex size-3" />
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      ) : (
        /* Dynamic 3-Pane Explore Page Template */
        <div className="flex size-full flex-row overflow-hidden bg-background">
          {/* Column 1: Channel List */}
          <div className="flex w-72 flex-col border-r border-border/60 bg-background/95">
            <div className="p-4 border-b border-border/50">
              <h2 className="text-sm font-semibold tracking-wider text-muted-foreground uppercase">
                Channel List
              </h2>
            </div>
            <ScrollArea className="flex-1">
              <div className="flex flex-col gap-1 p-2">
                <button
                  onClick={() => setSelectedCamera(undefined)}
                  className={cn(
                    "w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all duration-200",
                    selectedCamera === undefined
                      ? "bg-accent text-accent-foreground font-medium shadow-sm"
                      : "hover:bg-accent/40 text-muted-foreground"
                  )}
                >
                  All Channels
                </button>
                {cameras.map((camera, index) => (
                  <button
                    key={camera}
                    onClick={() => setSelectedCamera(camera)}
                    className={cn(
                      "w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all duration-200",
                      selectedCamera === camera
                        ? "bg-accent text-accent-foreground font-medium shadow-sm"
                        : "hover:bg-accent/40 text-muted-foreground"
                    )}
                  >
                    {formatCameraName(camera, index)}
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Column 2: Event Grid */}
          <div className="flex flex-1 flex-col bg-background_alt min-w-0 min-h-0">
            {/* Header / Category Organizer */}
            <div className="flex flex-col gap-3 p-4 bg-background border-b border-border/40">
              <div className="flex items-center justify-between">
                <h1 className="text-lg font-bold tracking-tight text-foreground">
                  Event Grid
                </h1>
                {isLoadingEvents && <ActivityIndicator className="size-4" />}
              </div>
              {/* Category Filter Pills */}
              <div className="flex flex-row gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                {categories.map((category) => (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={cn(
                      "px-3 py-1 text-xs font-medium rounded-full border transition-all duration-200 capitalize shrink-0",
                      selectedCategory === category
                        ? "bg-primary border-primary text-primary-foreground shadow-sm"
                        : "bg-background border-border text-muted-foreground hover:bg-accent"
                    )}
                  >
                    {category === "all" ? "All Categories" : category}
                  </button>
                ))}
              </div>
            </div>

            {/* Scrollable Rows of Categories (mockup layout) */}
            <ScrollArea className="flex-1 min-w-0 min-h-0 explore-scroll-area [&>div]:!overflow-x-hidden">
              <div className="p-4 space-y-6 w-full min-w-0">
                {isLoadingEvents && Object.keys(eventsByLabel).length === 0 ? (
                  <div className="flex size-full items-center justify-center">
                    <ActivityIndicator />
                  </div>
                ) : Object.keys(eventsByLabel).length === 0 ? (
                  <div className="flex size-full flex-col items-center justify-center text-muted-foreground gap-2">
                    <LuCalendar className="size-10 stroke-1" />
                    <p className="text-sm">No events found matching current criteria</p>
                  </div>
                ) : selectedCategory === "all" ? (
                  Object.entries(eventsByLabel).map(([label, labelEvents]) => (
                    <CategoryCarousel
                      key={label}
                      label={label}
                      labelEvents={labelEvents}
                      selectedEvent={selectedEvent}
                      setSelectedEvent={setSelectedEvent}
                      setSelectedCategory={setSelectedCategory}
                      apiHost={apiHost}
                      formatTime={formatTime}
                    />
                  ))
                ) : (
                  Object.entries(eventsByLabel).map(([label, labelEvents]) => {
                    const totalCount = (labelEvents[0] as SearchResult & { event_count?: number })?.event_count || labelEvents.length;
                    return (
                      <div key={label} className="flex flex-col gap-4 w-full min-w-0">
                        {/* Row Header */}
                        <div className="flex items-baseline gap-2 px-1">
                          <h3 className="text-sm font-bold text-foreground capitalize">
                            {label}
                          </h3>
                          <span className="text-[11px] text-muted-foreground">
                            {totalCount} Tracked Objects
                          </span>
                        </div>

                        {/* Wrapping Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 w-full pb-6">
                          {labelEvents.map((event) => (
                            <div
                              key={event.id}
                              onClick={() => setSelectedEvent(event)}
                              className={cn(
                                "w-full flex flex-col overflow-hidden rounded-xl border bg-background transition-all duration-300 cursor-pointer hover:shadow-md hover:-translate-y-0.5",
                                selectedEvent?.id === event.id
                                  ? "border-primary ring-1 ring-primary"
                                  : "border-border/50"
                              )}
                            >
                              <div className="relative aspect-video w-full overflow-hidden bg-black/10">
                                <img
                                  src={`${apiHost}api/events/${event.id}/thumbnail.webp`}
                                  alt={event.label}
                                  className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                                  loading="lazy"
                                />
                                {event.label && (
                                  <span className="absolute top-2 left-2 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded bg-black/60 text-white backdrop-blur-sm">
                                    {event.label}
                                  </span>
                                )}
                                <span className="absolute bottom-2 right-2 px-1.5 py-0.5 text-[9px] rounded bg-black/60 text-white backdrop-blur-sm">
                                  <TimeAgo time={event.start_time * 1000} dense />
                                </span>
                              </div>
                              <div className="flex flex-col p-2.5">
                                <p className="text-[11px] font-semibold text-foreground truncate">
                                  {event.camera.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                                </p>
                                <p className="text-[9px] text-muted-foreground mt-0.5">
                                  {formatTime(event.start_time)}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Column 3: Details & Controls */}
          <div className="flex w-[450px] flex-col border-l border-border/60 bg-background/95">
            {/* 1. Video Player */}
            <div className="p-4 border-b border-border/50 flex flex-col gap-3">
              <h2 className="text-sm font-semibold tracking-wider text-muted-foreground uppercase">
                Video Player
              </h2>
              {selectedEvent ? (
                <div className="flex flex-col gap-3">
                  <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black shadow-inner">
                    <video
                      key={selectedEvent.id}
                      ref={videoRef}
                      src={`${apiHost}api/events/${selectedEvent.id}/clip.mp4`}
                      poster={`${apiHost}api/events/${selectedEvent.id}/snapshot.jpg`}
                      className="w-full h-full object-contain"
                      muted={isMuted}
                      onTimeUpdate={() => {
                        if (videoRef.current) {
                          setCurrentTime(videoRef.current.currentTime);
                        }
                      }}
                      onLoadedMetadata={() => {
                        if (videoRef.current) {
                          setDuration(videoRef.current.duration);
                        }
                      }}
                      autoPlay
                      loop
                    />
                  </div>

                  {/* Seek Bar */}
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={0}
                      max={duration || 100}
                      value={currentTime}
                      onChange={handleSeek}
                      className="w-full h-1 bg-muted rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none"
                    />
                  </div>

                  {/* Player Controls */}
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handlePrevEvent}
                        disabled={gridEvents.findIndex((e) => e.id === selectedEvent.id) === 0}
                        className="h-8 w-8 text-foreground"
                      >
                        <LuChevronLeft className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handlePlayPause}
                        className="h-8 w-8 text-foreground"
                      >
                        {isPlaying ? <LuPause className="size-4" /> : <LuPlay className="size-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleNextEvent}
                        disabled={
                          gridEvents.findIndex((e) => e.id === selectedEvent.id) ===
                          gridEvents.length - 1
                        }
                        className="h-8 w-8 text-foreground"
                      >
                        <LuChevronRight className="size-4" />
                      </Button>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleVolumeToggle}
                        className="h-8 w-8 text-foreground"
                      >
                        {isMuted ? <LuVolumeX className="size-4" /> : <LuVolume2 className="size-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleFullscreen}
                        className="h-8 w-8 text-foreground"
                      >
                        <LuMaximize className="size-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="w-full aspect-video rounded-xl bg-muted/40 border border-dashed border-border/80 flex items-center justify-center text-xs text-muted-foreground">
                  Select an event to play video
                </div>
              )}
            </div>

            {/* Spacer */}
            <div className="flex-1 bg-background/95 border-b border-border/50" />

            {/* 3. Calendar Widget */}
            <div className="p-4 bg-background/95">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold tracking-wider text-muted-foreground uppercase">
                  Calendar
                </h2>
                {selectedDate && (
                  <Button
                    variant="ghost"
                    onClick={() => setSelectedDate(undefined)}
                    className="h-6 px-2 text-[10px] hover:text-foreground"
                  >
                    Clear Filter
                  </Button>
                )}
              </div>
              <div className="flex justify-center border border-border/40 rounded-xl bg-background/50 shadow-inner">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => setSelectedDate(date || undefined)}
                  className="p-1 scale-95"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
