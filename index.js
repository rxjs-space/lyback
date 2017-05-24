const express = require('express');  
const bodyParser = require('body-parser');
const login = require('./login');
const api = require('./api');
const app = express();
const port = process.env.PORT || 3001;
const errorHandler = require('./error-handler');
const dbX = require('./db');
const myPassport = require('./my-passport')();

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

// const flash = require('connect-flash');
// app.use(flash());
// app.use((req, res, next) => {
//   console.log(req.flash('error'));
//   next();
// })
app.use('/login', login);
app.use('/api', api);

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

