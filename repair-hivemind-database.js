const config = require('./config.js')
const { MongoClient } = require("mongodb")
const mongoClient = new MongoClient(config.mongo.uri)

async function go() {
	const database = mongoClient.db('hivemind')
	const contributionCountCollection = database.collection('contributionCount')
	const contributionsCollection = database.collection('contributions')
	const contributionCounts = await contributionCountCollection.find()
	contributionCounts.forEach((contributionCount) => {
		console.log(contributionCount)
		if(contributionCount.text) {
		// contributionsCollection.insertOne({ addedToHivemind: false, text: contributionCount.text, userId: contributionCount.userId, app: 'discord' })
			contributionCountCollection.deleteOne({ _id: contributionCount._id })
		}
	})
}

go()
