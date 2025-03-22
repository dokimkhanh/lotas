import express from 'express';
import {
  getMessages,
  sendMessage,
  deleteMessage,
  markAsRead,
} from '../controllers/message.controller.js';
import { protect } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.use(protect);

router.route('/')
  .get(getMessages)
  .post(sendMessage);

router.route('/:id')
  .delete(deleteMessage);

router.route('/:id/read').put(markAsRead);

export default router;