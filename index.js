const express = require('express');  
const bodyParser = require('body-parser');
const loginApi = require('./api/login');
const app = express();
const port = process.env.PORT || 3001;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use('/login', loginApi);

// app.get('/', function(req, res) {  
//     res.json({
//         status: 'My API is alive!'
//     });
// });

app.listen(port, function() {  
    console.log('listening on port', port);
});

// Connection URL




const user0 = {
  'mobile': '13312345678',
  'password': 'abcd',
  'entityId': '12345'
}

// usersColl.findOne({mobile: '13312345678'})
//   .then(user => {
//     bcrypt.compare(user0.password, user.password).then(function(res) {
//       // res == true
//       console.log(res);
//     });
//   })
//   .then(() => db.close());


// bcrypt.hash(user0.password, saltRounds).then(function(hash) {
//     // Store hash in your password DB.
//     usersColl.insert(Object.assign({}, user0, {
//       password: hash
//     }))
//     .then(logJStr)
//     .then(() => db.close());
// });



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