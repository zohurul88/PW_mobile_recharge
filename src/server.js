import express from "express";
import { MongoClient } from "mongodb";
import bodyParser from 'body-parser';
import bcrypt from 'bcrypt';

const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
dotenv.config();
const Ajv = require('ajv');


const app = express();

const url = 'mongodb://localhost:27017';
const dbName = 'recharge';

app.use(bodyParser.json());

app.post("/user", async(req, res) => {
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

app.post("/user/login", async(req, res) => {
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
    let exp = Math.floor(Date.now() / 1000) + (60 * 60);
    let token = jwt.sign({
        id: user._id,
        iss: process.env.JWT_ISS,
        exp
    }, process.env.JWT_SECRET);

    return res.status(201).json({
        token,
        expire_at: exp
    });
});


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
        console.log(validate.errors[i].params.missingProperty);
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
    let errors = new JSONAPIError(error);
    return res.status(statusCode).json(errors);
}

let insert = async(data, collection) => {
    try {
        const client = await MongoClient.connect(url, { useUnifiedTopology: true });
        const db = client.db(dbName);
        let insert = db.collection(collection).insertOne(data);
        // console.log(insert);
        client.close();
        return insert;
    } catch (error) {
        // console.log(error);
        return error;
    }
}
let hasUser = async(email, collection) => {
    try {
        const client = await MongoClient.connect(url, { useUnifiedTopology: true });
        const db = client.db(dbName);
        let select = db.collection(collection).findOne({ "email": email });
        client.close();
        return select;
    } catch (error) {
        // console.log(error);
        return error;
    }
}

let userJsonOut = (users) => {
    let JSONAPISerializer = require('jsonapi-serializer').Serializer;

    let UserSerializer = new JSONAPISerializer('users', {
        attributes: ['name', 'email']
    });

    return UserSerializer.serialize(users);
}

app.listen(process.env.PORT, () => console.log(`Listening on port ${process.env.PORT}`));