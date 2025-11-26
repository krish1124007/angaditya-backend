let io = null;

export const initSocket = (server) => {
  import("socket.io").then(({ Server }) => {
    io = new Server(server, {
      cors: { origin: "*", methods: ["GET", "POST"] }
    });
  });
};

export const getIO = () => {
  if (!io) throw new Error("Socket.io not initialized!");
  return io;
};
