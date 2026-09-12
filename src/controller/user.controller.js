import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { User } from "../models/user.model.js";



const generateAccessTokenAndRefreshToken = async function (userId) {
  try {
    const user = await User.findById(userId);
    const refreshToken = user.generateAccessToken();
    const accessToken = user.generateRefreshToken();

    user.refreshtoken = refreshToken;
    await user.save({ validateBeforeSave: false });

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

  const user = await User.create({
    username,
    email,
    password,
  });

  await user.save({ validateBeforeSave: true });

  return res
    .status(201)
    .json(new ApiResponse(201, (  "user created successfully")));
});

//Login 

const loggedInUser = asyncHandler(async (req, res) => {
   const {username, email, password} = req.body;

   if (!email && !username){
      throw ApiError.badRequest("Invalid email or username")
   }

   const user = await User.findOne({
      $or: [{email}, {username}]
   })

   if(!user){
      throw ApiError.notFound("User not found")
   }

   const isPasswordValid = await user.isPasswordCorrect(password)

   if(!isPasswordValid){
      throw ApiError.badRequest("Invalid credential")
   }

   const {refreshToken, accessToken} = await generateAccessTokenAndRefreshToken(user._id)

   const loggedInUser = await User.findById(user._id).select(
      "-password, -refreshToken",
   )

   const option ={
      httpOnly:true,
      secure:true
   }

   return res
   .status(200)
   .cookie("accessToken", accessToken, option)
   .cookie("refreshToken", refreshToken, option)
   .json(new ApiResponse(
      200,
      {
         user: loggedInUser,
         accessToken, 
         refreshToken
      },
      "User Logged In successfully"
   ))
})

export { userRegister, loggedInUser };
