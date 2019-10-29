import express from "express";
import Serializer from 'jaysonapi';
import { ObjectID } from "mongodb";
import bcrypt from 'bcrypt';
import db from "../db";
import { genToken } from "../app/jwt";
import { throwError, authFailed, internalError, throwValidationError } from "../app/error";
const Ajv = require('ajv');
const ajv = new Ajv();
const app = express();


app.post("/", async (req, res) => {
    let userJsonSchema = require('../schema/users/insert.json');
    let validate = ajv.compile(userJsonSchema);
    if (!validate(req.body)) {
        return throwValidationError(validate, res);
    }
    let password = bcrypt.hashSync(req.body.password, 10);
    if (await hasUser(req.body.email, "users") !== null) {
        return conflictUser(res)
    }
    let dataInsert = await db.insert({
        "name": req.body.name,
        "email": req.body.email,
        "password": password
    }, "users");
    if (dataInsert.insertedCount === 1) {
        return res.status(201).json(userJsonOut(dataInsert.ops));
    }
    return internalError(res);
});

app.post("/login", async (req, res) => {
    let userJsonSchema = require('../schema/users/login.json');
    let validate = ajv.compile(userJsonSchema);
    if (!validate(req.body)) {
        return throwValidationError(validate, res);
    }
    let us = await db.select({ email: req.body.email }, "users");
    let user = await hasUser(req.body.email, "users");
    if (user === null || !bcrypt.compareSync(req.body.password, user.password)) {
        return userNotFound(res);
    }
    return await tokenReturn(res, user);
});

app.get("/access-token", async (req, res) => {
    if (req.headers['x-api-key'] !== process.env.APP_SECRET_KEY) {
        return apiKeyFailed(res, "Invalid api key");
    }
    let getToken = await db.select({ _id: new ObjectID(req.jwtToken.token) }, "refresh_tokens");
    if (getToken.status !== 1 || unix_timestamp() > getToken.expire_at) {
        return authFailed(res, "Invalid token.");
    }
    let user = await db.select({ _id: new ObjectID(req.jwtToken.id) }, "users");
    if (!user) {
        return userNotFound(res);
    }
    return tokenReturn(res, user);
});
app.get("/", async (req, res) => {
    let users = await db.selectMany({}, "users");

    if (!users) {
        return userNotFound(res);
    }
    return res.status(200).json(userJsonOut(users));
});



let apiKeyFailed = (res, title, statusCode = 401) => {
    return throwError({
        code: statusCode,
        title,
        source: { pointer: "header.x-api-key" }
    }, res, statusCode);
}


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
    let token = await db.insert({
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


let hasUser = async (email, collection) => {
    return db.select({ "email": email }, collection)
}


let userJsonOut = (users) => {
    let UserSerializer = Serializer('user', {
        attributes: ['name', 'email']
    });

    return UserSerializer.serialize({ data: users });
}

module.exports = app;