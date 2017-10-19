const passport = require("passport");  
const passportJWT = require("passport-jwt");
const co = require('co');
const ObjectID = require('mongodb').ObjectID;

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
      const db = yield dbX.dbPromise;
      // const db = dbX.db;
      const userFound = yield db.collection('users').findOne({_id: new ObjectID(payload.sub._id)});
      // const expired = Math.ceil(Date.now() / 1000) >= payload.exp*1;
      if (!userFound) return done(null, false, {name: 'UserNotFoundError', message: `No such user as ${payload.sub.username}.`});
      // if (expired) return done(null, false, {err: 'Token Expired', message: `The token has expired. Please login again.`});
      return done(null, {
        _id: userFound._id,
        username: userFound.username,
        facility: userFound.facility
      }, {message: 'cleared by passport'});
    }).catch(function(err) {
      return done(err);
    });
  });
  passport.use(strategy);
  return {
    initialize: function() {
      return passport.initialize();
    },
    // authenticate: function() {
    //   return passport.authenticate("jwt", config.jwtSession);
    // },
    authenticate: function() {
      return function(req, res, next) {
        passport.authenticate("jwt", config.jwtSession, (err, user, info) => {
          if (err) return next(err);
          if (info && info.name === 'TokenExpiredError') return res.status(401).send({
              info
            })
          if (info && info.name === 'UserNotFoundError') return res.status(401).send({
            info
          })
          req.user = user;
          next();
        })(req, res, next);
      }
    }
  };
};