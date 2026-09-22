import { Router } from "express";
import {
  getAllVideos,
  getVideoById,
  publishVideo,
  updateVideo,
  deleteVideo,
  togglePublishStatus,
  getMyVideos,
} from "../controller/video.controller.js";
import { verifyJWT } from "../middleware/auth.middleware.js";
import { upload } from "../middleware/multer.middleware.js";

const VideoRouter = Router();
VideoRouter.use(verifyJWT); // Apply verifyJWT middleware to all routes in this file

VideoRouter.route("/upload-videos").post(
  upload.fields([
    {
      name: "videoFile",
      maxCount: 1,
    },
    {
      name: "thumbnail",
      maxCount: 1,
    },
  ]),
  publishVideo
);

VideoRouter.route("/getAll-videos").get(getAllVideos);
VideoRouter.route('/getMyVideos').get(getMyVideos)


VideoRouter.route("/:videoId")
  .patch(upload.single("thumbnail"), updateVideo)
  .get(getVideoById)
  .delete(deleteVideo);

VideoRouter.route("/toggle/publish/:videoId").patch(togglePublishStatus);

export default VideoRouter;
