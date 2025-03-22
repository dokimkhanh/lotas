import express from 'express';
import {
  getConversations,
  getConversation,
  createConversation,
  deleteConversation,
  createGroupConversation,
  updateGroupConversation,
  addParticipant,
  removeParticipant,
  markAsRead,
  changeAdmin,
  getUnreadCount
} from '../controllers/conversation.controller.js';
import { protect } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.use(protect);

router.route('/')
  .get(getConversations)
  .post(createConversation);

router.route('/group')
  .post(createGroupConversation);

router.route('/:id')
  .get(getConversation)
  .put(updateGroupConversation)
  .delete(deleteConversation);

router.route('/:id/participants')
  .post(addParticipant);

router.route('/:id/participants/:userId')
  .delete(removeParticipant);

router.route('/:id/read')
  .put(markAsRead);

router.route('/:id/admin')
  .put(changeAdmin);

router.route('/unread')
  .get(getUnreadCount);

export default router;