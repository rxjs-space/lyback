const passport = require("passport");  
const passportJWT = require("passport-jwt");
const co = require('co');
const ObjectId = require('mongodb').ObjectID;

const dbX = require('../db');
const users = [
  {
    "id": "1",
    "username": "baoshijie",
    "password": "abcd",
    "entityId": "12345"
  }
];

const config = require('../config');
const ExtractJwt = passportJWT.ExtractJwt;  
const JwtStrategy = passportJWT.Strategy;  
const options = {  
  secretOrKey: config.jwtSecret,
  // jwtFromRequest: ExtractJwt.fromAuthHeader()
  jwtFromRequest: ExtractJwt.fromAuthHeaderWithScheme('Bearer')
};

module.exports = function() {  
  const strategy = new JwtStrategy(options, function(payload, done) {
    co(function*() {
      // const db = yield dbX.dbPromise;
      const db = dbX.db;
      const userFound = yield db.collection('users').findOne({_id: new ObjectId(payload._id)});
      if (!userFound) done(null, false);
      done(null, {
        _id: userFound._id,
        username: userFound.username
      });
      // yield db.close();
    }).catch(function(err) {
      return done(err);
    });
  });
  passport.use(strategy);
  return {
    initialize: function() {
      return passport.initialize();
    },
    authenticate: function() {
      return passport.authenticate("jwt", config.jwtSession);
    }
  };
};