const Discord = require('discord.js');
const config = require('../config.js')
const { tweetHasCompleteSentences, tweetHasMeaningfulWords, tweetPassesBadWordCheck } = require('./quality-filters.js')
const { repeatedlyQuery } = require('./helpers.js')

const MINUTE_LIMIT = 3;
const ONE_MINUTE = 1000 * 60;

const HIVE_CHANNEL_ID = '1011005608931102812'

module.exports = class DiscordBot {
	_client
	name
	gpt3Model
	replyFrequency
	#minuteCount

	constructor({ name, gpt3Model, replyFrequency }) {
		this.name = name
		this.gpt3Model = gpt3Model
		this.replyFrequency = replyFrequency
		this._client = new Discord.Client({ intents: [Discord.GatewayIntentBits.Guilds, Discord.GatewayIntentBits.GuildMessages, Discord.GatewayIntentBits.MessageContent] });
		this.#minuteCount = { minute: Date.now() % ONE_MINUTE, count: 0 }
	}

	checkAndUpdateMinuteCount() {
		const now = Date.now();
		if(now % ONE_MINUTE > this.#minuteCount.minute) {
			this.#minuteCount.minute = now & ONE_MINUTE;
			this.#minuteCount.count = 0;
		}
		this.#minuteCount.count++;
		if(this.#minuteCount.count > MINUTE_LIMIT) {
			throw "Minute limit reached!";
		}
	}


	async generateResponse(prompt) {	
		let validTweetFound = false;
		let responseText = '';
		let attempts = 0;
		while(!validTweetFound && attempts < 6) {
			attempts++;
			const res = await repeatedlyQuery({
				method: 'post',
				url: 'https://api.openai.com/v1/completions',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': 'Bearer ' + config.openAiApiKey,
				}, 
				data: {
					model: this.gpt3Model, 
					prompt,
					temperature: .9, 
					max_tokens: 54,
					stop: ['###']
				}
			})
			console.log("Got gpt-3 response", responseText)
			responseText = res.data.choices[0].text;
			validTweetFound = (await tweetHasCompleteSentences(responseText)) 
			&& (await tweetHasMeaningfulWords(responseText))
			&& tweetPassesBadWordCheck(responseText)
		}
		return responseText
	}

	async reply(message) {
		try {
			let messageText = message.content
			let responseText = await this.generateResponse(messageText.replace(/<@.*>\s/, ''))
			message.reply(responseText)
		} catch(e) {
			console.log('Error', e)
		}
	}

	async onMessageCreate(message) {
		console.log("Message!", message.content, message.author.username, message.mentions)
		if (message.mentions.users.has(this._client.user.id) || message.mentions.roles.has(this._client.user.id)) {
			try {
				if (message.author.bot) {
					// only 50/50 chance of responding to bots
					if (Math.random()*2 < 1) {
						await this.reply(message)
					}
				} 
				else {
					await this.reply(message)
				}
			} catch(e) {
				console.log('Reply failed:', e)
			}
			return
		}
		
		if(message.channelId == HIVE_CHANNEL_ID && message.author.username != this.name) {
			// 1 in 20 chance
			if(Math.random() * this.replyFrequency < 1) {
				try {
					this.reply(message)
				} catch(e) {
					console.log('Reply failed:', e)
				}
			}
		}
	}
	
	async start() {
		this._client.on('ready', () => {
			console.log(`Logged in as ${this._client.user.tag}!`);
		 });
		 
		 this._client.on('messageCreate', this.onMessageCreate.bind(this));
		 
		 // Log in our bot
		 this._client.login(config.discord[this.name]);
	 
	}
}