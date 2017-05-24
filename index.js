const express = require('express');  
const bodyParser = require('body-parser');
const login = require('./login');
const api = require('./api');
const app = express();
const port = process.env.PORT || 3001;
const myPassport = require('./my-passport')();
const errorHandler = require('./error-handler');
const dbX = require('./db');

app.use((req, res, next) => {
  if (!dbX.db) {
    return res.status(500).send({
      error: 'failed to connect to db server.'
    })
  }
  return next();
})

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(myPassport.initialize());



app.use('/login', login);
app.use('/api', myPassport.authenticate(), api);

app.use(errorHandler);

dbX.connect().then(() => {
  app.listen(port, function() {  
    console.log('listening on port', port);
  });
}).catch(err => {
  console.log('db connection failed');
  app.listen(port, function() {  
    console.log('listening on port', port);
  });
});

// app.listen(port, function() {  
//     console.log('listening on port', port);
// });

