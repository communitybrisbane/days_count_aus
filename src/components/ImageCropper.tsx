"use client";

import { useState, useCallback } from "react";
import Cropper, { Area } from "react-easy-crop";

interface ImageCropperProps {
  imageSrc: string;
  onCropComplete: (croppedBlob: Blob) => void;
  onCancel: () => void;
  cropShape?: "rect" | "round";
  outputSize?: number;
}

async function getCroppedImg(
  imageSrc: string,
  pixelCrop: Area,
  outputSize: number,
  round: boolean
): Promise<Blob> {
  const image = new Image();
  image.crossOrigin = "anonymous";
  await new Promise<void>((resolve) => {
    image.onload = () => resolve();
    image.src = imageSrc;
  });

  const canvas = document.createElement("canvas");
  canvas.width = outputSize;
  canvas.height = outputSize;
  const ctx = canvas.getContext("2d")!;

  if (round) {
    ctx.beginPath();
    ctx.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
  }

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    outputSize,
    outputSize
  );

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob!), "image/jpeg", 0.85);
  });
}

export default function ImageCropper({
  imageSrc,
  onCropComplete,
  onCancel,
  cropShape = "rect",
  outputSize = 1024,
}: ImageCropperProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const onCropChange = useCallback((_: unknown, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleConfirm = async () => {
    if (!croppedAreaPixels) return;
    const blob = await getCroppedImg(imageSrc, croppedAreaPixels, outputSize, cropShape === "round");
    onCropComplete(blob);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center">
      <div className="w-full max-w-[450px] h-full max-h-dvh bg-black flex flex-col">
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
        <div className="flex gap-4 p-4 bg-black">
          <button
            onClick={onCancel}
            className="flex-1 py-3 border border-white/30 text-white rounded-xl"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 py-3 bg-aussie-gold text-white font-bold rounded-xl"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
