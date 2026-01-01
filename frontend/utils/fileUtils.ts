/**
 * File utility functions for common filename operations
 */

/**
 * Extract base name from filename (without extension)
 * @param filename - The filename to process (e.g., "item_image01.jpg")
 * @returns The base name without extension (e.g., "item_image01")
 *
 * @example
 * extractBaseName("item_image01.jpg") // "item_image01"
 * extractBaseName("photo.png") // "photo"
 * extractBaseName("archive.tar.gz") // "archive.tar"
 * extractBaseName("noextension") // "noextension"
 */
export const extractBaseName = (filename: string): string => {
  // Remove directory path if present
  const nameWithoutPath = filename.split('/').pop() || filename;
  const lastDotIndex = nameWithoutPath.lastIndexOf('.');
  return lastDotIndex !== -1 ? nameWithoutPath.substring(0, lastDotIndex) : nameWithoutPath;
};

/**
 * Extract file extension from filename
 * @param filename - The filename to process (e.g., "item_image01.jpg")
 * @returns The extension without dot (e.g., "jpg")
 *
 * @example
 * extractExtension("item_image01.jpg") // "jpg"
 * extractExtension("photo.png") // "png"
 * extractExtension("noextension") // ""
 */
export const extractExtension = (filename: string): string => {
  const lastDotIndex = filename.lastIndexOf('.');
  return lastDotIndex !== -1 ? filename.substring(lastDotIndex + 1) : '';
};
