import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();

// middleware

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:5174",
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

app.use(express.json({ limit: "16kb" }));
app.use(
  express.urlencoded({
    extended: true,
    limit: "16kb",
  })
);

app.use(express.static("public"));

// imports routes
import userRouter from "./src/routes/user.route.js";
import VideoRouter from "./src/routes/video.route.js"
import subscriptionRouter  from "./src/routes/subscription.route.js";

// routes
app.use("/api/v1/users", userRouter);
app.use("/api/v1/videos", VideoRouter)
app.use("/api/v1/subscriptions", subscriptionRouter)

app.use((err, _, res, next) => {
  const statusCode = err.statusCode || 500;

  res.status(statusCode).json({
    statusCode,
    message: err.message || "Something went wrong",
    success: false,
  });
});

export { app };
