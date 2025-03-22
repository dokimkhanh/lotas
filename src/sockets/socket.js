import User from '../models/user.model.js';
import Conversation from '../models/conversation.model.js';
import Message from '../models/message.model.js';
import Notification from '../models/notification.model.js';

export default (io) => {
  const onlineUsers = new Map();

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    socket.on('user_connected', async (userId) => {
      onlineUsers.set(userId, socket.id);
      io.emit('user_online', userId);
      console.log(`User ${userId} is online`);

      await User.findByIdAndUpdate(userId, { isOnline: true, lastActive: Date.now() });
    });

    socket.on('send_message', async (messageData) => {
      try {
        const { sender, conversation, content, attachments } = messageData;

        const newMessage = await Message.create({
          sender,
          conversation,
          content,
          attachments,
        });

        await Conversation.findByIdAndUpdate(conversation, {
          lastMessage: newMessage._id,
          $inc: { 'unreadCount.$[elem]': 1 },
        }, {
          arrayFilters: [{ 'elem.user': { $ne: sender } }],
        });

        const conversationData = await Conversation.findById(conversation);
        
        conversationData.participants.forEach((participant) => {
          const participantId = participant.toString();
          if (participantId !== sender) {
            const socketId = onlineUsers.get(participantId);
            if (socketId) {
              io.to(socketId).emit('receive_message', newMessage);
            }

            Notification.create({
              recipient: participantId,
              sender,
              type: 'message',
              message: newMessage._id,
              content: 'đã gửi cho bạn một tin nhắn',
            });
          }
        });
      } catch (error) {
        console.error('Error sending message:', error);
      }
    });

    socket.on('typing', ({ userId, conversationId }) => {
      // Lấy thông tin cuộc trò chuyện
      Conversation.findById(conversationId)
        .then(conversation => {
          conversation.participants.forEach((participant) => {
            const participantId = participant.toString();
            if (participantId !== userId) {
              const socketId = onlineUsers.get(participantId);
              if (socketId) {
                io.to(socketId).emit('user_typing', { userId, conversationId });
              }
            }
          });
        })
        .catch(err => console.error('Error in typing event:', err));
    });

    socket.on('stop_typing', ({ userId, conversationId }) => {
      // Lấy thông tin cuộc trò chuyện
      Conversation.findById(conversationId)
        .then(conversation => {
          conversation.participants.forEach((participant) => {
            const participantId = participant.toString();
            if (participantId !== userId) {
              const socketId = onlineUsers.get(participantId);
              if (socketId) {
                io.to(socketId).emit('user_stop_typing', { userId, conversationId });
              }
            }
          });
        })
        .catch(err => console.error('Error in stop typing event:', err));
    });

    socket.on('new_notification', async (notificationData) => {
      const { recipient } = notificationData;
      const socketId = onlineUsers.get(recipient);
      
      if (socketId) {
        io.to(socketId).emit('receive_notification', notificationData);
      }
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.id}`);
      
      let disconnectedUserId = null;
      for (const [userId, id] of onlineUsers.entries()) {
        if (id === socket.id) {
          disconnectedUserId = userId;
          break;
        }
      }

      if (disconnectedUserId) {
        onlineUsers.delete(disconnectedUserId);
        io.emit('user_offline', disconnectedUserId);
        console.log(`User ${disconnectedUserId} is offline`);

        User.findByIdAndUpdate(disconnectedUserId, {
          isOnline: false,
          lastActive: Date.now(),
        }).catch(err => console.error('Error updating user status:', err));
      }
    });

    socket.on('call_user', ({ from, to, signal }) => {
      const socketId = onlineUsers.get(to);
      if (socketId) {
        io.to(socketId).emit('incoming_call', { from, signal });
      }
    });

    socket.on('answer_call', ({ to, signal }) => {
      const socketId = onlineUsers.get(to);
      if (socketId) {
        io.to(socketId).emit('call_accepted', { signal });
      }
    });

    socket.on('end_call', ({ to }) => {
      const socketId = onlineUsers.get(to);
      if (socketId) {
        io.to(socketId).emit('call_ended');
      }
    });
  });
};