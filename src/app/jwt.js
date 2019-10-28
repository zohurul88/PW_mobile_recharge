const jwt = require('jsonwebtoken');
const extend = require('extend');

let decodeJWT = (token) => {
    token = token.replace(/^Bearer\s/, '');
    let verify = 0;
    let data;
    try {
        verify = true;
        data = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
        verify = false;
        data = { message: err.message, name: err.name };
    }
    return { verify, data };
}

let genToken = (data, seconds = 60) => {
    try {
        return jwt.sign(extend(data, {
            iss: process.env.JWT_ISS
        }), process.env.JWT_SECRET, { expiresIn: seconds });
    } catch (err) {
        console.log(err);
        return false;
    }
}

module.exports.decodeJWT = decodeJWT;
module.exports.genToken = genToken;