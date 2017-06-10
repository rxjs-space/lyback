const nodemailer = require('nodemailer');
const config = require('../config');
const Promise = require('bluebird');

// create reusable transporter object using the default SMTP transport
const transporter = nodemailer.createTransport({
    host: 'smtp.zoho.com',
    port: 465,
    secure: true, // secure:true for port 465, secure:false for port 587
    auth: {
        user: config.email.username,
        pass: config.email.password
    }
});

const sendMail = (mailOptions) => {
  return new Promise((resolve, reject) => {
    transporter.sendMail(mailOptions, (err, info) => {
      if(err) {
        reject(err);
      }
      resolve(info);
    })
  })


}
// setup email data with unicode symbols
// let mailOptions = {
//     // from: '"Fred Foo 👻" <foo@blurdybloop.com>', // sender address
//     to: 'lynx04212@qq.com', // list of receivers
//     subject: 'Hello ✔', // Subject line
//     text: 'Hello world ?', // plain text body
//     html: '<b>Hello world ?</b>' // html body
// };

    // let mailOptions = {
        // from: '"Fred Foo 👻" <foo@blurdybloop.com>', // sender address
    //     to: 'lynx04212@qq.com', // list of receivers
    //     subject: `data backup - ${(new Date).toISOString()}`, // Subject line
    //     attachments: [{path: `${dir}/${fileName}.zip`}]
    // };

module.exports = sendMail;


// transporter.sendMail(mailOptions, (error, info) => {
//     if (error) {
//         return console.log(error);
//     }
//     console.log('Message %s sent: %s', info.messageId, info.response);
// });