const express = require('express');  
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();
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

app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(myPassport.initialize());

app.use('/authenticate', authenticate);
app.use('/api', api);

app.use(errorHandler);

dbX.connect().then((db) => {
  // db.close(); // to test for case where db connection is lost
  app.listen(port, function() {  
    console.log('listening on port', port);
  });
}).catch(err => {
  console.log('db connection failed');
  app.listen(port, function() {  
    console.log('listening on port', port);
  });
});

