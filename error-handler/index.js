module.exports = (err, req, res, next) => {
  console.log('caught an error:');
  console.log(err.stack)
  if (err.name === 'MongoError' && JSON.stringify(err.message).indexOf('failed to connect to server')) {
    return res.status(500).send('无法连接至数据服务器。');
  }
  if (err.name === 'HttpError' && JSON.stringify(err.message).indexOf('Insufficient permissions to access resource')) {
    return res.sendStatus(401);
  }
  return res.status(500).send('Something broke!')
}