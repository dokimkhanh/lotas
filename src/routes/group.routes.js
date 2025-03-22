import express from 'express';
import {
  getGroups,
  getGroup,
  createGroup,
  updateGroup,
  deleteGroup,
  joinGroup,
  leaveGroup,
  addMember,
  removeMember,
  promoteToModerator,
  demoteFromModerator,
  approvePost,
  rejectPost,
} from '../controllers/group.controller.js';
import { protect } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.use(protect);

router.route('/')
  .get(getGroups)
  .post(createGroup);

router.route('/:id')
  .get(getGroup)
  .put(updateGroup)
  .delete(deleteGroup);

router.route('/:id/join').post(joinGroup);
router.route('/:id/leave').post(leaveGroup);
router.route('/:id/members').post(addMember);
router.route('/:id/members/:userId').delete(removeMember);
router.route('/:id/moderators/:userId').post(promoteToModerator);
router.route('/:id/moderators/:userId').delete(demoteFromModerator);
router.route('/:id/posts/:postId/approve').put(approvePost);
router.route('/:id/posts/:postId/reject').put(rejectPost);

export default router;