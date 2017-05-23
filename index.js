const express = require('express');  
const bodyParser = require('body-parser');
const login = require('./login');
const api = require('./api');
const app = express();
const port = process.env.PORT || 3001;
const myPassport = require('./my-passport')();
const errorHandler = require('./error-handler');
const dbX = require('./db');

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(myPassport.initialize());

app.use('/login', login);
// app.use('/api', myPassport.authenticate(), api);

app.use(errorHandler);
// app.get('/', function(req, res) {  
//     res.json({
//         status: 'My API is alive!'
//     });
// });

dbX.connect().then(() => {
  app.listen(port, function() {  
    console.log('listening on port', port);
  });
}).catch(err => console.log(err));

// app.listen(port, function() {  
//     console.log('listening on port', port);
// });

// Connection URL



// usersColl.findOne({mobile: '13312345678'})
//   .then(user => {
//     bcrypt.compare(user0.password, user.password).then(function(res) {
//       // res == true
//       console.log(res);
//     });
//   })
//   .then(() => db.close());





// const collection = db.get('firstCollection')


// collection.update({ a: 2 }, { $set: { b: 5 } })
//   .then(result => {
//     logJStr(result);
//   })
//   .then(() => {
//     return collection.find({a: 2})
//   })
//   .then(logJStr)
//   .then(() => {
//     return collection.insert({a: 4})
//   })
//   .then(() => {
//     return collection.find({a: 4})
//   })
//   .then(logJStr)
//   .then(() => {
//     return collection.remove({a: 4})
//   })
//   .then(() => {
//     return collection.find({a: 4})
//   })
//   .then(logJStr)
//   .then(() => db.close());