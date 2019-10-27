import express from "express";
import { MongoClient } from "mongodb";
import bodyParser from 'body-parser';
const Ajv = require('ajv');


const app = express();

const url = 'mongodb://localhost:27017';
const dbName = 'recharge';
const client = new MongoClient(url);

app.use(bodyParser.json());

// app.get("/", async (req, res) => {
//     try {
//         const client = await MongoClient.connect(url);
//         const db = client.db(dbName);
//         let insert = await db.collection("users").insertOne({
//             "name": "Zohurul Islam",
//             username: "mail@zohurul.com",
//             "password": "123456"
//         })
//         let hash = bcrypt.hashSync('myPassword', 10);
//         client.close();
//     } catch (error) {
//         res.status(500).json({ message: 'Error connecting to db', error });
//     }
// });
app.get("/", (req, res) => {
    let userJsonSchema = require('../schema/user-insert.json');
    let ajv = new Ajv();
    let validate = ajv.compile(userJsonSchema);
    if (!validate(req.body)) {
        return throwError(validate, res);
    }
    
});

let throwError = (validate, res) => {
    let JSONAPIError = require('jsonapi-serializer').Error;

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

    let errors = new JSONAPIError(errors);
    return res.status(400).json(errors);
}

app.listen(8000, () => console.log('Listening on port 8000'));