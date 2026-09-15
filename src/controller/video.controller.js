import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { uploadOnCloudinary } from "../services/cloudinary.js";
import mongoose, { isValidObjectId } from "mongoose";
import { Video } from "../models/video.model.js";
import { v2 as cloudindary } from "cloudinary";

// geting all the videos
const getAllVideos = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query;

  const pipeline = [];

  if (query) {
    pipeline.push({
      $match: {
        $or: [
          {
            title: { $regex: query, options: "i" },
          },
          {
            description: { $regex: query, options: "i" },
          },
        ],
      },
    });
  }

  if (userId) {
    if (!isValidObjectId(userId)) {
      throw ApiError.notFound("user is not valid");
    }
    pipeline.push({
      $match: { owner: new mongoose.Types.ObjectId(userId) },
    });
  }
  pipeline.push({ $match: { isPublished: true } });

  pipeline.push({
    $sort:
      sortBy && sortType
        ? { [sortBy]: sortType === "asc" ? 1 : -1 }
        : { createdAt: -1 },
  });

  pipeline.push(
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "ownerDetails",
        pipeline: [{ $project: { username: 1, fullName: 1, "avatar.url": 1 } }],
      },
    },
    { $addFields: { ownerDetails: { $first: "$ownerDetails" } } }
  );
  const videoAggregate = Video.aggregate(pipeline);

  const video = await Video.aggregatePaginate(videoAggregate, {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
  });

  return res
    .status(200)
    .json(new ApiResponse(200, video, "video fetched successfully"));
});

// uploading the video in cloudinary
const publishVideo = asyncHandler(async (req, res) => {
  const { title, description } = req.body;
  // console.log("BODY:", req.body);
  // console.log("FILES:", req.files);

  if ([title, description].some((field) => !field || field.trim() == "")) {
    throw ApiError.badRequest("All fields is required");
  }

  const videoLocalPath = req.files?.videoFile?.[0]?.path;
  const thumbnailLocalPath = req.files?.thumbnail?.[0]?.path;

  if (!videoLocalPath) {
    throw ApiError.badRequest("videoFileLocalPath is required");
  }
  if (!thumbnailLocalPath) {
    throw ApiError.badRequest("thumbnailLocalPath is required");
  }

  const videoFile = await uploadOnCloudinary(videoLocalPath);
  const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);

  if (!videoFile) {
    throw ApiError.badRequest("Video file not found");
  }
  if (!thumbnail) {
    throw ApiError.badRequest("Thumbnail not found");
  }

  const video = await Video.create({
    title,
    description,
    duration: videoFile.duration,
    videoFile: {
      url: videoFile.url,
      public_id: videoFile.public_id,
    },
    thumbnail: {
      url: thumbnail.url,
      public_id: thumbnail.public_id,
    },
    owner: req.user?._id,
    isPublished: false,
  });

  const videoUploaded = await Video.findById(video._id);

  if (!videoUploaded) {
    throw ApiError.badRequest("Video uploaded faild please try again later ");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, video, "Video uploaded successfully"));
});

// get video by id
const getVideoById = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  return res
    .status(200)
    .json(new ApiResponse(200, videoId, "Video fetched successfully"));
});

// update video
const updateVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!isValidObjectId(videoId)) {
    throw ApiError.badRequest("Invalid videoId");
  }

  const { title, description } = req.body;

  if ([title, description].some((field) => field?.trim() === "")) {
    throw ApiError.badRequest("Title and description are required");
  }

  const video = await Video.findById(videoId);

  if (!video) {
    throw ApiError.notFound("Video not found");
  }

  const oldThumbnailPublicId = video.thumbnail?.public_id;

  if (video.owner.toString() !== req.user?._id.toString()) {
    throw ApiError.unauthorized("You are not authorized to update this video");
  }

  const thumbnailLocalPath = req.file?.path;
  let thumbnail;

  if (thumbnailLocalPath) {
    thumbnail = await uploadOnCloudinary(thumbnailLocalPath);

    if (!thumbnail?.url) {
      throw ApiError.badRequest("Error while uploading thumbnail");
    }
  }

  const updatedVideo = await Video.findByIdAndUpdate(
    videoId,
    {
      $set: {
        title,
        description,
        ...(thumbnail && {
          thumbnail: {
            url: thumbnail.url,
            public_id: thumbnail.public_id,
          },
        }),
      },
    },
    { new: true }
  );

  if (oldThumbnailPublicId) {
    await cloudindary.uploader.destroy(oldThumbnailPublicId, "image");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, updatedVideo, "Video details updated successfully")
    );
});

// delete video
const deleteVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!isValidObjectId(videoId)) {
    throw ApiError.badRequest("Invalid videoId");
  }
  const video = await Video.findById(videoId);

  if (!video) {
    throw ApiError.badRequest("Video doesn't exit");
  }

  if (video.owner.toString() !== req.user?._id.toString()) {
    throw ApiError.unauthorized("You are not authorized to delete this video");
  }
  await cloudindary.uploader.destroy(video.videoFile.public_id, "video");
  await cloudindary.uploader.destroy(video.thumbnail.public_id, "image");

  await Video.findByIdAndDelete(videoId);

  return res
    .status(200)
    .json(new ApiResponse(200, video, "Video deleted successfully"));
});

// is video toggled
const togglePublishStatus = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!isValidObjectId(videoId)) {
    throw ApiError.badRequest("Invalid videoId");
  }

  const video = await Video.findById(videoId);

  if (!video) {
    throw ApiError.badRequest("Video doesn't exit");
  }
  if (video.owner.toString() !== req.user?._id.toString()) {
    throw ApiError.unauthorized(
      "You are not authorized to toggle this video's publish status"
    );
  }

  const toggledVideo = await Video.findByIdAndUpdate(
    videoId,
    {
      $set: {
        isPublished: !video.isPublished ,
      },
    },
    { new: true }
  );
  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        toggledVideo,
        `Video ${toggledVideo.isPublished ? "published" : "unpublished"} successfully`
      )
    );
});

export {
  getAllVideos,
  publishVideo,
  getVideoById,
  updateVideo,
  deleteVideo,
  togglePublishStatus,
};
