"use strict";

let process = require("process");

let message = process.env["HELLO_MESSAGE"];

/**
 * Handle Lambda Invoke Request
 *
 * @param event
 * @param context
 * @param callback
 */
exports.handle = (event, context, callback) => {
    callback(null, {
        statusCode: 200,
        body: message
    });
};