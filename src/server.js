import express from "express";
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import { decodeJWT } from "./app/jwt";
import errorRes from "./app/error";
import config from "../config/config";

dotenv.config();
const app = express();


app.use(bodyParser.json());
app.use((req, res, next) => {
    if (config.excludeAuthCheck.indexOf(req.method + req.url) > -1) {
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

// app.use(function(error, req, res, next) { /* if err.status == 4** then handle json error => res.status(400).send(), else shutdown node */ }
app.use((error, req, res, next) => {
    if (error instanceof SyntaxError) {
        return errorRes.throwError({ code: 400, title: "malformed json body!" }, res, 400);
    }
    return next();
});

/**
 * user module
 */
app.use("/user", require("./modules/user"));
app.use("/recharge", require("./modules/recharge"));



/**
 * Fallback for 404
 */
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