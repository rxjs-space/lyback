const logJsonStr = str => {
  return console.log(JSON.stringify(str, null, 2));
}

module.exports = logJsonStr;