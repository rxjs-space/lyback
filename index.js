const express = require('express');  
const bodyParser = require('body-parser');
const login = require('./login');
const api = require('./api');
const app = express();
const port = process.env.PORT || 3001;
const myPassport = require('./my-passport')();


app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(myPassport.initialize());

// Error handling
// app.use( function( error, request, response, next ) {
//   if( ! error ) {
//     return next();
//   }
//   response.send( error.msg, error.errorCode );
// });


// const co = require('co');
// const acl = require('acl');
// const dbX = require('./db');
// let aclInstance;

// co(function*() {
//   // Connection URL
//   // Use connect method to connect to the Server
//   const db = yield dbX.dbPromise;
//   aclInstance = new acl(new acl.mongodbBackend(db, 'acl_'));
//   // aclInstance.allow('user', 'parts', 'view').then(data => {
//   //   console.log('data after allow is ', data);
//   // });
//   // aclInstance.addUserRoles('kenisaige', 'user');
//   // // aclInstance.addRoleParents('admin', 'user');
//   yield aclInstance.isAllowed('kenisaige', 'parts', 'view', (err, res) => {
//     console.log('error after isAllowed is', err);
//     if (res) {
//       console.log('user kenisaige is allowed to view parts');
//     }
//   })  
//   // Close the connection
//   yield db.close();
// }).catch(function(err) {
//   console.log(err.stack);
// });



app.use('/login', login);
app.use('/api', myPassport.authenticate(), api);

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


// const bcrypt = require('bcrypt');
// const saltRounds = 10;

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