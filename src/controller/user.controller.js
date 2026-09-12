import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { User } from "../models/user.model.js";

const userRegister = asyncHandler(async (req, res) => {
   const {username, email, password} = req.body

   if([username, email, password].some((field)=> !field || field.trim()==="")){
      throw ApiError.badRequest("All field are required")
   }

   const existedUser = await User.findOne({
      $or: [{username},{email}]
   })

   if(existedUser){
      throw ApiError.conflict("User already exist")
   }

   const user = await User.create({
      username,
      email,
      password,
   })

   await user.save({validateBeforeSave: true})

   return res
   .status(201)
   .json(new ApiResponse(201, message="user created successfully"))
   
})

export {userRegister}