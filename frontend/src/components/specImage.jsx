export const OPERATION_OPTIONS = [
  "OP-010", "OP-020", "OP-020 A & OP-20B", "OP-030", "OP-030A",
  "OP-040", "OP-050", "OP-060", "OP-070", "OP-080", "OP-090",
];

// Resize + convert to JPEG so PDFKit can always embed it and payloads stay small
export const blobToCompressedDataUrl = (blob, maxW = 900, quality = 0.85) =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxW / img.width);
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Invalid image"));
    };
    img.src = url;
  });

// Ctrl+V inside a field
export const imageFromPasteEvent = (e) => {
  const items = e.clipboardData?.items || [];
  for (const it of items) {
    if (it.type && it.type.startsWith("image/")) return it.getAsFile();
  }
  return null;
};

// "Paste Image" button (needs HTTPS / localhost + user permission)
export const imageFromClipboardApi = async () => {
  const items = await navigator.clipboard.read();
  for (const item of items) {
    const type = item.types.find((t) => t.startsWith("image/"));
    if (type) return await item.getType(type);
  }
  return null;
};