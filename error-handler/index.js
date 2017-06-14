module.exports = (error, req, res, next) => {
  console.log('caught an error:');
  console.log('JSON.stringify(error): ', JSON.stringify(error));
  console.log('JSON.stringify(error.stack): ', JSON.stringify(error.stack));
  if (error.name === 'MongoError' && JSON.stringify(error.message).indexOf('failed to connect to server')) {
    return res.status(500).send('无法连接至数据服务器。');
  }
  if (error.name === 'HttpError' && JSON.stringify(error.message).indexOf('Insufficient permissions to access resource')) {
    return res.sendStatus(401);
  }
  return res.status(500).send('Something broke!')
}