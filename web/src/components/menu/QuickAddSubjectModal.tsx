import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Download as DownloadIcon,
  Image as ImageIcon,
  Target,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

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
  cameraName,
}: QuickAddSubjectModalProps) {
  const { t } = useTranslation(["views/aiviewsion"]);
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
    reference_images: [] as string[],
  });

  useEffect(() => {
    if (isOpen && type) {
      const generateId = (tVal: string) => {
        const prefix =
          tVal === "vehicle"
            ? "VID-"
            : tVal === "asset"
              ? "AID-"
              : tVal === "roi"
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
        reference_images: [],
      });
      setIsCalibratingROI(false);
      setCalibrationProgress(0);
    }
  }, [isOpen, type, cameraName]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    toast.info(t("quick_add.toast.uploading"));
    setIsSaving(true);

    setTimeout(() => {
      const fakeUrl = URL.createObjectURL(file);
      setCurrentObject((prev) => ({
        ...prev,
        reference_images: [...prev.reference_images, fakeUrl],
      }));
      toast.success(t("quick_add.toast.image_success"));
      setIsSaving(false);
    }, 1200);
  };

  const handleFieldChange = (field: string, value: string) => {
    setCurrentObject((prev) => ({
      ...prev,
      additional_details: {
        ...prev.additional_details,
        [field]: value,
      },
    }));
  };

  const handleSaveObject = (e: React.FormEvent) => {
    e.preventDefault();

    let finalName = currentObject.name.trim();
    if (!finalName && currentObject.object_type === "roi") {
      finalName = `Zone ${Math.floor(Math.random() * 1000)}`;
    }

    if (!finalName && currentObject.object_type !== "roi") {
      toast.error(t("quick_add.toast.name_required"));
      return;
    }

    if (currentObject.object_type === "roi") {
      setIsCalibratingROI(true);
      return;
    }

    setIsSaving(true);
    setTimeout(() => {
      toast.success(
        t("quick_add.toast.register_success", { id: currentObject.unique_id }),
      );
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
              toast.success(t("quick_add.toast.roi_success"));
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
  }, [isCalibratingROI, onClose, t]);

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
      className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md"
      onClick={() => onClose()}
    >
      <div
        className="hud-panel relative max-h-[90vh] w-full max-w-[900px] overflow-y-auto rounded-none border border-[rgba(0,243,255,0.2)] bg-[#030f22]/95 p-6 shadow-[0_0_30px_rgba(0,243,255,0.1)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="hud-panel-br"></div>
        {/* Header */}
        <div className="mb-6 flex items-center justify-between border-b border-[rgba(0,243,255,0.2)] pb-4">
          <div className="flex items-center gap-3">
            <h2 className="flex items-center gap-2 font-mono text-base font-bold uppercase tracking-wider text-[var(--hud-cyan)]">
              <Target size={18} /> {t("quick_add.title")}
            </h2>
            <span className="rounded border border-[rgba(0,243,255,0.3)] bg-[rgba(0,243,255,0.1)] px-2 py-0.5 font-mono text-[10px] uppercase text-[var(--hud-cyan)]">
              {type}
            </span>
          </div>
          <button
            onClick={() => onClose()}
            className="text-gray-400 transition-colors hover:text-[var(--hud-cyan)]"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        {!isCalibratingROI ? (
          <form onSubmit={handleSaveObject} className="space-y-6">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {/* Left Column */}
              <div className="space-y-4">
                <h4 className="border-b border-[rgba(0,243,255,0.15)] pb-1.5 font-mono text-[11px] font-bold uppercase tracking-widest text-[var(--hud-cyan)]">
                  {t("quick_add.basic_identification")}
                </h4>

                <div className="flex flex-col gap-1.5">
                  <label className="font-mono text-[10px] uppercase tracking-wider text-[rgba(0,243,255,0.7)]">
                    {t("quick_add.name_label")}
                  </label>
                  <input
                    required={type !== "roi"}
                    value={currentObject.name}
                    onChange={(e) =>
                      setCurrentObject({
                        ...currentObject,
                        name: e.target.value,
                      })
                    }
                    placeholder={
                      type === "roi"
                        ? t("quick_add.name_placeholder_roi")
                        : type === "vehicle"
                          ? t("quick_add.name_placeholder_vehicle")
                          : t("quick_add.name_placeholder_person")
                    }
                    className="w-full rounded border border-[rgba(0,243,255,0.2)] bg-[#031129]/60 px-3 py-2 font-mono text-sm text-[#e0f8ff] focus:border-[var(--hud-cyan)] focus:shadow-[0_0_10px_rgba(0,243,255,0.2)] focus:outline-none"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-mono text-[10px] uppercase tracking-wider text-[rgba(0,243,255,0.7)]">
                    {t("quick_add.registry_id_label")}
                  </label>
                  <input
                    readOnly
                    value={currentObject.unique_id}
                    className="w-full cursor-not-allowed rounded border border-[rgba(0,243,255,0.15)] bg-[#031129]/30 px-3 py-2 font-mono text-sm font-bold text-[var(--hud-cyan)] opacity-80 focus:outline-none"
                  />
                </div>

                {type === "roi" && (
                  <div className="flex flex-col gap-1.5">
                    <label className="font-mono text-[10px] uppercase tracking-wider text-[rgba(0,243,255,0.7)]">
                      {t("quick_add.type_of_roi")}
                    </label>
                    <select
                      value={
                        currentObject.additional_details?.roi_type || "tripwire"
                      }
                      onChange={(e) => {
                        const newType = e.target.value;
                        let defaultRisk = "Monitoring";
                        if (newType === "tripwire")
                          defaultRisk = "Perimeter Breach";
                        else if (newType === "zone")
                          defaultRisk = "Restricted Access";
                        setCurrentObject({
                          ...currentObject,
                          risk_level: defaultRisk,
                          additional_details: {
                            ...currentObject.additional_details,
                            roi_type: newType,
                          },
                        });
                      }}
                      className="w-full rounded border border-[rgba(0,243,255,0.2)] bg-[#031129]/60 px-3 py-2 font-mono text-sm text-[#e0f8ff] focus:border-[var(--hud-cyan)] focus:outline-none"
                    >
                      <option value="tripwire">
                        {t("quick_add.tripwire")}
                      </option>
                      <option value="zone">
                        {t("quick_add.restricted_zone")}
                      </option>
                      <option value="departure">
                        {t("quick_add.departure_zone")}
                      </option>
                      <option value="lane">
                        {t("quick_add.traffic_lane")}
                      </option>
                    </select>
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  <label className="font-mono text-[10px] uppercase tracking-wider text-[rgba(0,243,255,0.7)]">
                    {t("quick_add.status_alert_level")}
                  </label>
                  <select
                    value={currentObject.risk_level}
                    onChange={(e) =>
                      setCurrentObject({
                        ...currentObject,
                        risk_level: e.target.value,
                      })
                    }
                    style={{
                      color: getRiskBadgeColor(currentObject.risk_level),
                    }}
                    className="w-full rounded border border-[rgba(0,243,255,0.2)] bg-[#031129]/60 px-3 py-2 font-mono text-sm font-bold focus:border-[var(--hud-cyan)] focus:outline-none"
                  >
                    {type === "person" && (
                      <>
                        <option value="Monitoring">
                          {t("quick_add.risk.monitoring_person")}
                        </option>
                        <option value="Missing">
                          {t("quick_add.risk.missing_person")}
                        </option>
                        <option value="Wanted">
                          {t("quick_add.risk.wanted_person")}
                        </option>
                        <option value="Blacklisted">
                          {t("quick_add.risk.blacklisted_person")}
                        </option>
                      </>
                    )}
                    {type === "vehicle" && (
                      <>
                        <option value="Monitoring">
                          {t("quick_add.risk.monitoring_vehicle")}
                        </option>
                        <option value="Missing">
                          {t("quick_add.risk.missing_vehicle")}
                        </option>
                        <option value="Wanted">
                          {t("quick_add.risk.wanted_vehicle")}
                        </option>
                        <option value="Blacklisted">
                          {t("quick_add.risk.blacklisted_vehicle")}
                        </option>
                      </>
                    )}
                    {type === "asset" && (
                      <>
                        <option value="Monitoring">
                          {t("quick_add.risk.monitoring_asset")}
                        </option>
                        <option value="Missing">
                          {t("quick_add.risk.missing_asset")}
                        </option>
                        <option value="Blacklisted">
                          {t("quick_add.risk.blacklisted_asset")}
                        </option>
                      </>
                    )}
                    {type === "roi" && (
                      <>
                        <option value="Perimeter Breach">
                          {t("quick_add.risk.perimeter_breach_desc")}
                        </option>
                        <option value="Restricted Access">
                          {t("quick_add.risk.restricted_access_desc")}
                        </option>
                        <option value="Monitoring">
                          {t("quick_add.risk.monitoring_roi")}
                        </option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-4">
                <h4 className="border-b border-[rgba(0,243,255,0.15)] pb-1.5 font-mono text-[11px] font-bold uppercase tracking-widest text-[var(--hud-cyan)]">
                  {t("quick_add.telemetry_details")}
                </h4>

                {type !== "roi" && (
                  <div className="flex items-start gap-4 rounded border border-[rgba(0,243,255,0.15)] bg-[#031534]/50 p-4">
                    <div className="flex-1 space-y-3">
                      <label className="block font-mono text-[10px] uppercase tracking-wider text-[rgba(0,243,255,0.7)]">
                        {t("quick_add.reference_image")}
                      </label>
                      <div className="flex gap-2">
                        <input
                          placeholder={t("quick_add.paste_url")}
                          className="flex-1 rounded border border-[rgba(0,243,255,0.2)] bg-[#031129]/60 px-2.5 py-1 font-mono text-xs text-[#e0f8ff] focus:border-[var(--hud-cyan)] focus:outline-none"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              const val = (e.target as HTMLInputElement).value;
                              if (val) {
                                setCurrentObject((prev) => ({
                                  ...prev,
                                  reference_images: [
                                    ...prev.reference_images,
                                    val,
                                  ],
                                }));
                                (e.target as HTMLInputElement).value = "";
                              }
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="flex items-center justify-center rounded border border-[rgba(0,243,255,0.4)] bg-[rgba(0,243,255,0.1)] px-3 text-xs text-[var(--hud-cyan)] transition-colors hover:bg-[rgba(0,243,255,0.2)]"
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
                      <p className="font-mono text-[9px] leading-normal text-gray-400">
                        {t("quick_add.image_help")}
                      </p>
                    </div>

                    {/* Image Preview Box */}
                    <div className="flex h-[80px] w-[80px] items-center justify-center overflow-hidden rounded border border-[rgba(0,243,255,0.3)] bg-[#031534]">
                      {currentObject.reference_images.length > 0 ? (
                        <img
                          src={
                            currentObject.reference_images[
                              currentObject.reference_images.length - 1
                            ]
                          }
                          alt="POI"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="text-center text-[rgba(0,243,255,0.3)]">
                          <ImageIcon size={20} className="mx-auto mb-1" />
                          <div className="font-mono text-[8px]">
                            {t("quick_add.no_image")}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Dynamic Fields by Type */}
                {type === "person" && (
                  <div className="space-y-3 rounded border border-[rgba(0,243,255,0.15)] bg-[#031534]/50 p-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="font-mono text-[9px] uppercase text-[rgba(0,243,255,0.7)]">
                          {t("quick_add.gender")}
                        </label>
                        <select
                          value={currentObject.additional_details.gender || ""}
                          onChange={(e) =>
                            handleFieldChange("gender", e.target.value)
                          }
                          className="rounded border border-[rgba(0,243,255,0.2)] bg-[#031129]/60 p-1.5 font-mono text-xs focus:outline-none"
                        >
                          <option value="">{t("quick_add.select")}</option>
                          <option value="Male">{t("quick_add.male")}</option>
                          <option value="Female">
                            {t("quick_add.female")}
                          </option>
                        </select>
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="font-mono text-[9px] uppercase text-[rgba(0,243,255,0.7)]">
                          {t("quick_add.age_group")}
                        </label>
                        <input
                          value={currentObject.additional_details.age || ""}
                          onChange={(e) =>
                            handleFieldChange("age", e.target.value)
                          }
                          placeholder="e.g. 25-35"
                          className="rounded border border-[rgba(0,243,255,0.2)] bg-[#031129]/60 p-1.5 font-mono text-xs focus:outline-none"
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="font-mono text-[9px] uppercase text-[rgba(0,243,255,0.7)]">
                        {t("quick_add.features")}
                      </label>
                      <textarea
                        rows={2}
                        value={currentObject.additional_details.features || ""}
                        onChange={(e) =>
                          handleFieldChange("features", e.target.value)
                        }
                        placeholder={t("quick_add.features_placeholder")}
                        className="resize-none rounded border border-[rgba(0,243,255,0.2)] bg-[#031129]/60 p-1.5 font-mono text-xs focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                {type === "vehicle" && (
                  <div className="space-y-3 rounded border border-[rgba(0,243,255,0.15)] bg-[#031534]/50 p-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="font-mono text-[9px] uppercase text-[rgba(0,243,255,0.7)]">
                          {t("quick_add.plate_number")}
                        </label>
                        <input
                          value={
                            currentObject.additional_details.plate_number || ""
                          }
                          onChange={(e) =>
                            handleFieldChange("plate_number", e.target.value)
                          }
                          placeholder="LTO Plate / Temp"
                          className="rounded border border-[rgba(0,243,255,0.2)] bg-[#031129]/60 p-1.5 font-mono text-xs focus:outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="font-mono text-[9px] uppercase text-[rgba(0,243,255,0.7)]">
                          {t("quick_add.color")}
                        </label>
                        <input
                          value={currentObject.additional_details.color || ""}
                          onChange={(e) =>
                            handleFieldChange("color", e.target.value)
                          }
                          placeholder="e.g. Silver, Black"
                          className="rounded border border-[rgba(0,243,255,0.2)] bg-[#031129]/60 p-1.5 font-mono text-xs focus:outline-none"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="font-mono text-[9px] uppercase text-[rgba(0,243,255,0.7)]">
                          {t("quick_add.make_model")}
                        </label>
                        <input
                          value={
                            currentObject.additional_details.make_model || ""
                          }
                          onChange={(e) =>
                            handleFieldChange("make_model", e.target.value)
                          }
                          placeholder="Toyota Fortuner"
                          className="rounded border border-[rgba(0,243,255,0.2)] bg-[#031129]/60 p-1.5 font-mono text-xs focus:outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="font-mono text-[9px] uppercase text-[rgba(0,243,255,0.7)]">
                          {t("quick_add.vehicle_type")}
                        </label>
                        <select
                          value={
                            currentObject.additional_details.vehicle_type || ""
                          }
                          onChange={(e) =>
                            handleFieldChange("vehicle_type", e.target.value)
                          }
                          className="rounded border border-[rgba(0,243,255,0.2)] bg-[#031129]/60 p-1.5 font-mono text-xs focus:outline-none"
                        >
                          <option value="">{t("quick_add.select")}</option>
                          <option value="Sedan">{t("quick_add.sedan")}</option>
                          <option value="SUV">{t("quick_add.suv")}</option>
                          <option value="Pickup">
                            {t("quick_add.pickup")}
                          </option>
                          <option value="Motorcycle">
                            {t("quick_add.motorcycle")}
                          </option>
                          <option value="Van">{t("quick_add.van")}</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {type === "asset" && (
                  <div className="space-y-3 rounded border border-[rgba(0,243,255,0.15)] bg-[#031534]/50 p-4">
                    <div className="flex flex-col gap-1">
                      <label className="font-mono text-[9px] uppercase text-[rgba(0,243,255,0.7)]">
                        {t("quick_add.visual_id_tag")}
                      </label>
                      <input
                        value={
                          currentObject.additional_details.visual_tag || ""
                        }
                        onChange={(e) =>
                          handleFieldChange("visual_tag", e.target.value)
                        }
                        placeholder={t("quick_add.tag_placeholder")}
                        className="rounded border border-[rgba(0,243,255,0.2)] bg-[#031129]/60 p-1.5 font-mono text-xs focus:outline-none"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="font-mono text-[9px] uppercase text-[rgba(0,243,255,0.7)]">
                          {t("quick_add.asset_model")}
                        </label>
                        <input
                          value={currentObject.additional_details.model || ""}
                          onChange={(e) =>
                            handleFieldChange("model", e.target.value)
                          }
                          placeholder="e.g. Server Pack"
                          className="rounded border border-[rgba(0,243,255,0.2)] bg-[#031129]/60 p-1.5 font-mono text-xs focus:outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="font-mono text-[9px] uppercase text-[rgba(0,243,255,0.7)]">
                          {t("quick_add.classification")}
                        </label>
                        <input
                          value={
                            currentObject.additional_details.category || ""
                          }
                          onChange={(e) =>
                            handleFieldChange("category", e.target.value)
                          }
                          placeholder="e.g. Tactical / Logistics"
                          className="rounded border border-[rgba(0,243,255,0.2)] bg-[#031129]/60 p-1.5 font-mono text-xs focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {type === "roi" && (
                  <div className="space-y-2 rounded border border-[rgba(0,243,255,0.15)] bg-[#031534]/50 p-4">
                    <label className="block font-mono text-[9px] uppercase text-[rgba(0,243,255,0.7)]">
                      {t("quick_add.target_camera_asset")}
                    </label>
                    <input
                      readOnly
                      value={cameraName.toUpperCase()}
                      className="w-full cursor-not-allowed rounded border border-[rgba(0,243,255,0.15)] bg-[#031129]/40 px-3 py-2 font-mono text-xs text-white opacity-80 focus:outline-none"
                    />
                    <p className="mt-1 font-mono text-[9px] leading-normal text-gray-400">
                      {t("quick_add.editor_help")}
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
                className="flex-1 rounded border border-[rgba(0,243,255,0.3)] bg-transparent py-2.5 font-mono text-xs uppercase tracking-wider text-[var(--hud-cyan)] transition-colors hover:bg-[rgba(0,243,255,0.05)]"
              >
                {t("quick_add.cancel")}
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="flex-2 rounded border border-[var(--hud-cyan)] bg-[rgba(0,243,255,0.15)] py-2.5 font-mono text-xs font-bold uppercase tracking-widest text-[var(--hud-cyan)] shadow-[0_0_15px_rgba(0,243,255,0.1)] transition-all hover:bg-[rgba(0,243,255,0.25)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSaving
                  ? t("quick_add.processing")
                  : type === "roi"
                    ? t("quick_add.start_calibration")
                    : t("quick_add.register_immediately")}
              </button>
            </div>
          </form>
        ) : (
          /* ROI Drawing Progress Animation overlay */
          <div className="flex flex-col items-center justify-center space-y-6 py-12">
            <div className="relative flex h-24 w-24 items-center justify-center">
              <div className="absolute inset-0 animate-spin rounded-full border-4 border-[rgba(0,243,255,0.1)] border-t-[var(--hud-cyan)]"></div>
              <Target className="size-8 animate-pulse text-[var(--hud-cyan)]" />
            </div>

            <div className="space-y-2 text-center">
              <h3 className="font-mono text-sm font-bold uppercase tracking-widest text-[var(--hud-cyan)]">
                {t("quick_add.calibrating_roi")}
              </h3>
              <p className="font-mono text-xs text-gray-400">
                {t("quick_add.drawing_zone", {
                  type: currentObject.additional_details?.roi_type,
                  camera: cameraName.toUpperCase(),
                })}
              </p>
            </div>

            {/* Progress bar */}
            <div className="h-2 w-full max-w-md border border-[rgba(0,243,255,0.2)] bg-[rgba(255,255,255,0.05)] p-0.5">
              <div
                className="h-full bg-[var(--hud-cyan)] transition-all duration-150"
                style={{ width: `${calibrationProgress}%` }}
              ></div>
            </div>
            <div className="font-mono text-[10px] text-gray-500">
              {t("quick_add.stage", { progress: calibrationProgress })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
