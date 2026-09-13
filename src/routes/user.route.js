import { Router } from "express";
import { loggedInUser, logoutUser, userRegister } from "../controller/user.controller.js";

const userRouter = Router()

userRouter.route("/register").post(userRegister)
userRouter.route("/login").post(loggedInUser)
userRouter.route("/logout").get(logoutUser)

export default userRouter