import { create } from "ffmpeg";

export const videoCompression = async (videoLocalPath, outputPath) => {
  try {
    const video = await create(videoLocalPath);

    await video
      .setVideoBitRate(2000)
      .setAudioCodec("aac")
      .setAudioBitRate(192)
      .setVideoSize("1280x?")
      .save(outputPath);

    return outputPath;
  } catch (error) {
    console.error("Video compression failed:", error);
    throw error;
  }
};
