import { supabase } from "./supabase";
export async function uploadImage(
  file: File,
  bucket: "avatars" | "event-banners",
  userId: string,
): Promise<string> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw Error("Choose a JPG, PNG, or WebP image.");
  const max = bucket === "avatars" ? 2 : 5;
  if (file.size > max * 1024 * 1024)
    throw Error(`Choose an image smaller than ${max} MB.`);
  if (!supabase) {
    if (file.size > 500 * 1024)
      throw Error(
        "For the browser demo, choose an image under 500 KB. Connected Supabase supports larger files.",
      );
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(Error("Could not read this image."));
      reader.readAsDataURL(file);
    });
  }
  const path =
    userId +
    "/" +
    crypto.randomUUID() +
    "." +
    (file.type === "image/jpeg"
      ? "jpg"
      : file.type === "image/png"
        ? "png"
        : "webp");
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { upsert: false });
  if (error) throw error;
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}
