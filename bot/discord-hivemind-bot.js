const DiscordBot = require('./discord-bot')
const config = require('../config.js')
const { repeatedlyQuery, sleep } = require('./helpers')
const fs = require('fs')

const TEST_CHANNEL_ID = '1010978005683806269'
const HIVE_CHANNEL_ID = '1011005608931102812'
const FINETUNE_BATCH_SIZE = 100
module.exports = class DiscordHivemindBot extends DiscordBot { 
	_mongoClient
	_openAiClient
	constructor({mongoClient, openAiClient, ...args}) {
		console.log('DiscordHivemindBot.constructor')
		super({...args});
		this._mongoClient = mongoClient
		this._openAiClient = openAiClient
	}

	async start() {
		super.start()
		this.postRegularlyInHive()
	}

	async postRegularlyInHive() {
		while (true) {
			const newMessage = await this.generateResponse('###')
			const channel = this._client.channels.cache.get(HIVE_CHANNEL_ID)
			channel.send(newMessage)
			await sleep(1000 * 60 * 10)
		}
	}

	async fineTuneNewModel() {
		try {
			const mongoDatabase = this._mongoClient.db('hivemind')
			const contributions = mongoDatabase.collection('contributions')
			const newContributions = await contributions.find({ addedToHivemind:false })
			const filename = `${__dirname}/data/generated/hivemind-fine-tune-${Date.now()}.txt`
			const writeInterface = fs.createWriteStream(filename)
			await newContributions.forEach(async contribution => {
				// Strip input of user references in the form of <@userId>
				const parsedText = contribution.text.replace(/<@.*>\s/, '')
				const obj = {prompt:'###', completion:` ${parsedText}###`}
				await writeInterface.write(JSON.stringify(obj) + "\n")
			})

			const fileUploadResponse = await this._openAiClient.createFile(
				fs.createReadStream(filename),
				"fine-tune"
			);

			console.log('fileUploadResponse', fileUploadResponse, fileUploadResponse.data.id)
			
			console.log("Sending fine tuning request")
			
			const response = await this._openAiClient.createFineTune({
				training_file: fileUploadResponse.data.id,
				model: this.gpt3Model,
				suffix: `hivemind-fine-tune-${Date.now()}`,
				learning_rate_multiplier: 0.002
			})

			const fineTuneId = response.data.id
			let fineTuneFinished = false
			let attempts = 0
			while (!fineTuneFinished && attempts < 20) {
				attempts++
				const fineTuneRetrievalResponse = await this._openAiClient.retrieveFineTune(fineTuneId)
				console.log('fineTuneRetrievalResponse', fineTuneRetrievalResponse)
				if (fineTuneRetrievalResponse.data.status == 'succeeded') {
					fineTuneFinished = true
					const newFineTuneModel = fineTuneRetrievalResponse.data.model
					this.gpt3Model = newFineTuneModel

					const misc = mongoDatabase.collection('contributions')
					await misc.updateOne({ key: 'HIVEMIND_CURRENT_MODEL'}, { $set: { value: newFineTuneModel }  })

					const contributions = mongoDatabase.collection('contributions')
					await contributions.updateMany({ addedToHivemind: false }, { $set: { addedToHivemind: true }})

					// Send discord message notifying of update
					const channel = this._client.channels.cache.get(HIVE_CHANNEL_ID)
					channel.send(`🐝🐝🐝 HIVEMIND has updated 🐝🐝🐝`)
					
				} else {
					// Wait one minute and try again
					await sleep(60 * 1000)
				}
			}


		} catch (e) {
			console.log("Error", e)
		}
	}

	async classify(text) {
		const res = await repeatedlyQuery({
			method: 'post',
			url: 'https://api.openai.com/v1/completions',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': 'Bearer ' + config.openAiApiKey,
			}, 
			data: {
				model: `curie:ft-personal:hivemind-classifier-2022-08-20-23-42-40`, 
				temperature: .9, 
				prompt: `${text}###`,
				max_tokens: 54,
				stop: ['###']
			}
		})
		const responseText = res.data.choices[0].text;
		console.log('responseText', responseText)

		return responseText.trim().startsWith('A')
	}

	async classifyAndRecord(text, userId) {
		const isHivemindLike = await this.classify(text)
		console.log('classify and record hivemind like', isHivemindLike)
		const mongoDatabase = this._mongoClient.db('hivemind')
		if(isHivemindLike) {
			try {
				const contributionCountCollection = mongoDatabase.collection('contributionCount');
				const contributionCount = await contributionCountCollection.findOne({ userId: userId, app: 'discord'})
				console.log('contributionCount', contributionCount)
				if (contributionCount == null) {
					contributionCountCollection.insertOne({ userId: userId, app: 'discord', count: 1 })
				} else {
					contributionCountCollection.updateOne({ userId: userId, app: 'discord'}, { $inc: { count: 1 }})
				}
	
				const contributions = mongoDatabase.collection('contributions');
				await contributions.insertOne({ addedToHivemind:false, text: text, userId: userId, app: 'discord' })
				
				// If we have 100 new records, run a new fine-tune
				// Get a count of the number of new records
				const newContributions = await contributions.count({ addedToHivemind:false })
				console.log("New contributions:", newContributions)
				if (newContributions >= FINETUNE_BATCH_SIZE) {
					await this.fineTuneNewModel()
					// TODO, also finetune new classifier
				}
			} catch (e) {
				console.log(e);
			}
		}
		return isHivemindLike
	}
	
	async getCountForUser(userId) {
		console.log ('getCountForUser', userId)
		const mongoDatabase = this._mongoClient.db('hivemind')
		const contributionCountCollection = mongoDatabase.collection('contributionCount');
		const contributionCount = await contributionCountCollection.findOne({ userId: userId, app: 'discord'})
		if (contributionCount) {
			return contributionCount.count
		} else {
			return 0
		}
	}

	async onMessageCreate(message) {
		if((message.channelId == TEST_CHANNEL_ID || message.channelId == HIVE_CHANNEL_ID)
				&& message.author.username != this.name) {

			const isHivemindLike = await this.classifyAndRecord(message.content, message.author.id)
			if (isHivemindLike) {
				message.react('🐝')
			}
			
		}
		super.onMessageCreate(message)
	}

	async reply(message) {
		try { 
			let parsedInput = message.content.replace(/<@.*>\s/, '')
			if(message.content.indexOf(`!count`) > -1) {
				return await message.reply(`✨ ${(await this.getCountForUser(message.author.id))} ✨`)	
			}

			if(parsedInput.startsWith(`🐝`)) {
				parsedInput = message.content.replace(`🐝 `, '')
				// Check classifier to see if it's hivemind like 
				const isHivemindLike = await this.classifyAndRecord(parsedInput, message.author.id)
				if (!isHivemindLike) {
					return await message.react("🚫")

				} else {
					const replyText = await this.generateResponse(`Reply to "${message.content}"###`)
					console.log('Replying:', replyText)
					return await message.reply(`🐝${replyText} 🐝`)	
				}
			} else {
				const replyText = await this.generateResponse(`Reply to "${message.content}"###`)
				console.log('Replying:', message.content)
				return await message.reply(`${replyText}`)
			}
		} catch (e) {
			console.log('e')
		}
	}
}