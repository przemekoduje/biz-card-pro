import * as ImageManipulator from 'expo-image-manipulator';

/**
 * Processes an image for upload and OCR.
 * - Resizes the image if it's too large (max 1920px width/height).
 * - Compresses the image to reduce file size.
 * - Ensures JPEG format.
 * 
 * @param uri The local URI of the image to process.
 * @returns The processed image result containing uri, width, height, and base64 (if requested).
 */
export const processImage = async (uri: string): Promise<ImageManipulator.ImageResult> => {
    try {
        // Basic processing: Resize to a reasonable max dimension to save bandwidth/storage
        // and compress.
        const result = await ImageManipulator.manipulateAsync(
            uri,
            [{ resize: { width: 1080 } }], // Resize width to 1080px (maintain aspect ratio)
            {
                compress: 0.7, // 70% quality
                format: ImageManipulator.SaveFormat.JPEG,
                base64: true // We need base64 for Gemini
            }
        );
        return result;
    } catch (error) {
        console.error("Error processing image:", error);
        throw error;
    }
};
