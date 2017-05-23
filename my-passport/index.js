const passport = require("passport");  
const passportJWT = require("passport-jwt");
const co = require('co');

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
const Strategy = passportJWT.Strategy;  
const options = {  
  secretOrKey: config.jwtSecret,
  // jwtFromRequest: ExtractJwt.fromAuthHeader()
  jwtFromRequest: ExtractJwt.fromAuthHeaderWithScheme('Bearer')
};

module.exports = function() {  
  const strategy = new Strategy(options, function(payload, done) {
    co(function*() {
      const db = yield dbX.dbPromise;
      const userFound = yield db.collection('users').findOne({id: payload.id});
      if (!userFound) done(null, false);
      done(null, userFound);
      yield db.close();
    }).catch(function(err) {
      console.log(err.stack);
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