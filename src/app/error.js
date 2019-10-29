import Serializer from 'jaysonapi';

let throwError = (errors, res, statusCode = 400) => {
    const ErrorSerializer = Serializer('error', {
        errors: {}
    });
    return res.status(statusCode).json(ErrorSerializer.serialize({ errors }));
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

let throwValidationError = (validate, res) => {
    let errors = [];
    for (let i in validate.errors) {
        let pointer = validate.errors[i].params.missingProperty ? validate.errors[i].params.missingProperty : validate.errors[i].dataPath;
        errors.push({
            code: 400,
            source: { pointer },
            title: validate.errors[i].message,
        })
    }
    return throwError(errors, res);
}

let internalError = (res) => {
    return throwError({
        code: 500,
        title: "Something went wrong!"
    }, res, 500);
}


module.exports.throwError = throwError;
module.exports.authFailed = authFailed;
module.exports.invalidToken = invalidToken;
module.exports.throwValidationError = throwValidationError;
module.exports.internalError = internalError;