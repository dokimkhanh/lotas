import express from 'express';
import {
  getPosts,
  getPost,
  createPost,
  updatePost,
  deletePost,
  likePost,
  unlikePost,
  savePost,
  unsavePost,
  getSavedPosts,
  uploadPostImage,
} from '../controllers/post.controller.js';
import { protect } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.use(protect);

router.route('/')
  .get(getPosts)
  .post(createPost);

router.route('/saved').get(getSavedPosts);
router.route('/upload').post(uploadPostImage);

router.route('/:id')
  .get(getPost)
  .put(updatePost)
  .delete(deletePost);

router.route('/:id/like').put(likePost);
router.route('/:id/unlike').put(unlikePost);
router.route('/:id/save').put(savePost);
router.route('/:id/unsave').put(unsavePost);

export default router;