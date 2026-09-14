import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../services/cloudinary.js";
import jwt from "jsonwebtoken";

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

export { userRegister, loggedInUser, logoutUser, refreshAccessToken };
