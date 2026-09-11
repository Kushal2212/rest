import mongoose, { Schema } from "mongoose";

const userSchema = new Schema(
  {
    username: {
      type: String,
      required: true,
      unique: [true, "Username must be unique"],
      lowercase: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: [true, "Email must be unique"],
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, "password is required"],
    },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

export { User };
