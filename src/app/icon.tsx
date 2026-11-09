import { appIcon } from "@/lib/app-icon";

export const contentType = "image/png";

// The two sizes the manifest asks for: /icon/192 and /icon/512.
export function generateImageMetadata() {
  return [192, 512].map((px) => ({
    id: String(px),
    size: { width: px, height: px },
    contentType,
  }));
}

export default async function Icon({ id }: { id: Promise<string> }) {
  return appIcon(Number(await id));
}
