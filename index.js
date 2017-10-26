const express = require('express');  
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);

const port = process.env.PORT || 3001;

const authenticate = require('./authenticate');
const api = require('./api');
const errorHandler = require('./error-handler');
const dbX = require('./db');
const myPassport = require('./my-passport')();

// process.on('uncaughtException', (err) => {
//   console.error('whoops! there was an error');
//   console.log(err);
// });


app.use((req, res, next) => {
  if (!dbX.db) {
    dbX.connect()
      .then(() => next())
      .catch(error => {
        console.log(error);
        return res.status(500).send({
          error: 'failed to connect to db server.'
        })
      })
  } else {
    return next();
  }
})

const localHostInArr = process.env.LOCAL_HOST ? process.env.LOCAL_HOST : [];
const origins = ['http://lynx0421.coding.me', 'https://lynx0421.coding.me'].concat(localHostInArr);
app.use(cors({
  origin: origins
}));

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(myPassport.initialize());

app.get('/test-error', (req, res) => {
  res.status(401).json({
    ok: false,
    message: 'expired'
  });
})
app.use('/authenticate', authenticate);
app.use('/api', api);

app.use(errorHandler);

// require('./sockets').rtcNS(io);
require('./sockets').collectionVersionsNS(io);

dbX.connect().then((db) => {
  // db.close(); // to test for case where db connection is lost
  server.listen(port, function() {  
    console.log('listening on port', port);
  });
}).catch(err => {
  console.log('db connection failed');
  server.listen(port, function() {  
    console.log('listening on port', port);
  });
});

