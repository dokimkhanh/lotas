import express from 'express';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import http from 'http';
import { Server as socketio } from 'socket.io';
import fileUpload from 'express-fileupload';
import path from 'path';
import connectDB from './src/config/db.js';
import errorHandler from './src/middlewares/error.middleware.js';
import routes from './src/routes/index.js';
import socketHandler from './src/sockets/socket.js';

dotenv.config();
connectDB();

const app = express();
const server = http.createServer(app);
const io = socketio(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

app.use(express.json());
app.use(cookieParser());
app.use(fileUpload());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

socketHandler(io);

app.use('/api/v1', routes);

app.use(errorHandler);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`.yellow.bold);
});

process.on('unhandledRejection', (err, promise) => {
  console.log(`Error: ${err.message}`.red);
  server.close(() => process.exit(1));
});