import ErrorResponse from '../utils/errorResponse.js';
import asyncHandler from '../middlewares/async.middleware.js';
import Message from '../models/message.model.js';
import Conversation from '../models/conversation.model.js';
import User from '../models/user.model.js';

// @desc    Get messages for a conversation
// @route   GET /api/v1/messages?conversation=id
// @access  Private
const getMessages = asyncHandler(async (req, res, next) => {
  const { conversation } = req.query;

  if (!conversation) {
    return next(new ErrorResponse('Vui lòng cung cấp ID cuộc trò chuyện', 400));
  }

  // Kiểm tra xem người dùng có trong cuộc trò chuyện không
  const conversationData = await Conversation.findById(conversation);
  
  if (!conversationData) {
    return next(new ErrorResponse(`Không tìm thấy cuộc trò chuyện với id ${conversation}`, 404));
  }

  // Kiểm tra xem người dùng có quyền xem tin nhắn không
  if (!conversationData.participants.includes(req.user.id)) {
    return next(new ErrorResponse('Không có quyền truy cập cuộc trò chuyện này', 403));
  }

  // Lấy tin nhắn và sắp xếp theo thời gian
  const messages = await Message.find({ conversation })
    .sort({ createdAt: 1 })
    .populate('sender', 'name username avatar');

  // Cập nhật số tin nhắn chưa đọc về 0 cho người dùng hiện tại
  await Conversation.findByIdAndUpdate(conversation, {
    $set: { [`unreadCount.${req.user.id}`]: 0 },
  });

  res.status(200).json({
    success: true,
    count: messages.length,
    data: messages,
  });
});

// @desc    Send a message
// @route   POST /api/v1/messages
// @access  Private
const sendMessage = asyncHandler(async (req, res, next) => {
  const { conversation, content, attachments } = req.body;

  if (!conversation) {
    return next(new ErrorResponse('Vui lòng cung cấp ID cuộc trò chuyện', 400));
  }

  if (!content && (!attachments || attachments.length === 0)) {
    return next(new ErrorResponse('Vui lòng cung cấp nội dung hoặc tệp đính kèm', 400));
  }

  // Kiểm tra xem người dùng có trong cuộc trò chuyện không
  const conversationData = await Conversation.findById(conversation);
  
  if (!conversationData) {
    return next(new ErrorResponse(`Không tìm thấy cuộc trò chuyện với id ${conversation}`, 404));
  }

  // Kiểm tra xem người dùng có quyền gửi tin nhắn không
  if (!conversationData.participants.includes(req.user.id)) {
    return next(new ErrorResponse('Không có quyền gửi tin nhắn trong cuộc trò chuyện này', 403));
  }

  // Tạo tin nhắn mới
  const message = await Message.create({
    sender: req.user.id,
    conversation,
    content,
    attachments,
  });

  // Cập nhật tin nhắn cuối cùng và tăng số tin nhắn chưa đọc cho các thành viên khác
  const updateOperations = {};
  conversationData.participants.forEach(participant => {
    if (participant.toString() !== req.user.id) {
      updateOperations[`unreadCount.${participant}`] = (conversationData.unreadCount.get(participant.toString()) || 0) + 1;
    }
  });

  await Conversation.findByIdAndUpdate(conversation, {
    lastMessage: message._id,
    ...updateOperations,
  });

  // Populate thông tin người gửi
  const populatedMessage = await Message.findById(message._id).populate('sender', 'name username avatar');

  res.status(201).json({
    success: true,
    data: populatedMessage,
  });
});

// @desc    Delete a message
// @route   DELETE /api/v1/messages/:id
// @access  Private
const deleteMessage = asyncHandler(async (req, res, next) => {
  const message = await Message.findById(req.params.id);

  if (!message) {
    return next(new ErrorResponse(`Không tìm thấy tin nhắn với id ${req.params.id}`, 404));
  }

  // Kiểm tra xem người dùng có phải là người gửi tin nhắn không
  if (message.sender.toString() !== req.user.id) {
    return next(new ErrorResponse('Không có quyền xóa tin nhắn này', 403));
  }

  // Đánh dấu tin nhắn đã xóa thay vì xóa hoàn toàn
  message.isDeleted = true;
  message.content = 'Tin nhắn đã bị xóa';
  message.attachments = [];
  await message.save();

  res.status(200).json({
    success: true,
    data: {},
  });
});

// @desc    Mark message as read
// @route   PUT /api/v1/messages/:id/read
// @access  Private
const markAsRead = asyncHandler(async (req, res, next) => {
  const message = await Message.findById(req.params.id);

  if (!message) {
    return next(new ErrorResponse(`Không tìm thấy tin nhắn với id ${req.params.id}`, 404));
  }

  // Kiểm tra xem người dùng có trong cuộc trò chuyện không
  const conversation = await Conversation.findById(message.conversation);
  
  if (!conversation) {
    return next(new ErrorResponse(`Không tìm thấy cuộc trò chuyện`, 404));
  }

  // Kiểm tra xem người dùng có quyền đánh dấu tin nhắn đã đọc không
  if (!conversation.participants.includes(req.user.id)) {
    return next(new ErrorResponse('Không có quyền truy cập cuộc trò chuyện này', 403));
  }

  // Chỉ đánh dấu đã đọc nếu người dùng không phải là người gửi
  if (message.sender.toString() !== req.user.id) {
    message.isRead = true;
    message.readAt = Date.now();
    await message.save();

    // Cập nhật số tin nhắn chưa đọc
    await Conversation.findByIdAndUpdate(message.conversation, {
      $set: { [`unreadCount.${req.user.id}`]: 0 },
    });
  }

  res.status(200).json({
    success: true,
    data: message,
  });
});

export {
  getMessages,
  sendMessage,
  deleteMessage,
  markAsRead
};