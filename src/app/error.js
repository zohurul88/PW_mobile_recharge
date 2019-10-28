let throwError = (error, res, statusCode = 400) => {
    let JSONAPIError = require('jsonapi-serializer').Error;
    return res.status(statusCode).json(new JSONAPIError(error));
}
let authFailed = (res, title, statusCode = 401) => {
    return throwError({
        code: statusCode,
        title,
        source: { pointer: "header.authorization" }
    }, res, statusCode);
}
let invalidToken = (jwtDecode, res) => {
    let message = "Invalid token.";
    let statusCode = 401
    switch (jwtDecode.data.name) {
        case "TokenExpiredError":
            message = "Token has been expire.";
            statusCode = 403;
            break;
        default:
            break;

    }
    return authFailed(res, message, statusCode);
}
module.exports.throwError = throwError;
module.exports.authFailed = authFailed;
module.exports.invalidToken = invalidToken;