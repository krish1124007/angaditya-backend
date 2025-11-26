let io = null;

export const setSocketServer = (serverInstance) => {
  io = serverInstance;
};

export const getSocketServer = () => {
  return io;
};
