
let process = require("process");

let message = process.env["GOODBYE_MESSAGE"];

exports.handle = (event, context, callback) => {
    callback(null, {
        statusCode: 200,
        body: message
    });
};