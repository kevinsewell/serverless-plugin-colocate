
let process = require("process");

let message = process.env["HELLO_MESSAGE"];

exports.handle = (event, context, callback) => {
    callback(null, {
        statusCode: 200,
        body: message
    });
};