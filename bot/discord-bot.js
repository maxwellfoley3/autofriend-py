const Discord = require('discord.js');
const config = require('../config.js')
const { tweetHasCompleteSentences, tweetHasMeaningfulWords, tweetPassesBadWordCheck } = require('./quality-filters.js')
const { repeatedlyQuery } = require('./helpers.js')

const MINUTE_LIMIT = 3;
const ONE_MINUTE = 1000 * 60;

module.exports = class DiscordBot {
	#client
	name
	gpt3Model
	replyFrequency
	#minuteCount

	constructor(name, gpt3Model, replyFrequency) {
		this.name = name
		this.gpt3Model = gpt3Model
		this.replyFrequency = replyFrequency
		this.#client = new Discord.Client({ intents: [Discord.GatewayIntentBits.Guilds, Discord.GatewayIntentBits.GuildMessages, Discord.GatewayIntentBits.MessageContent] });
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


	async reply(message) {
		try {
			this.checkAndUpdateMinuteCount()
			let validResponseFound = false
			let messageText = message.content
			messageText = messageText.replace(/<@.*>\s/, '')
			let responseText
			let attempts = 0
			console.log('Replying to', messageText)
			while(!validResponseFound && attempts < 6) {
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
						prompt: `Reply to "${messageText}"###`, 
						temperature: .9, 
						max_tokens: 54,
						stop: ['###']
					}
				})
				responseText = res.data.choices[0].text;
				console.log("Got gpt-3 response", responseText)
				validResponseFound = (await tweetHasCompleteSentences(responseText)) 
				&& (await tweetHasMeaningfulWords(responseText))
				&& tweetPassesBadWordCheck(responseText);
			}
			message.reply(responseText)
		} catch(e) {
			console.log('Error', e)
		}
	}
	
	async start() {
		this.#client.on('ready', () => {
			console.log(`Logged in as ${this.#client.user.tag}!`);
		 });
		 
		 this.#client.on('messageCreate', async message => {
			 console.log("Message!", message.content, message.author.username, message.mentions)
			 if (message.mentions.users.has(this.#client.user.id) || message.mentions.roles.has(this.#client.user.id)) {
				 try {
					 this.reply(message)
				 } catch(e) {
					 console.log('Reply failed:', e)
				 }
				 return
			 }
			 
			 if(message.author.username != this.name) {
				 // 1 in 20 chance
				 if(Math.random()*this.replyFrequency < 1) {
					 try {
						 this.reply(message)
					 } catch(e) {
						 console.log('Reply failed:', e)
					 }
				 }
			 }
		 
		 });
		 
		 // Log in our bot
		 this.#client.login(config.discord[this.name]);
	 
	}
}