import { Router } from "express";
import {
  getUserChannelProfile,
  getWatchHistory,
  loggedInUser,
  logoutUser,
  refreshAccessToken,
  updateAccountDetails,
  updatePassword,
  updateUserCoverImage,
  updateUserProfileImage,
  userRegister,
  getCurrentUserDetails
} from "../controller/user.controller.js";
import { verifyJWT } from "../middleware/auth.middleware.js";
import { upload } from "../middleware/multer.middleware.js";

const userRouter = Router();

userRouter.route("/register").post(
  upload.fields([
    {
      name: "profileImage",
      maxCount: 1,
    },
    {
      name: "coverImage",
      maxCount: 1,
    },
  ]),

  userRegister
);
userRouter.route("/login").post(loggedInUser);
userRouter.route("/logout").get(verifyJWT, logoutUser);
userRouter.route("/refresh-token").get(refreshAccessToken);
userRouter.route("/current-user").get(verifyJWT, getCurrentUserDetails);

// password and account details
userRouter.route("/update-password").post(verifyJWT, updatePassword);
userRouter.route("/update-profile").patch(verifyJWT, updateAccountDetails);

//image update
userRouter
  .route("/profile-image")
  .patch(verifyJWT, upload.single("profileImage"), updateUserProfileImage);
userRouter
  .route("/cover-image")
  .patch(verifyJWT, upload.single("coverImage"), updateUserCoverImage);

userRouter.route("/channel/:username").get(verifyJWT, getUserChannelProfile);
userRouter.route("/watch-history").get(verifyJWT, getWatchHistory);

export default userRouter;
