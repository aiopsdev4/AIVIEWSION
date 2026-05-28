import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Download as DownloadIcon,
  Image as ImageIcon,
  Target
} from "lucide-react";
import { toast } from "sonner";

interface QuickAddSubjectModalProps {
  isOpen: boolean;
  onClose: (saved?: boolean) => void;
  type: "person" | "vehicle" | "asset" | "roi";
  cameraName: string;
}

export default function QuickAddSubjectModal({
  isOpen,
  onClose,
  type,
  cameraName
}: QuickAddSubjectModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [isCalibratingROI, setIsCalibratingROI] = useState(false);
  const [calibrationProgress, setCalibrationProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [currentObject, setCurrentObject] = useState({
    object_type: type || "person",
    name: "",
    unique_id: "",
    description: "",
    risk_level: "Monitoring",
    expiry_date: "",
    missing_date: "",
    additional_details: {} as Record<string, string>,
    reference_images: [] as string[]
  });

  useEffect(() => {
    if (isOpen && type) {
      const generateId = (t: string) => {
        const prefix =
          t === "vehicle"
            ? "VID-"
            : t === "asset"
              ? "AID-"
              : t === "roi"
                ? "ZID-"
                : "PID-";
        return (
          prefix + Math.random().toString(16).substring(2, 10).toUpperCase()
        );
      };

      setCurrentObject({
        object_type: type,
        name: "",
        unique_id: generateId(type),
        description: "",
        risk_level: type === "roi" ? "Perimeter Breach" : "Monitoring",
        expiry_date: "",
        missing_date: "",
        additional_details:
          type === "roi" ? { roi_type: "tripwire", camera_id: cameraName } : {},
        reference_images: []
      });
      setIsCalibratingROI(false);
      setCalibrationProgress(0);
    }
  }, [isOpen, type, cameraName]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    toast.info("Uploading image and extracting features...");
    setIsSaving(true);

    setTimeout(() => {
      const fakeUrl = URL.createObjectURL(file);
      setCurrentObject((prev) => ({
        ...prev,
        reference_images: [...prev.reference_images, fakeUrl]
      }));
      toast.success("Intelligence profile image updated successfully.");
      setIsSaving(false);
    }, 1200);
  };

  const handleFieldChange = (field: string, value: string) => {
    setCurrentObject((prev) => ({
      ...prev,
      additional_details: {
        ...prev.additional_details,
        [field]: value
      }
    }));
  };

  const handleSaveObject = (e: React.FormEvent) => {
    e.preventDefault();

    let finalName = currentObject.name.trim();
    if (!finalName && currentObject.object_type === "roi") {
      finalName = `Zone ${Math.floor(Math.random() * 1000)}`;
    }

    if (!finalName && currentObject.object_type !== "roi") {
      toast.error("Please enter a name or identifier.");
      return;
    }

    if (currentObject.object_type === "roi") {
      setIsCalibratingROI(true);
      return;
    }

    setIsSaving(true);
    setTimeout(() => {
      toast.success(`Registered subject ${currentObject.unique_id} successfully!`);
      setIsSaving(false);
      onClose(true);
    }, 1000);
  };

  // Simulated ROI drawing calibration
  useEffect(() => {
    if (isCalibratingROI) {
      const interval = setInterval(() => {
        setCalibrationProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            setTimeout(() => {
              toast.success("Security ROI Zone calibrated and registered.");
              setIsCalibratingROI(false);
              onClose(true);
            }, 500);
            return 100;
          }
          return prev + 10;
        });
      }, 150);
      return () => clearInterval(interval);
    }
  }, [isCalibratingROI, onClose]);

  if (!isOpen) return null;

  const getRiskBadgeColor = (level: string) => {
    switch (level) {
      case "Blacklisted":
      case "Restricted":
      case "Wanted":
      case "Perimeter Breach":
        return "#ff003c";
      case "Missing":
      case "Restricted Access":
        return "#ff9900";
      case "Monitoring":
      default:
        return "#0aff0a";
    }
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/85 z-[100000] backdrop-blur-md p-4"
      onClick={() => onClose()}
    >
      <div
        className="hud-panel w-full max-w-[900px] max-h-[90vh] overflow-y-auto rounded-none border border-[rgba(0,243,255,0.2)] bg-[#030f22]/95 shadow-[0_0_30px_rgba(0,243,255,0.1)] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="hud-panel-br"></div>
        {/* Header */}
        <div className="flex justify-between items-center border-b border-[rgba(0,243,255,0.2)] pb-4 mb-6">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-bold text-[var(--hud-cyan)] uppercase tracking-wider font-mono flex items-center gap-2">
              <Target size={18} /> Register Intelligence Subject
            </h2>
            <span className="text-[10px] text-[var(--hud-cyan)] bg-[rgba(0,243,255,0.1)] border border-[rgba(0,243,255,0.3)] px-2 py-0.5 rounded font-mono uppercase">
              {type}
            </span>
          </div>
          <button
            onClick={() => onClose()}
            className="text-gray-400 hover:text-[var(--hud-cyan)] transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        {!isCalibratingROI ? (
          <form onSubmit={handleSaveObject} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column */}
              <div className="space-y-4">
                <h4 className="text-[11px] text-[var(--hud-cyan)] uppercase tracking-widest font-mono border-b border-[rgba(0,243,255,0.15)] pb-1.5 font-bold">
                  Basic Identification
                </h4>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-[rgba(0,243,255,0.7)] uppercase tracking-wider font-mono">
                    Name / Identifier
                  </label>
                  <input
                    required={type !== "roi"}
                    value={currentObject.name}
                    onChange={(e) =>
                      setCurrentObject({ ...currentObject, name: e.target.value })
                    }
                    placeholder={
                      type === "roi"
                        ? "e.g. Main Entry Tripwire (Blank for auto-name)"
                        : type === "vehicle"
                          ? "e.g. Red SUV @ Makati"
                          : "e.g. Juan De La Cruz"
                    }
                    className="w-full bg-[#031129]/60 border border-[rgba(0,243,255,0.2)] rounded px-3 py-2 text-sm text-[#e0f8ff] font-mono focus:border-[var(--hud-cyan)] focus:shadow-[0_0_10px_rgba(0,243,255,0.2)] focus:outline-none"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-[rgba(0,243,255,0.7)] uppercase tracking-wider font-mono">
                    Registry ID (Auto-Generated)
                  </label>
                  <input
                    readOnly
                    value={currentObject.unique_id}
                    className="w-full bg-[#031129]/30 border border-[rgba(0,243,255,0.15)] rounded px-3 py-2 text-sm text-[var(--hud-cyan)] font-mono font-bold opacity-80 cursor-not-allowed"
                  />
                </div>

                {type === "roi" && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] text-[rgba(0,243,255,0.7)] uppercase tracking-wider font-mono">
                      Type of ROI
                    </label>
                    <select
                      value={currentObject.additional_details?.roi_type || "tripwire"}
                      onChange={(e) => {
                        const newType = e.target.value;
                        let defaultRisk = "Monitoring";
                        if (newType === "tripwire") defaultRisk = "Perimeter Breach";
                        else if (newType === "zone") defaultRisk = "Restricted Access";
                        setCurrentObject({
                          ...currentObject,
                          risk_level: defaultRisk,
                          additional_details: {
                            ...currentObject.additional_details,
                            roi_type: newType
                          }
                        });
                      }}
                      className="w-full bg-[#031129]/60 border border-[rgba(0,243,255,0.2)] rounded px-3 py-2 text-sm text-[#e0f8ff] font-mono focus:border-[var(--hud-cyan)] focus:outline-none"
                    >
                      <option value="tripwire">Tripwire (Line Crossing)</option>
                      <option value="zone">Restricted Zone (Polygon Area)</option>
                      <option value="departure">Departure Zone (Asset Guard)</option>
                      <option value="lane">Traffic Lane (Flow Monitor)</option>
                    </select>
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-[rgba(0,243,255,0.7)] uppercase tracking-wider font-mono">
                    Status / Alert Level
                  </label>
                  <select
                    value={currentObject.risk_level}
                    onChange={(e) =>
                      setCurrentObject({ ...currentObject, risk_level: e.target.value })
                    }
                    style={{ color: getRiskBadgeColor(currentObject.risk_level) }}
                    className="w-full bg-[#031129]/60 border border-[rgba(0,243,255,0.2)] rounded px-3 py-2 text-sm font-mono focus:border-[var(--hud-cyan)] focus:outline-none font-bold"
                  >
                    {type === "person" && (
                      <>
                        <option value="Monitoring">Monitoring - Observation Only</option>
                        <option value="Missing">Missing - Report Filed</option>
                        <option value="Wanted">Wanted - Active Search</option>
                        <option value="Blacklisted">Blacklisted - Banned</option>
                      </>
                    )}
                    {type === "vehicle" && (
                      <>
                        <option value="Monitoring">Monitoring - Standard tracking</option>
                        <option value="Missing">Missing - Stolen / Lost</option>
                        <option value="Wanted">Wanted - Linked to incident</option>
                        <option value="Blacklisted">Blacklisted - Prohibited Entry</option>
                      </>
                    )}
                    {type === "asset" && (
                      <>
                        <option value="Monitoring">Monitoring - In warehouse</option>
                        <option value="Missing">Missing - Unaccounted</option>
                        <option value="Blacklisted">Blacklisted - Blocked</option>
                      </>
                    )}
                    {type === "roi" && (
                      <>
                        <option value="Perimeter Breach">Perimeter Breach - Alert on Line Cross</option>
                        <option value="Restricted Access">Restricted Access - High-Security Area</option>
                        <option value="Monitoring">Monitoring - Traffic Stats Only</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-4">
                <h4 className="text-[11px] text-[var(--hud-cyan)] uppercase tracking-widest font-mono border-b border-[rgba(0,243,255,0.15)] pb-1.5 font-bold">
                  Telemetry & Details
                </h4>

                {type !== "roi" && (
                  <div className="bg-[#031534]/50 border border-[rgba(0,243,255,0.15)] rounded p-4 flex gap-4 items-start">
                    <div className="flex-1 space-y-3">
                      <label className="text-[10px] text-[rgba(0,243,255,0.7)] uppercase tracking-wider font-mono block">
                        Reference Image
                      </label>
                      <div className="flex gap-2">
                        <input
                          placeholder="Paste image URL..."
                          className="flex-1 bg-[#031129]/60 border border-[rgba(0,243,255,0.2)] rounded px-2.5 py-1 text-xs text-[#e0f8ff] font-mono focus:border-[var(--hud-cyan)] focus:outline-none"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              const val = (e.target as HTMLInputElement).value;
                              if (val) {
                                setCurrentObject((prev) => ({
                                  ...prev,
                                  reference_images: [...prev.reference_images, val]
                                }));
                                (e.target as HTMLInputElement).value = "";
                              }
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="px-3 bg-[rgba(0,243,255,0.1)] hover:bg-[rgba(0,243,255,0.2)] text-[var(--hud-cyan)] border border-[rgba(0,243,255,0.4)] rounded text-xs flex items-center justify-center transition-colors"
                        >
                          <DownloadIcon size={14} className="rotate-180" />
                        </button>
                        <input
                          type="file"
                          ref={fileInputRef}
                          className="hidden"
                          accept="image/*"
                          onChange={handleImageUpload}
                        />
                      </div>
                      <p className="text-[9px] text-gray-400 font-mono leading-normal">
                        Supports local files. Vision pipeline crops face boxes automatically.
                      </p>
                    </div>

                    {/* Image Preview Box */}
                    <div className="w-[80px] h-[80px] border border-[rgba(0,243,255,0.3)] bg-[#031534] flex items-center justify-center overflow-hidden rounded">
                      {currentObject.reference_images.length > 0 ? (
                        <img
                          src={
                            currentObject.reference_images[
                              currentObject.reference_images.length - 1
                            ]
                          }
                          alt="POI"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="text-center text-[rgba(0,243,255,0.3)]">
                          <ImageIcon size={20} className="mx-auto mb-1" />
                          <div className="text-[8px] font-mono">NO IMAGE</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Dynamic Fields by Type */}
                {type === "person" && (
                  <div className="bg-[#031534]/50 border border-[rgba(0,243,255,0.15)] rounded p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] text-[rgba(0,243,255,0.7)] uppercase font-mono">
                          Gender
                        </label>
                        <select
                          value={currentObject.additional_details.gender || ""}
                          onChange={(e) => handleFieldChange("gender", e.target.value)}
                          className="bg-[#031129]/60 border border-[rgba(0,243,255,0.2)] rounded p-1.5 text-xs font-mono focus:outline-none"
                        >
                          <option value="">Select</option>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                        </select>
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] text-[rgba(0,243,255,0.7)] uppercase font-mono">
                          Age Group
                        </label>
                        <input
                          value={currentObject.additional_details.age || ""}
                          onChange={(e) => handleFieldChange("age", e.target.value)}
                          placeholder="e.g. 25-35"
                          className="bg-[#031129]/60 border border-[rgba(0,243,255,0.2)] rounded p-1.5 text-xs font-mono focus:outline-none"
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] text-[rgba(0,243,255,0.7)] uppercase font-mono">
                        Distinguishing Features
                      </label>
                      <textarea
                        rows={2}
                        value={currentObject.additional_details.features || ""}
                        onChange={(e) => handleFieldChange("features", e.target.value)}
                        placeholder="e.g. Cap, glasses, dark blue jacket..."
                        className="bg-[#031129]/60 border border-[rgba(0,243,255,0.2)] rounded p-1.5 text-xs font-mono focus:outline-none resize-none"
                      />
                    </div>
                  </div>
                )}

                {type === "vehicle" && (
                  <div className="bg-[#031534]/50 border border-[rgba(0,243,255,0.15)] rounded p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] text-[rgba(0,243,255,0.7)] uppercase font-mono">
                          Plate Number
                        </label>
                        <input
                          value={currentObject.additional_details.plate_number || ""}
                          onChange={(e) =>
                            handleFieldChange("plate_number", e.target.value)
                          }
                          placeholder="LTO Plate / Temp"
                          className="bg-[#031129]/60 border border-[rgba(0,243,255,0.2)] rounded p-1.5 text-xs font-mono focus:outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] text-[rgba(0,243,255,0.7)] uppercase font-mono">
                          Color
                        </label>
                        <input
                          value={currentObject.additional_details.color || ""}
                          onChange={(e) => handleFieldChange("color", e.target.value)}
                          placeholder="e.g. Silver, Black"
                          className="bg-[#031129]/60 border border-[rgba(0,243,255,0.2)] rounded p-1.5 text-xs font-mono focus:outline-none"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] text-[rgba(0,243,255,0.7)] uppercase font-mono">
                          Make/Model
                        </label>
                        <input
                          value={currentObject.additional_details.make_model || ""}
                          onChange={(e) =>
                            handleFieldChange("make_model", e.target.value)
                          }
                          placeholder="Toyota Fortuner"
                          className="bg-[#031129]/60 border border-[rgba(0,243,255,0.2)] rounded p-1.5 text-xs font-mono focus:outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] text-[rgba(0,243,255,0.7)] uppercase font-mono">
                          Vehicle Type
                        </label>
                        <select
                          value={currentObject.additional_details.vehicle_type || ""}
                          onChange={(e) =>
                            handleFieldChange("vehicle_type", e.target.value)
                          }
                          className="bg-[#031129]/60 border border-[rgba(0,243,255,0.2)] rounded p-1.5 text-xs font-mono focus:outline-none"
                        >
                          <option value="">Select</option>
                          <option value="Sedan">Sedan</option>
                          <option value="SUV">SUV</option>
                          <option value="Pickup">Pickup</option>
                          <option value="Motorcycle">Motorcycle</option>
                          <option value="Van">Van</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {type === "asset" && (
                  <div className="bg-[#031534]/50 border border-[rgba(0,243,255,0.15)] rounded p-4 space-y-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] text-[rgba(0,243,255,0.7)] uppercase font-mono">
                        Visual ID Tag / Code
                      </label>
                      <input
                        value={currentObject.additional_details.visual_tag || ""}
                        onChange={(e) => handleFieldChange("visual_tag", e.target.value)}
                        placeholder="Tag label visible in video feed"
                        className="bg-[#031129]/60 border border-[rgba(0,243,255,0.2)] rounded p-1.5 text-xs font-mono focus:outline-none"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] text-[rgba(0,243,255,0.7)] uppercase font-mono">
                          Asset Model
                        </label>
                        <input
                          value={currentObject.additional_details.model || ""}
                          onChange={(e) => handleFieldChange("model", e.target.value)}
                          placeholder="e.g. Server Pack"
                          className="bg-[#031129]/60 border border-[rgba(0,243,255,0.2)] rounded p-1.5 text-xs font-mono focus:outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] text-[rgba(0,243,255,0.7)] uppercase font-mono">
                          Classification
                        </label>
                        <input
                          value={currentObject.additional_details.category || ""}
                          onChange={(e) =>
                            handleFieldChange("category", e.target.value)
                          }
                          placeholder="e.g. Tactical / Logistics"
                          className="bg-[#031129]/60 border border-[rgba(0,243,255,0.2)] rounded p-1.5 text-xs font-mono focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {type === "roi" && (
                  <div className="bg-[#031534]/50 border border-[rgba(0,243,255,0.15)] rounded p-4 space-y-2">
                    <label className="text-[9px] text-[rgba(0,243,255,0.7)] uppercase font-mono block">
                      Target Camera Asset
                    </label>
                    <input
                      readOnly
                      value={cameraName.toUpperCase()}
                      className="w-full bg-[#031129]/40 border border-[rgba(0,243,255,0.15)] rounded px-3 py-2 text-xs text-white font-mono opacity-80 cursor-not-allowed"
                    />
                    <p className="text-[9px] text-gray-400 font-mono leading-normal mt-1">
                      The editor will open coordinate calibration overlay on this specific stream feed.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-4 border-t border-[rgba(0,243,255,0.2)] pt-4">
              <button
                type="button"
                onClick={() => onClose()}
                className="flex-1 bg-transparent border border-[rgba(0,243,255,0.3)] hover:bg-[rgba(0,243,255,0.05)] text-[var(--hud-cyan)] py-2.5 rounded font-mono text-xs uppercase tracking-wider transition-colors"
              >
                CANCEL
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="flex-2 bg-[rgba(0,243,255,0.15)] border border-[var(--hud-cyan)] text-[var(--hud-cyan)] hover:bg-[rgba(0,243,255,0.25)] py-2.5 rounded font-mono text-xs uppercase tracking-widest font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(0,243,255,0.1)]"
              >
                {isSaving ? "PROCESSING..." : type === "roi" ? "START CALIBRATION" : "REGISTER IMMEDIATELY"}
              </button>
            </div>
          </form>
        ) : (
          /* ROI Drawing Progress Animation overlay */
          <div className="py-12 flex flex-col items-center justify-center space-y-6">
            <div className="relative w-24 h-24 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-t-[var(--hud-cyan)] border-[rgba(0,243,255,0.1)] animate-spin"></div>
              <Target className="size-8 text-[var(--hud-cyan)] animate-pulse" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-sm font-bold text-[var(--hud-cyan)] uppercase tracking-widest font-mono">
                Calibrating ROI Coordinates...
              </h3>
              <p className="text-xs text-gray-400 font-mono">
                Drawing {currentObject.additional_details?.roi_type} zone on {cameraName.toUpperCase()} mainstream
              </p>
            </div>

            {/* Progress bar */}
            <div className="w-full max-w-md bg-[rgba(255,255,255,0.05)] h-2 border border-[rgba(0,243,255,0.2)] p-0.5">
              <div
                className="bg-[var(--hud-cyan)] h-full transition-all duration-150"
                style={{ width: `${calibrationProgress}%` }}
              ></div>
            </div>
            <div className="text-[10px] text-gray-500 font-mono">
              STAGE: GENERATING VECTORS & TRIPWIRE SEGMENTS ({calibrationProgress}%)
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
