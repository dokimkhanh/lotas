import ErrorResponse from '../utils/errorResponse.js';
import asyncHandler from '../middlewares/async.middleware.js';
import Group from '../models/group.model.js';
import User from '../models/user.model.js';
import Post from '../models/post.model.js';
import Notification from '../models/notification.model.js';
import path from 'path';

// @desc    Get all groups
// @route   GET /api/v1/groups
// @access  Private
const getGroups = asyncHandler(async (req, res, next) => {
  // Lấy danh sách người dùng bị chặn
  const blockedUsers = req.user.blockedUsers;

  // Lấy danh sách nhóm không thuộc về người dùng bị chặn
  const groups = await Group.find({
    admin: { $nin: blockedUsers },
  })
    .sort({ createdAt: -1 })
    .populate('admin', 'name username avatar')
    .populate('members', 'name username avatar');

  res.status(200).json({
    success: true,
    count: groups.length,
    data: groups,
  });
});

// @desc    Get single group
// @route   GET /api/v1/groups/:id
// @access  Private
const getGroup = asyncHandler(async (req, res, next) => {
  const group = await Group.findById(req.params.id)
    .populate('admin', 'name username avatar')
    .populate('members', 'name username avatar')
    .populate({
      path: 'posts',
      select: 'content image likes comments createdAt',
      options: { sort: { createdAt: -1 } },
      populate: {
        path: 'user',
        select: 'name username avatar',
      },
    });

  if (!group) {
    return next(
      new ErrorResponse(`Không tìm thấy nhóm với id ${req.params.id}`, 404)
    );
  }

  // Kiểm tra nếu nhóm thuộc về người dùng bị chặn
  if (req.user.blockedUsers.includes(group.admin._id)) {
    return next(
      new ErrorResponse('Bạn đã bị người dùng này chặn', 403)
    );
  }

  res.status(200).json({
    success: true,
    data: group,
  });
});

// Xuất tất cả các hàm từ một nơi duy nhất ở cuối file
export {
  getGroups,
  getGroup
};