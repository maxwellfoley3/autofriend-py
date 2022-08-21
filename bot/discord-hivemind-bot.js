const DiscordBot = require('./discord-bot')
const config = require('../config.js')
const { repeatedlyQuery } = require('./helpers')

const TEST_CHANNEL_ID = '1010978005683806269'

module.exports = class DiscordHivemindBot extends DiscordBot { 
	_mongoClient
	constructor(mongoClient, ...args) {
		console.log('DiscordHivemindBot.constructor')
		super(...args);
		this._mongoClient = mongoClient
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
		if(isHivemindLike) {
			try {
				const database = this._mongoClient.db('hivemind');
				const contributionCountCollection = database.collection('contributionCount');
				const contributionCount = await contributionCountCollection.findOne({ userId: userId, app: 'discord'})
				console.log('contributionCount', contributionCount)
				if (contributionCount == null) {
					contributionCountCollection.insertOne({ userId: userId, app: 'discord', count: 1 })
				} else {
					contributionCountCollection.updateOne({ userId: userId, app: 'discord'}, { $inc: { count: 1 }})
				}
	
				const contributions = database.collection('contributionCount');
				await contributions.insertOne({ text: text, userId: userId, app: 'discord' })
			} catch (e) {
				console.log(e);
			}
		}
		return isHivemindLike
	}
	
	async getCountForUser(userId) {
		console.log ('getCountForUser', userId)
		const database = this._mongoClient.db('hivemind');
		const contributionCountCollection = database.collection('contributionCount');
		const contributionCount = await contributionCountCollection.findOne({ userId: userId, app: 'discord'})
		if (contributionCount) {
			return contributionCount.count
		} else {
			return 0
		}
	}

	async onMessageCreate(message) {
		if(message.channelId == TEST_CHANNEL_ID && message.author.username != this.name) {
			if(message.content.startsWith(`!count`)) {
				return await message.reply(`✨ ${(await this.getCountForUser(message.author.id))} ✨`)	
			}
			else if(!message.content.startsWith(`!`)) {
				const isHivemindLike = await this.classifyAndRecord(message.content, message.author.id)
				if (isHivemindLike) {
					message.react('🐝')
				}
			}
		}
		super.onMessageCreate(message)
	}

	async reply(message) {
		try { 
			let parsedInput = message.content.replace(/<@.*>\s/, '')

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