import express from "express";
import { ObjectID } from "mongodb";
import db from "../db";
import { throwError, internalError, throwValidationError } from "../app/error";
import uuidv1 from "uuid/v1";
const Ajv = require('ajv');
const ajv = new Ajv();
const app = express();
import Serializer, {
    Registry,
    Relationships,
} from 'jaysonapi';

app.post("/", async (req, res) => {
    let userJsonSchema = require('../schema/recharge/request.json');
    let validate = ajv.compile(userJsonSchema);
    if (!validate(req.body)) {
        return throwValidationError(validate, res);
    }
    let uuid = uuidv1();
    let requestList = [];
    let totalAmount = 0;
    for (let i in req.body) {
        let amount = parseInt(req.body[i].amount);
        requestList.push({
            number: req.body[i].number,
            operator: req.body[i].operator,
            amount: amount,
            type: req.body[i].type,
            req_id: uuid,
            user_id: req.jwtToken.id,
            is_paid: false,
            status: "pending"
        });
        totalAmount += amount;
    }
    let insert = await db.insertMany(requestList, "recharge_request");
    let user = await db.select({ _id: ObjectID(req.jwtToken.id) }, "users");
    if (insert.insertedCount < 1) {
        return internalError();
    }
    return res.status(202).json(outputJson(insert.ops, user));
});

let outputJson = (data, user) => {
    var JSONAPISerializer = require('jsonapi-serializer').Serializer;

    var UserSerializer = new JSONAPISerializer('recharge', {
        attributes: ['number', 'amount',"user"],
        user: {
            ref: "id",
            attributes: ["name","email"]
        }
    });
    user.id = user._id;
    for (let i in data) {
        data[i].id = data[i]._id,
            data[i].user = [];
            data[i].user.push(user)
    }
    console.log(data);
    return UserSerializer.serialize(data);
}

module.exports = app;