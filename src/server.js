import express from "express";
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import { decodeJWT } from "./app/jwt";
import errorRes from "./app/error"

dotenv.config();
const app = express();
const excludeAUthCheck = require("../config/config");

app.use(bodyParser.json());
app.use((req, res, next) => {
    if (excludeAUthCheck.indexOf(req.method + req.url) > -1) {
        return next();
    }
    if (!req.headers.authorization) {
        return errorRes.authFailed(res, "Authorization header missing");
    }
    let jwtDecode = decodeJWT(req.headers.authorization);
    if (!jwtDecode.verify) {
        return errorRes.invalidToken(jwtDecode, res);
    }
    req.jwtToken = jwtDecode.data;
    return next();
});

app.use("/user", require("./modules/user"));


app.all("*", (req, res) => {
    return res.status(404).json({
        errors: [{
            code: 404,
            title: "The page you are trying to find is not exists.",
            source: {
                pointer: req.method + " " + req.url
            }
        }]
    });
});
app.listen(process.env.PORT, () => console.log(`Listening on port ${process.env.PORT}`));