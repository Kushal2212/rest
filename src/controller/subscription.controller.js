import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Subscription } from "../models/subscriptions.model.js";
import { User } from "../models/user.model.js";

// toggle subscription
const toggleSubscription = asyncHandler(async (req, res) => {
  const { channelId } = req.params;

  console.log("channelId:", channelId);

  if (!channelId) {
    throw ApiError.badRequest("Invalid channel Id");
  }

  const channel = await User.findById(channelId);

  if (!channel) {
    throw ApiError.badRequest("Channel doesn't exist");
  }

  if (channelId === req.user?._id.toString()) {
    throw ApiError.unauthorized("You can't subscribe to your own channel");
  }

  const existingSubscription = await Subscription.findOne({
    subscriber: req.user?._id,
    channel: channelId,
  });

  if (existingSubscription) {
    await Subscription.findByIdAndDelete(existingSubscription._id);

    return res
      .status(200)
      .json(new ApiResponse(200, null, "Unsubscribed successfully"));
  }

  const newSubscription = await Subscription.create({
    subscriber: req.user?._id,
    channel: channelId,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, newSubscription, "Subscribed successfully"));
});

// get user subscriber
const getUserChannelSubscribers = asyncHandler(async (req, res) => {
  const { username } = req.params;

  if (!username?.trim()) {
    throw new ApiError(400, "Username is missing");
  }

  const channel = await User.aggregate([
    {
      $match: { username: username?.toLowerCase() },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "channel",
        as: "subscribers",
        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "subscriber",
              foreignField: "_id",
              as: "subscriberDetails",
              pipeline: [
                {
                  $project: {
                    username: 1,
                    fullName: 1,
                    "avatar.url": 1,
                  },
                },
              ],
            },
          },
          {
            $addFields: {
              subscriberDetails: { $first: "$subscriberDetails" },
            },
          },
          {
            $replaceRoot: { newRoot: "$subscriberDetails" },
          },
        ],
      },
    },
    {
      $addFields: {
        subscribersCount: { $size: "$subscribers" },
      },
    },
    {
      $project: {
        username: 1,
        subscribersCount: 1,
        subscribers: 1,
      },
    },
  ]);

  if (!channel?.length) {
    throw new ApiError(404, "Channel does not exist");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, channel[0], "Subscribers fetched successfully"));
});

// controller to return channel list to which user has subscribed
const getSubscribedChannels = asyncHandler(async (req, res) => {
  const { subscriberId } = req.params;

  if (!isValidObjectId(subscriberId)) {
    throw new ApiError(400, "Invalid subscriberId");
  }

  const subscribedChannels = await Subscription.aggregate([
    {
      $match: {
        subscriber: new mongoose.Types.ObjectId(subscriberId),
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "channel",
        foreignField: "_id",
        as: "channelDetails",
        pipeline: [
          {
            $project: {
              username: 1,
              fullName: 1,
              "avatar.url": 1,
            },
          },
        ],
      },
    },
    {
      $addFields: {
        channelDetails: { $first: "$channelDetails" },
      },
    },
    {
      $replaceRoot: { newRoot: "$channelDetails" },
    },
  ]);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        subscribedChannels,
        "Subscribed channels fetched successfully"
      )
    );
});

export { 
  toggleSubscription, 
  getUserChannelSubscribers, 
  getSubscribedChannels 
};
