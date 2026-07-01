function isRecoverablePortError(error) {
  return !!error && (error.code === 'EADDRINUSE' || error.code === 'EACCES');
}

function getNextPort(errorCode, port) {
  if (errorCode === 'EADDRINUSE') {
    return port + 1;
  }
  if (errorCode === 'EACCES') {
    return Math.floor(port / 100) * 100 + 100;
  }
  return null;
}

module.exports = {
  getNextPort,
  isRecoverablePortError,
};
