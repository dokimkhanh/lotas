import express from 'express';
import {
  getUsers,
  getUser,
  followUser,
  unfollowUser,
  blockUser,
  unblockUser,
  getUserPosts,
  updateProfile,
  uploadAvatar,
} from '../controllers/user.controller.js';
import { protect } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.use(protect);

router.route('/').get(getUsers);
router.route('/:id').get(getUser);
router.route('/:id/follow').post(followUser);
router.route('/:id/unfollow').post(unfollowUser);
router.route('/:id/block').post(blockUser);
router.route('/:id/unblock').post(unblockUser);
router.route('/:id/posts').get(getUserPosts);
router.route('/profile').put(updateProfile);
router.route('/avatar').post(uploadAvatar);

export default router;