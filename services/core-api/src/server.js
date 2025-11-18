import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createServer } from "http";
import { Server } from "socket.io";
import shipmentRoutes from "./routes/shipments.js";
import authRoutes from "./routes/auth.js";
import db from "./models/db.js";
import orderRoutes from "./routes/orders.js";
import driverRoutes from "./routes/drivers.js";
import messageRoutes from "./routes/messages.js";
import userRoutes from "./routes/users.js";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "healthy", service: "core-api" });
});

// REST routes
app.use("/api/shipments", shipmentRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/drivers", driverRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/users", userRoutes);

// Setup WebSocket
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });

io.on("connection", socket => {
  console.log("Client connected", socket.id);

  // Auto-join notification room for all clients
  socket.join('notification-room');
  console.log("Client joined notification-room", socket.id);

  // Allow clients to explicitly join rooms
  socket.on('join_room', (room) => {
    socket.join(room);
    console.log(`Client ${socket.id} joined room: ${room}`);
  });

  socket.on('leave_room', (room) => {
    socket.leave(room);
    console.log(`Client ${socket.id} left room: ${room}`);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected", socket.id);
  });
});

app.set("io", io);

const PORT = process.env.PORT || 8080;
httpServer.listen(PORT, () => console.log(`Server running on port ${PORT}`));
