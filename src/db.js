import { ObjectID, MongoClient } from "mongodb";

module.exports.select = async(filter, collection) => {
    try {
        const client = await MongoClient.connect(process.env.MONGO_URL, { useUnifiedTopology: true });
        const db = client.db(process.env.MONGO_DBNAME);
        let select = db.collection(collection).findOne(filter);
        client.close();
        return select;
    } catch (error) {
        return error;
    }
}
module.exports.selectMany = async(filter, collection) => {
    try {
        const client = await MongoClient.connect(process.env.MONGO_URL, { useUnifiedTopology: true });
        const db = client.db(process.env.MONGO_DBNAME);
        let select = db.collection(collection).aggregate([
            {"$project":{"id":"$_id","email":"$email","name":"$name"}}
        ]).toArray();
        client.close();
        return select;
    } catch (error) {
        return error;
    }
}

module.exports.insert = async(data, collection) => {
    try {
        const client = await MongoClient.connect(process.env.MONGO_URL, { useUnifiedTopology: true });
        const db = client.db(process.env.MONGO_DBNAME);
        let insert = db.collection(collection).insertOne(data);
        client.close();
        return insert;
    } catch (error) {
        return error;
    }
}
module.exports.insertMany = async(data, collection) => {
    try {
        const client = await MongoClient.connect(process.env.MONGO_URL, { useUnifiedTopology: true });
        const db = client.db(process.env.MONGO_DBNAME);
        let insert = db.collection(collection).insertMany(data);
        client.close();
        return insert;
    } catch (error) {
        return error;
    }
}