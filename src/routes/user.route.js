import { Router } from "express";
import { loggedInUser, logoutUser, userRegister } from "../controller/user.controller.js";
import { verifyJWT } from "../middleware/auth.middleware.js";
import { upload } from "../middleware/multer.middleware.js";


const userRouter = Router()

userRouter.route("/register").post(
    upload.fields([
        {
            name: "profileImage",
            maxCount: 1,
        },
        {
            name: "coverImage",
            maxCount:1,

        }

    ]),

    userRegister)
userRouter.route("/login").post(loggedInUser)
userRouter.route("/logout").get(verifyJWT, logoutUser)

export default userRouter
