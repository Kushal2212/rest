import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../services/cloudinary.js";
import jwt from "jsonwebtoken";
import { v2 as cloudinary } from "cloudinary";

//generate access and refresh token
const generateAccessTokenAndRefreshToken = async function (userId) {
  try {
    const user = await User.findById(userId);
    const refreshToken = await user.generateRefreshToken();
    const accessToken = await user.generateAccessToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    // console.log("saved refreshToken:", user.refreshToken);

    return { refreshToken, accessToken };
  } catch (error) {
    throw new ApiError.internal(
      "Something went wrong while generating Access and Refresh Token."
    );
  }
};

//User Resgistration
const userRegister = asyncHandler(async (req, res) => {
  const { username, email, password } = req.body;

  if (
    [username, email, password].some((field) => !field || field.trim() === "")
  ) {
    throw ApiError.badRequest("All field are required");
  }

  const existedUser = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (existedUser) {
    throw ApiError.conflict("User already exist");
  }

  const profileImageLocalPath = req.files?.profileImage[0]?.path;
  //const coverImageLocalPath = req.files?.coverImage[0]?.path;

  let coverImageLocalPath;
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }

  if (!profileImageLocalPath) {
    throw ApiError.badRequest("profile file is required");
  }

  const profileImage = await uploadOnCloudinary(profileImageLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);
  // console.log("profile:", profileImage)
  // console.log("cover:",  coverImage)

  if (!profileImage) {
    throw ApiError.badRequest("Profile is required");
  }

  const user = await User.create({
    username: username.toLowerCase(),
    profileImage: profileImage.url,
    coverImage: coverImage?.url || "",
    email,
    password,
  });

  await user.save({ validateBeforeSave: true });

  return res
    .status(201)
    .json(new ApiResponse(201, "user created successfully"));
});

//Login
const loggedInUser = asyncHandler(async (req, res) => {
  const { username, email, password } = req.body;

  if (!email && !username) {
    throw ApiError.badRequest("Invalid email or username");
  }

  const user = await User.findOne({
    $or: [{ email }, { username }],
  });

  if (!user) {
    throw ApiError.notFound("User not found");
  }

  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw ApiError.badRequest("Invalid credential");
  }

  const { refreshToken, accessToken } =
    await generateAccessTokenAndRefreshToken(user._id);

  const loggedInUser = await User.findById(user._id).select(
    "-password, -refreshToken"
  );

  const option = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, option)
    .cookie("refreshToken", refreshToken, option)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "User Logged In successfully"
      )
    );
});

//logout
const logoutUser = asyncHandler(async (req, res) => {
  const user = await User.findOneAndUpdate(
    req.username,
    {
      $unset: {
        refreshToken: 1,
      },
    },
    {
      new: true,
    }
  );
  const option = {
    httpOnly: true,
    secure: false,
  };
  return res
    .clearCookie("accessToken", option)
    .clearCookie("refreshToken", option)
    .json(new ApiResponse(200, user, "User logout successfully"));
});

// generate access token
const refreshAccessToken = asyncHandler(async (req, res) => {
  //1. Get refresh token
  //2. Does it exist?
  //3. Verify its JWT signature/expiry
  //4. Find the user
  /*5. Does this refresh token match
   the one currently stored for the user?*/
  /*6. Generate NEW access token
   + NEW refresh token */
  //7. Replace old refresh token
  //8. Send both to client
  const incomingRefreshToken = req.cookie.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
    throw ApiError.badRequest("Unauthorized request");
  }
  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );
    const user = await User.findById(decodedToken?._id);
    if (!user) {
      throw ApiError.notFound("Invalid token");
    }

    if (incomingRefreshToken !== user?.refreshToken) {
      throw ApiError.badRequest("Token expired or already used");
    }

    const { accessToken, newRefreshToken } =
      await generateAccessTokenAndRefreshToken(user._id);

    const options = {
      httpOnly: true,
      secure: true,
    };

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          { accessToken: accessToken, refreshToken: newRefreshToken },
          "access token refreshed"
        )
      );
  } catch (error) {
    throw ApiError.badRequest(error?.message || "Invalid refresh token");
  }
});

// update password
const updatePassword = asyncHandler(async (req, res) => {
  const { newpassword, oldpassword } = req.body;

  const user = await User.findById(req.user?._id);
  const isPasswordCorrect = await user.isPasswordCorrect(oldpassword);
  if (!isPasswordCorrect) {
    throw ApiError.badRequest("Incorrect oldPassword");
  }
  user.password = newpassword;

  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully"));
});

//update Account details
const updateAccountDetails = asyncHandler(async (req, res) => {
  const { email, username } = req.body;

  if (!email || !username) {
    throw ApiError.badRequest("All fields are required");
  }
  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        username: username,
        email: email,
      },
    },
    { new: true }
  ).select("-passwrod");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated successfully"));
});

// update user profile image
const updateUserProfileImage = asyncHandler(async (req, res) => {
  const profileImageLocalPath = req.file?.path;

  if (!profileImageLocalPath) {
    throw ApiError.badRequest("Profile file is missing");
  }

  const existingUser = await User.findById(req.user?._id);

  if (!existingUser) {
    throw ApiError.notFound("User not found");
  }
  //deleting the old profile image
  if (existingUser.profileImage.public_id) {
    await cloudinary.uploader.destroy(existingUser.profileImage.public_id);
  }

  const profileImage = await uploadOnCloudinary(profileImageLocalPath);

  if (!profileImage || !profileImage.url) {
    throw ApiError.badRequest("Error while uploading profile image");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        profileImage: profileImage.url,
        public_id: profileImage.public_id,
      },
    },
    { new: true }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Profile image upadated successfully"));
});

//update user cover image
const updateUserCoverImage = asyncHandler(async (req, res) => {
  const coverImageLocalPath = req.file?.path;

  if (!coverImageLocalPath) {
    throw ApiError.badRequest("Profile file is missing");
  }

  const existingUser = await User.findById(req.user?._id);

  if (!existingUser) {
    throw ApiError.notFound("User not found");
  }
  //deleting the old profile image
  if (existingUser.coverImage.public_id) {
    await cloudinary.uploader.destroy(existingUser.coverImage.public_id);
  }

  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!coverImage || !coverImage.url) {
    throw ApiError.badRequest("Error while uploading cover image");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        coverImage: coverImage.url,
        public_id: coverImage.public_id,
      },
    },
    { new: true }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Cover image upadated successfully"));
});

//get user details
const getCurrentUserDetails = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, "User fetched successfully"));
});

//get user channel profile
const getUserChannelProfile = asyncHandler(async (req, res) => {
  const { username } = req.param;

  if (!username.trim()) {
    throw ApiError.notFound("User not found");
  }
  const channel = await User.aggregate([
    {
      $match: { username: username?.toLowerCase() },
    },
    {
      $lookup: {
        from: "subscription",
        localField: "_id",
        foreignField: "channel",
        as: "subscriber",
      },
    },
    {
      $lookup: {
        from: "subscription",
        localField: "_id",
        foreignField: "subscriber",
        as: "subscribedTo",
      },
    },
    {
      $addFields: {
        subscriberCount: {
          $size: "$subscriber",
        },
        channelsSubscribedToCount: {
          $size: "$subscribedTo",
        },
        isSubscribed: {
          $cond: {
            if: { $in: [req.user?._id, "$subscriber.subscriber"] },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $project: {
        fullName: 1,
        username: 1,
        subscriberCount: 1,
        channelsSubscribedToCount: 1,
        isSubscribed: 1,
        avatar: 1,
        coverImage: 1,
        email: 1,
      },
    },
  ]);
  if (!channel?.length) {
    throw new ApiError(400, "Channel does not exit");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, channel[0], "user channel fetched successfully")
    );
});

//get user watch history
const getWatchHistory = asyncHandler(async (req, res) => {
  const user = await User.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(req.user._id),
      },
    },
    {
      $lookup: {
        from: "videos",
        localField: "watchHistory",
        foreignField: "_id",
        as: "watchHistory",
        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "owner",
              pipeline: [
                {
                  $project: {
                    fullName: 1,
                    username: 1,
                    avatar: 1,
                  },
                },
              ],
            },
          },
          {
            $addFields: {
              owner: {
                $first: "$owner",
              },
            },
          },
        ],
      },
    },
  ]);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        user[0].watchHistory,
        "Watch history fetched successfully"
      )
    );
});

export {
  userRegister,
  loggedInUser,
  logoutUser,
  refreshAccessToken,
  updatePassword,
  updateAccountDetails,
  updateUserProfileImage,
  updateUserCoverImage,
  getCurrentUserDetails,
  getUserChannelProfile,
  getWatchHistory,
};
