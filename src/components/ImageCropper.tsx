"use client";

import { useState, useCallback } from "react";
import Cropper, { Area } from "react-easy-crop";
import { compressCroppedImage } from "@/lib/imageUtils";
import { POST_IMAGE_SIZE } from "@/lib/constants";

interface ImageCropperProps {
  imageSrc: string;
  onCropComplete: (croppedBlob: Blob) => void;
  onCancel: () => void;
  cropShape?: "rect" | "round";
  outputSize?: number;
}

export default function ImageCropper({
  imageSrc,
  onCropComplete,
  onCancel,
  cropShape = "rect",
  outputSize = POST_IMAGE_SIZE,
}: ImageCropperProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const onCropChange = useCallback((_: unknown, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleConfirm = async () => {
    if (!croppedAreaPixels) return;
    const blob = await compressCroppedImage(imageSrc, croppedAreaPixels, outputSize, cropShape === "round");
    onCropComplete(blob);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      {/* Top bar: Cancel left, Confirm right */}
      <div
        className="shrink-0 flex items-center justify-between px-4 py-3 z-10"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top, 0px))" }}
      >
        <button
          onClick={onCancel}
          className="text-white/70 text-sm font-medium px-3 py-2 active:text-white"
        >
          Cancel
        </button>
        <button
          onClick={handleConfirm}
          className="bg-accent-orange text-white text-sm font-bold px-5 py-2 rounded-full active:scale-[0.96]"
        >
          Done
        </button>
      </div>

      {/* Crop area */}
      <div className="relative flex-1">
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          aspect={1}
          cropShape={cropShape}
          showGrid={cropShape === "rect"}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropChange}
        />
      </div>
    </div>
  );
}
