import ErrorResponse from '../utils/errorResponse.js';
import asyncHandler from '../middlewares/async.middleware.js';
import Conversation from '../models/conversation.model.js';
import User from '../models/user.model.js';
import Message from '../models/message.model.js';

// @desc    Get all conversations for logged in user
// @route   GET /api/v1/conversations
// @access  Private
const getConversations = asyncHandler(async (req, res, next) => {
  const conversations = await Conversation.find({
    participants: { $elemMatch: { $eq: req.user.id } },
  })
    .populate('participants', 'name username avatar isOnline lastActive')
    .populate('lastMessage')
    .populate('admin', 'name username avatar')
    .sort({ updatedAt: -1 });

  res.status(200).json({
    success: true,
    count: conversations.length,
    data: conversations,
  });
});

// @desc    Get single conversation
// @route   GET /api/v1/conversations/:id
// @access  Private
const getConversation = asyncHandler(async (req, res, next) => {
  const conversation = await Conversation.findById(req.params.id)
    .populate('participants', 'name username avatar isOnline lastActive')
    .populate('lastMessage')
    .populate('admin', 'name username avatar');

  if (!conversation) {
    return next(
      new ErrorResponse(`Không tìm thấy cuộc trò chuyện với id ${req.params.id}`, 404)
    );
  }

  // Kiểm tra xem người dùng có trong cuộc trò chuyện không
  if (!conversation.participants.some(p => p._id.toString() === req.user.id)) {
    return next(
      new ErrorResponse('Không có quyền truy cập cuộc trò chuyện này', 403)
    );
  }

  res.status(200).json({
    success: true,
    data: conversation,
  });
});

// @desc    Create new conversation (1-1)
// @route   POST /api/v1/conversations
// @access  Private
const createConversation = asyncHandler(async (req, res, next) => {
  const { receiverId } = req.body;

  if (!receiverId) {
    return next(new ErrorResponse('Vui lòng cung cấp ID người nhận', 400));
  }

  // Kiểm tra xem người nhận có tồn tại không
  const receiver = await User.findById(receiverId);
  if (!receiver) {
    return next(new ErrorResponse(`Không tìm thấy người dùng với id ${receiverId}`, 404));
  }

  // Kiểm tra xem người dùng có bị chặn bởi người nhận không
  if (receiver.blockedUsers.includes(req.user.id)) {
    return next(new ErrorResponse('Bạn đã bị người dùng này chặn', 403));
  }

  // Kiểm tra xem cuộc trò chuyện đã tồn tại chưa
  const existingConversation = await Conversation.findOne({
    isGroup: false,
    participants: { $all: [req.user.id, receiverId], $size: 2 },
  });

  if (existingConversation) {
    return res.status(200).json({
      success: true,
      data: existingConversation,
    });
  }

  // Tạo cuộc trò chuyện mới
  const conversation = await Conversation.create({
    participants: [req.user.id, receiverId],
    isGroup: false,
    unreadCount: {
      [req.user.id]: 0,
      [receiverId]: 0,
    },
  });

  // Populate thông tin người tham gia
  const populatedConversation = await Conversation.findById(conversation._id)
    .populate('participants', 'name username avatar isOnline lastActive');

  res.status(201).json({
    success: true,
    data: populatedConversation,
  });
});

// @desc    Create new group conversation
// @route   POST /api/v1/conversations/group
// @access  Private
const createGroupConversation = asyncHandler(async (req, res, next) => {
  const { name, participants } = req.body;

  if (!name) {
    return next(new ErrorResponse('Vui lòng cung cấp tên nhóm', 400));
  }

  if (!participants || !Array.isArray(participants) || participants.length === 0) {
    return next(new ErrorResponse('Vui lòng cung cấp danh sách người tham gia', 400));
  }

  // Thêm người tạo vào danh sách người tham gia
  const allParticipants = [...new Set([req.user.id, ...participants])];

  // Kiểm tra xem tất cả người tham gia có tồn tại không
  const users = await User.find({ _id: { $in: allParticipants } });
  if (users.length !== allParticipants.length) {
    return next(new ErrorResponse('Một số người dùng không tồn tại', 404));
  }

  // Kiểm tra xem người tạo có bị chặn bởi bất kỳ người tham gia nào không
  for (const user of users) {
    if (user._id.toString() !== req.user.id && user.blockedUsers.includes(req.user.id)) {
      return next(new ErrorResponse(`Bạn đã bị người dùng ${user.username} chặn`, 403));
    }
  }

  // Tạo cuộc trò chuyện nhóm mới
  const unreadCount = {};
  allParticipants.forEach(p => {
    unreadCount[p] = 0;
  });

  const conversation = await Conversation.create({
    participants: allParticipants,
    isGroup: true,
    groupName: name,
    admin: req.user.id,
    unreadCount,
  });

  // Populate thông tin người tham gia
  const populatedConversation = await Conversation.findById(conversation._id)
    .populate('participants', 'name username avatar isOnline lastActive')
    .populate('admin', 'name username avatar');

  res.status(201).json({
    success: true,
    data: populatedConversation,
  });
});

// @desc    Update group conversation
// @route   PUT /api/v1/conversations/:id
// @access  Private
const updateGroupConversation = asyncHandler(async (req, res, next) => {
  const { groupName, groupAvatar } = req.body;
  
  let conversation = await Conversation.findById(req.params.id);

  if (!conversation) {
    return next(
      new ErrorResponse(`Không tìm thấy cuộc trò chuyện với id ${req.params.id}`, 404)
    );
  }

  // Kiểm tra xem đây có phải là cuộc trò chuyện nhóm không
  if (!conversation.isGroup) {
    return next(new ErrorResponse('Không thể cập nhật cuộc trò chuyện không phải nhóm', 400));
  }

  // Kiểm tra xem người dùng có phải là admin của nhóm không
  if (conversation.admin.toString() !== req.user.id) {
    return next(new ErrorResponse('Chỉ admin mới có thể cập nhật thông tin nhóm', 403));
  }

  // Cập nhật thông tin nhóm
  const updateData = {};
  if (groupName) updateData.groupName = groupName;
  if (groupAvatar) updateData.groupAvatar = groupAvatar;

  conversation = await Conversation.findByIdAndUpdate(
    req.params.id,
    updateData,
    { new: true, runValidators: true }
  )
    .populate('participants', 'name username avatar isOnline lastActive')
    .populate('admin', 'name username avatar');

  res.status(200).json({
    success: true,
    data: conversation,
  });
});

// @desc    Add participants to group conversation
// @route   PUT /api/v1/conversations/:id/participants
// @access  Private
const addParticipants = asyncHandler(async (req, res, next) => {
  const { participants } = req.body;

  if (!participants || !Array.isArray(participants) || participants.length === 0) {
    return next(new ErrorResponse('Vui lòng cung cấp danh sách người tham gia', 400));
  }

  let conversation = await Conversation.findById(req.params.id);

  if (!conversation) {
    return next(
      new ErrorResponse(`Không tìm thấy cuộc trò chuyện với id ${req.params.id}`, 404)
    );
  }

  // Kiểm tra xem đây có phải là cuộc trò chuyện nhóm không
  if (!conversation.isGroup) {
    return next(new ErrorResponse('Không thể thêm người tham gia vào cuộc trò chuyện không phải nhóm', 400));
  }

  // Kiểm tra xem người dùng có phải là admin của nhóm không
  if (conversation.admin.toString() !== req.user.id) {
    return next(new ErrorResponse('Chỉ admin mới có thể thêm người tham gia', 403));
  }

  // Kiểm tra xem tất cả người tham gia có tồn tại không
  const users = await User.find({ _id: { $in: participants } });
  if (users.length !== participants.length) {
    return next(new ErrorResponse('Một số người dùng không tồn tại', 404));
  }

  // Kiểm tra xem người tham gia đã có trong nhóm chưa
  const newParticipants = participants.filter(
    p => !conversation.participants.includes(p)
  );

  if (newParticipants.length === 0) {
    return next(new ErrorResponse('Tất cả người dùng đã có trong nhóm', 400));
  }

  // Kiểm tra xem người tạo có bị chặn bởi bất kỳ người tham gia mới nào không
  for (const user of users) {
    if (user.blockedUsers.includes(req.user.id)) {
      return next(new ErrorResponse(`Bạn đã bị người dùng ${user.username} chặn`, 403));
    }
  }

  // Thêm người tham gia mới vào nhóm
  conversation = await Conversation.findByIdAndUpdate(
    req.params.id,
    {
      $push: { participants: { $each: newParticipants } },
    },
    { new: true, runValidators: true }
  )
    .populate('participants', 'name username avatar isOnline lastActive')
    .populate('admin', 'name username avatar');

  // Cập nhật unreadCount cho người tham gia mới
  const unreadCountUpdate = {};
  newParticipants.forEach(p => {
    unreadCountUpdate[`unreadCount.${p}`] = 0;
  });

  await Conversation.findByIdAndUpdate(req.params.id, { $set: unreadCountUpdate });

  res.status(200).json({
    success: true,
    data: conversation,
  });
});

// @desc    Remove participant from group conversation
// @route   PUT /api/v1/conversations/:id/participants/:userId
// @access  Private
const removeParticipant = asyncHandler(async (req, res, next) => {
  let conversation = await Conversation.findById(req.params.id);

  if (!conversation) {
    return next(
      new ErrorResponse(`Không tìm thấy cuộc trò chuyện với id ${req.params.id}`, 404)
    );
  }

  // Kiểm tra xem đây có phải là cuộc trò chuyện nhóm không
  if (!conversation.isGroup) {
    return next(new ErrorResponse('Không thể xóa người tham gia khỏi cuộc trò chuyện không phải nhóm', 400));
  }

  // Kiểm tra xem người dùng có phải là admin của nhóm không
  if (conversation.admin.toString() !== req.user.id) {
    return next(new ErrorResponse('Chỉ admin mới có thể xóa người tham gia', 403));
  }

  // Kiểm tra xem người dùng có trong nhóm không
  if (!conversation.participants.includes(req.params.userId)) {
    return next(new ErrorResponse('Người dùng không có trong nhóm', 400));
  }

  // Không thể xóa admin khỏi nhóm
  if (req.params.userId === req.user.id) {
    return next(new ErrorResponse('Không thể xóa admin khỏi nhóm', 400));
  }

  // Xóa người tham gia khỏi nhóm
  conversation = await Conversation.findByIdAndUpdate(
    req.params.id,
    {
      $pull: { participants: req.params.userId },
    },
    { new: true, runValidators: true }
  )
    .populate('participants', 'name username avatar isOnline lastActive')
    .populate('admin', 'name username avatar');

  res.status(200).json({
    success: true,
    data: conversation,
  });
});

// @desc    Leave group conversation
// @route   PUT /api/v1/conversations/:id/leave
// @access  Private
const leaveConversation = asyncHandler(async (req, res, next) => {
  let conversation = await Conversation.findById(req.params.id);

  if (!conversation) {
    return next(
      new ErrorResponse(`Không tìm thấy cuộc trò chuyện với id ${req.params.id}`, 404)
    );
  }

  // Kiểm tra xem đây có phải là cuộc trò chuyện nhóm không
  if (!conversation.isGroup) {
    return next(new ErrorResponse('Không thể rời khỏi cuộc trò chuyện không phải nhóm', 400));
  }

  // Kiểm tra xem người dùng có trong nhóm không
  if (!conversation.participants.includes(req.user.id)) {
    return next(new ErrorResponse('Bạn không có trong nhóm này', 400));
  }

  // Nếu người dùng là admin, cần chuyển quyền admin cho người khác
  if (conversation.admin.toString() === req.user.id) {
    // Tìm người tham gia khác để chuyển quyền admin
    const newAdmin = conversation.participants.find(
      p => p.toString() !== req.user.id
    );

    // Nếu không còn ai khác trong nhóm, xóa cuộc trò chuyện
    if (!newAdmin) {
      await Conversation.findByIdAndDelete(req.params.id);
      return res.status(200).json({
        success: true,
        data: {},
        message: 'Cuộc trò chuyện đã bị xóa vì không còn người tham gia'
      });
    }

    // Cập nhật admin mới
    await Conversation.findByIdAndUpdate(req.params.id, {
      admin: newAdmin
    });
  }

  // Xóa người dùng khỏi nhóm
  conversation = await Conversation.findByIdAndUpdate(
    req.params.id,
    {
      $pull: { participants: req.user.id }
    },
    { new: true, runValidators: true }
  )
    .populate('participants', 'name username avatar isOnline lastActive')
    .populate('admin', 'name username avatar');

  res.status(200).json({
    success: true,
    data: conversation
  });
});

// @desc    Change admin of group conversation
// @route   PUT /api/v1/conversations/:id/admin/:userId
// @access  Private
const changeAdmin = asyncHandler(async (req, res, next) => {
  let conversation = await Conversation.findById(req.params.id);

  if (!conversation) {
    return next(
      new ErrorResponse(`Không tìm thấy cuộc trò chuyện với id ${req.params.id}`, 404)
    );
  }

  // Kiểm tra xem đây có phải là cuộc trò chuyện nhóm không
  if (!conversation.isGroup) {
    return next(new ErrorResponse('Không thể thay đổi admin cho cuộc trò chuyện không phải nhóm', 400));
  }

  // Kiểm tra xem người dùng có phải là admin của nhóm không
  if (conversation.admin.toString() !== req.user.id) {
    return next(new ErrorResponse('Chỉ admin mới có thể thay đổi admin', 403));
  }

  // Kiểm tra xem người dùng mới có trong nhóm không
  if (!conversation.participants.includes(req.params.userId)) {
    return next(new ErrorResponse('Người dùng không có trong nhóm', 400));
  }

  // Cập nhật admin mới
  conversation = await Conversation.findByIdAndUpdate(
    req.params.id,
    {
      admin: req.params.userId
    },
    { new: true, runValidators: true }
  )
    .populate('participants', 'name username avatar isOnline lastActive')
    .populate('admin', 'name username avatar');

  res.status(200).json({
    success: true,
    data: conversation
  });
});

// @desc    Get unread count for all conversations
// @route   GET /api/v1/conversations/unread
// @access  Private
const getUnreadCount = asyncHandler(async (req, res, next) => {
  // Lấy tất cả các cuộc trò chuyện của người dùng
  const conversations = await Conversation.find({
    participants: { $elemMatch: { $eq: req.user.id } }
  });

  // Tính tổng số tin nhắn chưa đọc
  let totalUnread = 0;
  const unreadByConversation = {};

  conversations.forEach(conversation => {
    const unreadCount = conversation.unreadCount.get(req.user.id) || 0;
    totalUnread += unreadCount;
    unreadByConversation[conversation._id] = unreadCount;
  });

  res.status(200).json({
    success: true,
    data: {
      totalUnread,
      unreadByConversation
    }
  });
});

export {
  getConversations,
  getConversation,
  createConversation,
  createGroupConversation,
  updateGroupConversation,
  addParticipants,
  removeParticipant,
  leaveConversation,
  changeAdmin,
  getUnreadCount
};