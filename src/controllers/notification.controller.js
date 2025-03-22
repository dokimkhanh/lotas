import ErrorResponse from '../utils/errorResponse.js';
import asyncHandler from '../middlewares/async.middleware.js';
import Notification from '../models/notification.model.js';

// @desc    Get all notifications for logged in user
// @route   GET /api/v1/notifications
// @access  Private
const getNotifications = asyncHandler(async (req, res, next) => {
  const notifications = await Notification.find({ recipient: req.user.id })
    .sort({ createdAt: -1 })
    .populate('sender', 'name username avatar')
    .populate('post')
    .populate('comment')
    .populate('group')
    .populate('message');

  res.status(200).json({
    success: true,
    count: notifications.length,
    data: notifications,
  });
});

// @desc    Mark notification as read
// @route   PUT /api/v1/notifications/:id/read
// @access  Private
const markAsRead = asyncHandler(async (req, res, next) => {
  const notification = await Notification.findById(req.params.id);

  if (!notification) {
    return next(
      new ErrorResponse(`Không tìm thấy thông báo với id ${req.params.id}`, 404)
    );
  }

  // Kiểm tra xem người dùng có phải là người nhận thông báo không
  if (notification.recipient.toString() !== req.user.id) {
    return next(
      new ErrorResponse('Không có quyền cập nhật thông báo này', 401)
    );
  }

  notification.isRead = true;
  notification.readAt = Date.now();
  await notification.save();

  res.status(200).json({
    success: true,
    data: notification,
  });
});

// @desc    Mark all notifications as read
// @route   PUT /api/v1/notifications/read-all
// @access  Private
const markAllAsRead = asyncHandler(async (req, res, next) => {
  await Notification.updateMany(
    { recipient: req.user.id, isRead: false },
    { isRead: true, readAt: Date.now() }
  );

  res.status(200).json({
    success: true,
    data: {},
  });
});

// @desc    Delete notification
// @route   DELETE /api/v1/notifications/:id
// @access  Private
const deleteNotification = asyncHandler(async (req, res, next) => {
  const notification = await Notification.findById(req.params.id);

  if (!notification) {
    return next(
      new ErrorResponse(`Không tìm thấy thông báo với id ${req.params.id}`, 404)
    );
  }

  // Kiểm tra xem người dùng có phải là người nhận thông báo không
  if (notification.recipient.toString() !== req.user.id) {
    return next(
      new ErrorResponse('Không có quyền xóa thông báo này', 401)
    );
  }

  await notification.remove();

  res.status(200).json({
    success: true,
    data: {},
  });
});

export {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification
};