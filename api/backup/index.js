const router = require('express').Router();
const co = require('co');
const coForEach = require('co-foreach');
const fs = require('fs');
const compressing = require('compressing');
const Promise = require('bluebird');

const writeFile = Promise.promisify(require("fs").writeFile);

const nodemailer = require('nodemailer');
const config = require('../../config');

const dbX = require('../../db');
const sendMail = require('../../utils/mail');

const saveZipMail = (dir, fileName, data) => {
  if (!fs.existsSync(dir)){
    fs.mkdirSync(dir);
  }

  return co(function*() {
    yield writeFile(`${dir}/${fileName}`, JSON.stringify(data, null, 2));
    yield compressing.zip.compressFile(`${dir}/${fileName}`, `${dir}/${fileName}.zip`);
    // const transporter = nodemailer.createTransport({
    //     host: 'smtp.zoho.com',
    //     port: 465,
    //     secure: true, // secure:true for port 465, secure:false for port 587
    //     auth: {
    //         user: config.email.username,
    //         pass: config.email.password
    //     }
    // });

// const sendMail = Promise.promisify(transporter.sendMail);


    let mailOptions = {
        from: '"lynx04213 👻" <lynx04213@zoho.com>', // sender address
        to: 'lynx04213@zoho.com', // list of receivers
        subject: `data backup - ${(new Date).toISOString()}`, // Subject line
        // text: 'go',
        attachments: [{path: `${dir}/${fileName}.zip`}]
    };
    const result = yield sendMail(mailOptions);

    // transporter.sendMail(mailOptions, (error, info) => {
    //     if (error) {
    //         // return console.log(error);
    //         throw new Error(error);
    //     }
    //     return info;
    //     // console.log('Message %s sent: %s', info.messageId, info.response);
    // });

    console.log('Message %s sent: %s', result.messageId, result.response);
    return result;
  })
}

router.get('/', (req, res) => {
  let data = {};
  const startedAt = new Date();
  co(function*() {
    const db = yield dbX.dbPromise;
    const collections = yield db.listCollections().toArray();
    // console.log(collections);
    // const subCollections = [collections[0], collections[1]]
    yield coForEach(collections, function*(col) {
      const subData = yield db.collection(col.name).find().toArray();
      Object.assign(data, {
        [col.name]: subData
      });
    });

    const szmResult = yield saveZipMail('generated-files', 'data.json', data);
    return res.json({
      szmResult,
      timeConsumed: (new Date() - startedAt)/1000
    });
  }).catch(err => {
    return res.status(500).json(err.stack);
  })
})

module.exports = router;

/*
  coForEach example

  forEach(files, function * (file, idx) {
    var content = yield Q.nfcall(fs.readFile, file);
    // do something usefull
  }).then(function () {
    // co-foreach is returning promise which is fulfilled
    // after all generator functions are successfully finished
  }).catch(function (err) {
    // handle error
  });

*/