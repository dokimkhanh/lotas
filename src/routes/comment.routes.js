import express from 'express';
import {
  getComments,
  getComment,
  addComment,
  addReply,
  updateComment,
  deleteComment,
  likeComment,
  unlikeComment,
} from '../controllers/comment.controller.js';
import { protect } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.use(protect);

router.route('/:id')
  .get(getComment)
  .put(updateComment)
  .delete(deleteComment);

router.route('/:id/replies').post(addReply);
router.route('/:id/like').put(likeComment);
router.route('/:id/unlike').put(unlikeComment);

export default router;