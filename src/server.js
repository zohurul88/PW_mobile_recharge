import express from "express";
import { ObjectID, MongoClient } from "mongodb";
import bodyParser from 'body-parser';
import bcrypt from 'bcrypt';

const jwt = require('jsonwebtoken');
const extend = require('extend');
const dotenv = require('dotenv');
dotenv.config();
const Ajv = require('ajv');


const app = express();

const url = 'mongodb://localhost:27017';
const dbName = 'recharge';

app.use(bodyParser.json());

const excludeAUthCheck = require("../config/config");

app.use((req, res, next) => {
    if (excludeAUthCheck.indexOf(req.method + req.url) > -1) {
        return next();
    }
    if (!req.headers.authorization) {
        return authFailed(res, "Authorization header missing");
    }
    let jwtDecode = decodeJWT(req.headers.authorization);
    if (!jwtDecode.verify) {
        return invalidToken(jwtDecode, res);
    }
    req.jwtToken = jwtDecode.data;
    return next();
});

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

let authFailed = (res, title, statusCode = 401) => {
    return throwError({
        code: statusCode,
        title,
        source: { pointer: "header.authorization" }
    }, res, statusCode);
}
let apiKeyFailed = (res, title, statusCode = 401) => {
    return throwError({
        code: statusCode,
        title,
        source: { pointer: "header.x-api-key" }
    }, res, statusCode);
}
app.post("/user", async (req, res) => {
    let userJsonSchema = require('../schema/user-insert.json');
    let ajv = new Ajv();
    let validate = ajv.compile(userJsonSchema);
    if (!validate(req.body)) {
        return throwValidationError(validate, res);
    }
    let password = bcrypt.hashSync(req.body.password, 10);
    if (await hasUser(req.body.email, "users") !== null) {
        return conflictUser(res)
    }
    let dataInsert = await insert({
        "name": req.body.name,
        "email": req.body.email,
        "password": password
    }, "users");
    if (dataInsert.insertedCount === 1) {
        return res.status(201).json(userJsonOut(dataInsert.ops));
    }
    return internalError(res);
});

app.post("/user/login", async (req, res) => {
    let userJsonSchema = require('../schema/user-login.json');
    let ajv = new Ajv();
    let validate = ajv.compile(userJsonSchema);
    if (!validate(req.body)) {
        return throwValidationError(validate, res);
    }
    let user = await hasUser(req.body.email, "users");
    if (user === null || !bcrypt.compareSync(req.body.password, user.password)) {
        return userNotFound(res);
    }
    return await tokenReturn(res, user);
});

app.post("/user/access-token", async (req, res) => {
    if (req.headers['x-api-key'] !== process.env.APP_SECRET_KEY) {
        return apiKeyFailed(res, "Invalid api key");
    }
    let getToken = await select({ _id: new ObjectID(req.jwtToken.token) }, "refresh_tokens");
    if (getToken.status !== 1 || unix_timestamp() > getToken.expire_at) {
        return authFailed(res, "Invalid token.");
    }
    let user = await select({ _id: new ObjectID(req.jwtToken.id) }, "users");
    if (!user) {
        return userNotFound(res);
    }
    return tokenReturn(res, user);
});



let tokenReturn = async (res, user) => {
    let refreshToken = await refreshTokenGen(user);
    if (!refreshToken) return internalError(res);
    let lifetime = parseInt(process.env.JWT_ACCESS_LIFETIME);
    return res.status(201).json({
        access: {
            token: genToken({ id: user._id, sub: "access-token" }, lifetime + 10),
            expire_at: unix_timestamp() + lifetime
        },
        refresh: refreshToken
    });
}

let refreshTokenGen = async (user) => {
    let lifetime = parseInt(process.env.JWT_REFRESH_LIFETIME);
    let token = await insert({
        app: process.env.APP_SECRET_KEY,
        user_id: user._id,
        status: 1,
        expire_at: (unix_timestamp() + lifetime)
    }, "refresh_tokens");
    if (token.insertedCount !== 1) {
        return false;
    }
    return genToken({ id: user._id, token: token.insertedId, sub: "refresh-token" }, lifetime + 10);
}

let unix_timestamp = () => {
    return (Math.floor(Date.now() / 1000));
}

let genToken = (data, seconds = 60) => {
    return jwt.sign(extend(data, {
        iss: process.env.JWT_ISS
    }), process.env.JWT_SECRET, { expiresIn: seconds });
}


let conflictUser = (res) => {
    return throwError({
        code: 409,
        source: { pointer: "email" },
        title: "Email address already exits."
    }, res, 409);
}

let userNotFound = (res) => {
    return throwError({
        code: 404,
        title: "User email or password incorrect."
    }, res, 404);
}

let throwValidationError = (validate, res) => {
    errors = [];
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

let throwError = (error, res, statusCode = 400) => {
    let JSONAPIError = require('jsonapi-serializer').Error;
    return res.status(statusCode).json(new JSONAPIError(error));
}

let insert = async (data, collection) => {
    try {
        const client = await MongoClient.connect(url, { useUnifiedTopology: true });
        const db = client.db(dbName);
        let insert = db.collection(collection).insertOne(data);
        client.close();
        return insert;
    } catch (error) {
        return error;
    }
}
let hasUser = async (email, collection) => {
    return select({ "email": email }, collection)
}
let select = async (filter, collection) => {
    try {
        const client = await MongoClient.connect(url, { useUnifiedTopology: true });
        const db = client.db(dbName);
        let select = db.collection(collection).findOne(filter);
        client.close();
        return select;
    } catch (error) {
        return error;
    }
}

// let update = async (filter, update) => {
//     try{
//         const client = await MongoClient.connect(url, { useUnifiedTopology: true });
//         const db = client.db(dbName);
//         db.collection(collection).updateOne()
//     }
// }
let userJsonOut = (users) => {
    let JSONAPISerializer = require('jsonapi-serializer').Serializer;

    let UserSerializer = new JSONAPISerializer('users', {
        attributes: ['name', 'email']
    });

    return UserSerializer.serialize(users);
}

app.listen(process.env.PORT, () => console.log(`Listening on port ${process.env.PORT}`));