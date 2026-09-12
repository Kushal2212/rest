import { Router } from "express";
import { loggedInUser, userRegister } from "../controller/user.controller.js";

const userRouter = Router()

userRouter.route("/register").post(userRegister)
userRouter.route("/login").post(loggedInUser)

export default userRouter